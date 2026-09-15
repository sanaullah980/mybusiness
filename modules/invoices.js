// Professional invoices / Bill Book.
// Invoice numbers are assigned LAZILY the first time someone generates an
// invoice for a sale (via a Firestore transaction incrementing
// settings.nextInvoiceNumber), so old sales are untouched until the shop
// owner actually wants a bill for them, and numbers stay gap-free per
// business regardless of which sale type they came from.
// PDF generation uses jsPDF (loaded from CDN in index.html, window.jspdf).

function getBusinessName() {
    return (window.data.settings && window.data.settings.name) || 'My Business';
}

async function ensureInvoiceNumber(saleId) {
    const sale = (window.data.sales||[]).find(s => s.id === saleId);
    if (sale && sale.invoiceNumber !== undefined && sale.invoiceNumber !== null && sale.invoiceNumber !== '') return sale.invoiceNumber;
    let assignedNumber = null;
    // Existing sales already receive their invoice number at sale time. If an old
    // sale has no number, employees must still be able to open its invoice without
    // attempting an admin-only settings write.
    if (window.currentRole !== 'admin') {
        const cachedNums=(window.data?.sales||[]).map(x=>parseInt(x.invoiceNumber,10)).filter(Number.isFinite);
        assignedNumber=Math.max(1,...cachedNums)+1;
        return assignedNumber;
    }
    await window.runAtomicOrOffline(async (transaction) => {
        const settingsRef = window.doc(window.db, 'settings', window.currentUserId);
        const saleRef = window.doc(window.db, 'sales', saleId);
        const settingsSnap = await transaction.get(settingsRef);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error('Sale not found.');
        if (saleSnap.data().invoiceNumber !== undefined && saleSnap.data().invoiceNumber !== null && saleSnap.data().invoiceNumber !== '') { assignedNumber = saleSnap.data().invoiceNumber; return; }
        const cachedNums=(window.data?.sales||[]).map(x=>parseInt(x.invoiceNumber,10)).filter(Number.isFinite);
        const maxCached=Math.max(0,...cachedNums);
        const configured=parseInt(settingsSnap.exists() ? settingsSnap.data().nextInvoiceNumber : 0,10);
        const current=Math.max(1,maxCached+1,Number.isFinite(configured)&&configured>0&&configured<100000000?configured:1);
        assignedNumber=current;
        transaction.set(settingsRef,{nextInvoiceNumber:current+1},{merge:true});
        transaction.update(saleRef,{invoiceNumber:current});
    });
    return assignedNumber;
}

function esc(v){ return (window.esc||((x)=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))))(v); }
function invoiceItems(sale){ return Array.isArray(sale.items)&&sale.items.length ? sale.items : [{id:null,name:sale.note||'Sale',qty:1,price:Number(sale.total)||0,cost:0}]; }

export async function openInvoiceModal(saleId) {
    const invoiceNumber=await ensureInvoiceNumber(saleId).catch(e=>{alert(e.message||'Failed to generate bill number.');return null;});
    if(invoiceNumber===null||invoiceNumber===undefined)return;
    const sale=(window.data.sales||[]).find(s=>s.id===saleId); if(!sale)return alert('Sale not found.');
    const fmt=window.formatCurrency, items=invoiceItems(sale);
    const modal=document.getElementById('modal-body');
    modal.classList.add('invoice-modal');
    modal.innerHTML=`<div class="modal-header"><h2>Invoice #${esc(invoiceNumber)}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
      <div class="invoice-sheet">
        <div class="invoice-business"><strong>${esc(getBusinessName())}</strong><span>${esc(window.data.settings?.phone||'')}</span><span>${esc(window.data.settings?.address||'')}</span></div>
        <div class="invoice-title"><strong>Invoice #${esc(invoiceNumber)}</strong><span>${new Date(sale.date).toLocaleString()}</span></div>
        <div class="invoice-customer"><span>Customer</span><strong>${esc(sale.customerName||'Walk-in')}</strong></div>
        ${sale.customerId ? `<div class="invoice-customer"><span>Phone</span><strong>${esc((window.data.customers||[]).find(c=>c.id===sale.customerId)?.phone||'')}</strong></div>`:''}
        <table class="invoice-table"><thead><tr><th>ITEM</th><th>Qty</th><th>RATE</th><th>AMOUNT</th></tr></thead><tbody>${items.map(i=>`<tr><td>${esc(i.name)}</td><td>${Number(i.qty)||0}</td><td>${fmt(i.price||0)}</td><td>${fmt((Number(i.price)||0)*(Number(i.qty)||0))}</td></tr>`).join('')}</tbody></table>
        <div class="invoice-total-row"><span>Total</span><strong>${fmt(sale.total||0)}</strong></div>
        <div class="invoice-total-row"><span>Received</span><strong>${fmt(sale.amountPaid||0)}</strong></div>
        <div class="invoice-total-row net"><span>${(sale.amountDue||0)>0?'Net Amount':'Net Amount'}</span><strong>${fmt(sale.amountDue||0)}</strong></div>
      </div>
      <div class="invoice-actions">${window.currentRole==='admin'?`<button class="btn btn-secondary" onclick="editInvoiceItems('${saleId}')"><i class="fas fa-edit"></i> Edit Invoice</button>`:''}
      ${items.some(i=>i.id && (Number(i.qty||0)-Number(i.returnedQty||0))>0) && ['normal','wholesale','retail'].includes(sale.saleType)?`${window.currentRole==='admin'?`<button class="btn btn-secondary" onclick="openReturnModal('${saleId}')"><i class="fas fa-undo"></i> Return / Refund</button>`:''}`:''}
      <button class="btn" onclick="downloadInvoicePdf('${saleId}')"><i class="fas fa-file-pdf"></i> Preview / PDF</button><button class="btn btn-secondary" onclick="printInvoice('${saleId}')"><i class="fas fa-print"></i> Print</button><button class="btn" style="background:#25D366" onclick="shareInvoiceWhatsApp('${saleId}')"><i class="fab fa-whatsapp"></i> WhatsApp</button></div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function buildInvoiceLines(sale){ return invoiceItems(sale).map(i=>`${i.name}  x${i.qty}  @ ${window.formatCurrency(i.price||0)}  =  ${window.formatCurrency((i.price||0)*(i.qty||0))}`); }
function buildInvoiceDoc(sale,invoiceNumber){
    if(!window.jspdf){alert('PDF library not loaded. Check your internet connection.');return null;}
    const {jsPDF}=window.jspdf, doc=new jsPDF({unit:'pt',format:'a5'}),fmt=window.formatCurrency;
    const left=32,right=385; let y=34;
    doc.setFontSize(16); doc.text(getBusinessName(),left,y); y+=18; doc.setFontSize(9);
    if(window.data.settings?.phone) {doc.text(String(window.data.settings.phone),left,y);y+=12;}
    if(window.data.settings?.address) {doc.text(String(window.data.settings.address),left,y);y+=12;}
    y+=6; doc.setFontSize(14); doc.text(`Invoice #${invoiceNumber}`,left,y); doc.setFontSize(9); doc.text(new Date(sale.date).toLocaleString(),right,y,{align:'right'}); y+=18;
    doc.text(`Customer: ${sale.customerName||'Walk-in'}`,left,y); y+=15;
    doc.line(left,y,right,y);y+=14; doc.setFontSize(8); doc.text('ITEM',left,y);doc.text('QTY',250,y);doc.text('RATE',290,y);doc.text('AMOUNT',right,y,{align:'right'});y+=12;
    invoiceItems(sale).forEach(i=>{doc.text(String(i.name||''),left,y,{maxWidth:205});doc.text(String(i.qty||0),250,y);doc.text(fmt(i.price||0),290,y);doc.text(fmt((i.price||0)*(i.qty||0)),right,y,{align:'right'});y+=16;});
    doc.line(left,y,right,y);y+=17;doc.setFontSize(10);doc.text('Total',290,y);doc.text(fmt(sale.total||0),right,y,{align:'right'});y+=15;doc.setFontSize(9);doc.text('Received',290,y);doc.text(fmt(sale.amountPaid||0),right,y,{align:'right'});y+=15;doc.setFontSize(10);doc.text('Net Amount',290,y);doc.text(fmt(sale.amountDue||0),right,y,{align:'right'}); return doc;
}

export async function downloadInvoicePdf(saleId) {
    const sale = window.data.sales.find(s => s.id === saleId);
    if (!sale) return alert("Sale not found.");
    const invoiceNumber = await ensureInvoiceNumber(saleId);
    const doc = buildInvoiceDoc(sale, invoiceNumber);
    if (doc) doc.save(`Invoice-${invoiceNumber}.pdf`);
}

export async function printInvoice(saleId) {
    const sale = window.data.sales.find(s => s.id === saleId);
    if (!sale) return alert("Sale not found.");
    const invoiceNumber = await ensureInvoiceNumber(saleId);
    const doc = buildInvoiceDoc(sale, invoiceNumber);
    if (doc) doc.autoPrint(), window.open(doc.output('bloburl'), '_blank');
}

export async function shareInvoiceWhatsApp(saleId) {
    const sale = window.data.sales.find(s => s.id === saleId);
    if (!sale) return alert("Sale not found.");
    const invoiceNumber = await ensureInvoiceNumber(saleId);
    const formatCurrency = window.formatCurrency;
    const text = `Invoice #${invoiceNumber} - ${getBusinessName()}\nDate: ${new Date(sale.date).toLocaleDateString()}\nTotal: ${formatCurrency(sale.total)}\nPaid: ${formatCurrency(sale.amountPaid || 0)}\n${(sale.amountDue || 0) > 0 ? 'Due: ' + formatCurrency(sale.amountDue) : 'Status: PAID'}\n\n(PDF invoice downloaded separately can be attached in WhatsApp)`;
    let phone = '';
    if (sale.customerId) { const c = window.data.customers.find(x => x.id === sale.customerId); if (c && c.phone) phone = c.phone.replace(/[^0-9]/g, ''); }
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (navigator.share) {
        navigator.share({ title: `Invoice #${invoiceNumber}`, text }).catch(() => window.open(url, '_blank'));
    } else {
        window.open(url, '_blank');
    }
}


export function editInvoiceItems(saleId){
    const sale=(window.data.sales||[]).find(s=>s.id===saleId); if(!sale)return alert('Sale not found.');
    const products=Array.isArray(window.data.products)?window.data.products:[], items=Array.isArray(sale.items)?sale.items:[]; if(!items.length)return alert('This invoice has no itemized products to edit.');
    // Preserve any quantity/price edits already typed before opening the product picker.
    if(window._editingInvoiceSaleId===saleId && window._invoiceEditDraft) window._invoiceEditDraft=currentEditItemsFromDraft();
    else window._invoiceEditDraft=items.map(i=>({...i}));
    const fmt=window.formatCurrency, modal=document.getElementById('modal-body');
    modal.classList.add('invoice-edit-modal');
    modal.innerHTML=`<div class="modal-header"><h2>Edit Invoice #${esc(sale.invoiceNumber||'')}</h2><button class="close-btn" onclick="openInvoiceModal('${saleId}')">&times;</button></div>
      <div class="invoice-edit-head"><div class="form-row"><div class="form-group"><label>Invoice Number</label><input type="number" id="edit-inv-bill" min="1" value="${Number(sale.invoiceNumber)||1}"></div><div class="form-group"><label>Date</label><input type="date" id="edit-inv-date" value="${new Date(sale.date).toISOString().slice(0,10)}"></div></div>
      <div class="form-group"><label>Customer</label><div class="readonly-field">${esc(sale.customerName||'Walk-in')}</div></div></div>
      <div class="section-title"><h3>Items</h3><button class="btn btn-secondary btn-sm" onclick="openInvoiceItemPicker('${saleId}')"><i class="fas fa-plus"></i> Add / Remove Invoice Items</button></div>
      <div id="invoice-edit-items">${items.map((i,n)=>`<div class="invoice-edit-item" data-index="${n}"><div class="invoice-edit-item-title"><strong>${esc(i.name)}</strong><button type="button" class="btn btn-sm btn-danger" onclick="removeInvoiceEditItem(${n})">Remove</button></div><div class="form-row"><div class="form-group"><label>Quantity</label><input type="number" min="${Number(i.returnedQty||0)}" step="1" id="edit-inv-qty-${n}" value="${Number(i.qty)||0}"></div><div class="form-group"><label>Price / Rate</label><input type="number" min="0" step="0.01" id="edit-inv-price-${n}" value="${Number(i.price)||0}"></div></div><small>Cost: ${fmt(i.cost||0)}${i.returnedQty?` · Already returned: ${i.returnedQty}`:''}</small></div>`).join('')}</div>
      <div class="form-row"><div class="form-group"><label>Discount (Rs.)</label><input type="number" id="edit-inv-discount" min="0" step="0.01" value="${Number(sale.discount)||0}"></div><div class="form-group"><label>Amount Received (Rs.)</label><input type="number" id="edit-inv-paid" min="0" step="0.01" value="${Number(sale.amountPaid)||0}"></div></div>
      <button class="btn" id="btn-save-invoice-edit" onclick="saveInvoiceEdits('${saleId}')"><i class="fas fa-save"></i> Save Changes</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function currentEditItemsFromDraft(){
    const items=(window._invoiceEditDraft||[]).map((old,i)=>{const q=document.getElementById(`edit-inv-qty-${i}`),p=document.getElementById(`edit-inv-price-${i}`);return {...old,qty:Math.max(Number(old.returnedQty||0),parseInt(q?.value,10)||0),price:Math.max(0,parseFloat(p?.value)||0)};}).filter(i=>i.qty>0);
    return items;
}
function currentEditItems(sale){ return (sale.items||[]).map((old,i)=>{const q=document.getElementById(`edit-inv-qty-${i}`),p=document.getElementById(`edit-inv-price-${i}`);return {...old,qty:Math.max(Number(old.returnedQty||0),parseInt(q?.value,10)||0),price:Math.max(0,parseFloat(p?.value)||0)};}).filter(i=>i.qty>0); }
export function removeInvoiceEditItem(index){ const saleId=window._editingInvoiceSaleId; const sale=(window.data.sales||[]).find(s=>s.id===saleId); if(!sale)return; const items=currentEditItems(sale); if((sale.items[index]?.returnedQty||0)>0)return alert('This item has already been returned and cannot be removed completely.'); items.splice(index,1); window._invoiceEditDraft=items; renderInvoiceEditDraft(saleId); }
function renderInvoiceEditDraft(saleId){ const sale=(window.data.sales||[]).find(s=>s.id===saleId),items=window._invoiceEditDraft||sale.items||[],fmt=window.formatCurrency; const holder=document.getElementById('invoice-edit-items'); if(!holder)return; holder.innerHTML=items.map((i,n)=>`<div class="invoice-edit-item" data-index="${n}"><div class="invoice-edit-item-title"><strong>${esc(i.name)}</strong><button type="button" class="btn btn-sm btn-danger" onclick="removeInvoiceEditItem(${n})">Remove</button></div><div class="form-row"><div class="form-group"><label>Quantity</label><input type="number" min="${Number(i.returnedQty||0)}" id="edit-inv-qty-${n}" value="${Number(i.qty)||0}"></div><div class="form-group"><label>Price / Rate</label><input type="number" min="0" step="0.01" id="edit-inv-price-${n}" value="${Number(i.price)||0}"></div></div><small>Cost: ${fmt(i.cost||0)}${i.returnedQty?` · Already returned: ${i.returnedQty}`:''}</small></div>`).join(''); }
export function openInvoiceItemPicker(saleId){
    window._editingInvoiceSaleId=saleId; const sale=(window.data.sales||[]).find(s=>s.id===saleId); if(!sale)return;
    const products=Array.isArray(window.data.products)?window.data.products:[];
    const draft=currentEditItems(sale); window._invoiceEditDraft=draft; const selected=new Map(draft.map(i=>[i.id,i])); const modal=document.getElementById('modal-body'),fmt=window.formatCurrency;
    modal.innerHTML=`<div class="modal-header"><h2>Add / Remove Invoice Items</h2><button class="close-btn" onclick="editInvoiceItems('${saleId}')">&times;</button></div><p style="color:var(--gray);font-size:13px">Select or unselect products. Each selected product has its own quantity and selling price.</p><div class="product-picker-search form-group"><input type="search" id="invoice-product-search" placeholder="Search products..." oninput="filterInvoiceItemPicker()"></div><div id="invoice-item-picker-list">${productsForInvoicePicker(products,selected,fmt)}</div><button class="btn" onclick="applyInvoiceItemPicker('${saleId}')">Apply Selected Items</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}
function productsForInvoicePicker(products,selected,fmt){ return products.map(p=>{const i=selected.get(p.id),checked=!!i,qty=i?.qty||1,price=i?.price??(window.activeSaleType==='retail'?p.retailPrice:p.wholesalePrice)??p.price??0;return `<div class="product-select-item-wrapper invoice-picker-row" data-name="${esc(String(p.name||'').toLowerCase())}"><button type="button" class="product-select-item" onclick="toggleInvoicePickerRow('${esc(p.id)}')"><input type="checkbox" id="inv-chk-${esc(p.id)}" ${checked?'checked':''} onclick="event.preventDefault();event.stopPropagation();toggleInvoicePickerRow('${esc(p.id)}')"><span class="product-select-main"><strong>${esc(p.name)}</strong><small>Stock: ${Number(p.stock)||0} · Price: ${fmt(price)}</small></span><i class="fas fa-chevron-right"></i></button><div id="inv-row-${esc(p.id)}" class="product-qty-row ${checked?'':'hidden'}"><label>Qty</label><input type="number" min="1" id="inv-pick-qty-${esc(p.id)}" value="${qty}" onchange="setInvoicePickerQty('${esc(p.id)}',this.value)"><label>Price</label><input type="number" min="0" step="0.01" id="inv-pick-price-${esc(p.id)}" value="${price}" onchange="setInvoicePickerPrice('${esc(p.id)}',this.value)"></div></div>`;}).join('')||'<p class="empty-state">No products found.</p>'; }
function pickerSelected(){ const sale=(window.data.sales||[]).find(s=>s.id===window._editingInvoiceSaleId); const base=new Map((window._invoiceEditDraft||sale?.items||[]).map(i=>[i.id,i])); return base; }
export function toggleInvoicePickerRow(id){const cb=document.getElementById(`inv-chk-${id}`),row=document.getElementById(`inv-row-${id}`),map=pickerSelected(); if(!cb||!row)return; cb.checked=!cb.checked; row.classList.toggle('hidden',!cb.checked); if(cb.checked){const p=(window.data.products||[]).find(x=>x.id===id),old=map.get(id);map.set(id,{id,name:p?.name||old?.name||'Product',qty:old?.qty||1,price:old?.price??(window.activeSaleType==='retail'?p?.retailPrice:p?.wholesalePrice)??p?.price??0,cost:p?.cost??old?.cost??0,returnedQty:old?.returnedQty||0});}else map.delete(id);window._invoicePickerMap=map;}
export function setInvoicePickerQty(id,v){const m=window._invoicePickerMap||pickerSelected(),i=m.get(id);if(i)i.qty=Math.max(1,parseInt(v,10)||1);window._invoicePickerMap=m;}
export function setInvoicePickerPrice(id,v){const m=window._invoicePickerMap||pickerSelected(),i=m.get(id);if(i)i.price=Math.max(0,parseFloat(v)||0);window._invoicePickerMap=m;}
export function filterInvoiceItemPicker(){const q=(document.getElementById('invoice-product-search')?.value||'').toLowerCase();document.querySelectorAll('.invoice-picker-row').forEach(x=>x.classList.toggle('hidden',!(x.dataset.name||'').includes(q)));}
export function applyInvoiceItemPicker(saleId){const m=window._invoicePickerMap||pickerSelected(); const sale=(window.data.sales||[]).find(s=>s.id===saleId); for(const old of sale.items||[]){const n=m.get(old.id);if((old.returnedQty||0)>Number(n?.qty||0))return alert(`${old.name}: quantity cannot be less than already returned quantity (${old.returnedQty}).`);} window._invoiceEditDraft=[...m.values()]; delete window._invoicePickerMap; editInvoiceItems(saleId);}

export async function saveInvoiceEdits(saleId){
    const sale=(window.data.sales||[]).find(s=>s.id===saleId); if(!sale)return alert('Sale not found.');
    const items=window._invoiceEditDraft||currentEditItems(sale); if(!items.length)return alert('Invoice must contain at least one item.');
    const billNumber=Math.max(1,parseInt(document.getElementById('edit-inv-bill')?.value,10)||Number(sale.invoiceNumber)||1),discount=Math.max(0,parseFloat(document.getElementById('edit-inv-discount')?.value)||0),paidInput=parseFloat(document.getElementById('edit-inv-paid')?.value)||0;
    for(const old of sale.items||[]){const n=items.find(x=>x.id===old.id);if((old.returnedQty||0)>Number(n?.qty||0))return alert(`${old.name}: quantity cannot be less than already returned quantity (${old.returnedQty}).`);}
    const subtotal=items.reduce((a,i)=>a+Number(i.price||0)*Number(i.qty||0),0),appliedDiscount=Math.min(discount,subtotal),total=Math.max(0,subtotal-appliedDiscount),amountPaid=Math.min(Math.max(0,paidInput),total),amountDue=Math.max(0,total-amountPaid),totalProfit=items.reduce((a,i)=>a+(Number(i.price||0)-Number(i.cost||0))*Number(i.qty||0),0)-appliedDiscount;
    const btn=document.getElementById('btn-save-invoice-edit');window.showLoading('btn-save-invoice-edit','Saving...');
    try{await window.runAtomicOrOffline(async transaction=>{
      const saleRef=window.doc(window.db,'sales',saleId),snap=await transaction.get(saleRef);if(!snap.exists())throw new Error('Sale not found.');const fresh=snap.data(),oldItems=fresh.items||[];
      const ids=[...new Set([...oldItems.map(i=>i.id),...items.map(i=>i.id)].filter(Boolean))],snaps=await Promise.all(ids.map(id=>transaction.get(window.doc(window.db,'products',id)))),byId=new Map(ids.map((id,n)=>[id,snaps[n]]));
      for(const id of ids)if(!byId.get(id)?.exists())throw new Error('Product not found.');
      for(const old of oldItems){if(old.id)transaction.update(window.doc(window.db,'products',old.id),{stock:Number(byId.get(old.id).data().stock||0)+Number(old.qty||0)});}
      for(const i of items){if(i.id)transaction.update(window.doc(window.db,'products',i.id),{stock:Number(byId.get(i.id).data().stock||0)-Number(i.qty||0)});}
      if(fresh.customerId){const cRef=window.doc(window.db,'customers',fresh.customerId),cSnap=await transaction.get(cRef);if(cSnap.exists()){const newBal=Math.max(0,Number(cSnap.data().balance||0)-Math.max(0,Number(fresh.amountDue)||0)+amountDue);transaction.update(cRef,{balance:newBal,updatedAt:new Date().toISOString()});const linked=(window.data.customerTransactions||[]).find(t=>t.saleId===saleId);if(linked)transaction.update(window.doc(window.db,'customerTransactions',linked.id),{amount:total,amountPaid,debitAmount:total,creditAmount:amountPaid,amountDue,balanceAfter:newBal,billNo:String(billNumber),note:`Bill No. ${billNumber}`});}}
      const dateInput=document.getElementById('edit-inv-date')?.value;const newDate=dateInput?new Date(dateInput+'T12:00:00').toISOString():fresh.date;
      transaction.update(saleRef,{items,invoiceNumber:billNumber,date:newDate,subtotal,discount:appliedDiscount,total,amountPaid,amountDue,totalProfit,profitKnown:true});
      transaction.set(window.doc(window.db,'settings',window.currentUserId),{nextInvoiceNumber:Math.max(billNumber+1,1)},{merge:true});
    }); window._invoiceEditDraft=null;window.showToast?.('Invoice updated successfully!','success');await openInvoiceModal(saleId);
    }catch(e){console.error(e);alert(e.message||'Failed to update bill.');}finally{window.hideLoading('btn-save-invoice-edit');}
}

window.openInvoiceModal = openInvoiceModal;
window.downloadInvoicePdf = downloadInvoicePdf;
window.printInvoice = printInvoice;
window.shareInvoiceWhatsApp = shareInvoiceWhatsApp;
window.editInvoiceItems = editInvoiceItems;
window.saveInvoiceEdits = saveInvoiceEdits;
window.openInvoiceItemPicker = openInvoiceItemPicker;
window.toggleInvoicePickerRow = toggleInvoicePickerRow;
window.setInvoicePickerQty = setInvoicePickerQty;
window.setInvoicePickerPrice = setInvoicePickerPrice;
window.filterInvoiceItemPicker = filterInvoiceItemPicker;
window.applyInvoiceItemPicker = applyInvoiceItemPicker;
window.removeInvoiceEditItem = removeInvoiceEditItem;
