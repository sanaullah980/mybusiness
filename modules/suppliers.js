// Supplier management + ledger, mirroring the customer ledger pattern.
// A supplier "balance" here means: amount WE OWE the supplier (payable).
// "Gave" = we paid the supplier (reduces payable). "Received"/"Purchase" = we
// bought stock on credit from them (increases payable). Stock-purchase-driven
// debt is created from modules/stockPurchases.js via the atomic write helper so it
// stays consistent with inventory + cash book; the manual actions here are
// for adjustments and for recording a payment against the supplier directly.

export function renderSuppliers(container) {
    const data = window.data;
    const formatCurrency = window.formatCurrency;
    const chevronSvg = `<svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
    const totalPayable = (data.suppliers || []).reduce((sum, s) => sum + (s.balance || 0), 0);
    container.innerHTML = `
        <div class="card debt"><h3>Total Payable to Suppliers</h3><div class="value">${formatCurrency(totalPayable)}</div></div>
        <button class="btn" style="margin-bottom:20px;" onclick="openSupplierModal()">+ Add Supplier</button>
        <div class="card" id="supplier-list">${(data.suppliers || []).length === 0 ? '<p style="color:var(--gray); text-align:center; padding:10px;">No suppliers found.</p>' : data.suppliers.map(s => `<div class="list-item" onclick="openSupplierDetails('${s.id}')"><div class="list-item-info"><h4>${s.name}</h4><p>${s.phone || 'No phone'} | Payable: <span style="color:var(--danger); font-weight:bold;">${formatCurrency(s.balance || 0)}</span></p></div>${chevronSvg}</div>`).join('')}</div>`;
}

export function openSupplierModal(supplierId = null) {
    const s = supplierId ? (window.data.suppliers || []).find(x => x.id === supplierId) : null;
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>${s ? 'Edit' : 'Add'} Supplier</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><div class="form-group"><label>Supplier Name *</label><input type="text" id="s-name" value="${s ? s.name : ''}"></div><div class="form-group"><label>Phone / Contact</label><input type="text" id="s-phone" value="${s ? (s.phone || '') : ''}"></div><div class="form-group"><label>Notes</label><textarea id="s-notes" rows="2" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px;">${s ? (s.notes || '') : ''}</textarea></div><button class="btn" id="btn-save-supplier" onclick="saveSupplier('${supplierId || ''}')">${s ? 'Update' : 'Save'} Supplier</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export async function saveSupplier(supplierId) {
    const name = document.getElementById('s-name').value.trim();
    const phone = document.getElementById('s-phone').value.trim();
    const notes = document.getElementById('s-notes').value.trim();
    if (!name) return alert("Name required.");
    window.showLoading('btn-save-supplier', "Saving...");
    try {
        const sData = { name, phone, notes, ownerId: window.currentUserId };
        if (supplierId) await window.updateDoc(window.doc(window.db, "suppliers", supplierId), sData);
        else { sData.balance = 0; await window.addDoc(window.collection(window.db, "suppliers"), sData); }
        alert(supplierId ? "Updated!" : "Added!");
        window.closeModal();
        window.navigate('suppliers');
    } catch (error) {
        console.error(error);
        alert("Failed.");
    } finally {
        window.hideLoading('btn-save-supplier');
    }
}

export async function deleteSupplier(id) {
    const s = (window.data.suppliers || []).find(x => x.id === id);
    if (s && (s.balance || 0) !== 0) return alert("Cannot delete a supplier with an outstanding balance. Settle it first.");
    if (!confirm("Delete this supplier?")) return;
    try {
        await window.deleteDoc(window.doc(window.db, "suppliers", id));
        window.navigate('suppliers');
    } catch (error) {
        console.error(error);
        alert("Failed.");
    }
}

// Supplier details: balance + a date-wise ledger (Purchased | Paid), same
// shape as the customer ledger so the UI feels consistent.
export function openSupplierDetails(supplierId) {
    const s = (window.data.suppliers || []).find(x => x.id === supplierId);
    if (!s) return alert("Supplier not found.");
    const txns = (window.data.supplierTransactions || []).filter(t => t.supplierId === supplierId).sort((a, b) => new Date(a.date) - new Date(b.date));
    const modal = document.getElementById('modal-body');

    let rowsHtml = '';
    if (txns.length === 0) {
        rowsHtml = '<tr><td colspan="3" style="text-align:center; color:var(--gray); padding: 20px;">No transactions yet</td></tr>';
    } else {
        rowsHtml = txns.map(t => {
            const isPaid = t.type === 'payment';
            const dateStr = new Date(t.date).toLocaleDateString();
            const purchasedCell = isPaid ? '' : `<span class="text-danger" style="font-weight:bold;">${window.formatCurrency(t.amount)}</span>`;
            const paidCell = isPaid ? `<span class="text-success" style="font-weight:bold;">${window.formatCurrency(t.amount)}</span>` : '';
            return `<tr><td>${dateStr}</td><td style="text-align:right;">${purchasedCell}</td><td style="text-align:right;">${paidCell}</td></tr>`;
        }).join('');
    }

    modal.innerHTML = `
        <div class="modal-header"><h2>${s.name}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
        <div style="text-align:center; margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="font-size:14px; color:var(--gray);">You Owe (Payable)</div>
            <div style="font-size:32px; font-weight:bold; color:var(--danger);">${window.formatCurrency(s.balance || 0)}</div>
        </div>
        <h3 style="font-size:16px; margin-bottom:10px; color:var(--dark);">Ledger</h3>
        <div style="overflow-x:auto; margin-bottom: 15px;">
            <table class="ledger-table" style="min-width: 300px;">
                <thead><tr><th>Date</th><th style="text-align:right; color:var(--danger);">Purchased</th><th style="text-align:right; color:var(--success);">Paid</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
        <div class="ledger-btn-row">
            <button class="btn ledger-btn give" onclick="openSupplierPayModal('${s.id}')">Pay Supplier</button>
            <button class="btn ledger-btn receive" onclick="openSupplierDebtModal('${s.id}')">Record Credit Purchase</button>
        </div>
        <button class="btn btn-secondary" style="margin-top:10px;" onclick="deleteSupplier('${s.id}')">Delete Supplier</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export function openSupplierPayModal(supplierId) {
    const s = (window.data.suppliers || []).find(x => x.id === supplierId);
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>Pay ${s.name}</h2><button class="close-btn" onclick="openSupplierDetails('${s.id}')">&times;</button></div><p style="margin-bottom:15px;">Current Payable: <strong>${window.formatCurrency(s.balance || 0)}</strong></p><div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="sup-pay-amount" min="1" max="${s.balance || 0}"></div><div class="form-group"><label>Note (Optional)</label><input type="text" id="sup-pay-note" placeholder="e.g., Cash paid"></div><button class="btn" id="btn-sup-pay" style="background:var(--success);" onclick="processSupplierPayment('${s.id}')">Confirm Payment</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

// Paying a supplier reduces the payable AND reduces cash in hand. The cash
// book (modules/cashbook.js) derives this cash-out directly from the
// supplierTransactions collection created here — it does NOT get a separate
// cashTransactions entry, to avoid double-counting the same rupee twice.
export async function processSupplierPayment(supplierId) {
    const amount = parseFloat(document.getElementById('sup-pay-amount').value);
    const note = document.getElementById('sup-pay-note').value.trim();
    const s = (window.data.suppliers || []).find(x => x.id === supplierId);
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");
    if (amount > (s.balance || 0)) return alert("Amount cannot exceed current payable.");
    window.showLoading('btn-sup-pay', "Processing...");
    try {
        await window.runAtomicOrOffline(async (transaction) => {
            const supplierRef = window.doc(window.db, "suppliers", supplierId);
            const snap = await transaction.get(supplierRef);
            if (!snap.exists()) throw new Error("Supplier not found.");
            const newBalance = Math.max(0, (snap.data().balance || 0) - amount);
            transaction.update(supplierRef, { balance: newBalance });
            const txnRef = window.doc(window.collection(window.db, "supplierTransactions"));
            transaction.set(txnRef, { ownerId: window.currentUserId, supplierId, type: 'payment', amount, balanceAfter: newBalance, date: new Date().toISOString(), note: note || 'Payment to supplier' });
        });
        alert("Payment recorded successfully!");
        openSupplierDetails(supplierId);
    } catch (error) {
        console.error(error);
        alert(error.message || "Failed to record payment.");
    } finally {
        window.hideLoading('btn-sup-pay');
    }
}

export function openSupplierDebtModal(supplierId) {
    const s = (window.data.suppliers || []).find(x => x.id === supplierId);
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>Credit Purchase from ${s.name}</h2><button class="close-btn" onclick="openSupplierDetails('${s.id}')">&times;</button></div><p style="margin-bottom:15px; font-size:13px; color:var(--gray);">Use this for a manual balance adjustment. For actual stock purchases, use Stock Purchases so inventory updates too.</p><div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="sup-debt-amount" min="1"></div><div class="form-group"><label>Note (Optional)</label><input type="text" id="sup-debt-note"></div><button class="btn" id="btn-sup-debt" style="background:var(--danger);" onclick="processSupplierDebt('${s.id}')">Confirm</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export async function processSupplierDebt(supplierId) {
    const amount = parseFloat(document.getElementById('sup-debt-amount').value);
    const note = document.getElementById('sup-debt-note').value.trim();
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");
    window.showLoading('btn-sup-debt', "Processing...");
    try {
        await window.runAtomicOrOffline(async (transaction) => {
            const supplierRef = window.doc(window.db, "suppliers", supplierId);
            const snap = await transaction.get(supplierRef);
            if (!snap.exists()) throw new Error("Supplier not found.");
            const newBalance = (snap.data().balance || 0) + amount;
            transaction.update(supplierRef, { balance: newBalance });
            const txnRef = window.doc(window.collection(window.db, "supplierTransactions"));
            transaction.set(txnRef, { ownerId: window.currentUserId, supplierId, type: 'manual_debt', amount, balanceAfter: newBalance, date: new Date().toISOString(), note: note || 'Manual balance adjustment' });
        });
        alert("Recorded!");
        openSupplierDetails(supplierId);
    } catch (error) {
        console.error(error);
        alert(error.message || "Failed.");
    } finally {
        window.hideLoading('btn-sup-debt');
    }
}

window.renderSuppliers = renderSuppliers;
window.openSupplierModal = openSupplierModal;
window.saveSupplier = saveSupplier;
window.deleteSupplier = deleteSupplier;
window.openSupplierDetails = openSupplierDetails;
window.openSupplierPayModal = openSupplierPayModal;
window.processSupplierPayment = processSupplierPayment;
window.openSupplierDebtModal = openSupplierDebtModal;
window.processSupplierDebt = processSupplierDebt;
