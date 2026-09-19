// Cash Book: opening balance + a chronological running balance built from
// every collection that actually moves cash. To avoid double-counting the
// same rupee, each cash movement has exactly ONE source of truth:
//   - Sale amountPaid              -> sales collection (cash IN at sale time)
//   - Customer debt payment        -> customerTransactions type='payment' (cash IN)
//   - Expense                      -> expenses collection (cash OUT)
//   - Stock purchase amountPaid    -> stockPurchases collection (cash OUT)
//   - Supplier debt payment        -> supplierTransactions type='payment' (cash OUT)
//   - Manual entry                 -> cashTransactions collection (IN or OUT)
// Nothing here writes to more than one of these per real-world event, so the
// running balance can't drift from double bookkeeping.

export function buildCashBookEntries() {
    const data = window.data;
    const entries = [];

    (data.sales || []).forEach(s => {
        if ((s.amountPaid || 0) > 0) entries.push({ date: s.date, type: 'in', amount: s.amountPaid, label: `Sale - ${s.customerName || 'Walk-in'}`, source: 'sale' });
    });
    (data.customerTransactions || []).forEach(t => {
        if (t.type === 'payment') entries.push({ date: t.date, type: 'in', amount: t.amount, label: `Customer payment${t.note ? ' - ' + t.note : ''}`, source: 'customer_payment' });
    });
    (data.expenses || []).forEach(e => {
        entries.push({ date: e.date, type: 'out', amount: e.amount || 0, label: `Expense${e.category ? ' - ' + e.category : ''}`, source: 'expense' });
    });
    (data.stockPurchases || []).forEach(p => {
        const paid = p.amountPaid !== undefined ? p.amountPaid : p.amount;
        if ((paid || 0) > 0) entries.push({ date: p.date, type: 'out', amount: paid, label: `Stock purchase${p.productName ? ' - ' + p.productName : (p.category ? ' - ' + p.category : '')}`, source: 'stock_purchase' });
    });
    (data.supplierTransactions || []).forEach(t => {
        if (t.type === 'payment') entries.push({ date: t.date, type: 'out', amount: t.amount, label: `Supplier payment${t.note ? ' - ' + t.note : ''}`, source: 'supplier_payment' });
    });
    (data.salesReturns || []).forEach(r => {
        if ((r.cashRefund || 0) > 0) entries.push({ date: r.date, type: 'out', amount: r.cashRefund, label: `Sales return refund${r.note ? ' - ' + r.note : ''}`, source: 'sales_return' });
    });
    (data.cashTransactions || []).forEach(t => {
        entries.push({ date: t.date, type: t.type === 'income' ? 'in' : 'out', amount: t.amount, label: t.note || (t.type === 'income' ? 'Manual cash in' : 'Manual cash out'), source: 'manual' });
    });

    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    return entries;
}

export function renderCashBook(container) {
    const data = window.data;
    const formatCurrency = window.formatCurrency;
    const opening = (data.settings && data.settings.cashOpeningBalance) || 0;
    const entries = buildCashBookEntries();

    let running = opening;
    let totalIn = 0, totalOut = 0;
    const rows = entries.map(e => {
        running += e.type === 'in' ? e.amount : -e.amount;
        if (e.type === 'in') totalIn += e.amount; else totalOut += e.amount;
        return `<tr><td>${new Date(e.date).toLocaleDateString()}</td><td>${e.label}</td><td style="text-align:right; color:var(--success);">${e.type === 'in' ? formatCurrency(e.amount) : ''}</td><td style="text-align:right; color:var(--danger);">${e.type === 'out' ? formatCurrency(e.amount) : ''}</td><td style="text-align:right; font-weight:bold;">${formatCurrency(running)}</td></tr>`;
    });

    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="card"><h3>Opening Balance</h3><div class="value" style="font-size:20px;">${formatCurrency(opening)}</div></div>
            <div class="card profit"><h3>Cash in Hand</h3><div class="value" style="font-size:20px;">${formatCurrency(running)}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card"><h3>Total In</h3><div class="value" style="font-size:20px; color:var(--success);">${formatCurrency(totalIn)}</div></div>
            <div class="card"><h3>Total Out</h3><div class="value" style="font-size:20px; color:var(--danger);">${formatCurrency(totalOut)}</div></div>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:15px;">
            <button class="btn" onclick="openCashEntryModal('income')" style="background:var(--success);">+ Cash In</button>
            <button class="btn" onclick="openCashEntryModal('expense')" style="background:var(--danger);">+ Cash Out</button>
        </div>
        <button class="btn btn-secondary" style="margin-bottom:20px;" onclick="openSetOpeningBalanceModal()">Set Opening Balance</button>
        <div class="card">
            <h3 style="margin-bottom:10px;">Transactions</h3>
            <div style="overflow-x:auto;">
                <table class="ledger-table" style="min-width:500px;">
                    <thead><tr><th>Date</th><th>Description</th><th style="text-align:right;">In</th><th style="text-align:right;">Out</th><th style="text-align:right;">Balance</th></tr></thead>
                    <tbody>${rows.length ? rows.join('') : '<tr><td colspan="5" style="text-align:center; color:var(--gray); padding:20px;">No cash transactions yet</td></tr>'}</tbody>
                </table>
            </div>
        </div>`;
}

export function openSetOpeningBalanceModal() {
    const current = (window.data.settings && window.data.settings.cashOpeningBalance) || 0;
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>Set Opening Balance</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><p style="font-size:13px; color:var(--gray); margin-bottom:15px;">This is your starting cash — set it once when you begin using the Cash Book.</p><div class="form-group"><label>Opening Balance (Rs.) *</label><input type="number" id="cb-opening" min="0" step="0.01" value="${current}"></div><button class="btn" id="btn-save-opening" onclick="saveOpeningBalance()">Save</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export async function saveOpeningBalance() {
    const amount = parseFloat(document.getElementById('cb-opening').value);
    if (isNaN(amount) || amount < 0) return alert("Enter a valid amount.");
    window.showLoading('btn-save-opening', "Saving...");
    try {
        await window.setDoc(window.doc(window.db, "settings", window.currentUserId), { cashOpeningBalance: amount }, { merge: true });
        window.data.settings.cashOpeningBalance = amount;
        alert("Saved!");
        window.closeModal();
        window.navigate('cashbook');
    } catch (error) {
        console.error(error);
        alert("Failed.");
    } finally {
        window.hideLoading('btn-save-opening');
    }
}

export function openCashEntryModal(type) {
    const modal = document.getElementById('modal-body');
    const title = type === 'income' ? 'Add Cash In' : 'Add Cash Out';
    modal.innerHTML = `<div class="modal-header"><h2>${title}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="cb-amount" min="0.01" step="0.01"></div><div class="form-group"><label>Date *</label><input type="date" id="cb-date" value="${window.getLocalDateStr(new Date())}"></div><div class="form-group"><label>Note</label><input type="text" id="cb-note" placeholder="e.g., Owner withdrawal, extra cash found"></div><button class="btn" id="btn-save-cash-entry" style="background:${type === 'income' ? 'var(--success)' : 'var(--danger)'};" onclick="saveCashEntry('${type}')">Save</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export async function saveCashEntry(type) {
    const amount = parseFloat(document.getElementById('cb-amount').value);
    const date = document.getElementById('cb-date').value;
    const note = document.getElementById('cb-note').value.trim();
    if (isNaN(amount) || amount <= 0 || !date) return alert("Enter a valid amount and date.");
    window.showLoading('btn-save-cash-entry', "Saving...");
    try {
        await window.addDoc(window.collection(window.db, "cashTransactions"), { ownerId: window.currentUserId, type, amount, date: new Date(date).toISOString(), note });
        alert("Saved!");
        window.closeModal();
        window.navigate('cashbook');
    } catch (error) {
        console.error(error);
        alert("Failed.");
    } finally {
        window.hideLoading('btn-save-cash-entry');
    }
}

window.renderCashBook = renderCashBook;
window.openSetOpeningBalanceModal = openSetOpeningBalanceModal;
window.saveOpeningBalance = saveOpeningBalance;
window.openCashEntryModal = openCashEntryModal;
window.saveCashEntry = saveCashEntry;
