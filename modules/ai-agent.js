/*
 * MyBusiness local agent layer.
 *
 * Qwen is used for language generation/ambiguous requests. This layer is
 * intentionally deterministic for common business commands so the small
 * Qwen 0.6B model does not have to guess Firestore operations.
 * It never changes the existing data model and uses the existing Firestore
 * helpers exposed by app.js.
 */

const money = v => window.formatCurrency ? window.formatCurrency(Number(v) || 0) : `Rs. ${Number(v || 0).toLocaleString()}`;
const norm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[؟?!.،,]/g, ' ').replace(/\s+/g, ' ').trim();
const numberFrom = s => {
  const m = String(s || '').replace(/,/g, '').match(/(?:rs\.?\s*)?(-?\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : NaN;
};
const qtyFrom = s => {
  const m = String(s || '').match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:x|pcs?|pieces?|units?|item|items|qty|quantity)?(?:\s|$)/i);
  return m ? Math.max(1, Math.floor(Number(m[1]))) : 1;
};
function findByName(list, name) {
  const q = norm(name);
  if (!q) return null;
  const exact = list.find(x => norm(x.name) === q);
  if (exact) return exact;
  return list.find(x => norm(x.name).includes(q) || q.includes(norm(x.name))) || null;
}
function names(list, max=30){ return list.slice(0,max).map(x=>x.name).filter(Boolean).join(', '); }
function requireUser(){ if(!window.currentUserId) throw new Error('Please log in again before using the AI agent.'); }
function confirmText(action){
  window.__myBusinessAiPending = action;
  return `${action.summary}\n\nConfirm? Reply “yes” to perform it or “no” to cancel.`;
}
function isYes(s){ return /^(yes|y|haan|han|جی|ہاں|ok|okay|confirm|kar do|kardo|do it)$/i.test(norm(s)); }
function isNo(s){ return /^(no|n|nah|nahi|نہیں|cancel|cancel it|mat karo|rehne do)$/i.test(norm(s)); }

async function execute(action){
  requireUser();
  const db=window.db, doc=window.doc, collection=window.collection;
  if(action.type==='addStock' || action.type==='removeStock'){
    const ref=doc(db,'products',action.product.id);
    await window.runAtomicOrOffline(async tx=>{
      const snap=await tx.get(ref); if(!snap.exists()) throw new Error('Product no longer exists.');
      if(snap.data().ownerId!==window.currentUserId) throw new Error('Unauthorized product.');
      const current=Math.max(0,Number(snap.data().stock)||0);
      const next=action.type==='addStock' ? current+action.qty : current-action.qty;
      if(next<0) throw new Error(`Not enough stock. Current stock is ${current}.`);
      tx.update(ref,{stock:next,updatedAt:new Date().toISOString()});
      const ar=doc(collection(db,'stockAdjustments'));
      tx.set(ar,{ownerId:window.currentUserId,productId:action.product.id,type:action.type==='addStock'?'add':'remove',quantity:action.qty,date:new Date().toISOString(),note:'AI agent'});
    });
    return `${action.product.name}: stock ${action.type==='addStock'?'increased':'decreased'} by ${action.qty}. New stock: ${Math.max(0,Number(action.product.stock)||0)+(action.type==='addStock'?action.qty:-action.qty)}.`;
  }
  if(action.type==='receiveCustomer' || action.type==='giveCustomer'){
    const ref=doc(db,'customers',action.customer.id), tr=doc(collection(db,'customerTransactions'));
    await window.runAtomicOrOffline(async tx=>{
      const snap=await tx.get(ref); if(!snap.exists()) throw new Error('Customer no longer exists.');
      if(snap.data().ownerId!==window.currentUserId) throw new Error('Unauthorized customer.');
      const current=Math.max(0,Number(snap.data().balance)||0);
      const next=action.type==='receiveCustomer' ? Math.max(0,current-action.amount) : current+action.amount;
      if(next<0) throw new Error('Amount exceeds customer due.');
      tx.update(ref,{balance:next,updatedAt:new Date().toISOString()});
      tx.set(tr,{ownerId:window.currentUserId,customerId:action.customer.id,type:action.type==='receiveCustomer'?'payment':'manual_debt',amount:action.amount,amountPaid:action.type==='receiveCustomer'?action.amount:0,debitAmount:action.type==='receiveCustomer'?0:action.amount,creditAmount:action.type==='receiveCustomer'?action.amount:0,balanceAfter:next,date:new Date().toISOString(),note:'AI agent',createdBy:window.authUserId||window.currentUserId});
    });
    return `${money(action.amount)} ${action.type==='receiveCustomer'?'received from':'added to'} ${action.customer.name}. New due: ${money(Math.max(0,Number(action.customer.balance)||0)+(action.type==='receiveCustomer'?-action.amount:action.amount))}.`;
  }
  if(action.type==='addCustomer'){
    const ref=doc(collection(db,'customers'));
    await window.addDoc(collection(db,'customers'),{name:action.name,phone:action.phone||'',address:'',notes:'',dueDate:null,balance:0,createdAt:new Date().toISOString(),ownerId:window.currentUserId});
    return `Customer “${action.name}” added successfully.`;
  }
  if(action.type==='addProduct'){
    await window.addDoc(collection(db,'products'),{name:action.name,barcode:action.barcode||'',cost:action.cost,price:action.wholesalePrice,wholesalePrice:action.wholesalePrice,retailPrice:action.retailPrice,minStock:action.minStock||5,stock:action.stock||0,ownerId:window.currentUserId});
    return `Product “${action.name}” added with stock ${action.stock||0}.`;
  }
  if(action.type==='supplierPayment' || action.type==='supplierDebt'){
    const ref=doc(db,'suppliers',action.supplier.id), tr=doc(collection(db,'supplierTransactions'));
    await window.runAtomicOrOffline(async tx=>{
      const snap=await tx.get(ref); if(!snap.exists()) throw new Error('Supplier no longer exists.');
      if(snap.data().ownerId!==window.currentUserId) throw new Error('Unauthorized supplier.');
      const current=Math.max(0,Number(snap.data().balance)||0);
      const next=action.type==='supplierPayment'?Math.max(0,current-action.amount):current+action.amount;
      if(action.type==='supplierPayment' && action.amount>current) throw new Error(`Payment exceeds supplier payable of ${money(current)}.`);
      tx.update(ref,{balance:next});
      tx.set(tr,{ownerId:window.currentUserId,supplierId:action.supplier.id,type:action.type==='supplierPayment'?'payment':'manual_debt',amount:action.amount,balanceAfter:next,date:new Date().toISOString(),note:'AI agent'});
    });
    return `${money(action.amount)} ${action.type==='supplierPayment'?'paid to':'added as payable to'} ${action.supplier.name}. New payable: ${money(action.type==='supplierPayment'?Math.max(0,Number(action.supplier.balance||0)-action.amount):Number(action.supplier.balance||0)+action.amount)}.`;
  }
  if(action.type==='expense'){
    await window.addDoc(collection(db,'expenses'),{amount:action.amount,date:new Date().toISOString(),category:action.category||'AI expense',note:action.note||'Added by AI agent',ownerId:window.currentUserId});
    return `Expense of ${money(action.amount)} recorded${action.category?` under ${action.category}`:''}.`;
  }
  throw new Error('Unsupported agent action.');
}

function parseCommand(input){
  const s=norm(input), data=window.data||{};
  const products=data.products||[], customers=data.customers||[], suppliers=data.suppliers||[];
  const findMentioned=(list)=>list.find(x=>x.name && (s===norm(x.name) || s.includes(norm(x.name))));
  const qty=Math.max(1, Math.floor(numberFrom(s) || qtyFrom(s) || 1));

  // Read commands.
  const mentionedProduct=findMentioned(products);
  if(mentionedProduct && /(?:stock|inventory|سٹاک|اسٹاک)/i.test(s) && !/(?:add|increase|remove|decrease|put|dal|daal|jama|kam|اضاف|کم|منہا|نکال)/i.test(s)){
    return {kind:'answer',text:`${mentionedProduct.name}: current stock ${Number(mentionedProduct.stock)||0}.`};
  }
  if(/(?:low stock|low inventory|kam stock|کم اسٹاک|کم سٹاک)/i.test(s)){
    const low=products.filter(p=>Number(p.stock||0)<=Number(p.minStock||5));
    return {kind:'answer',text:low.length?`Low stock: ${low.map(p=>`${p.name} (${p.stock})`).join(', ')}`:'No low-stock products found.'};
  }
  if(/(?:all products|products list|product list|تمام پروڈکٹس|پروڈکٹس دکھاؤ)/i.test(s)){
    return {kind:'answer',text:products.length?products.map(p=>`${p.name}: ${p.stock} in stock`).join('\n'):'No products found.'};
  }
  const mentionedCustomer=findMentioned(customers);
  if(/(?:customer|گاہک).*(?:balance|due|debt|udhaar|ادھار|واجب)|(?:balance|due|debt|udhaar|ادھار|واجب).*(?:customer|گاہک)/i.test(s)){
    if(mentionedCustomer)return {kind:'answer',text:`${mentionedCustomer.name}: due ${money(mentionedCustomer.balance||0)}.`};
    const due=customers.filter(c=>Number(c.balance||0)>0); return {kind:'answer',text:due.length?due.map(c=>`${c.name}: ${money(c.balance)}`).join('\n'):'No customer dues found.'};
  }
  if(/(?:sales|sale|فروخت|سیل).*(?:today|aaj|آج)|(?:today|aaj|آج).*(?:sales|sale|فروخت|سیل)/i.test(s)){
    const today=window.getLocalDateStr?window.getLocalDateStr(new Date()):new Date().toISOString().slice(0,10);
    const rows=(data.sales||[]).filter(x=>String(x.date||'').slice(0,10)===today), total=rows.reduce((a,x)=>a+Number(x.total||0),0);
    return {kind:'answer',text:`Today's sales: ${rows.length} sale(s), total ${money(total)}.`};
  }
  if(/(?:profit|منافع|منافعہ).*(?:today|aaj|آج)|(?:today|aaj|آج).*(?:profit|منافع|منافعہ)/i.test(s)){
    const today=window.getLocalDateStr?window.getLocalDateStr(new Date()):new Date().toISOString().slice(0,10);
    const rows=(data.sales||[]).filter(x=>String(x.date||'').slice(0,10)===today), profit=rows.reduce((a,x)=>a+Number(x.totalProfit||0),0);
    return {kind:'answer',text:`Today's recorded profit: ${money(profit)}.`};
  }

  // Stock adjustments. Resolve the product by name from the user's actual data.
  if(mentionedProduct && /(?:add|increase|put|dal|daal|jama|جمع|اضافہ|شامل)/i.test(s) && /(?:stock|اسٹاک|سٹاک|pcs?|pieces?|items?|units?|پیس|عدد)/i.test(s)){
    return {kind:'confirm',action:{type:'addStock',product:mentionedProduct,qty,summary:`Add ${qty} to ${mentionedProduct.name} stock? Current stock: ${mentionedProduct.stock}.`}};
  }
  if(mentionedProduct && /(?:remove|decrease|minus|kam|kamm|nikal|کم|منہا|نکال)/i.test(s) && /(?:stock|اسٹاک|سٹاک|pcs?|pieces?|items?|units?|پیس|عدد)/i.test(s)){
    return {kind:'confirm',action:{type:'removeStock',product:mentionedProduct,qty,summary:`Remove ${qty} from ${mentionedProduct.name} stock? Current stock: ${mentionedProduct.stock}.`}};
  }

  // Customer Khata actions.
  if(mentionedCustomer && /(?:receive|received|got|wapas|wasool|لیا|وصول|وصولی|وصول کیے)/i.test(s)){
    if(Number.isFinite(numberFrom(s)))return {kind:'confirm',action:{type:'receiveCustomer',customer:mentionedCustomer,amount:numberFrom(s),summary:`Receive ${money(numberFrom(s))} from ${mentionedCustomer.name}? Current due: ${money(mentionedCustomer.balance||0)}.`}};
  }
  if(mentionedCustomer && /(?:give|gave|credit|udhaar|add debt|دیا|ادھار|واجب)/i.test(s)){
    if(Number.isFinite(numberFrom(s)))return {kind:'confirm',action:{type:'giveCustomer',customer:mentionedCustomer,amount:numberFrom(s),summary:`Add ${money(numberFrom(s))} to ${mentionedCustomer.name}'s due? Current due: ${money(mentionedCustomer.balance||0)}.`}};
  }

  // Supplier actions.
  const mentionedSupplier=findMentioned(suppliers);
  if(mentionedSupplier && /(?:pay|paid|payment|ادا|ادائیگی)/i.test(s) && Number.isFinite(numberFrom(s))){
    return {kind:'confirm',action:{type:'supplierPayment',supplier:mentionedSupplier,amount:numberFrom(s),summary:`Pay ${money(numberFrom(s))} to ${mentionedSupplier.name}? Current payable: ${money(mentionedSupplier.balance||0)}.`}};
  }
  if(mentionedSupplier && /(?:credit|debt|udhaar|purchase debt|ادھار|واجب)/i.test(s) && Number.isFinite(numberFrom(s))){
    return {kind:'confirm',action:{type:'supplierDebt',supplier:mentionedSupplier,amount:numberFrom(s),summary:`Add ${money(numberFrom(s))} payable to ${mentionedSupplier.name}? Current payable: ${money(mentionedSupplier.balance||0)}.`}};
  }

  // Create customer. Keep it intentionally conservative: only a clearly named customer is created.
  if(/(?:add|create|new|بناؤ|بنائیں|شامل).*(?:customer|گاہک)/i.test(s)){
    let name=s.replace(/.*?(?:customer|گاہک)\s*(?:named|name|کا نام|نام)?/i,'').replace(/(?:phone|number|فون|نمبر).*$/i,'').trim();
    if(name)return {kind:'confirm',action:{type:'addCustomer',name,summary:`Create customer “${name}”?`}};
  }
  if(/(?:expense|خرچہ|اخراجات)/i.test(s) && Number.isFinite(numberFrom(s))){
    const amount=numberFrom(s); return {kind:'confirm',action:{type:'expense',amount,category:'AI expense',note:input,summary:`Record an expense of ${money(amount)}?`}};
  }
  return null;
}

export async function handleAgentCommand(input){
  const text=String(input||'').trim();
  if(!text) return {handled:true,text:'Please enter a command.'};
  if(window.__myBusinessAiPending){
    const pending=window.__myBusinessAiPending;
    if(isYes(text)){ window.__myBusinessAiPending=null; try{return {handled:true,text:await execute(pending)};}catch(e){return {handled:true,text:`I could not complete that task: ${e.message||e}`};} }
    if(isNo(text)){window.__myBusinessAiPending=null;return {handled:true,text:'Cancelled. No changes were made.'};}
  }
  const parsed=parseCommand(text);
  if(parsed?.kind==='answer') return {handled:true,text:parsed.text};
  if(parsed?.kind==='confirm') return {handled:true,text:confirmText(parsed.action)};
  return {handled:false};
}

export function agentContext(){
  const d=window.data||{};
  return `Business context: ${d.products?.length||0} products, ${d.customers?.length||0} customers, ${d.suppliers?.length||0} suppliers. Product names: ${names(d.products||[],20)}. Customer names: ${names(d.customers||[],20)}. Supplier names: ${names(d.suppliers||[],20)}. User language: ${document.documentElement.lang||'en'}.`;
}
