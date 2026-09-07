export function renderSales(container) { const data = window.data; const formatCurrency = window.formatCurrency; container.innerHTML = `<div class="tabs"> <button class="tab-btn active" onclick="showSaleTab('normal', this)">Normal Sale</button> <button class="tab-btn" onclick="showSaleTab('manual', this)">Manual Item</button> <button class="tab-btn" onclick="showSaleTab('bulk', this)">Quick / Bulk</button> </div> <div id="sale-tab-normal" class="sale-tab"> <div class="card"> <div class="form-group"> <label>Customer (Optional)</label> <select id="sale-customer"> <option value="">Walk-in Customer</option> ${data.customers.map(c => `<option value="${c.id}">${c.name} (Debt: ${formatCurrency(c.balance || 0)})</option>`).join('')} </select> </div> <div class="form-group"><label>Scan / Enter Barcode</label><div style="display:flex;gap:8px"><input style="flex:1" type="text" id="sale-barcode-input" placeholder="Scan with a scanner or type barcode" onkeydown="if(event.key==='Enter'){event.preventDefault(); addProductByBarcode();}"><button class="btn btn-secondary" type="button" onclick="startBarcodeScanner()" title="Use camera"><i class="fas fa-camera"></i></button></div></div> <div class="form-group"> <label>Products</label> <button class="btn btn-secondary" onclick="openProductSelectionModal()" style="text-align:left; display:flex; justify-content:space-between; align-items:center; background: var(--dark);"> <span><i class="fas fa-plus"></i> Select Products to Add</span> <i class="fas fa-chevron-down"></i> </button> </div> </div> <div class="card"> <h3>Cart</h3> <div id="cart-items"></div> <hr style="margin:15px 0;"> <div class="form-group"><label>Subtotal</label><input type="text" id="cart-subtotal-display" readonly value="Rs. 0"></div> <div class="form-row"> <div class="form-group"><label>Discount Type</label><select id="sale-discount-type" onchange="updateSaleDue()"><option value="amount">Amount (Rs.)</option><option value="percent">Percent (%)</option></select></div> <div class="form-group"><label>Discount Value</label><input type="number" id="sale-discount-value" value="0" min="0" oninput="updateSaleDue()"></div> </div> <div class="form-row"> <div class="form-group"><label>Total (After Discount)</label><input type="text" id="cart-total-display" readonly value="Rs. 0"></div> <div class="form-group"><label>Amount Paid</label><input type="number" id="sale-amount-paid" value="0" min="0" oninput="updateSaleDue()"></div> </div> <div class="form-group"><label>Remaining Due (Added to Debt)</label><input type="text" id="sale-amount-due" readonly value="Rs. 0"></div> <button class="btn" id="btn-complete-sale" onclick="completeNormalSale()">Complete Sale</button> </div> </div> <div id="sale-tab-manual" class="sale-tab hidden"> <div class="card"> <h3>Manual Item Sale</h3> <div class="form-group"><label>Item Name</label><input type="text" id="manual-item-name"></div> <div class="form-group"> <label>Customer (Optional)</label> <select id="manual-customer"> <option value="">Walk-in Customer</option> ${data.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('')} </select> </div> <div class="form-row"> <div class="form-group"><label>Selling Amount (Rs.)</label><input type="number" id="manual-amount" min="0"></div> <div class="form-group"><label>Amount Paid (Rs.)</label><input type="number" id="manual-paid" min="0" value="0"></div> </div><div class="form-group"><label>Estimated Profit (Rs.)</label><input type="number" id="manual-profit" min="0" placeholder="Optional"></div> <button class="btn" id="btn-manual-sale" onclick="completeManualSale()">Record Manual Sale</button> </div> </div> <div id="sale-tab-bulk" class="sale-tab hidden"> <div class="card"> <h3>Quick / Bulk Sale</h3> <div class="form-group"> <label>Customer (Optional)</label> <select id="bulk-customer"> <option value="">Walk-in Customer</option> ${data.customers.map(c => `<option value="${c.id}">${c.name} (Debt: ${formatCurrency(c.balance || 0)})</option>`).join('')} </select> </div> <div class="form-row"> <div class="form-group"><label>Total Selling Amount (Rs.)</label><input type="number" id="bulk-total" min="0"></div> <div class="form-group"><label>Estimated Profit (Rs.) <small>(Leave blank if unknown)</small></label><input type="number" id="bulk-profit" min="0"></div> </div> <div class="form-row"> <div class="form-group"><label>Amount Paid (Rs.)</label><input type="number" id="bulk-paid" value="0" min="0"></div> <div class="form-group"><label>Note</label><input type="text" id="bulk-note" placeholder="e.g., Evening sales"></div> </div> <button class="btn" id="btn-bulk-sale" onclick="completeBulkSale()">Record Bulk Sale</button> </div> </div>`; window.cart = []; renderCart(); }
export function showSaleTab(tab, btn) { document.querySelectorAll('.sale-tab').forEach(t => t.classList.add('hidden')); document.getElementById(`sale-tab-${tab}`).classList.remove('hidden'); document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
export function renderCart() { const container = document.getElementById('cart-items'); if (!container) return; let total = 0; if (window.cart.length === 0) { container.innerHTML = '<p style="color:var(--gray); text-align:center; padding:10px;">Cart is empty.</p>'; } else { container.innerHTML = window.cart.map((item, index) => { const sub = item.price * item.qty; total += sub; return `<div class="list-item" style="cursor:default;"><div class="list-item-info"><h4>${item.name} x${item.qty}</h4><p>${window.formatCurrency(item.price)} each</p></div><div style="display:flex; align-items:center; gap:10px;"><span style="font-weight:bold;">${window.formatCurrency(sub)}</span><i class="fas fa-trash" style="color:var(--danger); cursor:pointer; padding:5px;" onclick="removeCartItem(${index})"></i></div></div>`; }).join(''); } updateSaleDue(); }
export function updateSaleDue() { const subtotal = window.cart.reduce((sum, item) => sum + (item.price * item.qty), 0); const discountType = document.getElementById('sale-discount-type')?.value || 'amount'; const discountValueInput = parseFloat(document.getElementById('sale-discount-value')?.value) || 0; const rawDiscount = discountType === 'percent' ? subtotal * (discountValueInput / 100) : discountValueInput; const discount = Math.max(0, Math.min(subtotal, rawDiscount)); const total = subtotal - discount; const paid = parseFloat(document.getElementById('sale-amount-paid')?.value) || 0; const due = Math.max(0, total - paid); if (document.getElementById('cart-subtotal-display')) document.getElementById('cart-subtotal-display').value = window.formatCurrency(subtotal); if (document.getElementById('cart-total-display')) document.getElementById('cart-total-display').value = window.formatCurrency(total); if (document.getElementById('sale-amount-due')) document.getElementById('sale-amount-due').value = window.formatCurrency(due); }
export function addProductByBarcode() { const input = document.getElementById('sale-barcode-input'); const code = input.value.trim(); if (!code) return; const normalized = code.toLowerCase().replace(/\s+/g,''); const product = window.data.products.find(p => p.barcode !== undefined && p.barcode !== null && String(p.barcode).trim().toLowerCase().replace(/\s+/g,'') === normalized); if (!product) { alert(`No product found with barcode: ${code}`); input.value = ''; input.select(); return; } if (product.stock <= 0) { alert(`${product.name} is out of stock.`); input.value = ''; return; } const existing = window.cart.find(i => i.id === product.id); if (existing) { if (existing.qty + 1 > product.stock) { alert(`Not enough stock for ${product.name}! Available: ${product.stock}`); input.value = ''; return; } existing.qty += 1; } else { window.cart.push({ id: product.id, name: product.name, price: product.price, cost: product.cost, qty: 1 }); } renderCart(); input.value = ''; input.focus(); window.showToast?.(`${product.name} added to cart`); }
export function addSaleItem() { const select = document.getElementById('sale-product'); const qtyInput = document.getElementById('sale-qty'); const qty = parseInt(qtyInput.value); const option = select.options[select.selectedIndex]; if (!option.value) return alert("Select a product."); if (!qty || qty < 1) return alert("Qty must be at least 1."); const availableStock = parseInt(option.dataset.stock); const item = { id: option.value, name: option.text.split(' (')[0], price: parseFloat(option.dataset.price), cost: parseFloat(option.dataset.cost), qty: qty }; const existing = window.cart.find(i => i.id === item.id); if (existing) { if (existing.qty + qty > availableStock) return alert(`Not enough stock! Available: ${availableStock}`); existing.qty += qty; } else { if (qty > availableStock) return alert(`Not enough stock! Available: ${availableStock}`); window.cart.push(item); } renderCart(); qtyInput.value = 1; select.selectedIndex = 0; }
export function removeCartItem(index) { window.cart.splice(index, 1); renderCart(); }
export async function completeNormalSale() { if(window.cart.length === 0) return alert("Cart is empty!"); const btn = document.getElementById('btn-complete-sale'); window.showLoading('btn-complete-sale', "Processing..."); try { const customerId = document.getElementById('sale-customer').value || null; const amountPaid = parseFloat(document.getElementById('sale-amount-paid').value) || 0; const discountType = document.getElementById('sale-discount-type').value || 'amount'; const discountValueInput = parseFloat(document.getElementById('sale-discount-value').value) || 0; const cartSnapshot = window.cart.map(i => ({ ...i })); await window.runAtomicOrOffline(async (transaction) => { const productSnapshots = []; for (const item of cartSnapshot) { const snap = await transaction.get(doc(window.db, "products", item.id)); productSnapshots.push({ item, snap }); } let customerSnap = null; if (customerId) customerSnap = await transaction.get(doc(window.db, "customers", customerId)); let subtotal = 0, rawProfit = 0; for (const { item, snap } of productSnapshots) { if (!snap.exists()) throw new Error(`Product ${item.name} not found.`); const pData = snap.data(); if (pData.ownerId !== window.currentUserId) throw new Error("Unauthorized."); if (pData.stock < item.qty) throw new Error(`Insufficient stock for ${item.name}.`); subtotal += item.price * item.qty; rawProfit += (item.price - pData.cost) * item.qty; } const rawDiscount = discountType === 'percent' ? subtotal * (discountValueInput / 100) : discountValueInput; const discount = Math.max(0, Math.min(subtotal, rawDiscount)); const total = subtotal - discount; const totalProfit = rawProfit - discount; if (amountPaid < 0 || amountPaid > total) throw new Error(`Amount paid cannot exceed the sale total of ${window.formatCurrency(total)}.`); const amountDue = Math.max(0, total - amountPaid); let newCustomerBalance = 0; if (customerId && amountDue > 0 && customerSnap && customerSnap.exists()) newCustomerBalance = (customerSnap.data().balance || 0) + amountDue; else if (customerId && customerSnap && customerSnap.exists()) newCustomerBalance = customerSnap.data().balance || 0; const saleRef = doc(collection(window.db, "sales")); const customerName = (customerId && customerSnap && customerSnap.exists()) ? customerSnap.data().name : "Walk-in"; const itemsWithReturnTracking = cartSnapshot.map(i => ({ ...i, returnedQty: 0 })); transaction.set(saleRef, { ownerId: window.currentUserId, customerId: customerId || null, customerName, saleType: 'normal', date: new Date().toISOString(), items: itemsWithReturnTracking, subtotal, discount, discountType, total, amountPaid, amountDue, totalProfit, profitKnown: true, note: '', returnedAmount: 0, returnedProfit: 0, invoiceNumber: null }); for (const { item, snap } of productSnapshots) transaction.update(doc(window.db, "products", item.id), { stock: snap.data().stock - item.qty }); if (customerId && amountDue > 0) { transaction.update(doc(window.db, "customers", customerId), { balance: newCustomerBalance }); const txnRef = doc(collection(window.db, "customerTransactions")); transaction.set(txnRef, { ownerId: window.currentUserId, customerId, type: 'sale_debt', amount: amountDue, balanceAfter: newCustomerBalance, date: new Date().toISOString(), note: `Sale #${saleRef.id.substring(0,8)}`, saleId: saleRef.id }); } }); alert("Sale completed!"); window.cart = []; window.navigate('dashboard'); } catch (error) { console.error(error); alert(error.message || "Unable to complete sale."); } finally { window.hideLoading('btn-complete-sale'); } }
export async function completeManualSale() {
    const name=document.getElementById('manual-item-name').value.trim();
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
            transaction.set(saleRef,{ownerId:window.currentUserId,customerId,customerName,saleType:'manual',date:new Date().toISOString(),items:[{name,price:amount,cost:amount-totalProfit,qty:1}],total:amount,amountPaid,amountDue,totalProfit,profitKnown,note:'Manual entry'});
            if(customerId&&amountDue>0){
                transaction.update(window.doc(window.db,'customers',customerId),{balance:newBalance,updatedAt:new Date().toISOString()});
                const txnRef=window.doc(window.collection(window.db,'customerTransactions'));
                transaction.set(txnRef,{ownerId:window.currentUserId,customerId,type:'sale_debt',amount:amountDue,balanceAfter:newBalance,date:new Date().toISOString(),note:`Manual sale #${saleRef.id.substring(0,8)}`,saleId:saleRef.id});
            }
        });
        alert('Manual sale recorded!'); window.navigate('dashboard');
    }catch(error){console.error(error);alert(error.message||'Failed to record sale.');}
    finally{window.hideLoading('btn-manual-sale');}
}

export async function completeBulkSale() { const customerId = document.getElementById('bulk-customer').value || null; const total = parseFloat(document.getElementById('bulk-total').value); const profitInput = document.getElementById('bulk-profit').value; const amountPaid = parseFloat(document.getElementById('bulk-paid').value) || 0; const note = document.getElementById('bulk-note').value.trim(); if (isNaN(total) || total <= 0) return alert("Enter valid total amount."); const btn = document.getElementById('btn-bulk-sale'); window.showLoading('btn-bulk-sale', "Saving..."); try { const profitKnown = profitInput !== ""; const totalProfit = profitKnown ? parseFloat(profitInput) : 0; if (profitKnown && (!Number.isFinite(totalProfit) || totalProfit < 0 || totalProfit > total)) return alert('Estimated profit must be between Rs. 0 and the total selling amount.'); if (amountPaid < 0 || amountPaid > total) return alert(`Amount paid cannot exceed the total of ${window.formatCurrency(total)}.`); const amountDue = Math.max(0, total - amountPaid); await window.runAtomicOrOffline(async (transaction) => { let customerSnap = null; if (customerId) customerSnap = await transaction.get(doc(window.db, "customers", customerId)); const newCustomerBalance = (customerId && amountDue > 0 && customerSnap && customerSnap.exists()) ? (customerSnap.data().balance || 0) + amountDue : (customerSnap && customerSnap.exists() ? customerSnap.data().balance || 0 : 0); const saleRef = doc(collection(window.db, "sales")); const customerName = (customerId && customerSnap && customerSnap.exists()) ? customerSnap.data().name : "Walk-in"; transaction.set(saleRef, { ownerId: window.currentUserId, customerId: customerId || null, customerName, saleType: 'bulk', date: new Date().toISOString(), items: [], total, amountPaid, amountDue, totalProfit, profitKnown, note }); if (customerId && amountDue > 0) { transaction.update(doc(window.db, "customers", customerId), { balance: newCustomerBalance }); const txnRef = doc(collection(window.db, "customerTransactions")); transaction.set(txnRef, { ownerId: window.currentUserId, customerId, type: 'sale_debt', amount: amountDue, balanceAfter: newCustomerBalance, date: new Date().toISOString(), note: `Bulk Sale #${saleRef.id.substring(0,8)}`, saleId: saleRef.id }); } }); alert("Bulk sale recorded!"); window.navigate('dashboard'); } catch (error) { console.error(error); alert("Failed to record bulk sale."); } finally { window.hideLoading('btn-bulk-sale'); } }
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
                    <small>Stock: ${Number(p.stock) || 0} · Price: ${window.formatCurrency(p.price || 0)}</small>
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
export function addSelectedProductsToCart() { let addedCount = 0; let errorMessage = ""; window.data.products.forEach(p => { const checkbox = document.getElementById(`chk-${p.id}`); if (checkbox && checkbox.checked) { const qtyInput = document.getElementById(`qty-${p.id}`); const qty = parseInt(qtyInput.value); if (!qty || qty < 1) { errorMessage += `Please enter a valid quantity for ${p.name}.\n`; return; } if (qty > p.stock) { errorMessage += `Not enough stock for ${p.name}! Available: ${p.stock}\n`; return; } const existing = window.cart.find(i => i.id === p.id); if (existing) { if (existing.qty + qty > p.stock) { errorMessage += `Not enough stock for ${p.name}! Cart already has ${existing.qty}, available: ${p.stock}\n`; return; } existing.qty += qty; } else { const item = { id: p.id, name: p.name, price: p.price, cost: p.cost, qty: qty }; window.cart.push(item); } addedCount++; checkbox.checked = false; document.getElementById(`qty-container-${p.id}`).classList.add('hidden'); qtyInput.value = 1; } }); if (errorMessage) { alert(errorMessage); } else if (addedCount > 0) { renderCart(); closeModal(); } else { alert("Please select at least one product."); } }

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
