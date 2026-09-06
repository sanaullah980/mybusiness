function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function customerTransactionsFor(customerId) {
    return (window.data.customerTransactions || [])
        .filter(t => t.customerId === customerId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function renderCustomers(container) {
    const customers = window.data.customers || [];
    const totalDebt = customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance) || 0), 0);
    const icon = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>`;
    const arrow = `<svg class="chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>`;
    container.innerHTML = `
        <div class="customer-summary-card">
            <div><span class="summary-label">Customers</span><strong>${customers.length}</strong></div>
            <div class="summary-divider"></div>
            <div><span class="summary-label">Total receivable</span><strong class="text-danger">${window.formatCurrency(totalDebt)}</strong></div>
        </div>
        <button class="btn customer-add-btn" onclick="openCustomerModal()">${icon}<span>Add Customer</span></button>
        <div class="customer-list-card" id="customer-list">
            ${customers.length === 0 ? `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>No customers yet</h3><p>Add your first customer to start tracking credit.</p></div>` : customers.map(c => {
                const balance = Math.max(0, Number(c.balance) || 0);
                return `<button class="customer-row" onclick="openCustomerDetails('${esc(c.id)}')">
                    <span class="customer-avatar">${esc((c.name || '?').trim().charAt(0).toUpperCase())}</span>
                    <span class="customer-row-main"><strong>${esc(c.name)}</strong><small>${esc(c.phone || 'No phone number')}</small></span>
                    <span class="customer-row-balance"><small>Due</small><strong class="${balance > 0 ? 'text-danger' : 'text-success'}">${window.formatCurrency(balance)}</strong></span>
                    ${arrow}
                </button>`;
            }).join('')}
        </div>`;
}

export function openCustomerModal(customerId = null) {
    const c = customerId ? window.data.customers.find(x => x.id === customerId) : null;
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>${c ? 'Edit Customer' : 'Add Customer'}</h2><button class="close-btn" onclick="closeModal()" aria-label="Close">&times;</button></div>
        <div class="form-group"><label>Customer Name *</label><input type="text" id="c-name" value="${esc(c?.name || '')}" autocomplete="name"></div>
        <div class="form-group"><label>Phone / Contact</label><input type="text" id="c-phone" value="${esc(c?.phone || '')}" autocomplete="tel"></div>
        <div class="form-group"><label>Notes</label><textarea id="c-notes" rows="2">${esc(c?.notes || '')}</textarea></div>
        <button class="btn" id="btn-save-customer" onclick="saveCustomer('${esc(customerId || '')}')">${c ? 'Update Customer' : 'Save Customer'}</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('c-name')?.focus(), 50);
}

export async function saveCustomer(customerId) {
    const name = document.getElementById('c-name').value.trim();
    const phone = document.getElementById('c-phone').value.trim();
    const notes = document.getElementById('c-notes').value.trim();
    if (!name) return alert('Customer name is required.');
    if (!window.currentUserId) return alert('Please log in again.');
    window.showLoading('btn-save-customer', 'Saving...');
    try {
        const cData = { name, phone, notes, ownerId: window.currentUserId };
        if (customerId) await window.updateDoc(window.doc(window.db, 'customers', customerId), cData);
        else { cData.balance = 0; cData.createdAt = new Date().toISOString(); await window.addDoc(window.collection(window.db, 'customers'), cData); }
        closeModal();
        window.navigate('customers');
    } catch (error) { console.error(error); alert(error.message || 'Failed to save customer.'); }
    finally { window.hideLoading('btn-save-customer'); }
}

export function openCustomerDetails(customerId) {
    const c = window.data.customers.find(x => x.id === customerId);
    if (!c) return alert('Customer not found.');
    const modal = document.getElementById('modal-body');
    const giveIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></svg>`;
    const receiveIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m18 13-6 6-6-6"/></svg>`;
    const balance = Math.max(0, Number(c.balance) || 0);
    modal.innerHTML = `<div class="customer-detail-head">
        <button class="close-btn" onclick="closeModal()" aria-label="Close">&times;</button>
        <span class="customer-avatar customer-avatar-lg">${esc((c.name || '?').trim().charAt(0).toUpperCase())}</span>
        <h2>${esc(c.name)}</h2><p>${esc(c.phone || 'No phone number')}</p>
        <div class="customer-balance"><span>Current Due</span><strong class="${balance > 0 ? 'text-danger' : 'text-success'}">${window.formatCurrency(balance)}</strong></div>
    </div>
    <div class="ledger-heading"><div><h3>Transaction History</h3><p>All changes to this customer's balance</p></div></div>
    <div id="cust-ledger-container" class="customer-ledger-wrap"></div>
    <div class="ledger-actions">
        <button class="ledger-action give" onclick="openGiveModal('${esc(c.id)}')">${giveIcon}<span>Gave</span><small>Increase due</small></button>
        <button class="ledger-action receive" onclick="openReceiveModal('${esc(c.id)}')">${receiveIcon}<span>Received</span><small>Reduce due</small></button>
    </div>
    <div class="customer-secondary-actions">
        <button class="btn btn-secondary" onclick="downloadCustomerStatementPdf('${esc(c.id)}')">Download Statement</button>
        ${balance > 0 ? `<button class="btn btn-light" onclick="sendPaymentReminder('${esc(c.id)}')">Send Payment Reminder</button>` : ''}
    </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    renderCustomerLedgerTable(customerId);
}

export function renderCustomerLedgerTable(customerId) {
    const container = document.getElementById('cust-ledger-container');
    if (!container) return;
    const txns = customerTransactionsFor(customerId);
    if (!txns.length) {
        container.innerHTML = `<div class="ledger-empty"><div class="ledger-empty-icon">↕</div><strong>No transactions yet</strong><span>Use Gave or Received below to record the first entry.</span></div>`;
        return;
    }
    const rows = txns.map(t => {
        const received = t.type === 'payment' || t.type === 'return_credit';
        const date = new Date(t.date);
        const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        return `<tr><td><strong>${dateStr}</strong><small>${date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</small></td>
            <td>${received ? '' : `<span class="money gave-money">${window.formatCurrency(Number(t.amount) || 0)}</span>`}</td>
            <td>${received ? `<span class="money received-money">${window.formatCurrency(Number(t.amount) || 0)}</span>` : ''}</td></tr>`;
    }).join('');
    container.innerHTML = `<div class="ledger-table-scroll"><table class="ledger-table customer-ledger"><thead><tr><th>Date</th><th>Gave</th><th>Received</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function downloadCustomerStatementPdf(customerId) {
    const c = window.data.customers.find(x => x.id === customerId);
    if (!c) return alert('Customer not found.');
    if (!window.jspdf) return alert('PDF library is unavailable. Connect to the internet and try again.');
    const txns = customerTransactionsFor(customerId).reverse();
    const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit:'pt', format:'a4' });
    let y = 50; const businessName = window.data.settings?.name || 'My Business';
    pdf.setFontSize(16); pdf.text(businessName, 40, y); y += 22; pdf.setFontSize(13); pdf.text(`Statement - ${c.name}`, 40, y); y += 24;
    pdf.setFontSize(10); pdf.text('Date', 40, y); pdf.text('Gave', 300, y); pdf.text('Received', 420, y); y += 14; pdf.line(40,y,550,y); y += 16;
    let gave=0, received=0;
    txns.forEach(t => { const isReceived=t.type==='payment'||t.type==='return_credit'; const amount=Number(t.amount)||0; if(isReceived) received+=amount; else gave+=amount; pdf.text(new Date(t.date).toLocaleDateString(),40,y); if(isReceived) pdf.text(window.formatCurrency(amount),420,y); else pdf.text(window.formatCurrency(amount),300,y); y+=16; if(y>760){pdf.addPage();y=50;} });
    y += 8; pdf.line(40,y,550,y); y += 18; pdf.text(`Total Gave: ${window.formatCurrency(gave)}`,40,y); pdf.text(`Total Received: ${window.formatCurrency(received)}`,300,y); y += 22; pdf.setFontSize(12); pdf.text(`Current Due: ${window.formatCurrency(c.balance || 0)}`,40,y);
    pdf.save(`Statement-${String(c.name).replace(/[^a-z0-9]+/gi,'-')}.pdf`);
}

export function sendPaymentReminder(customerId) {
    const c = window.data.customers.find(x => x.id === customerId); if (!c) return alert('Customer not found.');
    const text = `Hi ${c.name}, this is a friendly reminder from ${window.data.settings?.name || 'My Business'} that your outstanding balance is ${window.formatCurrency(c.balance || 0)}. Thank you.`;
    const phone = String(c.phone || '').replace(/[^0-9]/g,''); const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (navigator.share) navigator.share({title:'Payment Reminder', text}).catch(()=>window.open(url,'_blank')); else window.open(url,'_blank');
}

export function openGiveModal(customerId) {
    const c = window.data.customers.find(x => x.id === customerId); if (!c) return;
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>Gave to ${esc(c.name)}</h2><button class="close-btn" onclick="openCustomerDetails('${esc(c.id)}')">&times;</button></div>
        <div class="action-explainer give-explainer"><strong>Increase customer's due</strong><span>This amount will be added to their outstanding balance.</span></div>
        <div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="give-amount" min="0.01" step="0.01" inputmode="decimal" placeholder="0"></div>
        <div class="form-group"><label>Note (Optional)</label><input type="text" id="give-note" maxlength="120" placeholder="e.g. Cash given"></div>
        <button class="btn ledger-confirm give-confirm" id="btn-give" onclick="processGive('${esc(c.id)}')">Confirm Gave</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden'); setTimeout(()=>document.getElementById('give-amount')?.focus(),50);
}

export async function processGive(customerId) {
    const amount = Number.parseFloat(document.getElementById('give-amount')?.value); const note = document.getElementById('give-note')?.value.trim();
    if (!Number.isFinite(amount) || amount <= 0) return alert('Enter a valid amount greater than zero.');
    if (!window.currentUserId) return alert('Please log in again.');
    window.showLoading('btn-give','Saving...');
    try {
        await window.runTransaction(window.db, async transaction => {
            const customerRef = window.doc(window.db,'customers',customerId); const snap = await transaction.get(customerRef);
            if (!snap.exists()) throw new Error('Customer not found.'); if (snap.data().ownerId !== window.currentUserId) throw new Error('Unauthorized.');
            const current = Math.max(0, Number(snap.data().balance)||0); const newBalance = current + amount;
            transaction.update(customerRef,{balance:newBalance}); const txnRef=window.doc(window.collection(window.db,'customerTransactions'));
            transaction.set(txnRef,{ownerId:window.currentUserId,customerId,type:'manual_debt',amount,balanceAfter:newBalance,date:new Date().toISOString(),note:note||'Debt increased'});
        });
        openCustomerDetails(customerId);
    } catch(error){ console.error(error); alert(error.message||'Failed to update debt.'); }
    finally{ window.hideLoading('btn-give'); }
}

export function openReceiveModal(customerId) {
    const c = window.data.customers.find(x => x.id === customerId); if (!c) return;
    const balance = Math.max(0, Number(c.balance)||0); const modal=document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>Received from ${esc(c.name)}</h2><button class="close-btn" onclick="openCustomerDetails('${esc(c.id)}')">&times;</button></div>
        <div class="action-explainer receive-explainer"><strong>Reduce customer's due</strong><span>Current outstanding balance: ${window.formatCurrency(balance)}</span></div>
        <div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="receive-amount" min="0.01" max="${balance}" step="0.01" inputmode="decimal" placeholder="0"></div>
        <div class="form-group"><label>Note (Optional)</label><input type="text" id="receive-note" maxlength="120" placeholder="e.g. Cash received"></div>
        <button class="btn ledger-confirm receive-confirm" id="btn-receive" onclick="processReceive('${esc(c.id)}')">Confirm Received</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden'); setTimeout(()=>document.getElementById('receive-amount')?.focus(),50);
}

export async function processReceive(customerId) {
    const amount=Number.parseFloat(document.getElementById('receive-amount')?.value); const note=document.getElementById('receive-note')?.value.trim();
    if (!Number.isFinite(amount)||amount<=0) return alert('Enter a valid amount greater than zero.'); if(!window.currentUserId)return alert('Please log in again.');
    window.showLoading('btn-receive','Saving...');
    try { await window.runTransaction(window.db,async transaction=>{
        const customerRef=window.doc(window.db,'customers',customerId); const snap=await transaction.get(customerRef); if(!snap.exists())throw new Error('Customer not found.'); if(snap.data().ownerId!==window.currentUserId)throw new Error('Unauthorized.');
        const current=Math.max(0,Number(snap.data().balance)||0); if(amount>current)throw new Error(`Received amount cannot exceed current due of ${window.formatCurrency(current)}.`);
        const newBalance=current-amount; transaction.update(customerRef,{balance:newBalance}); const txnRef=window.doc(window.collection(window.db,'customerTransactions'));
        transaction.set(txnRef,{ownerId:window.currentUserId,customerId,type:'payment',amount,balanceAfter:newBalance,date:new Date().toISOString(),note:note||'Payment received'});
    }); openCustomerDetails(customerId);
    } catch(error){console.error(error);alert(error.message||'Failed to record payment.');} finally{window.hideLoading('btn-receive');}
}

window.openCustomerModal=openCustomerModal; window.saveCustomer=saveCustomer; window.openCustomerDetails=openCustomerDetails; window.renderCustomerLedgerTable=renderCustomerLedgerTable; window.downloadCustomerStatementPdf=downloadCustomerStatementPdf; window.sendPaymentReminder=sendPaymentReminder; window.openGiveModal=openGiveModal; window.processGive=processGive; window.openReceiveModal=openReceiveModal; window.processReceive=processReceive;
