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
function ensureManualDraft(){ if(!Array.isArray(window.stockPurchaseManualItems)) window.stockPurchaseManualItems=[]; return window.stockPurchaseManualItems; }
function manualItemsFromLegacy(values={}){
    const arr=ensureManualDraft();
    if(!arr.length && String(values.name||'').trim()) arr.push({name:String(values.name||'').trim(),qty:Math.max(1,parseInt(values.manualQty,10)||1),price:Math.max(0,Number(values.manualPrice)||0)});
    return arr;
}

export function renderStockPurchases(container) {
    const data=window.data, formatCurrency=window.formatCurrency;
    container.innerHTML=`<div class="purchase-action-bar"><button class="btn purchase-scan-btn" style="margin-bottom:20px;" onclick="openBillScanner()"><i class="fas fa-file-invoice"></i> Scan Bill</button><button class="btn btn-secondary" style="margin-bottom:20px;" onclick="openStockPurchaseModal()"><i class="fas fa-pen"></i> Add Manually</button></div>
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
    const manualTotal=manualItemsFromLegacy(values).reduce((sum,i)=>sum+(Number(i.qty)||0)*(Number(i.price)||0),0);
    const grandTotal=total+manualTotal;
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
      <div class="form-group">
        <label>Manual Products (Optional)</label>
        <div id="sp-manual-items">
          ${manualItemsFromLegacy(values).length ? manualItemsFromLegacy(values).map((item,index)=>`<div class="stock-purchase-item-card sp-manual-item-card">
            <div class="stock-purchase-item-head"><div><strong>Manual Item ${index+1}</strong><small>Will be added to Inventory automatically</small></div><button type="button" class="btn btn-sm btn-danger" onclick="removeStockPurchaseManualItem(${index})" aria-label="Remove manual item"><i class="fas fa-trash"></i></button></div>
            <div class="form-group"><label>Product Name</label><input type="text" maxlength="120" value="${esc(item.name||'')}" placeholder="Item not in Inventory" oninput="updateStockPurchaseManualItem(${index},'name',this.value)"></div>
            <div class="form-row">
              <div class="form-group"><label>Quantity</label><input type="number" min="1" step="1" inputmode="numeric" value="${Number(item.qty)||1}" oninput="updateStockPurchaseManualItem(${index},'qty',this.value)"></div>
              <div class="form-group"><label>Purchase Price / Unit (Rs.)</label><input type="number" min="0" step="0.01" inputmode="decimal" value="${item.price!==undefined&&item.price!==''?esc(item.price):''}" placeholder="Price per unit" oninput="updateStockPurchaseManualItem(${index},'price',this.value)"></div>
            </div>
            <div class="stock-purchase-item-total">Item total: <strong>${money((Number(item.qty)||0)*(Number(item.price)||0))}</strong></div>
          </div>`).join('') : '<div class="empty-state" style="padding:14px;"><i class="fas fa-pen"></i><span>No manual items added</span></div>'}
        </div>
        <button type="button" class="btn btn-secondary" style="margin-top:10px;width:100%;" onclick="addStockPurchaseManualItem()"><i class="fas fa-plus"></i> Add Manual Item</button>
      </div>
      <div class="stock-purchase-total card" style="margin:12px 0;"><span>Total Purchase</span><strong id="sp-total">${money(grandTotal)}</strong></div>
      <div class="form-group"><label>Supplier</label><select id="sp-supplier">${supplierOptions}</select></div>
      <div class="form-group"><label>Date *</label><input type="date" id="sp-date" value="${esc(values.date||window.getLocalDateStr(new Date()))}"></div>
      <div class="form-group"><label>Amount Paid Now (Rs.)</label><input type="number" id="sp-amount-paid" min="0" step="0.01" placeholder="Leave blank to mark fully paid" value="${esc(values.paid||'')}"></div>
      <div class="form-group"><label>Note</label><input type="text" id="sp-note" value="${esc(values.note||'')}"></div>
      <button class="btn" id="btn-save-sp" onclick="saveStockPurchase()">Save Purchase</button>`;
}

function readStockPurchaseForm() {
    return {
        supplier:document.getElementById('sp-supplier')?.value||'',
        date:document.getElementById('sp-date')?.value||window.getLocalDateStr(new Date()),
        paid:document.getElementById('sp-amount-paid')?.value||'',
        note:document.getElementById('sp-note')?.value||''
    };
}

export function openStockPurchaseModal(values={}) {
    if(!Object.keys(values).length && !Array.isArray(window.stockPurchaseManualItems)) window.stockPurchaseManualItems=[];
    manualItemsFromLegacy(values);
    const modal=document.getElementById('modal-body');
    modal.classList.remove('product-selection-modal');
    modal.innerHTML=stockPurchaseFormHtml(values);
    const supplier=document.getElementById('sp-supplier');
    if(supplier && values.supplier) supplier.value=values.supplier;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export function addStockPurchaseManualItem(){
    ensureManualDraft().push({name:'',qty:1,price:0});
    openStockPurchaseModal(readStockPurchaseForm());
    setTimeout(()=>{const els=document.querySelectorAll('#sp-manual-items input[type="text"]');els[els.length-1]?.focus();},50);
}
export function updateStockPurchaseManualItem(index,field,value){
    const item=ensureManualDraft()[index]; if(!item)return;
    if(field==='name') item.name=String(value||'');
    else if(field==='qty') item.qty=Math.max(1,parseInt(value,10)||1);
    else item.price=Math.max(0,parseFloat(value)||0);
    const total=ensureDraft().reduce((sum,i)=>sum+(Number(i.qty)||0)*(Number(i.price)||0),0)+ensureManualDraft().reduce((sum,i)=>sum+(Number(i.qty)||0)*(Number(i.price)||0),0);
    const totalEl=document.getElementById('sp-total'); if(totalEl)totalEl.textContent=money(total);
}
export function removeStockPurchaseManualItem(index){
    const values=readStockPurchaseForm(); ensureManualDraft().splice(index,1); openStockPurchaseModal(values);
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
    const manualItems=ensureManualDraft().map(i=>({name:String(i.name||'').trim(),qty:Math.max(1,parseInt(i.qty,10)||0),price:Math.max(0,Number(i.price)||0)}));
    const date=document.getElementById('sp-date')?.value;
    const supplierId=document.getElementById('sp-supplier')?.value||null;
    const note=document.getElementById('sp-note')?.value.trim()||'';
    const paidRaw=document.getElementById('sp-amount-paid')?.value??'';
    if(!date)return alert('Date is required.');
    if(!draft.length&&!manualItems.length)return alert('Select at least one product or add a manual product.');
    if(manualItems.some(i=>!i.name||i.price<=0||i.qty<1))return alert('Enter a name, valid quantity and purchase price for every manual item.');
    if(draft.some(i=>!Number.isFinite(i.price)||i.price<0||i.qty<1))return alert('Enter a valid quantity and price for every selected product.');
    const manualAmount=manualItems.reduce((sum,i)=>sum+i.qty*i.price,0);
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
        const manualProducts=[];
        for(const mi of manualItems){
          const manualRef=window.doc(window.collection(window.db,'products'));
          const product={id:manualRef.id,name:mi.name,qty:mi.qty,price:mi.price,ref:manualRef};
          manualProducts.push(product);
          transaction.set(manualRef,{name:mi.name,barcode:'',cost:mi.price,price:mi.price,wholesalePrice:mi.price,retailPrice:mi.price,stock:mi.qty,minStock:5,ownerId:window.currentUserId});
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
        manualProducts.forEach((mp,idx)=>{ const mi=manualItems[idx]; items.push({productId:mp.id,productName:mp.name,qty:mp.qty,unitCost:mp.price,amount:mi.qty*mi.price,manual:true}); });
        const primary=items[0]||null;
        transaction.set(purchaseRef,{ownerId:window.currentUserId,date:new Date(date).toISOString(),amount:total,amountPaid,amountDue,category:'',note,supplierId:supplierId||null,supplier:supplierName,productId:primary?.productId||null,productName:items.length>1?`${items.length} Products`:primary?.productName||'',qty:primary?.qty||0,unitCost:primary?.unitCost||0,items,manualProductName:manualItems.map(i=>i.name).join(', ')||null});
        if(supplierId&&amountDue>0){
          const newBalance=Number(supplierSnap.data().balance||0)+amountDue;
          transaction.update(window.doc(window.db,'suppliers',supplierId),{balance:newBalance});
          const txnRef=window.doc(window.collection(window.db,'supplierTransactions'));
          transaction.set(txnRef,{ownerId:window.currentUserId,supplierId,type:'purchase_debt',amount:amountDue,balanceAfter:newBalance,date:new Date(date).toISOString(),note:`Stock purchase${items.length?` : ${items.length} item${items.length===1?'':'s'}`:''}`,purchaseId:purchaseRef.id});
        }
      });
      window.stockPurchaseDraftItems=[];
      window.stockPurchaseManualItems=[];
      window.showToast?.('Stock purchase recorded','success');
      window.closeModal();
    }catch(error){console.error(error);alert(error.message||'Failed to record stock purchase.');}
    finally{window.hideLoading('btn-save-sp');}
}


// Scanner commit path. It deliberately reuses the same transaction/stock/debt rules
// as normal purchases, while accepting reviewed OCR items and bill metadata.
export async function commitStockPurchaseFromScanner({items,header}){
    if(window.currentRole!=='admin' && !window.hasPermission?.('stockPurchases')) throw new Error('You do not have permission to create purchases.');
    const cleanItems=(items||[]).map(i=>({
        name:String(i.name||'').trim(), productId:String(i.selectedProductId||i.productId||''),
        qty:Number(i.quantity)||0, unit:String(i.unit||'piece').trim()||'piece', packSize:String(i.packSize||'').trim(),
        price:Number(i.purchasePrice)||0, sku:String(i.sku||'').trim(), barcode:String(i.barcode||'').trim()
    }));
    if(!cleanItems.length)throw new Error('No purchase items were detected.');
    if(cleanItems.some(i=>!i.name||i.qty<=0||i.price<0))throw new Error('Review every product name, quantity and purchase price before confirming.');
    const total=cleanItems.reduce((s,i)=>s+i.qty*i.price,0);
    const billTotal=Number(header?.grandTotal)||0;
    const amountPaidRaw=header?.paid;
    const amountPaid=amountPaidRaw===''||amountPaidRaw===undefined||amountPaidRaw===null?total:Math.max(0,Math.min(total,Number(amountPaidRaw)||0));
    const amountDue=Math.max(0,total-amountPaid);
    const supplierId=header?.supplierId||null;
    if(amountDue>0&&!supplierId)throw new Error('An unpaid amount requires selecting a Supplier so the balance can be tracked.');
    const aliasPairs=[];
    let purchaseId='';
    await window.runAtomicOrOffline(async transaction=>{
        const productSnaps=new Map(), newProducts=[];
        for(const item of cleanItems){
            if(item.productId){
                const ref=window.doc(window.db,'products',item.productId),snap=await transaction.get(ref);
                if(!snap.exists())throw new Error(`Selected product not found: ${item.name}`);
                if(snap.data().ownerId!==window.currentUserId)throw new Error('Unauthorized product access.');
                productSnaps.set(item.productId,snap);
            }
        }
        let supplierSnap=null,supplierName='';
        if(supplierId){ supplierSnap=await transaction.get(window.doc(window.db,'suppliers',supplierId)); if(!supplierSnap.exists())throw new Error('Supplier not found.'); if(supplierSnap.data().ownerId!==window.currentUserId)throw new Error('Unauthorized supplier access.'); supplierName=supplierSnap.data().name||''; }
        for(const item of cleanItems){
            if(item.productId)continue;
            const ref=window.doc(window.collection(window.db,'products')); const obj={name:item.name,barcode:item.barcode||'',sku:item.sku||'',cost:item.price,price:item.price,wholesalePrice:item.price,retailPrice:item.price,stock:item.qty,minStock:5,unit:item.unit,packSize:item.packSize,ownerId:window.currentUserId,createdAt:new Date().toISOString()};
            transaction.set(ref,obj); item.productId=ref.id; newProducts.push({id:ref.id,...obj});
        }
        for(const item of cleanItems){
            const ref=window.doc(window.db,'products',item.productId),snap=productSnaps.get(item.productId); const pd=snap?.data?.()||newProducts.find(p=>p.id===item.productId)||{};
            if(!pd||pd.ownerId!==window.currentUserId)throw new Error(`Product not found: ${item.name}`);
            // New products were already written with their confirmed opening stock above.
            if(!snap)continue;
            const patch={stock:Number(pd.stock||0)+item.qty,cost:item.price,updatedAt:new Date().toISOString()};
            if(item.unit)patch.unit=item.unit; if(item.packSize)patch.packSize=item.packSize;
            const aliases=Array.isArray(pd.billAliases)?pd.billAliases.slice():[];
            if(item.name && similarityForCommit(item.name,pd.name||'')<0.94 && !aliases.some(a=>String(a).toLowerCase()===item.name.toLowerCase())){aliases.push(item.name);patch.billAliases=aliases;aliasPairs.push({productId:item.productId,alias:item.name});}
            transaction.update(ref,patch);
        }
        const ref=window.doc(window.collection(window.db,'stockPurchases')); purchaseId=ref.id;
        const purchaseItems=cleanItems.map(i=>({productId:i.productId,productName:productSnaps.get(i.productId)?.data()?.name||newProducts.find(p=>p.id===i.productId)?.name||i.name,qty:i.qty,unit:i.unit,packSize:i.packSize,unitCost:i.price,amount:i.qty*i.price,sku:i.sku||null,barcode:i.barcode||null,source:'bill_scan'}));
        const primary=purchaseItems[0];
        transaction.set(ref,{ownerId:window.currentUserId,date:new Date(header.date).toISOString(),amount:total,amountPaid,amountDue,category:'',note:header.note||'Bill scan',supplierId,supplier:supplierName,productId:primary?.productId||null,productName:purchaseItems.length>1?`${purchaseItems.length} Products`:primary?.productName||'',qty:primary?.qty||0,unitCost:primary?.unitCost||0,items:purchaseItems,source:'bill_scan',ocrConfidenceAverage:Number(window.billScanDraft?.confidence)||null,supplierInvoiceNumber:header.invoiceNumber||null,billDate:header.date||null,subtotal:Number(header.subtotal)||0,discount:Number(header.discount)||0,tax:Number(header.tax)||0,grandTotal:billTotal||total,createdAt:new Date().toISOString(),createdBy:window.authUserId||window.currentUserId});
        if(supplierId&&amountDue>0){ const newBalance=Number(supplierSnap.data().balance||0)+amountDue; transaction.update(window.doc(window.db,'suppliers',supplierId),{balance:newBalance,updatedAt:new Date().toISOString()}); const txnRef=window.doc(window.collection(window.db,'supplierTransactions')); transaction.set(txnRef,{ownerId:window.currentUserId,supplierId,type:'purchase_debt',amount:amountDue,balanceAfter:newBalance,date:new Date(header.date).toISOString(),note:`Stock purchase${purchaseItems.length?` : ${purchaseItems.length} items`:''}`,purchaseId:purchaseId}); }
    });
    return {purchaseId,aliasPairs,total,billTotal};
}
function similarityForCommit(a,b){
    const norm=v=>String(v||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    const aa=norm(a),bb=norm(b); if(aa===bb)return 1; const A=new Set(aa.split(/\s+/)),B=new Set(bb.split(/\s+/)); let inter=0;A.forEach(x=>{if(B.has(x))inter++;}); const j=inter/Math.max(1,A.size+B.size-inter); return j;
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
        const tq=window.query(window.collection(window.db,'supplierTransactions'),window.where('ownerId','==',window.currentUserId));
        const ts=await window.getDocs(tq); linkedSupplierTxnRefs=ts.docs.filter(d=>d.data()?.ownerId===window.currentUserId && d.data()?.purchaseId===id).map(d=>d.ref);
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
window.addStockPurchaseManualItem=addStockPurchaseManualItem;
window.updateStockPurchaseManualItem=updateStockPurchaseManualItem;
window.removeStockPurchaseManualItem=removeStockPurchaseManualItem;
window.updateStockPurchaseDraftItem=updateStockPurchaseDraftItem;
window.removeStockPurchaseItem=removeStockPurchaseItem;
window.filterStockPurchaseProducts=filterStockPurchaseProducts;
window.closeStockPurchaseProductPicker=closeStockPurchaseProductPicker;
window.selectStockPurchaseProduct=selectStockPurchaseProduct;
window.showStockPurchaseTab=showStockPurchaseTab;
window.onStockPurchaseProductChange=onStockPurchaseProductChange;
window.saveStockPurchase=saveStockPurchase;
window.deleteStockPurchase=deleteStockPurchase;

window.commitStockPurchaseFromScanner=commitStockPurchaseFromScanner;
