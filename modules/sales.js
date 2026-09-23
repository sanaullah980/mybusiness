function getNextBillNumber() {
    const nums=(window.data?.sales||[]).map(s=>parseInt(s.invoiceNumber,10)).filter(Number.isFinite);
    const configured=parseInt(window.data?.settings?.nextInvoiceNumber,10);
    const max=Math.max(0,...nums);
    if(max>0) return max+1;
    return 1;
}

function salePriceFor(product){ const type=window.activeSaleType||'wholesale'; return type==='retail' ? Number(product.retailPrice ?? product.price ?? 0) : Number(product.wholesalePrice ?? product.price ?? 0); }
export function renderSales(container) { const data=window.data, formatCurrency=window.formatCurrency; window.activeSaleType=window.activeSaleType||'wholesale'; const type=window.activeSaleType; const saleForm=`<div class="card"><div class="sale-type-banner"><strong>${type==='retail'?'Retail Sale':'Wholesale Sale'}</strong><span>Product prices update automatically for this sale type.</span></div><div class="form-group"><label>Bill Number</label><input type="number" id="sale-bill-number" min="1" step="1" value="${getNextBillNumber()}" placeholder="Bill Number"></div><div class="form-group"><label>Customer (Optional)</label><select id="sale-customer"><option value="">Walk-in Customer</option>${data.customers.map(c=>`<option value="${c.id}">${c.name} (Debt: ${formatCurrency(c.balance||0)})</option>`).join('')}</select></div><div class="form-group"><label>Scan / Enter Barcode</label><div style="display:flex;gap:8px"><input style="flex:1" type="text" id="sale-barcode-input" placeholder="Scan with a scanner or type barcode" onkeydown="if(event.key==='Enter'){event.preventDefault();addProductByBarcode();}"><button class="btn btn-secondary" type="button" onclick="startBarcodeScanner()"><i class="fas fa-camera"></i></button></div></div><div class="form-group"><label>Products</label><button class="btn btn-secondary" onclick="openProductSelectionModal()" style="text-align:left;display:flex;justify-content:space-between;align-items:center"><span><i class="fas fa-plus"></i> Select Products to Add</span><i class="fas fa-chevron-down"></i></button></div></div><div class="card"><h3>Cart</h3><div id="cart-items"></div><hr style="margin:15px 0"><div class="form-group"><label>Subtotal</label><input type="text" id="cart-subtotal-display" readonly value="Rs. 0"></div><div class="form-row"><div class="form-group"><label>Discount Type</label><select id="sale-discount-type" onchange="updateSaleDue()"><option value="amount">Amount (Rs.)</option><option value="percent">Percent (%)</option></select></div><div class="form-group"><label>Discount Value <span id="sale-discount-auto-label"></span></label><input type="number" id="sale-discount-value" value="0" min="0" oninput="updateSaleDue()"></div></div><div class="form-row"><div class="form-group"><label>Total (After Discount)</label><input type="text" id="cart-total-display" readonly value="Rs. 0"></div><div class="form-group"><label>Amount Paid</label><input type="number" id="sale-amount-paid" value="0" min="0" oninput="updateSaleDue()"></div></div><div class="form-group"><label id="sale-due-label">Remaining Due (Added to Debt)</label><input type="text" id="sale-amount-due" readonly value="Rs. 0"></div><button class="btn" id="btn-complete-sale" onclick="completeNormalSale()">Complete ${type==='retail'?'Retail':'Wholesale'} Sale</button></div>`; container.innerHTML=`<div class="tabs"><button class="tab-btn ${type==='wholesale'?'active':''}" onclick="showSaleTab('wholesale',this)">Wholesale Sale</button><button class="tab-btn ${type==='retail'?'active':''}" onclick="showSaleTab('retail',this)">Retail Sale</button><button class="tab-btn" onclick="showSaleTab('manual',this)">Manual Item</button></div><div id="sale-main-form">${saleForm}</div><div id="sale-tab-manual" class="sale-tab hidden"><div class="card"><h3>Manual Item Sale</h3><div class="form-group"><label>Bill Number</label><input type="number" id="manual-bill-number" min="1" step="1" value="${getNextBillNumber()}"></div><div class="form-group"><label>Item Name</label><input type="text" id="manual-item-name"></div><div class="form-group"><label>Customer (Optional)</label><select id="manual-customer"><option value="">Walk-in Customer</option>${data.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></div><div class="form-row"><div class="form-group"><label>Selling Amount (Rs.)</label><input type="number" id="manual-amount" min="0"></div><div class="form-group"><label>Amount Paid (Rs.)</label><input type="number" id="manual-paid" min="0" value="0"></div></div><div class="form-group"><label>Estimated Profit (Rs.)</label><input type="number" id="manual-profit" min="0" placeholder="Optional"></div><button class="btn" id="btn-manual-sale" onclick="completeManualSale()">Record Manual Sale</button></div></div>`; if(type==='retail'){const di=document.getElementById('sale-discount-value');if(di)di.readOnly=true;const dl=document.getElementById('sale-due-label');if(dl)dl.textContent='Remaining Due';const at=document.getElementById('sale-discount-auto-label');if(at)at.textContent='(Auto)';} window.cart=[];renderCart(); }
export function showSaleTab(tab,btn){ if(tab==='manual'){document.getElementById('sale-main-form').classList.add('hidden');document.getElementById('sale-tab-manual').classList.remove('hidden');}else{window.activeSaleType=tab;renderSales(document.getElementById('app-content'));}document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b===btn)); }
export function renderCart() {
    const container=document.getElementById('cart-items'); if(!container)return;
    let total=0;
    if(!window.cart.length){container.innerHTML='<p style="color:var(--gray); text-align:center; padding:10px;">Cart is empty.</p>';}
    else {container.innerHTML=window.cart.map((item,index)=>{const sub=Number(item.price)*Number(item.qty);total+=sub;return `<div class="list-item sale-cart-row" style="cursor:default;"><div class="list-item-info"><h4>${item.name}</h4><p>${window.formatCurrency(item.price)} each</p></div><div class="sale-cart-controls"><input class="cart-qty-input" type="number" min="1" step="1" value="${Number(item.qty)||1}" aria-label="Quantity for ${String(item.name).replace(/"/g,'&quot;')}" onchange="updateCartItemQty(${index},this.value)" oninput="updateCartItemQty(${index},this.value)"><strong>${window.formatCurrency(sub)}</strong><button type="button" class="btn btn-sm btn-danger" onclick="removeCartItem(${index})" aria-label="Remove ${String(item.name).replace(/"/g,'&quot;')}"><i class="fas fa-trash"></i></button></div></div>`;}).join('');}
    updateSaleDue();
}
export function updateCartItemQty(index,value){const item=window.cart[index];if(!item)return;const qty=Math.max(1,parseInt(value,10)||1);item.qty=qty;renderCart();}
export function updateSaleDue() { const subtotal = window.cart.reduce((sum, item) => sum + (item.price * item.qty), 0); const isRetail = window.activeSaleType === 'retail'; const paid = Math.max(0, parseFloat(document.getElementById('sale-amount-paid')?.value) || 0); const discountType = document.getElementById('sale-discount-type')?.value || 'amount'; const discountValueInput = parseFloat(document.getElementById('sale-discount-value')?.value) || 0; let discount, total, due; if (isRetail) { discount = Math.max(0, Math.min(subtotal, subtotal - paid)); total = subtotal - discount; due = 0; const discountInput=document.getElementById('sale-discount-value'); if(discountInput){discountInput.value=String(discount);discountInput.readOnly=true;} } else { const rawDiscount = discountType === 'percent' ? subtotal * (discountValueInput / 100) : discountValueInput; discount = Math.max(0, Math.min(subtotal, rawDiscount)); total = subtotal - discount; due = Math.max(0, total - paid); const discountInput=document.getElementById('sale-discount-value'); if(discountInput)discountInput.readOnly=false; } if (document.getElementById('cart-subtotal-display')) document.getElementById('cart-subtotal-display').value = window.formatCurrency(subtotal); if (document.getElementById('cart-total-display')) document.getElementById('cart-total-display').value = window.formatCurrency(total); if (document.getElementById('sale-amount-due')) document.getElementById('sale-amount-due').value = window.formatCurrency(due); }
export function addProductByBarcode() { const input = document.getElementById('sale-barcode-input'); const code = input.value.trim(); if (!code) return; const normalized = code.toLowerCase().replace(/\s+/g,''); const product = window.data.products.find(p => p.barcode !== undefined && p.barcode !== null && String(p.barcode).trim().toLowerCase().replace(/\s+/g,'') === normalized); if (!product) { alert(`No product found with barcode: ${code}`); input.value = ''; input.select(); return; } if (Number(product.stock) <= 0) { alert(`${product.name} is out of stock.`); input.value = ''; return; } const existing = window.cart.find(i => i.id === product.id); if (existing) { if (existing.qty + 1 > product.stock) { alert(`Not enough stock for ${product.name}! Available: ${product.stock}`); input.value = ''; return; } existing.qty += 1; } else { window.cart.push({ id: product.id, name: product.name, price: salePriceFor(product), cost: product.cost, qty: 1 }); } renderCart(); input.value = ''; input.focus(); window.showToast?.(`${product.name} added to cart`); }
export function addSaleItem() { const select = document.getElementById('sale-product'); const qtyInput = document.getElementById('sale-qty'); const qty = parseInt(qtyInput.value); const option = select.options[select.selectedIndex]; if (!option.value) return alert("Select a product."); if (!qty || qty < 1) return alert("Qty must be at least 1."); const availableStock = parseInt(option.dataset.stock); const product=(window.data.products||[]).find(p=>p.id===option.value); const item = { id: option.value, name: option.text.split(' (')[0], price: salePriceFor(product||{price:option.dataset.price}), cost: parseFloat(option.dataset.cost), qty: qty }; const existing = window.cart.find(i => i.id === item.id); if (existing) { existing.qty += qty; } else { window.cart.push(item); } renderCart(); qtyInput.value = 1; select.selectedIndex = 0; }
export function removeCartItem(index) { window.cart.splice(index, 1); renderCart(); }
export async function completeNormalSale() {
    if(!window.cart.length)return alert('Cart is empty!');
    const saleType=window.activeSaleType==='retail'?'retail':'wholesale'; window.showLoading('btn-complete-sale','Processing...');
    try{
      const customerId=document.getElementById('sale-customer').value||null, billNumber=Math.max(1,parseInt(document.getElementById('sale-bill-number')?.value,10)||getNextBillNumber()), amountPaid=parseFloat(document.getElementById('sale-amount-paid').value)||0, discountType=document.getElementById('sale-discount-type').value||'amount', discountValueInput=parseFloat(document.getElementById('sale-discount-value').value)||0, cartSnapshot=window.cart.map(i=>({...i}));
      await window.runAtomicOrOffline(async transaction=>{
        const productDocs=cartSnapshot.map(i=>window.doc(window.db,'products',i.id)), refs=customerId?[...productDocs,window.doc(window.db,'customers',customerId)]:productDocs, snapshots=await Promise.all(refs.map(ref=>transaction.get(ref))), productSnapshots=cartSnapshot.map((item,index)=>({item,snap:snapshots[index]})), customerSnap=customerId?snapshots.at(-1):null;
        let subtotal=0,rawProfit=0;
        for(const {item,snap} of productSnapshots){if(!snap.exists())throw new Error(`Product ${item.name} not found.`);const p=snap.data();if(p.ownerId!==window.currentUserId)throw new Error('Unauthorized.');const unit=saleType==='retail'?Number(p.retailPrice??p.price):Number(p.wholesalePrice??p.price);item.price=unit;subtotal+=unit*item.qty;rawProfit+=(unit-Number(p.cost||0))*item.qty;}
        if(amountPaid<0)throw new Error('Amount paid cannot be negative.');
        const rawDiscount=saleType==='retail'?Math.max(0,subtotal-amountPaid):(discountType==='percent'?subtotal*(discountValueInput/100):discountValueInput),discount=Math.max(0,Math.min(subtotal,rawDiscount)),total=subtotal-discount,totalProfit=rawProfit-discount;
        const amountDue=saleType==='retail'?0:Math.max(0,total-amountPaid),current=customerSnap?.exists()?Math.max(0,Number(customerSnap.data().balance||0)):0,newCustomerBalance=saleType==='retail'?current:Math.max(0,current+total-amountPaid),saleRef=window.doc(window.collection(window.db,'sales')),customerName=customerSnap?.exists()?customerSnap.data().name:'Walk-in';
        transaction.set(saleRef,{ownerId:window.currentUserId,createdBy:window.authUserId||window.currentUserId,createdByName:window.currentMemberName||'Business Owner',customerId:customerId||null,customerName,saleType,date:new Date().toISOString(),items:cartSnapshot.map(i=>({...i,returnedQty:0})),subtotal,discount,discountType,total,amountPaid,amountDue,totalProfit,profitKnown:true,note:'',returnedAmount:0,returnedProfit:0,invoiceNumber:billNumber});
        for(const {item,snap} of productSnapshots)transaction.update(window.doc(window.db,'products',item.id),{stock:Number(snap.data().stock||0)-item.qty});
        if(customerId && saleType!=='retail' && amountDue>0){transaction.update(window.doc(window.db,'customers',customerId),{balance:newCustomerBalance,updatedAt:new Date().toISOString()});const txnRef=window.doc(window.collection(window.db,'customerTransactions'));transaction.set(txnRef,{ownerId:window.currentUserId,customerId,type:'sale_debt',amount:amountDue,amountPaid:amountPaid,debitAmount:amountDue,creditAmount:amountPaid,balanceAfter:newCustomerBalance,date:new Date().toISOString(),note:`Bill No. ${billNumber}`,billNo:String(billNumber),saleId:saleRef.id,createdBy:window.authUserId||window.currentUserId});}
        const settingsRef=window.doc(window.db,'settings',window.currentUserId);
        transaction.set(settingsRef,{nextInvoiceNumber:Math.max(billNumber+1,getNextBillNumber()+1)},{merge:true});
      });
      window.showToast?.(`${saleType==='retail'?'Retail':'Wholesale'} sale completed!`,'success');window.cart=[];window.navigate('dashboard');
    }catch(e){console.error(e);alert(e.message||'Unable to complete sale.');}finally{window.hideLoading('btn-complete-sale');}
}
export async function completeWholesaleSale(){window.activeSaleType='wholesale';return completeNormalSale();}
export async function completeRetailSale(){window.activeSaleType='retail';return completeNormalSale();}
export async function completeManualSale() {
    const name=document.getElementById('manual-item-name').value.trim();
    const billNumber=Math.max(1,parseInt(document.getElementById('manual-bill-number')?.value,10)||getNextBillNumber());
    const amount=parseFloat(document.getElementById('manual-amount').value);
    const paidInput=document.getElementById('manual-paid')?.value ?? '';
    const amountPaid=paidInput===''?0:parseFloat(paidInput);
    const profitInput=document.getElementById('manual-profit').value;
    const customerId=document.getElementById('manual-customer').value||null;
    if(!name||!Number.isFinite(amount)||amount<=0)return alert('Enter a valid item name and selling amount.');
    if(!Number.isFinite(amountPaid)||amountPaid<0||amountPaid>amount)return alert(`Amount paid must be between Rs. 0 and ${window.formatCurrency(amount)}.`);
    const profitKnown=profitInput!==''; const totalProfit=profitKnown?parseFloat(profitInput):0;
    if(!Number.isFinite(totalProfit)||totalProfit<0||totalProfit>amount)return alert('Estimated profit must be between Rs. 0 and the selling amount.');
    if(!window.currentUserId)return alert('Please log in again.');
    const btn=document.getElementById('btn-manual-sale'); window.showLoading('btn-manual-sale','Saving...');
    try{
        const amountDue=amount-amountPaid;
        await window.runAtomicOrOffline(async transaction=>{
            let customerSnap=null;
            if(customerId){
                customerSnap=await transaction.get(window.doc(window.db,'customers',customerId));
                if(!customerSnap.exists())throw new Error('Customer not found.');
                if(customerSnap.data().ownerId!==window.currentUserId)throw new Error('Unauthorized.');
            }
            const customerName=customerSnap?.exists()?customerSnap.data().name:'Walk-in';
            const saleRef=window.doc(window.collection(window.db,'sales'));
            const currentBalance=customerSnap?.exists()?Math.max(0,Number(customerSnap.data().balance)||0):0;
            const newBalance=currentBalance+amountDue;
            transaction.set(saleRef,{ownerId:window.currentUserId,createdBy:window.authUserId||window.currentUserId,createdByName:window.currentMemberName||'Business Owner',customerId,customerName,saleType:'manual',date:new Date().toISOString(),invoiceNumber:billNumber,items:[{name,price:amount,cost:amount-totalProfit,qty:1}],total:amount,amountPaid,amountDue,totalProfit,profitKnown,note:'Manual entry'});
            if(customerId&&amountDue>0){
                transaction.update(window.doc(window.db,'customers',customerId),{balance:newBalance,updatedAt:new Date().toISOString()});
                const txnRef=window.doc(window.collection(window.db,'customerTransactions'));
                transaction.set(txnRef,{ownerId:window.currentUserId,customerId,type:'sale_debt',amount:amountDue,balanceAfter:newBalance,date:new Date().toISOString(),note:`Bill No. ${billNumber}`,billNo:String(billNumber),saleId:saleRef.id});
            }
            transaction.set(window.doc(window.db,'settings',window.currentUserId),{nextInvoiceNumber:billNumber+1},{merge:true});
        });
        alert('Manual sale recorded!'); window.navigate('dashboard');
    }catch(error){console.error(error);alert(error.message||'Failed to record sale.');}
    finally{window.hideLoading('btn-manual-sale');}
}

export async function completeBulkSale() { const customerId = document.getElementById('bulk-customer').value || null; const total = parseFloat(document.getElementById('bulk-total').value); const profitInput = document.getElementById('bulk-profit').value; const amountPaid = parseFloat(document.getElementById('bulk-paid').value) || 0; const note = document.getElementById('bulk-note').value.trim(); if (isNaN(total) || total <= 0) return alert("Enter valid total amount."); const btn = document.getElementById('btn-bulk-sale'); window.showLoading('btn-bulk-sale', "Saving..."); try { const profitKnown = profitInput !== ""; const totalProfit = profitKnown ? parseFloat(profitInput) : 0; if (profitKnown && (!Number.isFinite(totalProfit) || totalProfit < 0 || totalProfit > total)) return alert('Estimated profit must be between Rs. 0 and the total selling amount.'); if (amountPaid < 0) return alert('Amount paid cannot be negative.'); const amountDue = Math.max(0, total - amountPaid); await window.runAtomicOrOffline(async (transaction) => { let customerSnap = null; if (customerId) customerSnap = await transaction.get(window.doc(window.db, "customers", customerId)); const newCustomerBalance = (customerId && amountDue > 0 && customerSnap && customerSnap.exists()) ? (customerSnap.data().balance || 0) + amountDue : (customerSnap && customerSnap.exists() ? customerSnap.data().balance || 0 : 0); const saleRef = window.doc(window.collection(window.db, "sales")); const customerName = (customerId && customerSnap && customerSnap.exists()) ? customerSnap.data().name : "Walk-in"; transaction.set(saleRef, { ownerId: window.currentUserId, createdBy: window.authUserId || window.currentUserId, customerId: customerId || null, customerName, saleType: 'bulk', date: new Date().toISOString(), items: [], total, amountPaid, amountDue, totalProfit, profitKnown, note }); if (customerId && amountDue > 0) { transaction.update(window.doc(window.db, "customers", customerId), { balance: newCustomerBalance }); const txnRef = window.doc(window.collection(window.db, "customerTransactions")); transaction.set(txnRef, { ownerId: window.currentUserId, customerId, type: 'sale_debt', amount: amountDue, balanceAfter: newCustomerBalance, date: new Date().toISOString(), note: `Bulk Sale #${saleRef.id.substring(0,8)}`, saleId: saleRef.id }); } }); alert("Bulk sale recorded!"); window.navigate('dashboard'); } catch (error) { console.error(error); alert("Failed to record bulk sale."); } finally { window.hideLoading('btn-bulk-sale'); } }
export function openProductSelectionModal() {
    const modal = document.getElementById('modal-body');
    const products = Array.isArray(window.data.products) ? window.data.products : [];
    const esc = window.esc || (v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
    const productsListHtml = products.map(p => `
        <div class="product-select-item-wrapper" data-name="${esc(String(p.name || '').toLowerCase())}">
            <button type="button" class="product-select-item" onclick="toggleProductRow('${esc(p.id)}')" aria-controls="qty-container-${esc(p.id)}" aria-expanded="false">
                <input type="checkbox" id="chk-${esc(p.id)}" tabindex="-1" onpointerdown="event.preventDefault()" onclick="event.preventDefault(); event.stopPropagation(); toggleProductRow('${esc(p.id)}')" aria-label="Select ${esc(p.name)}">
                <span class="product-select-main">
                    <strong>${esc(p.name || 'Unnamed product')}</strong>
                    <small>Stock: ${Number(p.stock) || 0} · Price: ${window.formatCurrency(salePriceFor(p))}</small>
                </span>
                <i class="fas fa-chevron-right product-select-chevron" aria-hidden="true"></i>
            </button>
            <div id="qty-container-${esc(p.id)}" class="product-qty-row hidden">
                <label for="qty-${esc(p.id)}">Quantity</label>
                <input type="number" id="qty-${esc(p.id)}" value="1" min="1" max="${Math.max(1, Number(p.stock) || 1)}" inputmode="numeric" enterkeyhint="done" aria-label="Quantity for ${esc(p.name)}">
            </div>
        </div>`).join('');

    modal.classList.add('product-selection-modal');
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Select Products</h2>
            <button class="close-btn" onclick="closeModal()" aria-label="Close">&times;</button>
        </div>
        <div class="product-picker-search form-group">
            <input type="search" id="product-search" placeholder="Search products..." autocomplete="off" enterkeyhint="search" oninput="filterProductSelectionList()">
        </div>
        <div id="product-selection-list" class="product-selection-list">
            ${productsListHtml || '<p class="empty-state"><i class="fas fa-box-open"></i><strong>No products found</strong><span>Add products in Inventory first.</span></p>'}
        </div>
        <div class="product-picker-footer">
            <button class="btn" onclick="addSelectedProductsToCart()">Add Selected to Cart</button>
        </div>`;

    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('product-picker-open');

    // Never autofocus the search field or checkbox. A user explicitly tapping a quantity field is the only action that opens the keyboard.
    requestAnimationFrame(() => {
        const search = document.getElementById('product-search');
        if (search) search.blur();
        syncProductPickerHeight();
    });
}

function syncProductPickerHeight() {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-body');
    if (!overlay || !modal || !modal.classList.contains('product-selection-modal')) return;
    const vv = window.visualViewport;
    const h = vv?.height || window.innerHeight;
    modal.style.maxHeight = `${Math.max(260, h - 12)}px`;
    modal.style.height = `${Math.max(260, h - 12)}px`;
}

export function toggleProductRow(id) {
    const checkbox = document.getElementById(`chk-${id}`);
    const qtyContainer = document.getElementById(`qty-container-${id}`);
    const row = checkbox?.closest('.product-select-item');
    if (!checkbox || !qtyContainer) return;
    checkbox.checked = !checkbox.checked;
    qtyContainer.classList.toggle('hidden', !checkbox.checked);
    row?.setAttribute('aria-expanded', checkbox.checked ? 'true' : 'false');
    // Deliberately do NOT focus the quantity input here. Selection should not summon the keyboard.
}

export function filterProductSelectionList() { const searchTerm = document.getElementById('product-search').value.toLowerCase(); const items = document.querySelectorAll('.product-select-item-wrapper'); items.forEach(wrapper => { const name = wrapper.dataset.name; if (name.includes(searchTerm)) { wrapper.classList.remove('hidden'); } else { wrapper.classList.add('hidden'); } }); }
export function addSelectedProductsToCart() { let addedCount=0; window.data.products.forEach(p=>{const checkbox=document.getElementById(`chk-${p.id}`);if(!checkbox||!checkbox.checked)return;const qty=Math.max(1,parseInt(document.getElementById(`qty-${p.id}`)?.value,10)||1);const existing=window.cart.find(i=>i.id===p.id);if(existing)existing.qty+=qty;else window.cart.push({id:p.id,name:p.name,price:salePriceFor(p),cost:p.cost,qty});addedCount++;checkbox.checked=false;document.getElementById(`qty-container-${p.id}`)?.classList.add('hidden');});if(addedCount){renderCart();closeModal();}else alert('Please select at least one product.');}

window.openProductSelectionModal = openProductSelectionModal;
window.toggleProductRow = toggleProductRow;
window.filterProductSelectionList = filterProductSelectionList;
window.addSelectedProductsToCart = addSelectedProductsToCart;
window.syncProductPickerHeight = syncProductPickerHeight;
window.addProductByBarcode = addProductByBarcode;

export async function startBarcodeScanner(){
 if(!('BarcodeDetector' in window)) return alert('Camera barcode scanning is not supported by this browser. Use a hardware scanner or type the barcode.');
 try{const detector=new BarcodeDetector();const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});const video=document.createElement('video');video.setAttribute('playsinline','');video.muted=true;video.srcObject=stream;const m=document.getElementById('modal-body');m.innerHTML=`<div class="modal-header"><h2>Scan Barcode</h2><button class="close-btn" id="stop-scan">&times;</button></div><video id="barcode-video" style="width:100%;border-radius:16px;background:#111;max-height:55vh" autoplay playsinline></video><p style="font-size:12px;color:var(--gray);text-align:center;margin-top:10px">Point the camera at a product barcode.</p>`;document.getElementById('modal-overlay').classList.remove('hidden');const target=document.getElementById('barcode-video');target.srcObject=stream;await target.play();let active=true;const stop=()=>{active=false;stream.getTracks().forEach(t=>t.stop());closeModal();};document.getElementById('stop-scan').onclick=stop;const scan=async()=>{if(!active)return;try{const codes=await detector.detect(target);if(codes.length&&codes[0].rawValue){document.getElementById('modal-overlay').classList.add('hidden');stream.getTracks().forEach(t=>t.stop());active=false;const input=document.getElementById('sale-barcode-input');if(input){input.value=codes[0].rawValue;addProductByBarcode();}}else requestAnimationFrame(scan);}catch(_){requestAnimationFrame(scan);}};requestAnimationFrame(scan);}catch(e){console.error(e);alert('Could not access the camera. Check browser camera permission.');}}
window.startBarcodeScanner=startBarcodeScanner;
