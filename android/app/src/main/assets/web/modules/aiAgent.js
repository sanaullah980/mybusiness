/* MyBusiness Offline AI Agent
 * Browser-safe controller. Android local Qwen3 is provided by window.AndroidQwen.
 * The model can only emit validated JSON tool requests; it never receives Firebase credentials.
 */
const AI_TOOLS = {
  search_products:{description:'Find products by name or barcode.',required:['query'],write:false},
  get_product:{description:'Get one exact product by id or unique name.',required:['query'],write:false},
  get_low_stock_products:{description:'List products at or below their minimum stock.',required:[],write:false},
  search_customers:{description:'Find customers by name or phone.',required:['query'],write:false},
  get_customer_balance:{description:'Get the current balance for one unique customer.',required:['customer'],write:false},
  search_suppliers:{description:'Find suppliers by name or phone.',required:['query'],write:false},
  get_supplier_balance:{description:'Get the current payable balance for one unique supplier.',required:['supplier'],write:false},
  get_today_sales:{description:'List today\'s sales.',required:[],write:false},
  get_sales_summary:{description:'Summarize sales for a date or date range.',required:['from','to'],write:false},
  get_purchase_summary:{description:'Summarize stock purchases for a date or date range.',required:['from','to'],write:false},
  get_cashbook_summary:{description:'Summarize cashbook income and expenses for a date or date range.',required:['from','to'],write:false},
  get_expense_summary:{description:'Summarize expenses for a date or date range.',required:['from','to'],write:false},
  get_stock_summary:{description:'Summarize current inventory.',required:[],write:false},
  add_product:{description:'Add a new product.',required:['name','cost','wholesalePrice','retailPrice','stock'],write:true},
  update_product:{description:'Update an existing product by exact id.',required:['id'],write:true},
  add_stock:{description:'Add stock to an existing product.',required:['product','quantity'],write:true},
  create_sale:{description:'Create a normal wholesale or retail sale using existing products.',required:['items','saleType','amountPaid'],write:true},
  create_credit_sale:{description:'Create a sale with an outstanding customer amount.',required:['customer','items','saleType','amountPaid'],write:true},
  receive_customer_payment:{description:'Record money received from an existing customer.',required:['customer','amount'],write:true},
  record_customer_credit:{description:'Record an amount given/credited to an existing customer.',required:['customer','amount'],write:true},
  create_purchase:{description:'Record a stock purchase using existing products or manual items.',required:['items','amountPaid'],write:true},
  record_supplier_payment:{description:'Record a payment to an existing supplier.',required:['supplier','amount'],write:true},
  record_expense:{description:'Record a business expense.',required:['amount','category'],write:true}
};

const WRITE_TOOLS = new Set(Object.entries(AI_TOOLS).filter(([,v])=>v.write).map(([k])=>k));
const MODEL_NAME='Qwen3 0.6B Q4_0';
let pendingWrite=null, busy=false, chat=[];

function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#39;'}[c]||c));}
function money(v){return window.formatCurrency?window.formatCurrency(Number(v)||0):`Rs. ${Number(v||0).toLocaleString()}`;}
function dateStr(d=new Date()){return new Date(d).toISOString().slice(0,10);}
function stripThink(s){return String(s||'').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();}
function extractJson(s){
  s=stripThink(s).replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const start=s.indexOf('{'); if(start<0)return null;
  let depth=0,inStr=false,escp=false;
  for(let i=start;i<s.length;i++){
    const c=s[i];
    if(inStr){if(escp)escp=false;else if(c==='\\')escp=true;else if(c==='"')inStr=false;continue;}
    if(c==='"'){inStr=true;continue;} if(c==='{')depth++; if(c==='}'&&!--depth){try{return JSON.parse(s.slice(start,i+1));}catch{return null;}}
  } return null;
}
function uniqueByName(arr,query){const q=String(query||'').trim().toLowerCase(); if(!q)return arr; return arr.filter(x=>String(x.name||'').toLowerCase().includes(q)||String(x.phone||'').toLowerCase().includes(q));}
function resolveOne(arr,q,label){
  const s=String(q||'').trim().toLowerCase(); if(!s)throw new Error(`${label} is required.`);
  const exact=arr.filter(x=>String(x.name||'').trim().toLowerCase()===s || String(x.id||'').toLowerCase()===s);
  if(exact.length===1)return exact[0]; if(exact.length>1)throw new Error(`I found multiple ${label}s with that name. Please select one.`);
  const partial=uniqueByName(arr,s); if(partial.length===1)return partial[0]; if(partial.length>1)throw new Error(`I found ${partial.length} matching ${label}s. Please be more specific.`);
  throw new Error(`${label} not found: ${q}`);
}
function rangeArgs(a){
  const from=a.from||dateStr(), to=a.to||from;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))throw new Error('Use dates in YYYY-MM-DD format.');
  return {from:new Date(from+'T00:00:00'),to:new Date(to+'T23:59:59.999')};
}
function salesInRange(from,to){return (window.data.sales||[]).filter(s=>{const d=new Date(s.date);return d>=from&&d<=to;});}

function toolSchemas(){return Object.entries(AI_TOOLS).map(([name,t])=>`${name}: ${t.description}; required=${t.required.join(',')||'none'}; write=${t.write}`).join('\n');}
function systemPrompt(){return `You are the private MyBusiness command parser. Use /no_think. Output ONLY one JSON object and nothing else. Never output code. Never invent ids, names, prices, balances or quantities. Ask for clarification by using tool "clarify" when required. Choose exactly one registered tool. For dates use YYYY-MM-DD. For customer/product/supplier references use the user's wording; the app will validate matches. Tool schemas:\n${toolSchemas()}\nJSON shape: {"tool":"name","arguments":{...}}`}
function fallbackIntent(text){
  const t=text.trim(); const low=t.toLowerCase();
  if(/low stock|کم اسٹاک|kam stock/.test(low))return {tool:'get_low_stock_products',arguments:{}};
  let m=t.match(/(?:receive|received|receive karo|receive kr|se)\s+([\w\s-]+?)\s+(?:rs\.?\s*)?([0-9][0-9,]*(?:\.\d+)?)/i);
  if(m && /receive|se/.test(low))return {tool:'receive_customer_payment',arguments:{customer:m[1].trim(),amount:Number(m[2].replace(/,/g,''))}};
  m=t.match(/(.+?)\s+(?:ka|ki|ke)\s+balance/i); if(m)return {tool:'get_customer_balance',arguments:{customer:m[1].trim()}};
  if(/today.*sale|aaj.*sale/.test(low))return {tool:'get_today_sales',arguments:{}};
  m=t.match(/(?:add|stock mein add|add karo|add kr).+?([0-9]+)\s+(?:bottle|bottles|pcs|pieces|units)?/i);
  if(m && /stock/.test(low))return {tool:'add_stock',arguments:{product:t.replace(m[0],'').trim(),quantity:Number(m[1])}};
  return null;
}

async function runTool(name,a={}){
  const d=window.data||{};
  switch(name){
    case 'search_products': return (d.products||[]).filter(p=>String(p.name||'').toLowerCase().includes(String(a.query||'').toLowerCase())||String(p.barcode||'').toLowerCase()===String(a.query||'').toLowerCase()).map(p=>({id:p.id,name:p.name,stock:Number(p.stock)||0,cost:Number(p.cost)||0,wholesalePrice:Number(p.wholesalePrice??p.price)||0,retailPrice:Number(p.retailPrice??p.price)||0,barcode:p.barcode||''}));
    case 'get_product': {const p=resolveOne(d.products||[],a.query,'product');return {id:p.id,name:p.name,stock:Number(p.stock)||0,cost:Number(p.cost)||0,wholesalePrice:Number(p.wholesalePrice??p.price)||0,retailPrice:Number(p.retailPrice??p.price)||0,barcode:p.barcode||''};}
    case 'get_low_stock_products': return (d.products||[]).filter(p=>Number(p.stock)<=Number(p.minStock??5)).map(p=>({id:p.id,name:p.name,stock:Number(p.stock)||0,minStock:Number(p.minStock??5)}));
    case 'search_customers': return uniqueByName(d.customers||[],a.query).map(c=>({id:c.id,name:c.name,phone:c.phone||'',balance:Number(c.balance)||0}));
    case 'get_customer_balance': {const c=resolveOne(d.customers||[],a.customer,'customer');return {id:c.id,name:c.name,balance:Number(c.balance)||0,phone:c.phone||''};}
    case 'search_suppliers': return uniqueByName(d.suppliers||[],a.query).map(s=>({id:s.id,name:s.name,phone:s.phone||'',balance:Number(s.balance)||0}));
    case 'get_supplier_balance': {const s=resolveOne(d.suppliers||[],a.supplier,'supplier');return {id:s.id,name:s.name,balance:Number(s.balance)||0,phone:s.phone||''};}
    case 'get_today_sales': return salesInRange(new Date(dateStr()+'T00:00:00'),new Date(dateStr()+'T23:59:59.999')).map(s=>({id:s.id,invoiceNumber:s.invoiceNumber,total:Number(s.total)||0,amountPaid:Number(s.amountPaid)||0,amountDue:Number(s.amountDue)||0,customerName:s.customerName||'Walk-in',saleType:s.saleType||''}));
    case 'get_sales_summary': {const r=rangeArgs(a), rows=salesInRange(r.from,r.to);return {from:a.from,to:a.to,count:rows.length,total:rows.reduce((x,s)=>x+(Number(s.total)||0),0),paid:rows.reduce((x,s)=>x+(Number(s.amountPaid)||0),0),due:rows.reduce((x,s)=>x+(Number(s.amountDue)||0),0),profit:rows.reduce((x,s)=>x+(Number(s.totalProfit)||0),0)};}
    case 'get_purchase_summary': {const r=rangeArgs(a), rows=(d.stockPurchases||[]).filter(p=>{const x=new Date(p.date);return x>=r.from&&x<=r.to;});return {from:a.from,to:a.to,count:rows.length,total:rows.reduce((x,p)=>x+(Number(p.amount)||0),0),paid:rows.reduce((x,p)=>x+(Number(p.amountPaid)||0),0),due:rows.reduce((x,p)=>x+(Number(p.amountDue)||0),0)};}
    case 'get_cashbook_summary': {const r=rangeArgs(a);const inRows=[...(d.sales||[]).map(x=>({date:x.date,amount:Number(x.amountPaid)||0,type:'in'})),...(d.customerTransactions||[]).filter(x=>x.type==='payment').map(x=>({date:x.date,amount:Number(x.amount)||0,type:'in'})),...(d.cashTransactions||[]).filter(x=>x.type==='income').map(x=>({date:x.date,amount:Number(x.amount)||0,type:'in'}))].filter(x=>{const dt=new Date(x.date);return dt>=r.from&&dt<=r.to});const outRows=[...(d.expenses||[]).map(x=>({date:x.date,amount:Number(x.amount)||0,type:'out'})),...(d.stockPurchases||[]).map(x=>({date:x.date,amount:Number(x.amountPaid??x.amount)||0,type:'out'})),...(d.supplierTransactions||[]).filter(x=>x.type==='payment').map(x=>({date:x.date,amount:Number(x.amount)||0,type:'out'})),...(d.cashTransactions||[]).filter(x=>x.type!=='income').map(x=>({date:x.date,amount:Number(x.amount)||0,type:'out'}))].filter(x=>{const dt=new Date(x.date);return dt>=r.from&&dt<=r.to});const cashIn=inRows.reduce((x,e)=>x+e.amount,0),cashOut=outRows.reduce((x,e)=>x+e.amount,0);return {from:a.from,to:a.to,cashIn,cashOut,net:cashIn-cashOut};}
    case 'get_expense_summary': {const r=rangeArgs(a);const rows=(d.expenses||[]).filter(e=>{const x=new Date(e.date);return x>=r.from&&x<=r.to;});return {from:a.from,to:a.to,count:rows.length,total:rows.reduce((x,e)=>x+(Number(e.amount)||0),0),byCategory:rows.reduce((o,e)=>{const k=e.category||'Uncategorized';o[k]=(o[k]||0)+(Number(e.amount)||0);return o;},{})};}
    case 'get_stock_summary': return {products:(d.products||[]).length,units:(d.products||[]).reduce((x,p)=>x+(Number(p.stock)||0),0),lowStock:(d.products||[]).filter(p=>Number(p.stock)<=Number(p.minStock??5)).length};
    default: return await runWriteTool(name,a);
  }
}

async function runWriteTool(name,a){
  if(!window.currentUserId)throw new Error('Please log in first.');
  const d=window.data||{};
  if(name==='add_product'){
    const vals={name:String(a.name||'').trim(),cost:Number(a.cost),wholesalePrice:Number(a.wholesalePrice),retailPrice:Number(a.retailPrice),stock:Number(a.stock),minStock:Number(a.minStock??5),barcode:String(a.barcode||'')};
    if(!vals.name||![vals.cost,vals.wholesalePrice,vals.retailPrice,vals.stock].every(Number.isFinite)||vals.cost<0||vals.wholesalePrice<0||vals.retailPrice<0||vals.stock<0)throw new Error('Invalid product fields.');
    if((d.products||[]).some(p=>p.name.trim().toLowerCase()===vals.name.toLowerCase()))throw new Error('A product with this name already exists.');
    const ref=window.doc(window.collection(window.db,'products'));await window.setDoc(ref,{...vals,price:vals.wholesalePrice,ownerId:window.currentUserId});return {ok:true,id:ref.id,name:vals.name};
  }
  if(name==='update_product'){
    const p=(d.products||[]).find(x=>x.id===a.id);if(!p)throw new Error('Product not found.');const patch={};for(const k of ['name','cost','wholesalePrice','retailPrice','stock','minStock','barcode'])if(a[k]!==undefined)patch[k]=a[k];if(patch.wholesalePrice!==undefined)patch.price=Number(patch.wholesalePrice);await window.updateDoc(window.doc(window.db,'products',p.id),patch);return {ok:true,id:p.id};
  }
  if(name==='add_stock'){
    const p=resolveOne(d.products||[],a.product,'product'), qty=Number(a.quantity);if(!Number.isInteger(qty)||qty<=0)throw new Error('Quantity must be a positive whole number.');
    await window.runAtomicOrOffline(async tx=>{const ref=window.doc(window.db,'products',p.id),snap=await tx.get(ref);if(!snap.exists())throw new Error('Product not found.');const stock=Number(snap.data().stock)||0;tx.update(ref,{stock:stock+qty,updatedAt:new Date().toISOString()});const ar=window.doc(window.collection(window.db,'stockAdjustments'));tx.set(ar,{ownerId:window.currentUserId,productId:p.id,type:'add',quantity:qty,date:new Date().toISOString(),note:'Added by MyBusiness AI'});});return {ok:true,product:p.name,added:qty,newStock:Number(p.stock||0)+qty};
  }
  if(name==='receive_customer_payment'||name==='record_customer_credit'){
    const c=resolveOne(d.customers||[],a.customer,'customer'), amount=Number(a.amount);if(!Number.isFinite(amount)||amount<=0)throw new Error('Amount must be greater than zero.');
    await window.runAtomicOrOffline(async tx=>{const ref=window.doc(window.db,'customers',c.id),snap=await tx.get(ref);if(!snap.exists())throw new Error('Customer not found.');const cur=Math.max(0,Number(snap.data().balance)||0);const credit=name==='receive_customer_payment';const next=credit?Math.max(0,cur-amount):cur+amount;tx.update(ref,{balance:next,updatedAt:new Date().toISOString()});const tr=window.doc(window.collection(window.db,'customerTransactions'));tx.set(tr,{ownerId:window.currentUserId,customerId:c.id,type:credit?'payment':'manual_debt',amount,amountPaid:credit?amount:0,debitAmount:credit?0:amount,creditAmount:credit?amount:0,balanceAfter:next,date:new Date().toISOString(),note:credit?'Payment received via AI':'Credit recorded via AI',createdBy:window.authUserId||window.currentUserId});});return {ok:true,customer:c.name,amount,newBalance:Math.max(0,(Number(c.balance)||0)+(name==='receive_customer_payment'?-amount:amount))};
  }
  if(name==='record_supplier_payment'){
    const s=resolveOne(d.suppliers||[],a.supplier,'supplier'), amount=Number(a.amount);if(!Number.isFinite(amount)||amount<=0)throw new Error('Amount must be greater than zero.');if(amount>Number(s.balance||0))throw new Error('Amount cannot exceed current supplier payable.');await window.runAtomicOrOffline(async tx=>{const ref=window.doc(window.db,'suppliers',s.id),snap=await tx.get(ref);if(!snap.exists())throw new Error('Supplier not found.');const next=Math.max(0,(Number(snap.data().balance)||0)-amount);tx.update(ref,{balance:next});const tr=window.doc(window.collection(window.db,'supplierTransactions'));tx.set(tr,{ownerId:window.currentUserId,supplierId:s.id,type:'payment',amount,balanceAfter:next,date:new Date().toISOString(),note:'Payment to supplier via AI'});});return {ok:true,supplier:s.name,amount,newBalance:Math.max(0,Number(s.balance||0)-amount)};
  }
  if(name==='record_expense'){
    const amount=Number(a.amount);if(!Number.isFinite(amount)||amount<=0)throw new Error('Amount must be greater than zero.');const ref=window.doc(window.collection(window.db,'expenses'));await window.setDoc(ref,{ownerId:window.currentUserId,amount,date:new Date(a.date||new Date().toISOString()).toISOString(),category:String(a.category||'Uncategorized'),note:String(a.note||'Recorded by MyBusiness AI')});return {ok:true,id:ref.id,amount,category:a.category||'Uncategorized'};
  }
  if(name==='create_sale'||name==='create_credit_sale'){
    const items=Array.isArray(a.items)?a.items:[];if(!items.length)throw new Error('At least one product is required.');const type=a.saleType==='retail'?'retail':'wholesale';const resolved=items.map(i=>{const p=resolveOne(d.products||[],i.product||i.name,'product');const qty=Number(i.quantity??i.qty);if(!Number.isInteger(qty)||qty<=0)throw new Error(`Invalid quantity for ${p.name}.`);if(qty>Number(p.stock||0))throw new Error(`Not enough stock for ${p.name}.`);return {p,qty};});let customer=null;if(name==='create_credit_sale'||a.customer)customer=resolveOne(d.customers||[],a.customer,'customer');const paid=Number(a.amountPaid??0);if(!Number.isFinite(paid)||paid<0)throw new Error('Invalid amount paid.');const bill=Math.max(1,Number(d.settings?.nextInvoiceNumber)||1);let finalTotal=0, finalDue=0;const saleRef=window.doc(window.collection(window.db,'sales'));await window.runAtomicOrOffline(async tx=>{let subtotal=0,profit=0;const snapList=[];for(const x of resolved){const snap=await tx.get(window.doc(window.db,'products',x.p.id));if(!snap.exists())throw new Error(`Product ${x.p.name} not found.`);snapList.push(snap);const p=snap.data();const unit=type==='retail'?Number(p.retailPrice??p.price):Number(p.wholesalePrice??p.price);subtotal+=unit*x.qty;profit+=(unit-Number(p.cost||0))*x.qty;}const total=subtotal;const due=Math.max(0,total-paid);finalTotal=total;finalDue=due;if(!customer&&due>0&&name==='create_credit_sale')throw new Error('Customer is required for a credit sale.');const old=customer?Math.max(0,Number((await tx.get(window.doc(window.db,'customers',customer.id))).data().balance)||0):0;const newBal=old+due;tx.set(saleRef,{ownerId:window.currentUserId,createdBy:window.authUserId||window.currentUserId,createdByName:window.currentMemberName||'Business Owner',customerId:customer?.id||null,customerName:customer?.name||'Walk-in',saleType:type,date:new Date().toISOString(),items:resolved.map((x,idx)=>({id:x.p.id,name:x.p.name,price:type==='retail'?Number(x.p.retailPrice??x.p.price):Number(x.p.wholesalePrice??x.p.price),cost:Number(x.p.cost||0),qty:x.qty,returnedQty:0})),subtotal,discount:0,discountType:'amount',total,amountPaid:paid,amountDue:due,totalProfit:profit,profitKnown:true,note:'AI sale',returnedAmount:0,returnedProfit:0,invoiceNumber:bill});for(let i=0;i<resolved.length;i++)tx.update(window.doc(window.db,'products',resolved[i].p.id),{stock:Number(snapList[i].data().stock||0)-resolved[i].qty});if(customer){tx.update(window.doc(window.db,'customers',customer.id),{balance:newBal,updatedAt:new Date().toISOString()});const tr=window.doc(window.collection(window.db,'customerTransactions'));tx.set(tr,{ownerId:window.currentUserId,customerId:customer.id,type:'sale_debt',amount:total,amountPaid:paid,debitAmount:total,creditAmount:paid,balanceAfter:newBal,date:new Date().toISOString(),note:`Bill No. ${bill}`,billNo:String(bill),saleId:saleRef.id,createdBy:window.authUserId||window.currentUserId});}tx.set(window.doc(window.db,'settings',window.currentUserId),{nextInvoiceNumber:bill+1},{merge:true});});return {ok:true,id:saleRef.id,invoiceNumber:bill,total:finalTotal,totalPaid:paid,amountDue:finalDue,customer:customer?.name||'Walk-in'};
  }
  if(name==='create_purchase'){
    const items=Array.isArray(a.items)?a.items:[];if(!items.length)throw new Error('At least one purchase item is required.');const resolved=items.map(i=>{const qty=Number(i.quantity??i.qty),price=Number(i.price??i.unitCost);if(!Number.isInteger(qty)||qty<1||!Number.isFinite(price)||price<0)throw new Error('Invalid purchase quantity or price.');if(i.manual)return {manual:true,name:String(i.name||'Manual Item'),qty,price};const p=resolveOne(d.products||[],i.product||i.name,'product');return {p,qty,price};});const paid=Number(a.amountPaid);if(!Number.isFinite(paid)||paid<0)throw new Error('Invalid amount paid.');const total=resolved.reduce((s,x)=>s+x.qty*x.price,0);if(paid>total)throw new Error('Amount paid cannot exceed purchase total.');const supplier=a.supplier?resolveOne(d.suppliers||[],a.supplier,'supplier'):null;const due=total-paid;if(due>0&&!supplier)throw new Error('Supplier is required for an unpaid purchase.');await window.runAtomicOrOffline(async tx=>{const itemDocs=[];for(const x of resolved){if(x.manual){const r=window.doc(window.collection(window.db,'products'));itemDocs.push(r);tx.set(r,{name:x.name,barcode:'',cost:x.price,price:x.price,wholesalePrice:x.price,retailPrice:x.price,stock:x.qty,minStock:5,ownerId:window.currentUserId});}else{const r=window.doc(window.db,'products',x.p.id),snap=await tx.get(r);if(!snap.exists())throw new Error('Product not found.');itemDocs.push(r);tx.update(r,{stock:Number(snap.data().stock||0)+x.qty,cost:x.price});}}const pr=window.doc(window.collection(window.db,'stockPurchases'));const mapped=resolved.map((x,i)=>({productId:itemDocs[i].id,productName:x.manual?x.name:x.p.name,qty:x.qty,unitCost:x.price,amount:x.qty*x.price,...(x.manual?{manual:true}:{})}));tx.set(pr,{ownerId:window.currentUserId,date:new Date().toISOString(),amount:total,amountPaid:paid,amountDue:due,category:'',note:String(a.note||'Purchase recorded by AI'),supplierId:supplier?.id||null,supplier:supplier?.name||'',productId:mapped[0]?.productId||null,productName:mapped.length>1?`${mapped.length} Products`:mapped[0]?.productName||'',qty:mapped[0]?.qty||0,unitCost:mapped[0]?.unitCost||0,items:mapped});if(supplier&&due>0){const sr=window.doc(window.db,'suppliers',supplier.id),ss=await tx.get(sr);const bal=Number(ss.data().balance||0)+due;tx.update(sr,{balance:bal});const tr=window.doc(window.collection(window.db,'supplierTransactions'));tx.set(tr,{ownerId:window.currentUserId,supplierId:supplier.id,type:'purchase_debt',amount:due,balanceAfter:bal,date:new Date().toISOString(),note:'Stock purchase recorded by AI',purchaseId:pr.id});}});return {ok:true,total,amountPaid:paid,amountDue:due,supplier:supplier?.name||null};
  }
  throw new Error(`Tool not implemented: ${name}`);
}

function ensureUI(){
  if(document.getElementById('mybiz-ai-fab'))return;
  const fab=document.createElement('button');fab.id='mybiz-ai-fab';fab.className='mybiz-ai-fab';fab.innerHTML='<i class="fas fa-robot"></i><span>AI</span>';fab.onclick=openAI;document.body.appendChild(fab);
  const panel=document.createElement('div');panel.id='mybiz-ai-panel';panel.className='mybiz-ai-panel hidden';panel.innerHTML=`<div class="mybiz-ai-head"><div><strong>MyBusiness AI</strong><small id="mybiz-ai-status">Checking local AI…</small></div><button onclick="window.closeMyBusinessAI()">&times;</button></div><div id="mybiz-ai-messages" class="mybiz-ai-messages"></div><div id="mybiz-ai-confirm" class="mybiz-ai-confirm hidden"></div><div class="mybiz-ai-input"><textarea id="mybiz-ai-input" rows="2" placeholder="Ask in English or Roman Urdu…"></textarea><button id="mybiz-ai-send" onclick="window.sendMyBusinessAI()"><i class="fas fa-paper-plane"></i></button></div>`;document.body.appendChild(panel);
  document.getElementById('mybiz-ai-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAI();}});
  updateStatus();
}
function addMsg(role,text){const box=document.getElementById('mybiz-ai-messages');if(!box)return;const el=document.createElement('div');el.className=`mybiz-ai-msg ${role}`;el.innerHTML=esc(text).replace(/\n/g,'<br>');box.appendChild(el);box.scrollTop=box.scrollHeight;}
function updateStatus(){const s=document.getElementById('mybiz-ai-status');if(!s)return;const q=!!window.AndroidQwen;if(!q){s.textContent='Android offline AI is available in the APK';return;}s.textContent=window.__mybizQwenStatus?.text||'Local Qwen3';}
function openAI(){ensureUI();document.getElementById('mybiz-ai-panel').classList.remove('hidden');document.getElementById('mybiz-ai-input')?.focus();}
function closeAI(){document.getElementById('mybiz-ai-panel')?.classList.add('hidden');}
async function sendAI(){if(busy)return;const input=document.getElementById('mybiz-ai-input'),text=input?.value.trim();if(!text)return;input.value='';addMsg('user',text);busy=true;document.getElementById('mybiz-ai-send').disabled=true;try{let req=null;if(window.AndroidQwen?.generate){req=await askNative(text);}else req=fallbackIntent(text);if(!req){addMsg('assistant','Offline AI is available in the Android app. This browser version cannot run Qwen locally.');return;}await handleRequest(req,text);}catch(e){addMsg('assistant',e.message||'AI request failed.');}finally{busy=false;document.getElementById('mybiz-ai-send').disabled=false;}}
function askNative(userText){return new Promise((resolve,reject)=>{const id='r'+Date.now()+Math.random().toString(36).slice(2);window.__mybizQwenResolvers=window.__mybizQwenResolvers||{};window.__mybizQwenResolvers[id]={resolve,reject};const context=`${systemPrompt()}\nUser request: ${userText}\nReturn only JSON.`;try{window.AndroidQwen.generate(context,id);}catch(e){delete window.__mybizQwenResolvers[id];reject(e);}});}
async function handleRequest(req,original){if(!req||typeof req.tool!=='string')throw new Error('The AI returned an invalid tool request.');if(req.tool==='clarify'){addMsg('assistant',req.arguments?.question||'Please clarify.');return;}const def=AI_TOOLS[req.tool];if(!def)throw new Error('Unknown AI tool request was rejected.');for(const k of def.required)if(req.arguments?.[k]===undefined||req.arguments?.[k]===null||req.arguments?.[k]==='')throw new Error(`Missing required field: ${k}`);if(WRITE_TOOLS.has(req.tool)){showConfirmation(req);return;}const result=await runTool(req.tool,req.arguments||{});await answerFromResult(original,req,result);}
function showConfirmation(req){pendingWrite=req;const box=document.getElementById('mybiz-ai-confirm');box.classList.remove('hidden');box.innerHTML=`<div><strong>Confirm action</strong><p>${esc(describeAction(req))}</p></div><div><button class="btn btn-secondary" onclick="window.cancelMyBusinessAI()">Cancel</button><button class="btn" onclick="window.confirmMyBusinessAI()">Confirm</button></div>`;}
function describeAction(req){const a=req.arguments||{};const map={receive_customer_payment:`Record Rs. ${Number(a.amount||0).toLocaleString()} received from ${a.customer}.`,record_customer_credit:`Record Rs. ${Number(a.amount||0).toLocaleString()} credit for ${a.customer}.`,record_supplier_payment:`Record Rs. ${Number(a.amount||0).toLocaleString()} payment to supplier ${a.supplier}.`,add_stock:`Add ${a.quantity} units of ${a.product} to stock.`,record_expense:`Record expense Rs. ${Number(a.amount||0).toLocaleString()} (${a.category||'Uncategorized'}).`,create_sale:`Create a ${a.saleType||'wholesale'} sale for the requested items.`,create_credit_sale:`Create a credit sale for ${a.customer}.`,create_purchase:`Record a stock purchase for the requested items.`,add_product:`Add product ${a.name}.`,update_product:`Update product ${a.id}.`};return map[req.tool]||`Run ${req.tool}.`}
async function confirmAI(){if(!pendingWrite)return;const req=pendingWrite;pendingWrite=null;document.getElementById('mybiz-ai-confirm').classList.add('hidden');try{const result=await runTool(req.tool,req.arguments||{});addMsg('assistant','Done. '+JSON.stringify(result));}catch(e){addMsg('assistant',e.message||'Action failed.');}}
function cancelAI(){pendingWrite=null;document.getElementById('mybiz-ai-confirm')?.classList.add('hidden');addMsg('assistant','Cancelled.');}
async function answerFromResult(original,req,result){addMsg('assistant',formatToolResult(req.tool,result));}
function formatToolResult(tool,r){if(tool==='get_customer_balance')return `${r.name} owes ${money(r.balance)}.`;if(tool==='get_supplier_balance')return `${r.name} payable balance is ${money(r.balance)}.`;if(tool==='get_low_stock_products')return r.length?`Low stock: ${r.map(x=>`${x.name} (${x.stock})`).join(', ')}`:'No low-stock products.';if(tool==='get_today_sales')return r.length?`Today: ${money(r.reduce((s,x)=>s+x.total,0))} sales across ${r.length} invoices.`:'No sales recorded today.';if(tool==='get_sales_summary')return `${r.from} to ${r.to}: ${r.count} sales, total ${money(r.total)}, paid ${money(r.paid)}, due ${money(r.due)}, profit ${money(r.profit)}.`;if(tool==='get_stock_summary')return `${r.products} products, ${r.units} units in stock, ${r.lowStock} low-stock products.`;if(Array.isArray(r))return r.length?JSON.stringify(r):'No matching records.';return JSON.stringify(r);}
window.__mybizQwenResult=(id,payload)=>{const r=window.__mybizQwenResolvers?.[id];if(!r)return;delete window.__mybizQwenResolvers[id];try{const obj=typeof payload==='string'?JSON.parse(payload):payload;r.resolve(extractJson(obj.text||obj.output||'' )||obj);}catch(e){r.reject(new Error('Could not parse local AI response.'));}};
window.__mybizQwenStatusUpdate=(payload)=>{window.__mybizQwenStatus=payload||{};updateStatus();};
window.openMyBusinessAI=openAI;window.closeMyBusinessAI=closeAI;window.sendMyBusinessAI=sendAI;window.confirmMyBusinessAI=confirmAI;window.cancelMyBusinessAI=cancelAI;
window.addEventListener('DOMContentLoaded',ensureUI);setTimeout(ensureUI,1000);
