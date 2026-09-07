// Stock Purchases now supports two modes:
//  - "Inventory Item": pick an existing product, enter qty + unit cost -> stock
//    goes UP and (optionally) the product's cost price is updated.
//  - "Quick Entry": old behaviour preserved exactly (free amount/category/note),
//    for misc purchases you don't want tied to a specific product.
// Either mode can optionally link a Supplier and a partial "Amount Paid" ->
// the unpaid remainder becomes supplier payable (feeds Suppliers + Cash Book).
// Old records (pre-upgrade) have no amountPaid/amountDue/productId fields;
// they are treated as fully-paid, non-inventory, non-supplier-linked purchases
// everywhere they're read, so nothing about existing data changes visually.

export function renderStockPurchases(container) {
    const data = window.data; const formatCurrency = window.formatCurrency;
    container.innerHTML = `<button class="btn" style="margin-bottom:20px;" onclick="openStockPurchaseModal()">+ Record Stock Purchase</button><div class="card" id="purchase-list">${data.stockPurchases.length === 0 ? '<div class="empty-state"><i class="fas fa-truck-loading"></i><h3>No purchases yet</h3><p>Record your first stock purchase to update inventory.</p></div>' : data.stockPurchases.slice().reverse().map(p => {
        const amountPaid = p.amountPaid !== undefined ? p.amountPaid : p.amount;
        const amountDue = p.amountDue || 0;
        return `<div class="list-item" style="cursor:default;"><div class="list-item-info"><h4>${p.category || (p.productName ? p.productName : 'Stock Purchase')}</h4><p>${new Date(p.date).toLocaleDateString()} ${p.supplier ? '| ' + p.supplier : ''} ${p.note ? '| ' + p.note : ''}</p>${amountDue > 0 ? `<p><span class="badge badge-low">Due: ${formatCurrency(amountDue)}</span></p>` : ''}</div><div style="display:flex; align-items:center; gap:10px;"><span style="font-weight:bold;">${formatCurrency(p.amount)}</span><button class="btn btn-sm btn-danger" onclick="deleteStockPurchase('${p.id}')"><i class="fas fa-trash"></i></button></div></div>`;
    }).join('')}</div>`;
}

export function openStockPurchaseModal() {
    const data = window.data;
    const modal = document.getElementById('modal-body');
    const supplierOptions = `<option value="">No Supplier / Cash Purchase</option>${(data.suppliers || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}`;
    const productOptions = data.products.map(p => `<option value="${p.id}" data-cost="${p.cost}">${p.name} (Stock: ${p.stock})</option>`).join('');
    modal.innerHTML = `
        <div class="modal-header"><h2>Record Stock Purchase</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
        <div class="tabs">
            <button class="tab-btn active" id="sp-tab-btn-inventory" onclick="showStockPurchaseTab('inventory')">Inventory Item</button>
            <button class="tab-btn" id="sp-tab-btn-quick" onclick="showStockPurchaseTab('quick')">Quick Entry</button>
        </div>
        <div id="sp-tab-inventory">
            ${data.products.length === 0 ? '<p style="color:var(--gray); margin-bottom:15px;">No products yet — add one in Inventory first, or use Quick Entry.</p>' : `
            <div class="form-group"><label>Product *</label><select id="sp-product" onchange="onStockPurchaseProductChange()">${productOptions}</select></div>
            <div class="form-row"><div class="form-group"><label>Quantity *</label><input type="number" id="sp-qty" min="1" value="1"></div><div class="form-group"><label>Unit Cost (Rs.) *</label><input type="number" id="sp-unit-cost" step="0.01" min="0"></div></div>
            <div class="form-group" style="display:flex; align-items:center; gap:8px;"><input type="checkbox" id="sp-update-cost" style="width:auto;" checked><label style="margin:0;" for="sp-update-cost">Update this product's cost price</label></div>`}
        </div>
        <div id="sp-tab-quick" class="hidden">
            <div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="sp-amount" min="0" step="0.01"></div>
            <div class="form-group"><label>Category</label><input type="text" id="sp-category"></div>
        </div>
        <div class="form-group"><label>Supplier</label><select id="sp-supplier">${supplierOptions}</select></div>
        <div class="form-group"><label>Date *</label><input type="date" id="sp-date" value="${window.getLocalDateStr(new Date())}"></div>
        <div class="form-group"><label>Amount Paid Now (Rs.)</label><input type="number" id="sp-amount-paid" min="0" step="0.01" placeholder="Leave blank to mark fully paid"></div>
        <div class="form-group"><label>Note</label><input type="text" id="sp-note"></div>
        <button class="btn" id="btn-save-sp" onclick="saveStockPurchase()">Save Purchase</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    if (data.products.length > 0) onStockPurchaseProductChange();
}

export function showStockPurchaseTab(tab) {
    document.getElementById('sp-tab-inventory').classList.toggle('hidden', tab !== 'inventory');
    document.getElementById('sp-tab-quick').classList.toggle('hidden', tab !== 'quick');
    document.getElementById('sp-tab-btn-inventory').classList.toggle('active', tab === 'inventory');
    document.getElementById('sp-tab-btn-quick').classList.toggle('active', tab === 'quick');
}

export function onStockPurchaseProductChange() {
    const select = document.getElementById('sp-product');
    const costInput = document.getElementById('sp-unit-cost');
    if (!select || !costInput) return;
    const option = select.options[select.selectedIndex];
    if (option) costInput.value = option.dataset.cost || 0;
}

export async function saveStockPurchase() {
    const isInventoryMode = !document.getElementById('sp-tab-inventory').classList.contains('hidden');
    const date = document.getElementById('sp-date').value;
    const supplierId = document.getElementById('sp-supplier').value || null;
    const note = document.getElementById('sp-note').value.trim();
    const amountPaidInput = document.getElementById('sp-amount-paid').value;
    if (!date) return alert("Date is required.");

    let amount, category = '', productId = null, productName = '', qty = 0, unitCost = 0, updateCost = false;
    if (isInventoryMode) {
        const productSelect = document.getElementById('sp-product');
        if (!productSelect || !productSelect.value) return alert("Select a product, or switch to Quick Entry.");
        productId = productSelect.value;
        productName = productSelect.options[productSelect.selectedIndex].text.split(' (')[0];
        qty = parseInt(document.getElementById('sp-qty').value);
        unitCost = parseFloat(document.getElementById('sp-unit-cost').value);
        updateCost = document.getElementById('sp-update-cost').checked;
        if (!qty || qty < 1 || isNaN(unitCost) || unitCost < 0) return alert("Enter a valid quantity and unit cost.");
        amount = qty * unitCost;
    } else {
        amount = parseFloat(document.getElementById('sp-amount').value);
        category = document.getElementById('sp-category').value.trim();
        if (isNaN(amount) || amount <= 0) return alert("Enter a valid amount.");
    }

    const amountPaid = amountPaidInput === '' ? amount : Math.max(0, Math.min(amount, parseFloat(amountPaidInput) || 0));
    const amountDue = Math.max(0, amount - amountPaid);
    if (amountDue > 0 && !supplierId) return alert("An unpaid amount requires selecting a Supplier so the balance can be tracked.");

    window.showLoading('btn-save-sp', "Saving...");
    try {
        await window.runAtomicOrOffline(async (transaction) => {
            let productSnap = null;
            if (productId) {
                productSnap = await transaction.get(window.doc(window.db, "products", productId));
                if (!productSnap.exists()) throw new Error("Product not found.");
                if (productSnap.data().ownerId !== window.currentUserId) throw new Error("Unauthorized.");
            }
            let supplierSnap = null, supplierName = '';
            if (supplierId) {
                supplierSnap = await transaction.get(window.doc(window.db, "suppliers", supplierId));
                if (!supplierSnap.exists()) throw new Error("Supplier not found.");
                supplierName = supplierSnap.data().name;
            }

            if (productId) {
                const pData = productSnap.data();
                const update = { stock: (pData.stock || 0) + qty };
                if (updateCost) update.cost = unitCost;
                transaction.update(window.doc(window.db, "products", productId), update);
            }

            const purchaseRef = window.doc(window.collection(window.db, "stockPurchases"));
            transaction.set(purchaseRef, {
                ownerId: window.currentUserId, date: new Date(date).toISOString(),
                amount, amountPaid, amountDue, category, note,
                supplierId: supplierId || null, supplier: supplierName || '',
                productId: productId || null, productName: productName || '', qty: qty || 0, unitCost: unitCost || 0
            });

            if (supplierId && amountDue > 0) {
                const newBalance = (supplierSnap.data().balance || 0) + amountDue;
                transaction.update(window.doc(window.db, "suppliers", supplierId), { balance: newBalance });
                const txnRef = window.doc(window.collection(window.db, "supplierTransactions"));
                transaction.set(txnRef, { ownerId: window.currentUserId, supplierId, type: 'purchase_debt', amount: amountDue, balanceAfter: newBalance, date: new Date(date).toISOString(), note: `Stock purchase${productName ? ': ' + productName : ''}`, purchaseId: purchaseRef.id });
            }
        });
        alert("Recorded!");
        window.closeModal();
    } catch (error) {
        console.error(error);
        alert(error.message || "Failed.");
    } finally {
        window.hideLoading('btn-save-sp');
    }
}

// Deleting a purchase that already moved stock or created supplier debt would
// silently corrupt those balances, so that's blocked — use a Stock Adjustment
// or a Supplier ledger entry instead to correct mistakes. Old-style purchases
// (no productId, no amountDue) delete exactly as before.
export async function deleteStockPurchase(id) {
    const p = window.data.stockPurchases.find(x => x.id === id);
    if (p && (p.productId || (p.amountDue && p.amountDue > 0))) {
        return alert("This purchase affected inventory and/or a supplier balance and can't be deleted directly. Use a Stock Adjustment or Supplier ledger entry to correct it instead.");
    }
    if (!confirm("Delete?")) return;
    try {
        await window.deleteDoc(window.doc(window.db, "stockPurchases", id));
    } catch (error) {
        alert("Failed.");
    }
}

window.renderStockPurchases = renderStockPurchases;
window.openStockPurchaseModal = openStockPurchaseModal;
window.showStockPurchaseTab = showStockPurchaseTab;
window.onStockPurchaseProductChange = onStockPurchaseProductChange;
window.saveStockPurchase = saveStockPurchase;
window.deleteStockPurchase = deleteStockPurchase;
