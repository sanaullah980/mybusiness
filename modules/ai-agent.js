/*
 * MyBusiness local agent layer.
 *
 * Qwen is used for language generation/ambiguous requests. This layer is
 * intentionally deterministic for common business commands so the small
 * Qwen 0.6B model does not have to guess Firestore operations.
 * It never changes the existing data model and uses the existing Firestore
 * helpers exposed by app.js.
 *
 * ---------------------------------------------------------------------
 * ADDING NEW WORDS: all trigger words live in the WORDS object below,
 * grouped by action. To teach the agent a new phrase, add it to the
 * relevant array (English / Roman Urdu / Urdu script all mixed together
 * is fine) — you do not need to touch the regex logic further down.
 * ---------------------------------------------------------------------
 */

const WORDS = {
  // Money received from a customer (their due goes DOWN).
  receiveCustomer: ['receive','received','receiving','collect','collected','got','get','wapas','wapis','wasool','wasol','vasol','liya','le liya',' le lia','mil gaya','mil gaye','mila','mile','aa gaya','aa gaye','paisay mil gaye','paise mil gaye','وصول','وصولی','لیا','ملا','ملے','آ گئے'],
  // Money/goods given on credit to a customer (their due goes UP).
  giveCustomer: ['give','gave','giving','credit','add debt','owe','owes','udhaar','udhar','qarz','diya','de diya','de dia','da do','dado','dade','dedo','de do','دیا','ادھار','واجب','قرض'],
  // Stock increases.
  addStock: ['add','increase','increasing','put','restock','refill','dal','daal','dal do','daal do','jama','jama karo','barha do','barhao','barhado','جمع','اضافہ','شامل','بڑھاؤ'],
  // Stock decreases.
  removeStock: ['remove','decrease','decreasing','minus','reduce','reducing','deduct','kam','kamm','nikal','nikal do','nikalo','ghata do','ghatao','ghatado','کم','منہا','نکال','گھٹاؤ'],
  // Supplier payments made (their payable goes DOWN).
  supplierPayment: ['pay','paid','paying','payment','ada','ada kiya','ada kar diya','ادا','ادائیگی'],
  // Supplier credit/debt taken (their payable goes UP).
  supplierDebt: ['credit','debt','owe','owes','udhaar','udhar','qarz','purchase debt','ادھار','واجب','قرض'],
  // Expenses.
  expense: ['expense','expenses','spent','spend','cost','kharcha','kharch','kharcha kiya','kharch kiya','خرچہ','اخراجات','خرچ'],
  // New customer creation.
  addCustomer: ['add','create','new','banao','banayen','بناؤ','بنائیں','شامل'],
  // Selling a product to a customer (or walk-in).
  sellProduct: ['sale karo','sell karo','sale kr do','sale kro','sale kar do','becho','bech do','farokht karo','sell it','make a sale','فروخت کرو','بیچو','بیچ دو'],
};

// Roman/Urdu number words for amounts written as text instead of digits
// (e.g. "panch sau" = 500, "do hazar" = 2000). Digits (numberFrom) are
// always tried first; this is only a fallback.
const UNIT_WORDS = {ek:1,aik:1,do:2,teen:3,char:4,chaar:4,panch:5,paanch:5,chay:6,che:6,chhay:6,saat:7,aath:8,nau:9,das:10,gyara:11,barah:12,pandra:15,bees:20,pachas:50,sattar:70,assi:80};

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
// Fallback for amounts spelled out in Roman Urdu words, e.g. "panch sau" (500),
// "ek hazar" (1000), "do hazar panch sau" (2500). Tried only when no digits found.
function numberFromWords(s){
  let total = 0, matched = false;
  const hazarMatch = s.match(/(\w+)?\s*(?:hazar|hazaar)/);
  if (hazarMatch) { const n = hazarMatch[1] ? (UNIT_WORDS[hazarMatch[1]] ?? numberFrom(hazarMatch[1])) : 1; if (n) { total += n * 1000; matched = true; } }
  const sauMatch = s.match(/(\w+)?\s*sau/);
  if (sauMatch) { const n = sauMatch[1] ? (UNIT_WORDS[sauMatch[1]] ?? numberFrom(sauMatch[1])) : 1; if (n) { total += n * 100; matched = true; } }
  return matched ? total : NaN;
}
function amountFrom(s){
  const n = numberFrom(s);
  return Number.isFinite(n) ? n : numberFromWords(s);
}
// Builds a case-insensitive alternation regex from a word list, e.g. WORDS.receiveCustomer.
function rx(words){ return new RegExp('(?:' + words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*')).join('|') + ')', 'i'); }

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
  }
  return dp[a.length][b.length];
}
// Finds an item from `list` mentioned inside sentence `s`. Tries an exact/substring
// match first (fast, zero false positives), then falls back to a fuzzy match so a
// small typo ("Alli" for "Ali") still resolves instead of silently failing.
function mentionedFrom(list, s) {
  const exact = list.find(x => x.name && (s === norm(x.name) || s.includes(norm(x.name))));
  if (exact) return exact;
  const words = s.split(' ');
  let best = null, bestDist = Infinity;
  for (const x of list) {
    if (!x.name) continue;
    const name = norm(x.name);
    const nameWordCount = name.split(' ').length;
    for (let i = 0; i < words.length; i++) {
      const window = words.slice(i, i + nameWordCount).join(' ');
      if (!window) continue;
      const d = levenshtein(window, name);
      const limit = Math.max(1, Math.floor(name.length * 0.25));
      if (d <= limit && d < bestDist) { bestDist = d; best = x; }
    }
  }
  return best;
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
  if(action.type==='sellProduct'){
    const productRef=doc(db,'products',action.product.id);
    const customerRef=action.customer?doc(db,'customers',action.customer.id):null;
    let resultText='';
    await window.runAtomicOrOffline(async tx=>{
      const productSnap=await tx.get(productRef);
      if(!productSnap.exists()) throw new Error('Product no longer exists.');
      const p=productSnap.data();
      if(p.ownerId!==window.currentUserId) throw new Error('Unauthorized product.');
      const stock=Number(p.stock)||0;
      if(action.qty>stock) throw new Error(`Not enough stock. Available: ${stock}.`);
      const unit=action.saleType==='retail'?Number(p.retailPrice??p.price??0):Number(p.wholesalePrice??p.price??0);
      const cost=Number(p.cost||0), total=unit*action.qty, totalProfit=(unit-cost)*action.qty;
      let newBalance=0;
      if(customerRef){
        const customerSnap=await tx.get(customerRef);
        if(!customerSnap.exists()) throw new Error('Customer no longer exists.');
        if(customerSnap.data().ownerId!==window.currentUserId) throw new Error('Unauthorized customer.');
        newBalance=Math.max(0,Number(customerSnap.data().balance)||0)+total;
      }
      const nums=(window.data?.sales||[]).map(x=>parseInt(x.invoiceNumber,10)).filter(Number.isFinite);
      const billNumber=Math.max(0,...nums)+1;
      const saleRef=doc(collection(db,'sales'));
      tx.update(productRef,{stock:stock-action.qty});
      tx.set(saleRef,{ownerId:window.currentUserId,createdBy:window.authUserId||window.currentUserId,createdByName:window.currentMemberName||'Business Owner',customerId:action.customer?action.customer.id:null,customerName:action.customer?action.customer.name:'Walk-in',saleType:action.saleType,date:new Date().toISOString(),items:[{id:action.product.id,name:action.product.name,price:unit,cost,qty:action.qty,returnedQty:0}],subtotal:total,discount:0,discountType:'amount',total,amountPaid:0,amountDue:total,totalProfit,profitKnown:true,note:'AI agent',returnedAmount:0,returnedProfit:0,invoiceNumber:billNumber});
      if(customerRef){
        tx.update(customerRef,{balance:newBalance,updatedAt:new Date().toISOString()});
        const txnRef=doc(collection(db,'customerTransactions'));
        tx.set(txnRef,{ownerId:window.currentUserId,customerId:action.customer.id,type:'sale_debt',amount:total,amountPaid:0,debitAmount:total,creditAmount:0,balanceAfter:newBalance,date:new Date().toISOString(),note:`Bill No. ${billNumber}`,billNo:String(billNumber),saleId:saleRef.id,createdBy:window.authUserId||window.currentUserId});
      }
      tx.set(doc(db,'settings',window.currentUserId),{nextInvoiceNumber:billNumber+1},{merge:true});
      resultText=`Sold ${action.qty} x ${action.product.name} ${action.customer?`to ${action.customer.name} (added ${money(total)} to their due)`:`to Walk-in customer for ${money(total)}`}.`;
    });
    return resultText;
  }
  throw new Error('Unsupported agent action.');
}

function parseCommand(input){
  const s=norm(input), data=window.data||{};
  const products=data.products||[], customers=data.customers||[], suppliers=data.suppliers||[];
  const findMentioned=(list)=>mentionedFrom(list, s);
  const qty=Math.max(1, Math.floor(numberFrom(s) || numberFromWords(s) || qtyFrom(s) || 1));

  // Read commands.
  const mentionedProduct=findMentioned(products);
  if(mentionedProduct && /(?:stock|inventory|سٹاک|اسٹاک)/i.test(s) && !rx(WORDS.addStock.concat(WORDS.removeStock)).test(s)){
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
  // Debt/balance question naming a specific customer directly (no amount attached,
  // so it isn't confused with a give/receive command like "abdullah ko 500 udhaar do").
  if(mentionedCustomer && /(?:balance|due|debt|kitna|kitne|how much|what is|واجب|کتنا|کتنے)/i.test(s) && !Number.isFinite(amountFrom(s))){
    return {kind:'answer',text:`${mentionedCustomer.name}: due ${money(mentionedCustomer.balance||0)}.`};
  }
  if(/(?:customer|گاہک).*(?:balance|due|debt|udhaar|ادھار|واجب)|(?:balance|due|debt|udhaar|ادھار|واجب).*(?:customer|گاہک)/i.test(s)){
    if(mentionedCustomer)return {kind:'answer',text:`${mentionedCustomer.name}: due ${money(mentionedCustomer.balance||0)}.`};
    const due=customers.filter(c=>Number(c.balance||0)>0); return {kind:'answer',text:due.length?due.map(c=>`${c.name}: ${money(c.balance)}`).join('\n'):'No customer dues found.'};
  }
  // Compares each sale's date in LOCAL time (matching getLocalDateStr's own local
  // getFullYear/getMonth/getDate) rather than slicing the raw UTC ISO string —
  // otherwise anything sold after midnight local time is miscounted as "yesterday"
  // whenever local time is ahead of UTC (e.g. Pakistan, UTC+5).
  if(/(?:sales|sale|فروخت|سیل).*(?:today|aaj|آج)|(?:today|aaj|آج).*(?:sales|sale|فروخت|سیل)/i.test(s)){
    const today=window.getLocalDateStr?window.getLocalDateStr(new Date()):new Date().toISOString().slice(0,10);
    const localDate=x=>window.getLocalDateStr?window.getLocalDateStr(new Date(x)):String(x||'').slice(0,10);
    const rows=(data.sales||[]).filter(x=>localDate(x.date)===today), total=rows.reduce((a,x)=>a+Number(x.total||0),0);
    return {kind:'answer',text:`Today's sales: ${rows.length} sale(s), total ${money(total)}.`};
  }
  if(/(?:profit|منافع|منافعہ).*(?:today|aaj|آج)|(?:today|aaj|آج).*(?:profit|منافع|منافعہ)/i.test(s)){
    const today=window.getLocalDateStr?window.getLocalDateStr(new Date()):new Date().toISOString().slice(0,10);
    const localDate=x=>window.getLocalDateStr?window.getLocalDateStr(new Date(x)):String(x||'').slice(0,10);
    const rows=(data.sales||[]).filter(x=>localDate(x.date)===today), profit=rows.reduce((a,x)=>a+Number(x.totalProfit||0),0);
    return {kind:'answer',text:`Today's recorded profit: ${money(profit)}.`};
  }

  // Selling a product. Defaults to wholesale price and, when a customer is named,
  // records the full amount as due (unpaid) against them — settle it later with a
  // "received" command, same as a normal khata sale. No customer named = Walk-in.
  if(mentionedProduct && rx(WORDS.sellProduct).test(s)){
    const stock=Number(mentionedProduct.stock)||0;
    if(qty>stock) return {kind:'answer',text:`Not enough stock for ${mentionedProduct.name}. Available: ${stock}.`};
    const unit=Number(mentionedProduct.wholesalePrice ?? mentionedProduct.price ?? 0), total=unit*qty;
    const customerPart=mentionedCustomer?`to ${mentionedCustomer.name} (added to their due)`:'to Walk-in customer';
    return {kind:'confirm',action:{type:'sellProduct',product:mentionedProduct,customer:mentionedCustomer||null,qty,saleType:'wholesale',summary:`Sell ${qty} x ${mentionedProduct.name} ${customerPart} at wholesale price (${money(unit)} each) = ${money(total)}?`}};
  }

  // Stock adjustments. Resolve the product by name from the user's actual data.
  if(mentionedProduct && rx(WORDS.addStock).test(s) && /(?:stock|اسٹاک|سٹاک|pcs?|pieces?|items?|units?|پیس|عدد)/i.test(s)){
    return {kind:'confirm',action:{type:'addStock',product:mentionedProduct,qty,summary:`Add ${qty} to ${mentionedProduct.name} stock? Current stock: ${mentionedProduct.stock}.`}};
  }
  if(mentionedProduct && rx(WORDS.removeStock).test(s) && /(?:stock|اسٹاک|سٹاک|pcs?|pieces?|items?|units?|پیس|عدد)/i.test(s)){
    return {kind:'confirm',action:{type:'removeStock',product:mentionedProduct,qty,summary:`Remove ${qty} from ${mentionedProduct.name} stock? Current stock: ${mentionedProduct.stock}.`}};
  }

  // Customer Khata actions. "udhaar/udhar" always means credit (give), even if a
  // receive-style word like "liya" also appears (e.g. "udhaar liya" = took on credit).
  if(mentionedCustomer && rx(WORDS.receiveCustomer).test(s) && !rx(WORDS.giveCustomer.filter(w=>/udhaar|udhar|ادھار/.test(w))).test(s)){
    const amt=amountFrom(s);
    if(Number.isFinite(amt))return {kind:'confirm',action:{type:'receiveCustomer',customer:mentionedCustomer,amount:amt,summary:`Receive ${money(amt)} from ${mentionedCustomer.name}? Current due: ${money(mentionedCustomer.balance||0)}.`}};
  }
  if(mentionedCustomer && rx(WORDS.giveCustomer).test(s)){
    const amt=amountFrom(s);
    if(Number.isFinite(amt))return {kind:'confirm',action:{type:'giveCustomer',customer:mentionedCustomer,amount:amt,summary:`Add ${money(amt)} to ${mentionedCustomer.name}'s due? Current due: ${money(mentionedCustomer.balance||0)}.`}};
  }

  // Supplier actions.
  const mentionedSupplier=findMentioned(suppliers);
  if(mentionedSupplier && rx(WORDS.supplierPayment).test(s)){
    const amt=amountFrom(s);
    if(Number.isFinite(amt))return {kind:'confirm',action:{type:'supplierPayment',supplier:mentionedSupplier,amount:amt,summary:`Pay ${money(amt)} to ${mentionedSupplier.name}? Current payable: ${money(mentionedSupplier.balance||0)}.`}};
  }
  if(mentionedSupplier && rx(WORDS.supplierDebt).test(s)){
    const amt=amountFrom(s);
    if(Number.isFinite(amt))return {kind:'confirm',action:{type:'supplierDebt',supplier:mentionedSupplier,amount:amt,summary:`Add ${money(amt)} payable to ${mentionedSupplier.name}? Current payable: ${money(mentionedSupplier.balance||0)}.`}};
  }

  // Create customer. Keep it intentionally conservative: only a clearly named customer is created.
  if(rx(WORDS.addCustomer).test(s) && /(?:customer|گاہک)/i.test(s)){
    let name=s.replace(/.*?(?:customer|گاہک)\s*(?:named|name|banao|banayen|کا نام|نام|بناؤ|بنائیں)?/i,'').replace(/(?:phone|number|فون|نمبر).*$/i,'').trim();
    if(name)return {kind:'confirm',action:{type:'addCustomer',name,summary:`Create customer “${name}”?`}};
  }
  if(rx(WORDS.expense).test(s)){
    const amt=amountFrom(s);
    if(Number.isFinite(amt))return {kind:'confirm',action:{type:'expense',amount:amt,category:'AI expense',note:input,summary:`Record an expense of ${money(amt)}?`}};
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