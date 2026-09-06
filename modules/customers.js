export function renderCustomers(container) {
    const data = window.data;
    const formatCurrency = window.formatCurrency;
    const chevronSvg = `<svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
    container.innerHTML = `<button class="btn" style="margin-bottom:20px;" onclick="openCustomerModal()">+ Add Customer</button><div class="card" id="customer-list">${data.customers.length === 0 ? '<p style="color:var(--gray); text-align:center; padding:10px;">No customers found.</p>' : data.customers.map(c => `<div class="list-item customer-item" onclick="openCustomerDetails('${c.id}')"><div class="list-item-info"><h4>${c.name}</h4><p>${c.phone || 'No phone'} | Debt: <span style="color:var(--danger); font-weight:bold;">${formatCurrency(c.balance || 0)}</span></p></div>${chevronSvg}</div>`).join('')}</div>`;
}

export function openCustomerModal(customerId = null) {
    const c = customerId ? window.data.customers.find(x => x.id === customerId) : null;
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>${c ? 'Edit' : 'Add'} Customer</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><div class="form-group"><label>Customer Name *</label><input type="text" id="c-name" value="${c ? c.name : ''}"></div><div class="form-group"><label>Phone / Contact</label><input type="text" id="c-phone" value="${c ? (c.phone || '') : ''}"></div><div class="form-group"><label>Notes</label><textarea id="c-notes" rows="2" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px;">${c ? (c.notes || '') : ''}</textarea></div><button class="btn" id="btn-save-customer" onclick="saveCustomer('${customerId || ''}')">${c ? 'Update' : 'Save'} Customer</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export async function saveCustomer(customerId) {
    const name = document.getElementById('c-name').value.trim();
    const phone = document.getElementById('c-phone').value.trim();
    const notes = document.getElementById('c-notes').value.trim();
    if (!name) return alert("Name required.");
    window.showLoading('btn-save-customer', "Saving...");
    try {
        const cData = { name, phone, notes, ownerId: window.currentUserId };
        if (customerId) await window.updateDoc(window.doc(window.db, "customers", customerId), cData);
        else { cData.balance = 0; await window.addDoc(window.collection(window.db, "customers"), cData); }
        alert(customerId ? "Updated!" : "Added!");
        closeModal();
        window.navigate('customers');
    } catch (error) {
        console.error(error);
        alert("Failed.");
    } finally {
        window.hideLoading('btn-save-customer');
    }
}

// Customer-details dialog: opens when a customer is tapped from the list.
// Shows the running balance, a date-filterable ledger (Date | Gave | Received)
// with period totals, a PDF statement download, and a payment reminder action.
export function openCustomerDetails(customerId) {
    const c = window.data.customers.find(x => x.id === customerId);
    if (!c) return alert("Customer not found.");
    const modal = document.getElementById('modal-body');
    const giveIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
    const receiveIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>`;

    modal.innerHTML = `
        <div class="modal-header"><h2>${c.name}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
        <div style="text-align:center; margin-bottom: 15px; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="font-size:14px; color:var(--gray);">Current Balance</div>
            <div style="font-size:32px; font-weight:bold; color:var(--danger);">${window.formatCurrency(c.balance || 0)}</div>
        </div>
        <div class="form-row" style="margin-bottom:5px;">
            <div class="form-group"><label>From</label><input type="date" id="cust-ledger-from" onchange="renderCustomerLedgerTable('${c.id}')"></div>
            <div class="form-group"><label>To</label><input type="date" id="cust-ledger-to" value="${window.getLocalDateStr(new Date())}" onchange="renderCustomerLedgerTable('${c.id}')"></div>
        </div>
        <h3 style="font-size:16px; margin-bottom:10px; color:var(--dark);">Report</h3>
        <div id="cust-ledger-container"></div>
        <div class="ledger-btn-row" style="margin-top:15px;">
            <button class="btn ledger-btn give" onclick="openGiveModal('${c.id}')">${giveIcon} Gave</button>
            <button class="btn ledger-btn receive" onclick="openReceiveModal('${c.id}')">${receiveIcon} Received</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
            <button class="btn btn-secondary" onclick="downloadCustomerStatementPdf('${c.id}')"><i class="fas fa-file-pdf"></i> Download Statement (PDF)</button>
            ${(c.balance || 0) > 0 ? `<button class="btn" style="background:#25D366;" onclick="sendPaymentReminder('${c.id}')"><i class="fab fa-whatsapp"></i> Send Payment Reminder</button>` : ''}
        </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    renderCustomerLedgerTable(customerId);
}

export function renderCustomerLedgerTable(customerId) {
    const container = document.getElementById('cust-ledger-container');
    if (!container) return;
    const fromVal = document.getElementById('cust-ledger-from')?.value;
    const toVal = document.getElementById('cust-ledger-to')?.value;
    const fromDate = fromVal ? new Date(fromVal + 'T00:00:00') : null;
    const toDate = toVal ? new Date(toVal + 'T23:59:59') : null;

    const txns = window.data.customerTransactions
        .filter(t => t.customerId === customerId)
        .filter(t => (!fromDate || new Date(t.date) >= fromDate) && (!toDate || new Date(t.date) <= toDate))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    let totalGave = 0, totalReceived = 0;
    let rowsHtml = '';
    if (txns.length === 0) {
        rowsHtml = '<tr><td colspan="3" style="text-align:center; color:var(--gray); padding: 20px;">No transactions in this period</td></tr>';
    } else {
        rowsHtml = txns.map(t => {
            const isReceived = t.type === 'payment' || t.type === 'return_credit';
            const dateStr = new Date(t.date).toLocaleDateString();
            if (isReceived) totalReceived += t.amount; else totalGave += t.amount;
            const gaveCell = isReceived ? '' : `<span class="text-danger" style="font-weight:bold;">${window.formatCurrency(t.amount)}</span>`;
            const receivedCell = isReceived ? `<span class="text-success" style="font-weight:bold;">${window.formatCurrency(t.amount)}</span>` : '';
            return `<tr><td>${dateStr}</td><td style="text-align:right;">${gaveCell}</td><td style="text-align:right;">${receivedCell}</td></tr>`;
        }).join('');
    }

    container.innerHTML = `
        <div style="overflow-x:auto; margin-bottom: 10px;">
            <table class="ledger-table" style="min-width: 300px;">
                <thead><tr><th>Date</th><th style="text-align:right; color:var(--danger);">Gave</th><th style="text-align:right; color:var(--success);">Received</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot><tr style="font-weight:bold; border-top:2px solid var(--dark);"><td>Total</td><td style="text-align:right; color:var(--danger);">${window.formatCurrency(totalGave)}</td><td style="text-align:right; color:var(--success);">${window.formatCurrency(totalReceived)}</td></tr></tfoot>
            </table>
        </div>`;
}

export function downloadCustomerStatementPdf(customerId) {
    const c = window.data.customers.find(x => x.id === customerId);
    if (!c) return alert("Customer not found.");
    if (!window.jspdf) return alert("PDF library not loaded. Check your internet connection and try again.");
    const fromVal = document.getElementById('cust-ledger-from')?.value;
    const toVal = document.getElementById('cust-ledger-to')?.value;
    const fromDate = fromVal ? new Date(fromVal + 'T00:00:00') : null;
    const toDate = toVal ? new Date(toVal + 'T23:59:59') : null;
    const txns = window.data.customerTransactions
        .filter(t => t.customerId === customerId)
        .filter(t => (!fromDate || new Date(t.date) >= fromDate) && (!toDate || new Date(t.date) <= toDate))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const businessName = (window.data.settings && window.data.settings.name) || 'My Business';
    let y = 50;
    doc.setFontSize(16); doc.text(businessName, 40, y); y += 22;
    doc.setFontSize(13); doc.text(`Statement - ${c.name}`, 40, y); y += 18;
    doc.setFontSize(10); doc.text(`${c.phone || ''}`, 40, y); y += 16;
    doc.text(`Period: ${fromVal || 'Start'} to ${toVal || 'Today'}`, 40, y); y += 20;
    doc.setLineWidth(0.5); doc.line(40, y, 550, y); y += 16;
    doc.setFontSize(10);
    doc.text('Date', 40, y); doc.text('Gave', 300, y); doc.text('Received', 420, y); y += 8;
    doc.line(40, y, 550, y); y += 14;
    let totalGave = 0, totalReceived = 0;
    txns.forEach(t => {
        const isReceived = t.type === 'payment' || t.type === 'return_credit';
        if (isReceived) totalReceived += t.amount; else totalGave += t.amount;
        doc.text(new Date(t.date).toLocaleDateString(), 40, y);
        if (!isReceived) doc.text(window.formatCurrency(t.amount), 300, y);
        if (isReceived) doc.text(window.formatCurrency(t.amount), 420, y);
        y += 16;
        if (y > 760) { doc.addPage(); y = 50; }
    });
    y += 6; doc.line(40, y, 550, y); y += 16;
    doc.setFontSize(11);
    doc.text(`Total Gave: ${window.formatCurrency(totalGave)}`, 40, y);
    doc.text(`Total Received: ${window.formatCurrency(totalReceived)}`, 300, y); y += 20;
    doc.setFontSize(13);
    doc.text(`Closing Balance: ${window.formatCurrency(c.balance || 0)}`, 40, y);
    doc.save(`Statement-${c.name.replace(/\s+/g, '-')}.pdf`);
}

export function sendPaymentReminder(customerId) {
    const c = window.data.customers.find(x => x.id === customerId);
    if (!c) return alert("Customer not found.");
    const businessName = (window.data.settings && window.data.settings.name) || 'My Business';
    const text = `Hi ${c.name}, this is a friendly reminder from ${businessName} that you have an outstanding balance of ${window.formatCurrency(c.balance || 0)}. Please arrange payment at your convenience. Thank you!`;
    const phone = c.phone ? c.phone.replace(/[^0-9]/g, '') : '';
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (navigator.share) {
        navigator.share({ title: 'Payment Reminder', text }).catch(() => window.open(url, '_blank'));
    } else if (navigator.clipboard && !phone) {
        navigator.clipboard.writeText(text).then(() => alert("No phone number on file — reminder text copied to clipboard instead."));
    } else {
        window.open(url, '_blank');
    }
}

export function openGiveModal(customerId) {
    const c = window.data.customers.find(x => x.id === customerId);
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>Gave to ${c.name}</h2><button class="close-btn" onclick="openCustomerDetails('${c.id}')">&times;</button></div><p style="margin-bottom:15px;">Current Debt: <strong>${window.formatCurrency(c.balance || 0)}</strong></p><div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="give-amount" min="1"></div><div class="form-group"><label>Note (Optional)</label><input type="text" id="give-note" placeholder="e.g., Cash given"></div><button class="btn" id="btn-give" style="background:var(--danger);" onclick="processGive('${c.id}')">Confirm Gave</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export async function processGive(customerId) {
    const amount = parseFloat(document.getElementById('give-amount').value);
    const note = document.getElementById('give-note').value.trim();
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");
    window.showLoading('btn-give', "Processing...");
    try {
        const c = window.data.customers.find(x => x.id === customerId);
        const newBalance = (c.balance || 0) + amount;
        await window.updateDoc(window.doc(window.db, "customers", customerId), { balance: newBalance });
        await window.addDoc(window.collection(window.db, "customerTransactions"), { ownerId: window.currentUserId, customerId, type: 'manual_debt', amount, balanceAfter: newBalance, date: new Date().toISOString(), note: note || 'Debt increased' });
        alert("Debt increased successfully!");
        openCustomerDetails(customerId);
    } catch (error) {
        console.error(error);
        alert("Failed to update debt.");
    } finally {
        window.hideLoading('btn-give');
    }
}

export function openReceiveModal(customerId) {
    const c = window.data.customers.find(x => x.id === customerId);
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>Received from ${c.name}</h2><button class="close-btn" onclick="openCustomerDetails('${c.id}')">&times;</button></div><p style="margin-bottom:15px;">Current Debt: <strong>${window.formatCurrency(c.balance || 0)}</strong></p><div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="receive-amount" min="1" max="${c.balance || 0}"></div><div class="form-group"><label>Note (Optional)</label><input type="text" id="receive-note" placeholder="e.g., Cash received"></div><button class="btn" id="btn-receive" style="background:var(--success);" onclick="processReceive('${c.id}')">Confirm Received</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export async function processReceive(customerId) {
    const amount = parseFloat(document.getElementById('receive-amount').value);
    const note = document.getElementById('receive-note').value.trim();
    const c = window.data.customers.find(x => x.id === customerId);
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");
    if (amount > (c.balance || 0)) return alert("Amount cannot exceed current debt.");
    window.showLoading('btn-receive', "Processing...");
    try {
        const newBalance = Math.max(0, (c.balance || 0) - amount);
        await window.updateDoc(window.doc(window.db, "customers", customerId), { balance: newBalance });
        await window.addDoc(window.collection(window.db, "customerTransactions"), { ownerId: window.currentUserId, customerId, type: 'payment', amount, balanceAfter: newBalance, date: new Date().toISOString(), note: note || 'Payment received' });
        alert("Payment recorded successfully!");
        openCustomerDetails(customerId);
    } catch (error) {
        console.error(error);
        alert("Failed to record payment.");
    } finally {
        window.hideLoading('btn-receive');
    }
}

window.openCustomerModal = openCustomerModal;
window.saveCustomer = saveCustomer;
window.openCustomerDetails = openCustomerDetails;
window.renderCustomerLedgerTable = renderCustomerLedgerTable;
window.downloadCustomerStatementPdf = downloadCustomerStatementPdf;
window.sendPaymentReminder = sendPaymentReminder;
window.openGiveModal = openGiveModal;
window.processGive = processGive;
window.openReceiveModal = openReceiveModal;
window.processReceive = processReceive;
