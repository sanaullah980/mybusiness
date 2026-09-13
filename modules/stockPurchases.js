// Stock Purchases: multi-product picker modeled on the Sales product picker.
// Each selected product gets its own quantity + purchase price, then all items
// are recorded together as one purchase document while keeping legacy fields.
function esc(v){ return window.esc ? window.esc(v) : String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function lastPurchasePrice(productId, fallback){
    const rows=(window.data.stockPurchases||[])
        .filter(p=>p.productId===productId && Number(p.unitCost)>0)
        .sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(rows.length) return Number(rows[0].unitCost);
    // Also look inside newer multi-item purchase records.
    for(const purchase of (window.data.stockPurchases||[]).slice().sort((a,b)=>new Date(b.date)-new Date(a.date))){
        const item=(purchase.items||[]).find(i=>i.productId===productId && Number(i.unitCost)>0);
        if(item) return Number(item.unitCost);
    }
    return Number(fallback||0);
}
function productById(id){ return (window.data.products||[]).find(p=>p.id===id); }
function money(v){ return window.formatCurrency(Number(v)||0); }
function ensureDraft(){ if(!Array.isArray(window.stockPurchaseDraftItems)) window.stockPurchaseDraftItems=[]; return window.stockPurchaseDraftItems; }

export function renderStockPurchases(container) {
    const data=window.data, formatCurrency=window.formatCurrency;
    container.innerHTML=`<button class="btn" style="margin-bottom:20px;" onclick="openStockPurchaseModal()">+ Record Stock Purchase</button>
    <div class="card" id="purchase-list">${data.stockPurchases.length===0
        ? '<div class="empty-state"><i class="fas fa-truck-loading"></i><h3>No purchases yet</h3><p>Record your first stock purchase to update inventory.</p></div>'
        : data.stockPurchases.slice().reverse().map(p=>{
            const amountDue=p.amountDue||0;
            const items=Array.isArray(p.items)&&p.items.length ? p.items : (p.productId?[{productId:p.productId,productName:p.productName,qty:p.qty,unitCost:p.unitCost}]:[]);
            const title=items.length>1 ? `${items.length} Products` : (p.productName||p.category||'Stock Purchase');
            const itemLine=items.map(i=>`${esc(i.productName||productById(i.productId)?.name||'Item')} — ${Number(i.qty)||0} × ${formatCurrency(i.unitCost||0)}`).join('<br>');
            return `<div class="list-item" style="cursor:default;"><div class="list-item-info"><h4>${esc(title)}</h4>
            <p>${new Date(p.date).toLocaleDateString()} ${p.supplier?'| '+esc(p.supplier):''} ${p.note?'| '+esc(p.note):''}</p>
            ${itemLine?`<p>${itemLine}</p>`:''}${amountDue>0?`<p><span class="badge badge-low">Due: ${formatCurrency(amountDue)}</span></p>`:''}
            </div><div style="display:flex;align-items:center;gap:10px;"><span style="font-weight:bold;">${formatCurrency(p.amount)}</span>
            <button class="btn btn-sm btn-danger" onclick="deleteStockPurchase('${esc(p.id)}')"><i class="fas fa-trash"></i></button></div></div>`;
        }).join('')}</div>`;
}

function stockPurchaseFormHtml(values={}) {
    const data=window.data;
    const supplierOptions=`<option value="">No Supplier / Cash Purchase</option>${(data.suppliers||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}`;
    const draft=ensureDraft();
    const selectedProducts=draft.map(item=>{
        const p=productById(item.productId);
        return p ? {...item, name:p.name, stock:Number(p.stock)||0} : null;
    }).filter(Boolean);
    const total=selectedProducts.reduce((sum,i)=>sum+(Number(i.qty)||0)*(Number(i.price)||0),0);
    return `
      <div class="modal-header"><h2>Record Stock Purchase</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
      <div class="form-group">
        <label>Products</label>
        <button type="button" class="btn btn-secondary stock-purchase-product-picker" onclick="openStockPurchaseProductPicker()">
          <span><i class="fas fa-plus"></i> ${selectedProducts.length ? 'Add / Change Products' : 'Select Products'}</span><i class="fas fa-chevron-down"></i>
        </button>
      </div>
      <div class="stock-purchase-selected-items" id="sp-selected-items">
        ${selectedProducts.length ? selectedProducts.map((item,index)=>`<div class="stock-purchase-item-card">
            <div class="stock-purchase-item-head"><div><strong>${esc(item.name)}</strong><small>Current stock: ${item.stock}</small></div><button type="button" class="btn btn-sm btn-danger" onclick="removeStockPurchaseItem(${index})" aria-label="Remove ${esc(item.name)}"><i class="fas fa-trash"></i></button></div>
            <div class="form-row stock-purchase-item-fields">
              <div class="form-group"><label>Quantity</label><input type="number" min="1" step="1" value="${Number(item.qty)||1}" inputmode="numeric" onchange="updateStockPurchaseDraftItem(${index},'qty',this.value)"></div>
              <div class="form-group"><label>Price per Unit (Rs.)</label><input type="number" min="0" step="0.01" value="${Number(item.price)||0}" inputmode="decimal" onchange="updateStockPurchaseDraftItem(${index},'price',this.value)"></div>
            </div>
            <div class="stock-purchase-item-total">Item total: <strong>${money((Number(item.qty)||0)*(Number(item.price)||0))}</strong></div>
        </div>`).join('') : '<div class="empty-state" style="padding:18px;"><i class="fas fa-box-open"></i><strong>No products selected</strong><span>Select one or multiple products above.</span></div>'}
      </div>
      <div class="stock-purchase-total card" style="margin:12px 0;"><span>Total Purchase</span><strong id="sp-total">${money(total)}</strong></div>
      <div class="form-group">
        <label>Manual Product Name (Optional)</label>
        <input type="text" id="sp-manual-name" maxlength="120" placeholder="Use this only for an item not in Inventory" value="${esc(values.name||'')}">
      </div>
      <div class="form-group"><label>Supplier</label><select id="sp-supplier">${supplierOptions}</select></div>
      <div class="form-group"><label>Date *</label><input type="date" id="sp-date" value="${esc(values.date||window.getLocalDateStr(new Date()))}"></div>
      <div class="form-group"><label>Amount Paid Now (Rs.)</label><input type="number" id="sp-amount-paid" min="0" step="0.01" placeholder="Leave blank to mark fully paid" value="${esc(values.paid||'')}"></div>
      <div class="form-group"><label>Note</label><input type="text" id="sp-note" value="${esc(values.note||'')}"></div>
      <button class="btn" id="btn-save-sp" onclick="saveStockPurchase()">Save Purchase</button>`;
}

function readStockPurchaseForm() {
    return {
        name:document.getElementById('sp-manual-name')?.value||'',
        supplier:document.getElementById('sp-supplier')?.value||'',
        date:document.getElementById('sp-date')?.value||window.getLocalDateStr(new Date()),
        paid:document.getElementById('sp-amount-paid')?.value||'',
        note:document.getElementById('sp-note')?.value||''
    };
}

export function openStockPurchaseModal(values={}) {
    const modal=document.getElementById('modal-body');
    modal.classList.remove('product-selection-modal');
    modal.innerHTML=stockPurchaseFormHtml(values);
    const supplier=document.getElementById('sp-supplier');
    if(supplier && values.supplier) supplier.value=values.supplier;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export function openStockPurchaseProductPicker(){
    const modal=document.getElementById('modal-body'), products=Array.isArray(window.data.products)?window.data.products:[];
    const draft=ensureDraft();
    modal.classList.add('product-selection-modal');
    modal.innerHTML=`
      <div class="modal-header"><h2>Select Products</h2><button class="close-btn" onclick="closeStockPurchaseProductPicker()">&times;</button></div>
      <div class="product-picker-search form-group"><input type="search" id="sp-product-search" placeholder="Search products..." autocomplete="off" oninput="filterStockPurchaseProducts()"></div>
      <div id="sp-product-list" class="product-selection-list">
        ${products.length?products.map(p=>{
          const selected=draft.find(i=>i.productId===p.id);
          const purchasePrice=selected ? Number(selected.price)||0 : lastPurchasePrice(p.id,p.cost);
          return `<div class="product-select-item-wrapper sp-product-option" data-name="${esc(String(p.name||'').toLowerCase())}">
            <button type="button" class="product-select-item" onclick="toggleStockPurchaseRow('${esc(p.id)}')" aria-controls="sp-qty-container-${esc(p.id)}" aria-expanded="${!!selected}">
                <input type="checkbox" id="sp-chk-${esc(p.id)}" ${selected?'checked':''} tabindex="-1" onpointerdown="event.preventDefault()" onclick="event.preventDefault();event.stopPropagation();toggleStockPurchaseRow('${esc(p.id)}')" aria-label="Select ${esc(p.name)}">
                <span class="product-select-main"><strong>${esc(p.name||'Unnamed product')}</strong><small>Stock: ${Number(p.stock)||0} · Last Price: ${money(purchasePrice)}</small></span>
                <i class="fas fa-chevron-right product-select-chevron" aria-hidden="true"></i>
            </button>
            <div id="sp-qty-container-${esc(p.id)}" class="product-qty-row ${selected?'':'hidden'}">
                <label for="sp-qty-${esc(p.id)}">Quantity</label><input type="number" id="sp-qty-${esc(p.id)}" value="${selected?Number(selected.qty)||1:1}" min="1" step="1" inputmode="numeric" onclick="event.stopPropagation()" oninput="setStockPurchasePickerQty('${esc(p.id)}',this.value)">
                <label for="sp-price-${esc(p.id)}">Price</label><input type="number" id="sp-price-${esc(p.id)}" value="${purchasePrice||''}" min="0" step="0.01" inputmode="decimal" placeholder="Purchase price" onclick="event.stopPropagation()" oninput="setStockPurchasePickerPrice('${esc(p.id)}',this.value)">
            </div>
          </div>`;
        }).join(''):'<p class="empty-state"><i class="fas fa-box-open"></i><strong>No products found</strong><span>Add products in Inventory first.</span></p>'}
      </div>
      <div class="product-picker-footer"><button class="btn" onclick="applyStockPurchaseSelection()">Add Selected Products</button></div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    requestAnimationFrame(()=>document.getElementById('sp-product-search')?.blur());
}

export function toggleStockPurchaseRow(productId){
    const checkbox=document.getElementById(`sp-chk-${productId}`), qtyContainer=document.getElementById(`sp-qty-container-${productId}`);
    const wrapper=checkbox?.closest('.sp-product-option');
    if(!checkbox||!qtyContainer)return;
    checkbox.checked=!checkbox.checked;
    qtyContainer.classList.toggle('hidden',!checkbox.checked);
    wrapper?.querySelector('.product-select-item')?.setAttribute('aria-expanded',checkbox.checked?'true':'false');
    if(checkbox.checked){
        const p=productById(productId),draft=ensureDraft();
        if(!draft.find(i=>i.productId===productId)) draft.push({productId,qty:1,price:lastPurchasePrice(productId,p?.cost)});
    }else{
        window.stockPurchaseDraftItems=ensureDraft().filter(i=>i.productId!==productId);
    }
}
export function setStockPurchasePickerQty(productId,value){
    const item=ensureDraft().find(i=>i.productId===productId); if(item)item.qty=Math.max(1,parseInt(value,10)||1);
}
export function setStockPurchasePickerPrice(productId,value){
    const item=ensureDraft().find(i=>i.productId===productId); if(item)item.price=Math.max(0,parseFloat(value)||0);
}
export function applyStockPurchaseSelection(){
    const selected=ensureDraft().filter(i=>document.getElementById(`sp-chk-${i.productId}`)?.checked);
    window.stockPurchaseDraftItems=selected.map(i=>({productId:i.productId,qty:Math.max(1,parseInt(i.qty,10)||1),price:Math.max(0,Number(i.price)||0)}));
    if(!window.stockPurchaseDraftItems.length)return alert('Please select at least one product.');
    const values=readStockPurchaseForm();
    openStockPurchaseModal(values);
}
export function updateStockPurchaseDraftItem(index,field,value){
    const draft=ensureDraft(),item=draft[index]; if(!item)return;
    item[field]=field==='qty'?Math.max(1,parseInt(value,10)||1):Math.max(0,parseFloat(value)||0);
    const values=readStockPurchaseForm();
    openStockPurchaseModal(values);
}
export function removeStockPurchaseItem(index){
    const values=readStockPurchaseForm();
    ensureDraft().splice(index,1);
    openStockPurchaseModal(values);
}
export function filterStockPurchaseProducts(){
    const q=(document.getElementById('sp-product-search')?.value||'').toLowerCase().trim();
    document.querySelectorAll('.sp-product-option').forEach(el=>el.classList.toggle('hidden',!el.dataset.name.includes(q)));
}
export function closeStockPurchaseProductPicker(){
    const values=readStockPurchaseForm();
    openStockPurchaseModal(values);
}

// Compatibility with older navigation/code paths.
export function selectStockPurchaseProduct(productId){
    const p=productById(productId); if(!p)return;
    const draft=ensureDraft();
    if(!draft.find(i=>i.productId===productId))draft.push({productId,qty:1,price:lastPurchasePrice(productId,p.cost)});
    openStockPurchaseModal(readStockPurchaseForm());
}
export function onStockPurchaseProductChange(){ }
export function showStockPurchaseTab(){ }

export async function saveStockPurchase() {
    const draft=ensureDraft().map(i=>({...i,qty:Math.max(1,parseInt(i.qty,10)||0),price:Math.max(0,Number(i.price)||0)}));
    const manualName=document.getElementById('sp-manual-name')?.value.trim()||'';
    const date=document.getElementById('sp-date')?.value;
    const supplierId=document.getElementById('sp-supplier')?.value||null;
    const note=document.getElementById('sp-note')?.value.trim()||'';
    const paidRaw=document.getElementById('sp-amount-paid')?.value??'';
    if(!date)return alert('Date is required.');
    if(!draft.length&&!manualName)return alert('Select at least one product or enter a manual product name.');
    if(draft.some(i=>!Number.isFinite(i.price)||i.price<0||i.qty<1))return alert('Enter a valid quantity and price for every selected product.');
    const manualAmount=manualName&&!draft.length ? Math.max(0,parseFloat(document.getElementById('sp-unit-cost')?.value)||0) : 0;
    const total=draft.reduce((sum,i)=>sum+i.qty*i.price,0)+manualAmount;
    if(total<=0)return alert('Purchase total must be greater than Rs. 0.');
    const amountPaid=paidRaw===''?total:Math.max(0,Math.min(total,parseFloat(paidRaw)||0));
    const amountDue=Math.max(0,total-amountPaid);
    if(amountDue>0&&!supplierId)return alert('An unpaid amount requires selecting a Supplier so the balance can be tracked.');
    window.showLoading('btn-save-sp','Saving...');
    try{
      await window.runAtomicOrOffline(async transaction=>{
        const productSnaps=new Map();
        let supplierSnap=null,supplierName='';
        for(const item of draft){
          const ref=window.doc(window.db,'products',item.productId);
          const snap=await transaction.get(ref);
          if(!snap.exists())throw new Error(`Product not found: ${item.productId}`);
          if(snap.data().ownerId!==window.currentUserId)throw new Error('Unauthorized.');
          productSnaps.set(item.productId,snap);
        }
        if(supplierId){
          supplierSnap=await transaction.get(window.doc(window.db,'suppliers',supplierId));
          if(!supplierSnap.exists())throw new Error('Supplier not found.');
          supplierName=supplierSnap.data().name||'';
        }
        for(const item of draft){
          const snap=productSnaps.get(item.productId),pd=snap.data();
          transaction.update(window.doc(window.db,'products',item.productId),{stock:Number(pd.stock||0)+item.qty,cost:item.price});
        }
        const purchaseRef=window.doc(window.collection(window.db,'stockPurchases'));
        const items=draft.map(item=>({productId:item.productId,productName:productSnaps.get(item.productId).data().name||'',qty:item.qty,unitCost:item.price,amount:item.qty*item.price}));
        const primary=items[0]||null;
        transaction.set(purchaseRef,{ownerId:window.currentUserId,date:new Date(date).toISOString(),amount:total,amountPaid,amountDue,category:'',note,supplierId:supplierId||null,supplier:supplierName,productId:primary?.productId||null,productName:items.length>1?`${items.length} Products`:primary?.productName||manualName,qty:primary?.qty||0,unitCost:primary?.unitCost||0,items,manualProductName:manualName||null});
        if(supplierId&&amountDue>0){
          const newBalance=Number(supplierSnap.data().balance||0)+amountDue;
          transaction.update(window.doc(window.db,'suppliers',supplierId),{balance:newBalance});
          const txnRef=window.doc(window.collection(window.db,'supplierTransactions'));
          transaction.set(txnRef,{ownerId:window.currentUserId,supplierId,type:'purchase_debt',amount:amountDue,balanceAfter:newBalance,date:new Date(date).toISOString(),note:`Stock purchase${items.length?` : ${items.length} item${items.length===1?'':'s'}`:manualName?` : ${manualName}`:''}`,purchaseId:purchaseRef.id});
        }
      });
      window.stockPurchaseDraftItems=[];
      window.showToast?.('Stock purchase recorded','success');
      window.closeModal();
    }catch(error){console.error(error);alert(error.message||'Failed to record stock purchase.');}
    finally{window.hideLoading('btn-save-sp');}
}

export async function deleteStockPurchase(id){
    const purchase=(window.data.stockPurchases||[]).find(x=>x.id===id); if(!purchase)return;
    if(!confirm(`Delete this stock purchase? The purchased quantity will be removed from inventory and any linked supplier debt will be reversed.`))return;
    try{
      const purchaseRef=window.doc(window.db,'stockPurchases',id);
      const purchaseSnap=await window.getDoc(purchaseRef); if(!purchaseSnap.exists())throw new Error('Purchase not found.');
      const existing=purchaseSnap.data(); if(existing.ownerId!==window.currentUserId)throw new Error('Unauthorized.');
      let linkedSupplierTxnRefs=[];
      if(existing.supplierId&&Number(existing.amountDue||0)>0){
        const tq=window.query(window.collection(window.db,'supplierTransactions'),window.where('purchaseId','==',id));
        const ts=await window.getDocs(tq); linkedSupplierTxnRefs=ts.docs.filter(d=>d.data()?.ownerId===window.currentUserId).map(d=>d.ref);
      }
      await window.runAtomicOrOffline(async transaction=>{
        const ps=await transaction.get(purchaseRef); if(!ps.exists())throw new Error('Purchase not found.');
        const p=ps.data(); if(p.ownerId!==window.currentUserId)throw new Error('Unauthorized.');
        const items=Array.isArray(p.items)&&p.items.length?p.items:(p.productId?[{productId:p.productId,qty:p.qty||0}]:[]);
        for(const item of items){
          if(!item.productId)continue;
          const productRef=window.doc(window.db,'products',item.productId),prod=await transaction.get(productRef);
          if(prod.exists())transaction.update(productRef,{stock:Number(prod.data().stock||0)-Number(item.qty||0)});
        }
        if(p.supplierId&&Number(p.amountDue||0)>0){
          const supplierRef=window.doc(window.db,'suppliers',p.supplierId),ss=await transaction.get(supplierRef);
          if(ss.exists())transaction.update(supplierRef,{balance:Math.max(0,Number(ss.data().balance||0)-Number(p.amountDue||0)),updatedAt:new Date().toISOString()});
          linkedSupplierTxnRefs.forEach(ref=>transaction.delete(ref));
        }
        transaction.delete(purchaseRef);
      });
      window.showToast?.('Stock purchase deleted and inventory updated','success');
    }catch(e){console.error(e);alert(e.message||'Failed to delete stock purchase.');}
}

window.renderStockPurchases=renderStockPurchases;
window.openStockPurchaseModal=openStockPurchaseModal;
window.openStockPurchaseProductPicker=openStockPurchaseProductPicker;
window.toggleStockPurchaseRow=toggleStockPurchaseRow;
window.setStockPurchasePickerQty=setStockPurchasePickerQty;
window.setStockPurchasePickerPrice=setStockPurchasePickerPrice;
window.applyStockPurchaseSelection=applyStockPurchaseSelection;
window.updateStockPurchaseDraftItem=updateStockPurchaseDraftItem;
window.removeStockPurchaseItem=removeStockPurchaseItem;
window.filterStockPurchaseProducts=filterStockPurchaseProducts;
window.closeStockPurchaseProductPicker=closeStockPurchaseProductPicker;
window.selectStockPurchaseProduct=selectStockPurchaseProduct;
window.showStockPurchaseTab=showStockPurchaseTab;
window.onStockPurchaseProductChange=onStockPurchaseProductChange;
window.saveStockPurchase=saveStockPurchase;
window.deleteStockPurchase=deleteStockPurchase;
