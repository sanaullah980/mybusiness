export function renderSales(container) {
    const data = window.data;
    const formatCurrency = window.formatCurrency;
    container.innerHTML = `
        <div class="tabs">
            <button class="tab-btn active" onclick="showSaleTab('normal', this)">Normal Sale</button>
            <button class="tab-btn" onclick="showSaleTab('manual', this)">Manual Item</button>
            <button class="tab-btn" onclick="showSaleTab('bulk', this)">Quick / Bulk</button>
        </div>
        <div id="sale-tab-normal" class="sale-tab">
            <div class="card">
                <div class="form-group">
                    <label>Customer (Optional)</label>
                    <select id="sale-customer">
                        <option value="">Walk-in Customer</option>
                        ${data.customers.map(c => `<option value="${c.id}">${c.name} (Debt: ${formatCurrency(c.balance || 0)})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Products</label>
                    <button class="btn btn-secondary" onclick="openProductSelectionModal()" style="text-align:left; display:flex; justify-content:space-between; align-items:center; background: var(--dark);">
                        <span><i class="fas fa-plus"></i> Select Products to Add</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
            <div class="card">
                <h3>Cart</h3>
                <div id="cart-items"></div>
                <hr style="margin:15px 0;">
                <div class="form-row">
                    <div class="form-group"><label>Total</label><input type="text" id="cart-total-display" readonly value="Rs. 0"></div>
                    <div class="form-group"><label>Amount Paid</label><input type="number" id="sale-amount-paid" value="0" min="0" oninput="updateSaleDue()"></div>
                </div>
                <div class="form-group"><label>Remaining Due (Added to Debt)</label><input type="text" id="sale-amount-due" readonly value="Rs. 0"></div>
                <button class="btn" id="btn-complete-sale" onclick="completeNormalSale()">Complete Sale</button>
            </div>
        </div>
        <div id="sale-tab-manual" class="sale-tab hidden">
            <div class="card">
                <h3>Manual Item Sale</h3>
                <div class="form-group"><label>Item Name</label><input type="text" id="manual-item-name"></div>
                <div class="form-row">
                    <div class="form-group"><label>Selling Amount (Rs.)</label><input type="number" id="manual-amount" min="0"></div>
                    <div class="form-group"><label>Estimated Profit (Rs.)</label><input type="number" id="manual-profit" min="0"></div>
                </div>
                <button class="btn" id="btn-manual-sale" onclick="completeManualSale()">Record Manual Sale</button>
            </div>
        </div>
        <div id="sale-tab-bulk" class="sale-tab hidden">
            <div class="card">
                <h3>Quick / Bulk Sale</h3>
                <div class="form-group">
                    <label>Customer (Optional)</label>
                    <select id="bulk-customer">
                        <option value="">Walk-in Customer</option>
                        ${data.customers.map(c => `<option value="${c.id}">${c.name} (Debt: ${formatCurrency(c.balance || 0)})</option>`).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Total Selling Amount (Rs.)</label><input type="number" id="bulk-total" min="0"></div>
                    <div class="form-group"><label>Estimated Profit (Rs.) <small>(Leave blank if unknown)</small></label><input type="number" id="bulk-profit" min="0"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Amount Paid (Rs.)</label><input type="number" id="bulk-paid" value="0" min="0"></div>
                    <div class="form-group"><label>Note</label><input type="text" id="bulk-note" placeholder="e.g., Evening sales"></div>
                </div>
                <button class="btn" id="btn-bulk-sale" onclick="completeBulkSale()">Record Bulk Sale</button>
            </div>
        </div>
    `;
    window.cart = [];
    renderCart();
}

export function showSaleTab(tab, btn) {
    document.querySelectorAll('.sale-tab').forEach(t => t.classList.add('hidden'));
    document.getElementById(`sale-tab-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

export function renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    let total = 0;
    if (window.cart.length === 0) {
        container.innerHTML = '<p style="color:var(--gray); text-align:center; padding:10px;">Cart is empty.</p>';
    } else {
        container.innerHTML = window.cart.map((item, index) => {
            const sub = item.price * item.qty;
            total += sub;
            return `<div class="list-item" style="cursor:default;">
                <div class="list-item-info"><h4>${item.name} x${item.qty}</h4><p>${window.formatCurrency(item.price)} each</p></div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:bold;">${window.formatCurrency(sub)}</span>
                    <i class="fas fa-trash" style="color:var(--danger); cursor:pointer; padding:5px;" onclick="removeCartItem(${index})"></i>
                </div>
            </div>`;
        }).join('');
    }
    document.getElementById('cart-total-display').value = window.formatCurrency(total);
    updateSaleDue();
}

export function updateSaleDue() {
    const total = window.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const paid = parseFloat(document.getElementById('sale-amount-paid')?.value) || 0;
    const due = Math.max(0, total - paid);
    if (document.getElementById('sale-amount-due')) document.getElementById('sale-amount-due').value = window.formatCurrency(due);
}

export function addSaleItem() {
    const select = document.getElementById('sale-product');
    const qtyInput = document.getElementById('sale-qty');
    const qty = parseInt(qtyInput.value);
    const option = select.options[select.selectedIndex];
    if (!option.value) return alert("Select a product.");
    if (!qty || qty < 1) return alert("Qty must be at least 1.");
    const availableStock = parseInt(option.dataset.stock);
    const item = { id: option.value, name: option.text.split(' (')[0], price: parseFloat(option.dataset.price), cost: parseFloat(option.dataset.cost), qty: qty };
    const existing = window.cart.find(i => i.id === item.id);
    if (existing) {
        if (existing.qty + qty > availableStock) return alert(`Not enough stock! Available: ${availableStock}`);
        existing.qty += qty;
    } else {
        if (qty > availableStock) return alert(`Not enough stock! Available: ${availableStock}`);
        window.cart.push(item);
    }
    renderCart();
    qtyInput.value = 1;
    select.selectedIndex = 0;
}

export function removeCartItem(index) {
    window.cart.splice(index, 1);
    renderCart();
}

export async function completeNormalSale() {
    if (window.cart.length === 0) return alert("Cart is empty!");
    const btn = document.getElementById('btn-complete-sale');
    window.showLoading('btn-complete-sale', "Processing...");
    try {
        const customerId = document.getElementById('sale-customer').value || null;
        const amountPaid = parseFloat(document.getElementById('sale-amount-paid').value) || 0;
        await runTransaction(window.db, async (transaction) => {
            const productSnapshots = [];
            for (const item of window.cart) {
                const snap = await transaction.get(doc(window.db, "products", item.id));
                productSnapshots.push({ item, snap });
            }
            let customerSnap = null;
            if (customerId) customerSnap = await transaction.get(doc(window.db, "customers", customerId));
            let total = 0, totalProfit = 0;
            for (const { item, snap } of productSnapshots) {
                if (!snap.exists()) throw new Error(`Product ${item.name} not found.`);
                const pData = snap.data();
                if (pData.ownerId !== window.currentUserId) throw new Error("Unauthorized.");
                if (pData.stock < item.qty) throw new Error(`Insufficient stock for ${item.name}.`);
                total += item.price * item.qty;
                totalProfit += (item.price - pData.cost) * item.qty;
            }
            const amountDue = Math.max(0, total - amountPaid);
            let newCustomerBalance = 0;
            if (customerId && amountDue > 0 && customerSnap && customerSnap.exists()) newCustomerBalance = (customerSnap.data().balance || 0) + amountDue;
            else if (customerId && customerSnap && customerSnap.exists()) newCustomerBalance = customerSnap.data().balance || 0;
            const saleRef = doc(collection(window.db, "sales"));
            const customerName = (customerId && customerSnap && customerSnap.exists()) ? customerSnap.data().name : "Walk-in";
            transaction.set(saleRef, { ownerId: window.currentUserId, customerId: customerId || null, customerName, saleType: 'normal', date: new Date().toISOString(), items: window.cart, total, amountPaid, amountDue, totalProfit, profitKnown: true, note: '' });
            for (const { item, snap } of productSnapshots) transaction.update(doc(window.db, "products", item.id), { stock: snap.data().stock - item.qty });
            if (customerId && amountDue > 0) {
                transaction.update(doc(window.db, "customers", customerId), { balance: newCustomerBalance });
                const txnRef = doc(collection(window.db, "customerTransactions"));
                transaction.set(txnRef, { ownerId: window.currentUserId, customerId, type: 'sale_debt', amount: amountDue, balanceAfter: newCustomerBalance, date: new Date().toISOString(), note: `Sale #${saleRef.id.substring(0, 8)}`, saleId: saleRef.id });
            }
        });
        alert("Sale completed!");
        window.cart = [];
        window.navigate('dashboard');
    } catch (error) {
        console.error(error);
        alert(error.message || "Unable to complete sale.");
    } finally {
        window.hideLoading('btn-complete-sale');
    }
}

export async function completeManualSale() {
    const name = document.getElementById('manual-item-name').value.trim();
    const amount = parseFloat(document.getElementById('manual-amount').value);
    const profitInput = document.getElementById('manual-profit').value;
    const customerId = document.getElementById('manual-customer').value || null;
    if (!name || isNaN(amount) || amount <= 0) return alert("Enter valid name and amount.");
    let customerName = "Walk-in";
    if (customerId) {
        const c = window.data.customers.find(x => x.id === customerId);
        if (c) customerName = c.name;
    }
    const btn = document.getElementById('btn-manual-sale');
    window.showLoading('btn-manual-sale', "Saving...");
    try {
        const profitKnown = profitInput !== "";
        const totalProfit = profitKnown ? parseFloat(profitInput) : 0;
        await addDoc(collection(window.db, "sales"), { ownerId: window.currentUserId, customerId: customerId, customerName: customerName, saleType: 'manual', date: new Date().toISOString(), items: [{ name, price: amount, cost: amount - totalProfit, qty: 1 }], total: amount, amountPaid: amount, amountDue: 0, totalProfit, profitKnown, note: "Manual entry" });
        alert("Manual sale recorded!");
        window.navigate('dashboard');
    } catch (error) {
        console.error(error);
        alert("Failed to record sale.");
    } finally {
        window.hideLoading('btn-manual-sale');
    }
}

export async function completeBulkSale() {
    const customerId = document.getElementById('bulk-customer').value || null;
    const total = parseFloat(document.getElementById('bulk-total').value);
    const profitInput = document.getElementById('bulk-profit').value;
    const amountPaid = parseFloat(document.getElementById('bulk-paid').value) || 0;
    const note = document.getElementById('bulk-note').value.trim();
    if (isNaN(total) || total <= 0) return alert("Enter valid total amount.");
    const btn = document.getElementById('btn-bulk-sale');
    window.showLoading('btn-bulk-sale', "Saving...");
    try {
        const profitKnown = profitInput !== "";
        const totalProfit = profitKnown ? parseFloat(profitInput) : 0;
        const amountDue = Math.max(0, total - amountPaid);
        await runTransaction(window.db, async (transaction) => {
            let customerSnap = null;
            if (customerId) customerSnap = await transaction.get(doc(window.db, "customers", customerId));
            const newCustomerBalance = (customerId && amountDue > 0 && customerSnap && customerSnap.exists()) ? (customerSnap.data().balance || 0) + amountDue : (customerSnap && customerSnap.exists() ? customerSnap.data().balance || 0 : 0);
            const saleRef = doc(collection(window.db, "sales"));
            const customerName = (customerId && customerSnap && customerSnap.exists()) ? customerSnap.data().name : "Walk-in";
            transaction.set(saleRef, { ownerId: window.currentUserId, customerId: customerId || null, customerName, saleType: 'bulk', date: new Date().toISOString(), items: [], total, amountPaid, amountDue, totalProfit, profitKnown, note });
            if (customerId && amountDue > 0) {
                transaction.update(doc(window.db, "customers", customerId), { balance: newCustomerBalance });
                const txnRef = doc(collection(window.db, "customerTransactions"));
                transaction.set(txnRef, { ownerId: window.currentUserId, customerId, type: 'sale_debt', amount: amountDue, balanceAfter: newCustomerBalance, date: new Date().toISOString(), note: `Bulk Sale #${saleRef.id.substring(0, 8)}`, saleId: saleRef.id });
            }
        });
        alert("Bulk sale recorded!");
        window.navigate('dashboard');
    } catch (error) {
        console.error(error);
        alert("Failed to record bulk sale.");
    } finally {
        window.hideLoading('btn-bulk-sale');
    }
}

export function openProductSelectionModal() {
    const modal = document.getElementById('modal-body');
    const productsListHtml = window.data.products.map(p => `<div class="product-select-item-wrapper" data-name="${p.name.toLowerCase()}" style="border-bottom:1px solid #eee;">
        <div class="product-select-item" onclick="toggleProductRow('${p.id}')" style="display:flex; align-items:center; padding:15px 10px; cursor:pointer;">
            <input type="checkbox" id="chk-${p.id}" style="margin-right:15px; transform: scale(1.5); pointer-events: none;">
            <div style="flex:1;">
                <div style="font-weight:bold; font-size:16px;">${p.name}</div>
                <div style="font-size:13px; color:var(--gray);">Stock: ${p.stock} | Price: ${window.formatCurrency(p.price)}</div>
            </div>
            <i class="fas fa-chevron-right" style="color:var(--gray);"></i>
        </div>
        <div id="qty-container-${p.id}" class="hidden" style="padding:10px 15px 15px 45px; background:#f8f9fa;">
            <label style="font-size:14px; font-weight:bold; color:var(--dark);">Quantity:</label>
            <input type="number" id="qty-${p.id}" value="1" min="1" max="${p.stock}" style="width:100px; padding:8px; margin-left:10px; border:1px solid #ddd; border-radius:4px; font-size:16px;">
        </div>
    </div>`).join('');
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Select Products</h2>
            <button class="close-btn" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group" style="position:sticky; top:0; background:white; padding-bottom:10px; z-index:10;">
            <input type="text" id="product-search" placeholder="Search products..." style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; font-size:16px;" oninput="filterProductSelectionList()">
        </div>
        <div id="product-selection-list" style="max-height: 50vh; overflow-y: auto;">
            ${productsListHtml.length > 0 ? productsListHtml : '<p style="text-align:center; padding:20px; color:var(--gray);">No products found. Add products in Inventory first.</p>'}
        </div>
        <div style="margin-top: 15px;">
            <button class="btn" onclick="addSelectedProductsToCart()">Add Selected to Cart</button>
        </div>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export function toggleProductRow(id) {
    const checkbox = document.getElementById(`chk-${id}`);
    checkbox.checked = !checkbox.checked;
    const qtyContainer = document.getElementById(`qty-container-${id}`);
    if (checkbox.checked) {
        qtyContainer.classList.remove('hidden');
        setTimeout(() => document.getElementById(`qty-${id}`).focus(), 10);
    } else {
        qtyContainer.classList.add('hidden');
    }
}

export function filterProductSelectionList() {
    const searchTerm = document.getElementById('product-search').value.toLowerCase();
    const items = document.querySelectorAll('.product-select-item-wrapper');
    items.forEach(wrapper => {
        const name = wrapper.dataset.name;
        if (name.includes(searchTerm)) {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
        }
    });
}

export function addSelectedProductsToCart() {
    let addedCount = 0;
    let errorMessage = "";
    window.data.products.forEach(p => {
        const checkbox = document.getElementById(`chk-${p.id}`);
        if (checkbox && checkbox.checked) {
            const qtyInput = document.getElementById(`qty-${p.id}`);
            const qty = parseInt(qtyInput.value);
            if (!qty || qty < 1) {
                errorMessage += `Please enter a valid quantity for ${p.name}.\n`;
                return;
            }
            if (qty > p.stock) {
                errorMessage += `Not enough stock for ${p.name}! Available: ${p.stock}\n`;
                return;
            }
            const existing = window.cart.find(i => i.id === p.id);
            if (existing) {
                if (existing.qty + qty > p.stock) {
                    errorMessage += `Not enough stock for ${p.name}! Cart already has ${existing.qty}, available: ${p.stock}\n`;
                    return;
                }
                existing.qty += qty;
            } else {
                const item = { id: p.id, name: p.name, price: p.price, cost: p.cost, qty: qty };
                window.cart.push(item);
            }
            addedCount++;
            checkbox.checked = false;
            document.getElementById(`qty-container-${p.id}`).classList.add('hidden');
            qtyInput.value = 1;
        }
    });
    if (errorMessage) {
        alert(errorMessage);
    } else if (addedCount > 0) {
        renderCart();
        closeModal();
    } else {
        alert("Please select at least one product.");
    }
}