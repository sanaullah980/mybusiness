// Stock Purchases: inventory purchase flow with the same searchable product-picker
// concept used by Sales. Existing purchase records remain compatible.
function esc(v){ return window.esc ? window.esc(v) : String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function lastPurchasePrice(productId, fallback){
    const rows=(window.data.stockPurchases||[])
        .filter(p=>p.productId===productId && Number(p.unitCost)>0)
        .sort((a,b)=>new Date(b.date)-new Date(a.date));
    return rows.length ? Number(rows[0].unitCost) : Number(fallback||0);
}

export function renderStockPurchases(container) {
    const data=window.data, formatCurrency=window.formatCurrency;
    container.innerHTML=`<button class="btn" style="margin-bottom:20px;" onclick="openStockPurchaseModal()">+ Record Stock Purchase</button>
    <div class="card" id="purchase-list">${data.stockPurchases.length===0
        ? '<div class="empty-state"><i class="fas fa-truck-loading"></i><h3>No purchases yet</h3><p>Record your first stock purchase to update inventory.</p></div>'
        : data.stockPurchases.slice().reverse().map(p=>{
            const amountPaid=p.amountPaid!==undefined?p.amountPaid:p.amount, amountDue=p.amountDue||0;
            const title=p.productName||p.category||'Stock Purchase';
            const itemLine=p.productId?`${p.qty||0} × ${formatCurrency(p.unitCost||0)}`:'';
            return `<div class="list-item" style="cursor:default;"><div class="list-item-info"><h4>${esc(title)}</h4>
            <p>${new Date(p.date).toLocaleDateString()} ${p.supplier?'| '+esc(p.supplier):''} ${p.note?'| '+esc(p.note):''}</p>
            ${itemLine?`<p>${itemLine}</p>`:''}${amountDue>0?`<p><span class="badge badge-low">Due: ${formatCurrency(amountDue)}</span></p>`:''}
            </div><div style="display:flex;align-items:center;gap:10px;"><span style="font-weight:bold;">${formatCurrency(p.amount)}</span>
            <button class="btn btn-sm btn-danger" onclick="deleteStockPurchase('${esc(p.id)}')"><i class="fas fa-trash"></i></button></div></div>`;
        }).join('')}</div>`;
}

function stockPurchaseFormHtml(selectedId='', values={}) {
    const data=window.data;
    const supplierOptions=`<option value="">No Supplier / Cash Purchase</option>${(data.suppliers||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}`;
    const p=(data.products||[]).find(x=>x.id===selectedId);
    const productLabel=p ? `<i class="fas fa-box"></i> ${esc(p.name)}` : `<i class="fas fa-box"></i> Select product`;
    const price=selectedId ? lastPurchasePrice(selectedId,p?.cost) : Number(values.price||0);
    const hint=selectedId && price>0 ? `Last purchase price: ${window.formatCurrency(price)} per unit. You can edit it.` : '';
    return `
      <div class="modal-header"><h2>Record Stock Purchase</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
      <div class="form-group">
        <label>Product</label>
        <button type="button" class="btn btn-secondary stock-purchase-product-picker" id="sp-product-picker" onclick="openStockPurchaseProductPicker()">
          <span id="sp-product-label">${productLabel}</span><i class="fas fa-chevron-down"></i>
        </button>
        <input type="hidden" id="sp-product" value="${esc(selectedId||'')}">
        <small style="display:block;margin-top:6px;color:var(--gray);">Select an existing product. For a new/unlisted item, leave it unselected and enter a product name below.</small>
      </div>
      <div class="form-group">
        <label>Product Name (Optional)</label>
        <input type="text" id="sp-manual-name" maxlength="120" placeholder="Use this only if the product is not in Inventory" value="${esc(values.name||'')}">
      </div>
      <div class="form-row">
        <div class="form-group"><label>Quantity *</label><input type="number" id="sp-qty" min="1" value="${esc(values.qty||1)}" inputmode="numeric"></div>
        <div class="form-group"><label>Price per Unit (Rs.) *</label><input type="number" id="sp-unit-cost" step="0.01" min="0" inputmode="decimal" placeholder="0" value="${price||''}"></div>
      </div>
      <div id="sp-price-hint" style="font-size:12px;color:var(--gray);margin:-6px 0 12px;">${hint}</div>
      <div class="form-group"><label>Supplier</label><select id="sp-supplier">${supplierOptions}</select></div>
      <div class="form-group"><label>Date *</label><input type="date" id="sp-date" value="${esc(values.date||window.getLocalDateStr(new Date()))}"></div>
      <div class="form-group"><label>Amount Paid Now (Rs.)</label><input type="number" id="sp-amount-paid" min="0" step="0.01" placeholder="Leave blank to mark fully paid" value="${esc(values.paid||'')}"></div>
      <div class="form-group"><label>Note</label><input type="text" id="sp-note" value="${esc(values.note||'')}"></div>
      <button class="btn" id="btn-save-sp" onclick="saveStockPurchase()">Save Purchase</button>`;
}

function readStockPurchaseForm() {
    return {
        productId:document.getElementById('sp-product')?.value||'',
        name:document.getElementById('sp-manual-name')?.value||'',
        qty:document.getElementById('sp-qty')?.value||1,
        price:document.getElementById('sp-unit-cost')?.value||'',
        supplier:document.getElementById('sp-supplier')?.value||'',
        date:document.getElementById('sp-date')?.value||window.getLocalDateStr(new Date()),
        paid:document.getElementById('sp-amount-paid')?.value||'',
        note:document.getElementById('sp-note')?.value||''
    };
}

export function openStockPurchaseModal(values={}) {
    const modal=document.getElementById('modal-body');
    const selectedId=values.productId||'';
    modal.classList.remove('product-selection-modal');
    modal.innerHTML=stockPurchaseFormHtml(selectedId,values);
    const supplier=document.getElementById('sp-supplier');
    if(supplier && values.supplier) supplier.value=values.supplier;
    document.getElementById('modal-overlay').classList.remove('hidden');
    requestAnimationFrame(()=>document.getElementById('sp-qty')?.select());
}

export function openStockPurchaseProductPicker(){
    const modal=document.getElementById('modal-body'), products=Array.isArray(window.data.products)?window.data.products:[];
    modal.classList.add('product-selection-modal');
    modal.innerHTML=`
      <div class="modal-header"><h2>Select Product</h2><button class="close-btn" onclick="closeStockPurchaseProductPicker()">&times;</button></div>
      <div class="product-picker-search form-group"><input type="search" id="sp-product-search" placeholder="Search products..." autocomplete="off" oninput="filterStockPurchaseProducts()"></div>
      <div id="sp-product-list" class="product-selection-list">
        ${products.length?products.map(p=>{
          const purchasePrice=lastPurchasePrice(p.id,p.cost);
          return `<button type="button" class="product-select-item-wrapper sp-product-option" data-name="${esc(String(p.name||'').toLowerCase())}" onclick="selectStockPurchaseProduct('${esc(p.id)}')">
            <span class="product-select-main"><strong>${esc(p.name||'Unnamed product')}</strong><small>Stock: ${Number(p.stock)||0} · Price: ${window.formatCurrency(purchasePrice)}</small></span>
            <i class="fas fa-chevron-right product-select-chevron" aria-hidden="true"></i>
          </button>`;
        }).join(''):'<p class="empty-state"><i class="fas fa-box-open"></i><strong>No products found</strong><span>Add products in Inventory or use a manual product name.</span></p>'}
      </div>`;
    requestAnimationFrame(()=>document.getElementById('sp-product-search')?.blur());
}

export function filterStockPurchaseProducts(){
    const q=(document.getElementById('sp-product-search')?.value||'').toLowerCase().trim();
    document.querySelectorAll('.sp-product-option').forEach(el=>el.classList.toggle('hidden',!el.dataset.name.includes(q)));
}
export function closeStockPurchaseProductPicker(){
    const values=readStockPurchaseForm();
    openStockPurchaseModal(values);
}
export function selectStockPurchaseProduct(productId){
    const p=(window.data.products||[]).find(x=>x.id===productId); if(!p)return;
    const values=readStockPurchaseForm();
    values.productId=p.id;
    values.name='';
    values.price=lastPurchasePrice(p.id,p.cost)||'';
    openStockPurchaseModal(values);
}

export function onStockPurchaseProductChange(){ /* kept for compatibility with existing links */ }
export function showStockPurchaseTab(){ /* kept for compatibility with older navigation */ }

export async function saveStockPurchase() {
    const productId=document.getElementById('sp-product')?.value||null;
    const manualName=document.getElementById('sp-manual-name')?.value.trim()||'';
    const date=document.getElementById('sp-date')?.value;
    const supplierId=document.getElementById('sp-supplier')?.value||null;
    const note=document.getElementById('sp-note')?.value.trim()||'';
    const qty=Math.max(0,parseInt(document.getElementById('sp-qty')?.value,10)||0);
    const unitCost=parseFloat(document.getElementById('sp-unit-cost')?.value);
    const paidRaw=document.getElementById('sp-amount-paid')?.value??'';
    if(!date)return alert('Date is required.');
    if(!productId&&!manualName)return alert('Select a product or enter a product name.');
    if(qty<1||!Number.isFinite(unitCost)||unitCost<0)return alert('Enter a valid quantity and price.');
    const amount=qty*unitCost;
    const amountPaid=paidRaw===''?amount:Math.max(0,Math.min(amount,parseFloat(paidRaw)||0));
    const amountDue=Math.max(0,amount-amountPaid);
    if(amountDue>0&&!supplierId)return alert('An unpaid amount requires selecting a Supplier so the balance can be tracked.');
    window.showLoading('btn-save-sp','Saving...');
    try{
      await window.runAtomicOrOffline(async transaction=>{
        let productSnap=null,supplierSnap=null,supplierName='';
        if(productId){
          productSnap=await transaction.get(window.doc(window.db,'products',productId));
          if(!productSnap.exists())throw new Error('Product not found.');
          if(productSnap.data().ownerId!==window.currentUserId)throw new Error('Unauthorized.');
        }
        if(supplierId){
          supplierSnap=await transaction.get(window.doc(window.db,'suppliers',supplierId));
          if(!supplierSnap.exists())throw new Error('Supplier not found.');
          supplierName=supplierSnap.data().name||'';
        }
        if(productId){
          const pd=productSnap.data();
          transaction.update(window.doc(window.db,'products',productId),{stock:Number(pd.stock||0)+qty,cost:unitCost});
        }
        const purchaseRef=window.doc(window.collection(window.db,'stockPurchases'));
        transaction.set(purchaseRef,{ownerId:window.currentUserId,date:new Date(date).toISOString(),amount,amountPaid,amountDue,category:'',note,supplierId:supplierId||null,supplier:supplierName,productId:productId||null,productName:productId?(productSnap.data().name||manualName):manualName,qty,unitCost});
        if(supplierId&&amountDue>0){
          const newBalance=Number(supplierSnap.data().balance||0)+amountDue;
          transaction.update(window.doc(window.db,'suppliers',supplierId),{balance:newBalance});
          const txnRef=window.doc(window.collection(window.db,'supplierTransactions'));
          transaction.set(txnRef,{ownerId:window.currentUserId,supplierId,type:'purchase_debt',amount:amountDue,balanceAfter:newBalance,date:new Date(date).toISOString(),note:`Stock purchase${productId?' : '+(productSnap.data().name||''):manualName?' : '+manualName:''}`,purchaseId:purchaseRef.id});
        }
      });
      window.showToast?.('Stock purchase recorded','success');
      window.closeModal();
    }catch(error){console.error(error);alert(error.message||'Failed to record stock purchase.');}
    finally{window.hideLoading('btn-save-sp');}
}
export async function deleteStockPurchase(id){
    const purchase=(window.data.stockPurchases||[]).find(x=>x.id===id); if(!purchase)return;
    if(!confirm(`Delete this stock purchase of ${purchase.productName||'this item'}? The purchased quantity will be removed from inventory and any linked supplier debt will be reversed.`))return;
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
        const purchaseSnap=await transaction.get(purchaseRef); if(!purchaseSnap.exists())throw new Error('Purchase not found.');
        const p=purchaseSnap.data(); if(p.ownerId!==window.currentUserId)throw new Error('Unauthorized.');
        if(p.productId){const productRef=window.doc(window.db,'products',p.productId),ps=await transaction.get(productRef);if(ps.exists()){const stock=Number(ps.data().stock||0),qty=Number(p.qty||0);transaction.update(productRef,{stock:stock-qty});}}
        if(p.supplierId&&Number(p.amountDue||0)>0){const supplierRef=window.doc(window.db,'suppliers',p.supplierId),ss=await transaction.get(supplierRef);if(ss.exists()){const newBalance=Math.max(0,Number(ss.data().balance||0)-Number(p.amountDue||0));transaction.update(supplierRef,{balance:newBalance,updatedAt:new Date().toISOString()});}
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
window.filterStockPurchaseProducts=filterStockPurchaseProducts;
window.closeStockPurchaseProductPicker=closeStockPurchaseProductPicker;
window.selectStockPurchaseProduct=selectStockPurchaseProduct;
window.showStockPurchaseTab=showStockPurchaseTab;
window.onStockPurchaseProductChange=onStockPurchaseProductChange;
window.saveStockPurchase=saveStockPurchase;
window.deleteStockPurchase=deleteStockPurchase;
