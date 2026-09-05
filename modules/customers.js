export function renderCustomers(container) {
    const data = window.data;
    const formatCurrency = window.formatCurrency;
    
    container.innerHTML = `
        <button class="btn" style="margin-bottom:20px;" onclick="openCustomerModal()">+ Add Customer</button>
        <div class="card" id="customer-list">
            ${data.customers.length === 0 ? '<p style="color:var(--gray); text-align:center; padding:10px;">No customers found.</p>' : 
              data.customers.map(c => `
                <div class="list-item" onclick="openCustomerProfileModal('${c.id}')" style="cursor:pointer;">
                    <div class="list-item-info">
                        <h4>${c.name}</h4>
                        <p>${c.phone || 'No phone'}</p>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:12px; color:var(--gray);">Balance</div>
                        <div style="font-weight:bold; color:var(--danger);">${formatCurrency(c.balance || 0)}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
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
        if (customerId) await updateDoc(doc(window.db, "customers", customerId), cData); 
        else { cData.balance = 0; await addDoc(collection(window.db, "customers"), cData); } 
        alert(customerId ? "Updated!" : "Added!"); 
        closeModal(); 
    } catch (error) { alert("Failed."); } 
    finally { window.hideLoading('btn-save-customer'); } 
}

// --- NEW PROFILE & REPORT MODAL ---
export function openCustomerProfileModal(customerId) {
    const c = window.data.customers.find(x => x.id === customerId);
    if (!c) return;
    
    const txns = window.data.customerTransactions
        .filter(t => t.customerId === customerId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const formatCurrency = window.formatCurrency;
    const modal = document.getElementById('modal-body');

    let historyHtml = '<div style="overflow-x:auto; margin-bottom: 20px;"><table class="ledger-table" style="min-width: 450px;">';
    historyHtml += '<thead><tr><th>Date</th><th>Type</th><th>Note</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Balance</th></tr></thead><tbody>';

    if (txns.length === 0) {
        historyHtml += '<tr><td colspan="5" style="text-align:center; color:var(--gray); padding: 20px;">No transactions yet</td></tr>';
    } else {
        txns.forEach(t => {
            const isPayment = t.type === 'payment';
            const typeText = isPayment ? 'Received' : 'Gave';
            const colorClass = isPayment ? 'text-success' : 'text-danger';
            const sign = isPayment ? '-' : '+';
            historyHtml += `<tr>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td class="${colorClass}" style="font-weight:bold;">${typeText}</td>
                <td>${t.note || '-'}</td>
                <td style="text-align:right;" class="${colorClass}">${sign}${formatCurrency(t.amount)}</td>
                <td style="text-align:right; font-weight:bold;">${formatCurrency(t.balanceAfter)}</td>
            </tr>`;
        });
    }
    historyHtml += '</tbody></table></div>';

    modal.innerHTML = `
        <div class="modal-header">
            <h2>${c.name}</h2>
            <button class="close-btn" onclick="closeModal()">&times;</button>
        </div>
        
        <div style="text-align:center; margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 8px;">
            <div style="font-size:14px; color:var(--gray);">Current Balance</div>
            <div style="font-size:32px; font-weight:bold; color:var(--danger);">${formatCurrency(c.balance || 0)}</div>
        </div>

        <h3 style="font-size:16px; margin-bottom:10px; color:var(--dark);">Transaction History</h3>
        ${historyHtml}

        <div style="display:flex; gap:10px; margin-top:10px;">
            <button class="btn" style="background:var(--warning); flex:1;" onclick="openGaveModal('${c.id}')">
                <i class="fas fa-arrow-up"></i> Gave
            </button>
            <button class="btn" style="background:var(--primary); flex:1;" onclick="openReceiveModal('${c.id}')">
                <i class="fas fa-arrow-down"></i> Receive
            </button>
        </div>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

// --- GAVE (INCREASE DEBT) ---
export function openGaveModal(customerId) {
    const c = window.data.customers.find(x => x.id === customerId);
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Gave to ${c.name}</h2>
            <button class="close-btn" onclick="openCustomerProfileModal('${c.id}')">&times;</button>
        </div>
        <p style="margin-bottom:15px;">Current Debt: <strong>${window.formatCurrency(c.balance || 0)}</strong></p>
        <div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="gave-amount" min="1"></div>
        <div class="form-group"><label>Note (Optional)</label><input type="text" id="gave-note" placeholder="e.g., Cash given"></div>
        <button class="btn" id="btn-gave" style="background:var(--warning);" onclick="processGave('${c.id}')">Confirm Gave</button>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export async function processGave(customerId) {
    const amount = parseFloat(document.getElementById('gave-amount').value);
    const note = document.getElementById('gave-note').value.trim();
    if (!amount || amount <= 0) return alert("Please enter a valid amount.");

    window.showLoading('btn-gave', "Processing...");
    try {
        await runTransaction(window.db, async (transaction) => {
            const cRef = doc(window.db, "customers", customerId);
            const cSnap = await transaction.get(cRef);
            const newBalance = (cSnap.data().balance || 0) + amount;
            transaction.update(cRef, { balance: newBalance });
            const txnRef = doc(collection(window.db, "customerTransactions"));
            transaction.set(txnRef, {
                ownerId: window.currentUserId, customerId, type: 'manual_debt', amount, balanceAfter: newBalance,
                date: new Date().toISOString(), note: note || 'Debt increased'
            });
        });
        alert("Debt increased successfully!");
        openCustomerProfileModal(customerId);
    } catch (error) {
        console.error(error);
        alert("Failed to update debt.");
    } finally { window.hideLoading('btn-gave'); }
}

// --- RECEIVE (DECREASE DEBT) ---
export function openReceiveModal(customerId) {
    const c = window.data.customers.find(x => x.id === customerId);
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Received from ${c.name}</h2>
            <button class="close-btn" onclick="openCustomerProfileModal('${c.id}')">&times;</button>
        </div>
        <p style="margin-bottom:15px;">Current Debt: <strong>${window.formatCurrency(c.balance || 0)}</strong></p>
        <div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="receive-amount" min="1" max="${c.balance || 0}"></div>
        <div class="form-group"><label>Note (Optional)</label><input type="text" id="receive-note" placeholder="e.g., Cash received"></div>
        <button class="btn" id="btn-receive" style="background:var(--primary);" onclick="processReceive('${c.id}')">Confirm Receive</button>
    `;
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
        await runTransaction(window.db, async (transaction) => {
            const cRef = doc(window.db, "customers", customerId);
            const cSnap = await transaction.get(cRef);
            const newBalance = Math.max(0, (cSnap.data().balance || 0) - amount);
            transaction.update(cRef, { balance: newBalance });
            const txnRef = doc(collection(window.db, "customerTransactions"));
            transaction.set(txnRef, {
                ownerId: window.currentUserId, customerId, type: 'payment', amount, balanceAfter: newBalance,
                date: new Date().toISOString(), note: note || 'Payment received'
            });
        });
        alert("Payment recorded successfully!");
        openCustomerProfileModal(customerId);
    } catch (error) {
        console.error(error);
        alert("Failed to record payment.");
    } finally { window.hideLoading('btn-receive'); }
}

// --- KEEP OLD EXPORTS TO PREVENT APP.JS IMPORT CRASH ---
export function openCustomerLedger(customerId) { openCustomerProfileModal(customerId); }
export function openAddDebtModal(customerId) { openGaveModal(customerId); }
export async function addCustomerDebt(customerId) {}
export function openRecordPaymentModal(customerId) { openReceiveModal(customerId); }
export async function recordCustomerPayment(customerId) {}

// --- EXPOSE TO WINDOW ---
window.openCustomerModal = openCustomerModal;
window.saveCustomer = saveCustomer;
window.openCustomerProfileModal = openCustomerProfileModal;
window.openGaveModal = openGaveModal;
window.processGave = processGave;
window.openReceiveModal = openReceiveModal;
window.processReceive = processReceive;
window.openCustomerLedger = openCustomerLedger;
window.openAddDebtModal = openAddDebtModal;
window.addCustomerDebt = addCustomerDebt;
window.openRecordPaymentModal = openRecordPaymentModal;
window.recordCustomerPayment = recordCustomerPayment;