function esc(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function customerTransactionsFor(customerId) {
    return (window.data.customerTransactions || [])
        .filter(t => t.customerId === customerId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}
function debitFor(t){
    if(t.debitAmount!==undefined) return Math.max(0,Number(t.debitAmount)||0);
    return ['sale_debt','manual_debt'].includes(t.type) ? Math.max(0,Number(t.amount)||0) : 0;
}
function creditFor(t){
    if(t.creditAmount!==undefined) return Math.max(0,Number(t.creditAmount)||0);
    return isReceived(t) ? Math.max(0,Number(t.amount)||0) : 0;
}
function isReceived(t){ return t.type === 'payment' || t.type === 'return_credit' || Number(t.creditAmount||0)>0; }
function money(v){ return window.formatCurrency(Number(v)||0); }
function billNumberFor(t){
    if (t.billNo) return t.billNo;
    const sale = t.saleId && (window.data.sales||[]).find(s=>s.id===t.saleId);
    return sale?.invoiceNumber || (t.saleId ? t.saleId.slice(-6).toUpperCase() : '');
}
function ledgerRows(customerId){
    const rows=[...customerTransactionsFor(customerId)].sort((a,b)=>new Date(a.date)-new Date(b.date));
    let running=0;
    return rows.map((t,i)=>{ running=Math.max(0,running+debitFor(t)-creditFor(t)); return {t,balance:running,index:i+1}; });
}

export function renderCustomers(container) {
    const customers = window.data.customers || [];
    const totalDebt = customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance) || 0), 0);
    container.innerHTML = `
        <div class="customer-summary-card"><div><span class="summary-label">Customers</span><strong>${customers.length}</strong></div><div class="summary-divider"></div><div><span class="summary-label">Total receivable</span><strong class="text-danger">${money(totalDebt)}</strong></div></div>
        <button class="btn customer-add-btn" onclick="openCustomerModal()"><i class="fas fa-user-plus"></i><span>Add Customer</span></button>
        <div class="customer-list-card" id="customer-list">${customers.length===0?`<div class="empty-state"><div class="empty-icon"><i class="fas fa-users"></i></div><h3>No customers yet</h3><p>Add your first customer to start tracking credit.</p></div>`:customers.map(c=>{const b=Math.max(0,Number(c.balance)||0);return `<button class="customer-row" onclick="openCustomerDetails('${esc(c.id)}')"><span class="customer-avatar">${esc((c.name||'?').trim().charAt(0).toUpperCase())}</span><span class="customer-row-main"><strong>${esc(c.name)}</strong><small>${esc(c.phone||'No phone number')}</small></span><span class="customer-row-balance"><small>Due</small><strong class="${b>0?'text-danger':'text-success'}">${money(b)}</strong></span><i class="fas fa-chevron-right"></i></button>`}).join('')}</div>`;
}

export function openCustomerModal(customerId = null) {
    const c = customerId ? window.data.customers.find(x => x.id === customerId) : null;
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>${c ? 'Edit Customer' : 'Add Customer'}</h2><button class="close-btn" onclick="closeModal()" aria-label="Close">&times;</button></div>
        <div class="form-group"><label>Customer Name *</label><input type="text" id="c-name" value="${esc(c?.name || '')}" autocomplete="name"></div>
        <div class="form-group"><label>Phone / Contact</label><input type="tel" id="c-phone" value="${esc(c?.phone || '')}" autocomplete="tel"></div>
        <div class="form-group"><label>Address</label><textarea id="c-address" rows="2" autocomplete="street-address" placeholder="Customer address">${esc(c?.address || '')}</textarea></div>
        <div class="form-group"><label>Due / Reminder Date</label><input type="date" id="c-due-date" value="${esc(c?.dueDate || '')}"></div>
        <div class="form-group"><label>Notes</label><textarea id="c-notes" rows="2">${esc(c?.notes || '')}</textarea></div>
        <button class="btn" id="btn-save-customer" onclick="saveCustomer('${esc(customerId || '')}')">${c ? 'Update Customer' : 'Save Customer'}</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export async function saveCustomer(customerId) {
    const name=document.getElementById('c-name').value.trim(), phone=document.getElementById('c-phone').value.trim(), address=document.getElementById('c-address')?.value.trim()||'', notes=document.getElementById('c-notes').value.trim(), dueDate=document.getElementById('c-due-date').value||null;
    if(!name) return alert('Customer name is required.'); if(!window.currentUserId) return alert('Please log in again.');
    window.showLoading('btn-save-customer','Saving...');
    try{const cData={name,phone,address,notes,dueDate,ownerId:window.currentUserId};if(customerId) await window.updateDoc(window.doc(window.db,'customers',customerId),cData);else{cData.balance=0;cData.createdAt=new Date().toISOString();await window.addDoc(window.collection(window.db,'customers'),cData);}closeModal();window.navigate('customers');}catch(e){console.error(e);alert(e.message||'Failed to save customer.');}finally{window.hideLoading('btn-save-customer');}
}

export function openCustomerDetails(customerId){
    const c=(window.data.customers||[]).find(x=>x.id===customerId); if(!c)return alert('Customer not found.');
    const balance=Math.max(0,Number(c.balance)||0), phone=String(c.phone||'').trim();
    const modal=document.getElementById('modal-body');
    modal.className='modal-content customer-detail-modal';
    modal.innerHTML=`<div class="khata-customer-page">
      <div class="khata-topbar"><button class="khata-back" onclick="closeModal()"><i class="fas fa-chevron-left"></i></button><div class="khata-title"><h2>${esc(c.name)} <span>Customer</span></h2><button class="khata-settings" onclick="openCustomerModal('${esc(c.id)}')">${phone?esc(phone):'Click here to view settings'}</button></div><a class="khata-call ${phone?'':'disabled'}" href="${phone?'tel:'+esc(phone):'#'}"><i class="fas fa-phone"></i></a></div>
      ${c.address?`<div class="khata-customer-address"><i class="fas fa-map-marker-alt"></i><span>${esc(c.address)}</span></div>`:""}
      <div class="khata-balance-card"><strong class="${balance>0?'due':'settled'}">${money(balance)}</strong><span>${balance>0?'You will get':'Settled'}</span>${c.dueDate?`<small>Due date: ${new Date(c.dueDate+'T00:00:00').toLocaleDateString()}</small>`:''}</div>
      <div class="khata-quick-actions">
        <button onclick="openCustomerReportOptions('${esc(c.id)}')"><i class="far fa-file-alt"></i><span>Report</span></button>
        <button onclick="openCustomerSetDate('${esc(c.id)}')"><i class="far fa-calendar-plus"></i><span>Set Date</span></button>
        <button onclick="sendPaymentReminder('${esc(c.id)}')"><i class="fab fa-whatsapp"></i><span>Reminder</span></button>
        <button onclick="sendCustomerSms('${esc(c.id)}')"><i class="far fa-comment-alt"></i><span>SMS</span></button>
      </div>
      <div class="khata-search"><i class="fas fa-search"></i><input id="customer-ledger-search" type="search" placeholder="Search" oninput="filterCustomerLedger('${esc(c.id)}')"></div>
      <div class="khata-ledger-head"><strong>Entries</strong><strong>You Gave</strong><strong>You Got</strong></div>
      <div id="cust-ledger-container" class="khata-ledger"></div>
      <button class="btn btn-danger customer-delete-btn" onclick="deleteCustomer('${esc(c.id)}')"><i class="fas fa-trash"></i> Delete Customer</button><div class="khata-bottom-actions"><button class="gave" onclick="openGiveModal('${esc(c.id)}')">YOU GAVE <small>Rs</small></button><button class="got" onclick="openReceiveModal('${esc(c.id)}')">YOU GOT <small>Rs</small></button></div>
    </div>`;
    modal.dataset.customerId=customerId; document.getElementById('modal-overlay').classList.remove('hidden'); renderCustomerLedgerTable(customerId);
    // Load ALL historical entries for this exact customer, including older records
    // created before ownerId was added. This keeps old Khata history editable/deletable.
    if (window.currentRole === 'admin' && window.getDocs && window.query && window.where) {
        window.getDocs(window.query(window.collection(window.db,'customerTransactions'), window.where('customerId','==',customerId)))
          .then(snap => {
              const existing=new Set((window.data.customerTransactions||[]).map(t=>t.id));
              snap.forEach(d=>{ if(!existing.has(d.id)) window.data.customerTransactions.push({id:d.id,...d.data()}); });
              renderCustomerLedgerTable(customerId);
          }).catch(err=>console.warn('Could not load historical customer entries:',err));
    }
}


export function renderCustomerLedgerTable(customerId){
    const container=document.getElementById('cust-ledger-container'); if(!container)return;
    const query=(document.getElementById('customer-ledger-search')?.value||'').trim().toLowerCase();
    const rows=ledgerRows(customerId).filter(({t})=>`${t.note||''} ${billNumberFor(t)}`.toLowerCase().includes(query));
    if(!rows.length){container.innerHTML='<div class="ledger-empty"><strong>No transactions found</strong></div>';return;}
    container.innerHTML=rows.slice().reverse().map(({t,balance})=>{
        const d=new Date(t.date), debit=debitFor(t), credit=creditFor(t), bill=billNumberFor(t);
        const details=[bill?`Bill No. ${esc(bill)}`:'',t.note&&!String(t.note).includes(bill||'§')?esc(t.note):''].filter(Boolean).join('<br>');
        const attachment=t.attachment?.url?`<a class="khata-attachment" href="${esc(t.attachment.url)}" target="_blank" rel="noopener"><i class="fas fa-paperclip"></i> ${esc(t.attachment.name||'View attachment')}</a>`:'';
        return `<button type="button" class="khata-entry" onclick="${t.saleId ? `openInvoiceModal('${esc(t.saleId)}')` : `openCustomerEntryActions('${esc(customerId)}','${esc(t.id)}')`}">
          <div class="khata-entry-main"><strong>${d.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'2-digit'})} • ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</strong>${details?`<div class="khata-entry-detail">${details}</div>`:''}${attachment}<span class="khata-running-balance">Bal. ${money(balance)}</span></div>
          <div class="khata-entry-money gave-money">${debit?money(debit):''}</div>
          <div class="khata-entry-money received-money">${credit?money(credit):''}</div>
        </button>`;
    }).join('');
}

export function filterCustomerLedger(customerId){ renderCustomerLedgerTable(customerId); }


async function recomputeCustomerLedger(customerId){
    // Query by customer so legacy Khata entries that predate ownerId are also included.
    // Firestore rules authorize this query for the Admin through the customer record.
    const q=window.query(window.collection(window.db,'customerTransactions'),window.where('customerId','==',customerId));
    const snap=await window.getDocs(q);
    const txns=snap.docs.filter(d=>d.data()?.customerId===customerId && (!d.data()?.ownerId || d.data()?.ownerId===window.currentUserId)).sort((a,b)=>new Date(a.data().date)-new Date(b.data().date));
    let balance=0; const updates=[];
    txns.forEach(d=>{const t=d.data(); balance=Math.max(0,balance+debitFor(t)-creditFor(t)); updates.push({ref:d.ref,balance});});
    for(let i=0;i<updates.length;i+=450){const batch=window.writeBatch(window.db);updates.slice(i,i+450).forEach(x=>batch.update(x.ref,{balanceAfter:x.balance}));await batch.commit();}
    await window.updateDoc(window.doc(window.db,'customers',customerId),{balance,updatedAt:new Date().toISOString()});
}
export function openCustomerEntryActions(customerId,transactionId){
    if(window.currentRole!=='admin') return window.showToast?.('Only the Admin can edit or delete a Khata entry.','warning');
    const t=(window.data.customerTransactions||[]).find(x=>x.id===transactionId); if(!t)return;
    const m=document.getElementById('modal-body');
    const debit=debitFor(t),credit=creditFor(t);
    m.className='modal-content';
    m.innerHTML=`<div class="modal-header"><h2>Khata Entry</h2><button class="close-btn" onclick="openCustomerDetails('${esc(customerId)}')">&times;</button></div>
      <p class="form-help">Edit the amounts or remove this entry. The customer's running balance will be recalculated.</p>
      <div class="form-row"><div class="form-group"><label>You Gave (Rs.)</label><input type="number" id="edit-entry-debit" min="0" step="0.01" value="${debit}"></div><div class="form-group"><label>Amount Paid (Rs.)</label><input type="number" id="edit-entry-credit" min="0" step="0.01" value="${credit}"></div></div>
      <div class="form-group"><label>Note</label><input type="text" id="edit-entry-note" maxlength="120" value="${esc(t.note||'')}"></div>
      <div class="form-row"><button class="btn" onclick="editCustomerEntry('${esc(customerId)}','${esc(transactionId)}')">Save Changes</button><button class="btn btn-danger" onclick="deleteCustomerEntry('${esc(customerId)}','${esc(transactionId)}')">Delete Entry</button></div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}
export async function editCustomerEntry(customerId,transactionId){
    const debit=Math.max(0,Number(document.getElementById('edit-entry-debit')?.value)||0),credit=Math.max(0,Number(document.getElementById('edit-entry-credit')?.value)||0),note=document.getElementById('edit-entry-note')?.value.trim()||'';
    if(debit===0&&credit===0)return alert('Enter an amount.');
    try{await window.updateDoc(window.doc(window.db,'customerTransactions',transactionId),{debitAmount:debit,creditAmount:credit,amount:debit||credit,note,updatedAt:new Date().toISOString()});await recomputeCustomerLedger(customerId);window.showToast?.('Entry updated','success');openCustomerDetails(customerId);}catch(e){console.error(e);alert(e.message||'Failed to update entry.');}
}
export async function deleteCustomerEntry(customerId,transactionId){
    if(!confirm('Delete this Khata entry? The customer balance will be recalculated.'))return;
    try{await window.deleteDoc(window.doc(window.db,'customerTransactions',transactionId));await recomputeCustomerLedger(customerId);window.showToast?.('Entry deleted','success');openCustomerDetails(customerId);}catch(e){console.error(e);alert(e.message||'Failed to delete entry.');}
}

export async function deleteCustomer(customerId){
    const c=(window.data.customers||[]).find(x=>x.id===customerId);
    if(!c) return;
    if(!confirm(`Delete customer "${c.name}" permanently? Their customer ledger entries will also be deleted. Sales records will remain.`)) return;
    if(!window.currentUserId) return alert('Please log in again.');
    try{
        // Query by customerId instead of ownerId so older entries without ownerId
        // can also be removed by the Admin. Firestore rules enforce ownership.
        const q=window.query(window.collection(window.db,'customerTransactions'), window.where('customerId','==',customerId));
        const snap=await window.getDocs(q);
        const owned=snap.docs.filter(d=>!d.data()?.ownerId || d.data()?.ownerId===window.currentUserId);
        for(let i=0;i<owned.length;i+=450){
            const batch=window.writeBatch(window.db);
            owned.slice(i,i+450).forEach(d=>batch.delete(d.ref));
            await batch.commit();
        }
        await window.deleteDoc(window.doc(window.db,'customers',customerId));
        window.showToast?.('Customer deleted','success');
        window.closeModal?.();
        window.navigate('customers');
    }catch(e){console.error(e);alert(e.message||'Failed to delete customer.');}
}

export function openCustomerSetDate(customerId){const c=(window.data.customers||[]).find(x=>x.id===customerId);if(!c)return;const m=document.getElementById('modal-body');m.className='modal-content';m.innerHTML=`<div class="modal-header"><h2>Set Date</h2><button class="close-btn" onclick="openCustomerDetails('${esc(customerId)}')">&times;</button></div><div class="form-group"><label>Payment / Due Date</label><input type="date" id="customer-due-date" value="${esc(c.dueDate||'')}"></div><button class="btn" onclick="saveCustomerDueDate('${esc(customerId)}')">Save Date</button>`;}
export async function saveCustomerDueDate(customerId){const dueDate=document.getElementById('customer-due-date')?.value||null;try{await window.updateDoc(window.doc(window.db,'customers',customerId),{dueDate,updatedAt:new Date().toISOString()});window.showToast?.('Date updated','success');openCustomerDetails(customerId);}catch(e){alert(e.message||'Unable to update date.');}}
export function sendCustomerSms(customerId){const c=(window.data.customers||[]).find(x=>x.id===customerId);if(!c)return;const text=`Hello ${c.name}, this is a reminder from ${window.data.settings?.name||'MyBusiness'} regarding your outstanding balance of ${money(c.balance)}.`;const phone=String(c.phone||'').replace(/[^0-9+]/g,'');if(!phone)return alert('Add a phone number for this customer first.');window.location.href=`sms:${phone}?body=${encodeURIComponent(text)}`;}

function statementDateRange(customerId){const txns=ledgerRows(customerId);const dates=txns.map(x=>new Date(x.t.date)).filter(d=>!isNaN(d));return {from:dates[0]||new Date(),to:dates[dates.length-1]||new Date()};}
function buildStatementPdf(customerId, fromValue=null, toValue=null){
 const c=(window.data.customers||[]).find(x=>x.id===customerId); if(!c||!window.jspdf)return null; const {jsPDF}=window.jspdf;const pdf=new jsPDF({unit:'pt',format:'a4'});let txns=ledgerRows(customerId); if(fromValue||toValue){const from=fromValue?new Date(fromValue+'T00:00:00'):new Date(0);const to=toValue?new Date(toValue+'T23:59:59'):new Date();txns=txns.filter(({t})=>{const d=new Date(t.date);return d>=from&&d<=to;});} let gave=0,got=0;txns.forEach(({t})=>isReceived(t)?got+=Number(t.amount)||0:gave+=Number(t.amount)||0);const business=window.data.settings?.name||'MyBusiness', range={from:fromValue?new Date(fromValue+'T00:00:00'):statementDateRange(customerId).from,to:toValue?new Date(toValue+'T23:59:59'):statementDateRange(customerId).to};let y=42;const W=555;
 pdf.setFillColor(178,48,23);pdf.rect(0,0,595,36,'F');pdf.setTextColor(255);pdf.setFontSize(16);pdf.text(business,28,24);pdf.setTextColor(30);pdf.setFontSize(20);pdf.text(`${c.name} Statement`,W/2,y+35,{align:'center'});y+=58;pdf.setFontSize(11);pdf.setTextColor(70);pdf.text(`Phone Number: ${c.phone||'Not added'}`,W/2,y,{align:'center'});y+=18;if(c.address){pdf.text(`Address: ${String(c.address).slice(0,90)}`,W/2,y,{align:'center'});y+=18;}pdf.text(`(${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()})`,W/2,y,{align:'center'});y+=25;
 const boxY=y;pdf.setDrawColor(120);pdf.rect(24,boxY,547,88);const cols=[24,134,244,354,464,571];cols.slice(1,-1).forEach(x=>pdf.line(x,boxY,x,boxY+88));const stats=[['Opening Balance','Rs 0'],['Total Debit (-)',money(gave)],['Total Credit (+)',money(got)],['Net Balance',money(c.balance||0)],['Running Balance',money(c.balance||0)]];stats.forEach((s,i)=>{const x=cols[i]+12;pdf.setFontSize(9);pdf.setTextColor(80);pdf.text(s[0],x,boxY+24);pdf.setFontSize(11);pdf.setTextColor(i===2?30:120,i===2?110:35,i===2?55:35);pdf.text(s[1],x,boxY+48);});y=boxY+112;pdf.setTextColor(25);pdf.setFontSize(14);pdf.text(`No. of Entries: ${txns.length} (All)`,24,y);y+=18;
 const headers=['#','Date','Details','Debit (-)','Credit (+)','Balance'];const xs=[28,62,150,330,420,505];pdf.setFillColor(245);pdf.rect(24,y,547,28,'F');pdf.setFontSize(9);pdf.setTextColor(25);headers.forEach((h,i)=>pdf.text(h,xs[i],y+18));y+=38;let idx=1;txns.forEach(({t,balance})=>{if(y>750){pdf.addPage();y=50;}const rec=isReceived(t);const d=new Date(t.date);pdf.setFontSize(8.5);pdf.setTextColor(35);pdf.text(String(idx++),xs[0],y);pdf.text(d.toLocaleDateString('en-GB'),xs[1],y);const det=`${billNumberFor(t)?'Bill No. '+billNumberFor(t):t.note||t.type||'Entry'}`;pdf.text(det.slice(0,28),xs[2],y);if(!rec)pdf.text(money(t.amount),xs[3],y);if(rec)pdf.text(money(t.amount),xs[4],y);pdf.text(money(balance??0),xs[5],y);y+=22;});pdf.line(24,y,571,y);y+=20;pdf.setFontSize(11);pdf.text('Grand Total',32,y);pdf.text(money(gave),xs[3],y);pdf.text(money(got),xs[4],y);pdf.text(money(c.balance||0),xs[5],y);y+=28;pdf.setFontSize(8);pdf.text(`Report Generated: ${new Date().toLocaleString()}`,24,y);return {pdf,c};
}
export function downloadCustomerStatementPdf(customerId, fromValue=null, toValue=null){const built=buildStatementPdf(customerId,fromValue,toValue);if(!built)return alert('PDF library is unavailable.');built.pdf.save(`Statement-${String(built.c.name).replace(/[^a-z0-9]+/gi,'-')}.pdf`);}
export function openCustomerReportOptions(customerId){const r=statementDateRange(customerId);const from=r.from.toISOString().slice(0,10),to=r.to.toISOString().slice(0,10);const m=document.getElementById('modal-body');m.className='modal-content';m.innerHTML=`<div class="modal-header"><h2>Customer Report</h2><button class="close-btn" onclick="openCustomerDetails('${esc(customerId)}')">&times;</button></div><p class="form-help">Choose the statement period and how you want to share it.</p><div class="form-row"><div class="form-group"><label>From</label><input type="date" id="customer-report-from" value="${from}"></div><div class="form-group"><label>To</label><input type="date" id="customer-report-to" value="${to}"></div></div><button class="btn" onclick="downloadCustomerStatementPdf('${esc(customerId)}',document.getElementById('customer-report-from').value,document.getElementById('customer-report-to').value)"><i class="fas fa-download"></i> Download PDF</button><button class="btn btn-secondary" style="margin-top:10px" onclick="sendCustomerReport('${esc(customerId)}',document.getElementById('customer-report-from').value,document.getElementById('customer-report-to').value,'chooser')"><i class="fas fa-share-alt"></i> Share</button>`;}
export async function sendCustomerReport(customerId, fromValue=null, toValue=null, target='chooser'){const built=buildStatementPdf(customerId,fromValue,toValue);if(!built)return alert('PDF library is unavailable.');const phone=String(built.c.phone||'').replace(/[^0-9]/g,'');if(!phone)return alert('Add a phone number for this customer first.');const text=`${window.data.settings?.name||'MyBusiness'} statement for ${built.c.name}`;const filename=`Statement-${String(built.c.name).replace(/[^a-z0-9]+/gi,'-')}.pdf`;try{const blob=built.pdf.output('blob');const file=new File([blob],filename,{type:'application/pdf'});if(target==='chooser'&&navigator.canShare?.({files:[file]})){await navigator.share({title:'Customer Statement',text,files:[file]});return;}}catch(e){if(e?.name==='AbortError')return;}built.pdf.save(filename);const scheme=target==='business'?'intent://send?phone='+phone+'&text='+encodeURIComponent(text)+'#Intent;scheme=whatsapp;package=com.whatsapp.w4b;end':'https://wa.me/'+phone+'?text='+encodeURIComponent(text);try{window.location.href=scheme;}catch(e){window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(text),'_blank');}alert('The PDF was downloaded. Attach the downloaded PDF in WhatsApp after the chat opens.');}
export function sendPaymentReminder(customerId){const c=(window.data.customers||[]).find(x=>x.id===customerId);if(!c)return;const text=`Hello ${c.name}, this is a reminder from ${window.data.settings?.name||'MyBusiness'} that your outstanding balance is ${money(c.balance)}. Thank you.`;const phone=String(c.phone||'').replace(/[^0-9]/g,'');if(!phone)return alert('Add a phone number for this customer first.');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank');}

function attachmentFields(kind){
    const prefix=kind==='give'?'give':'receive';
    return `<div class="form-group"><label>Bill Number (Optional)</label><input type="text" id="${prefix}-bill-no" maxlength="60" placeholder="e.g. 331"></div>
        <div class="form-group attachment-group"><label>Attachment (Optional)</label>
            <input type="file" id="${prefix}-attachment-camera" accept="image/*" capture="environment" class="attachment-input" onchange="customerAttachmentSelected('${prefix}',this)">
            <input type="file" id="${prefix}-attachment-gallery" accept="image/*" class="attachment-input" onchange="customerAttachmentSelected('${prefix}',this)">
            <input type="file" id="${prefix}-attachment-pdf" accept="application/pdf,.pdf" class="attachment-input" onchange="customerAttachmentSelected('${prefix}',this)">
            <div class="attachment-actions">
              <button type="button" class="attachment-choice" onclick="document.getElementById('${prefix}-attachment-camera').click()"><i class="fas fa-camera"></i><span>Camera</span></button>
              <button type="button" class="attachment-choice" onclick="document.getElementById('${prefix}-attachment-gallery').click()"><i class="fas fa-images"></i><span>Gallery</span></button>
              <button type="button" class="attachment-choice" onclick="document.getElementById('${prefix}-attachment-pdf').click()"><i class="fas fa-file-pdf"></i><span>PDF</span></button>
            </div>
            <div id="${prefix}-attachment-name" class="attachment-name" aria-live="polite">No attachment selected</div>
        </div>`;
}

export function customerAttachmentSelected(prefix,input){
    const file=input?.files?.[0]||null;
    ['camera','gallery','pdf'].forEach(kind=>{const el=document.getElementById(`${prefix}-attachment-${kind}`);if(el&&el!==input)el.value='';});
    const name=document.getElementById(`${prefix}-attachment-name`);
    if(name)name.textContent=file?`${file.name} (${Math.max(1,Math.round(file.size/1024))} KB)`:'No attachment selected';
}

function selectedAttachment(prefix){
    for(const kind of ['camera','gallery','pdf']){const file=document.getElementById(`${prefix}-attachment-${kind}`)?.files?.[0];if(file)return file;}
    return null;
}

async function uploadCustomerAttachment(customerId, transactionId, file){
    if(!file)return null;
    if(!navigator.onLine)throw new Error('Attachments need an internet connection to upload. You can save the amount without an attachment while offline.');
    const allowed=file.type?.startsWith('image/')||file.type==='application/pdf'||/\.pdf$/i.test(file.name||'');
    if(!allowed)throw new Error('Only camera/gallery images or PDF files are allowed.');
    const max=15*1024*1024;
    if(file.size>max)throw new Error('Attachment must be 15 MB or smaller.');
    const safeName=String(file.name||'attachment').replace(/[^a-z0-9._-]+/gi,'-').slice(-100);
    const path=`customerAttachments/${window.currentUserId}/${customerId}/${transactionId}/${Date.now()}-${safeName}`;
    const ref=window.storageRef(window.storage,path);
    const result=await window.uploadBytes(ref,file,{contentType:file.type||undefined,customMetadata:{ownerId:String(window.currentUserId),customerId:String(customerId),uploadedBy:String(window.authUserId||window.currentUserId)}});
    const url=await window.getDownloadURL(result.ref);
    return {name:file.name,type:file.type||'application/octet-stream',size:file.size,path,url};
}

function transactionPayload({customerId,type,amount,balanceAfter,note,billNo,attachment,offlineCreated=false}){
    return {ownerId:window.currentUserId,customerId,type,amount,balanceAfter,date:new Date().toISOString(),note:note||'',billNo:billNo||null,attachment:attachment||null,createdBy:window.authUserId||window.currentUserId,...(offlineCreated?{offlineCreated:true}:{})};
}

export function openGiveModal(customerId) {
    const c = window.data.customers.find(x => x.id === customerId); if (!c) return;
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>Gave to ${esc(c.name)}</h2><button class="close-btn" onclick="openCustomerDetails('${esc(c.id)}')">&times;</button></div>
        <div class="action-explainer give-explainer"><strong>Increase customer's due</strong><span>This amount will be added to their outstanding balance.</span></div>
        <div class="form-row"><div class="form-group"><label>You Gave (Rs.) *</label><input type="number" id="give-amount" min="0.01" step="0.01" inputmode="decimal" placeholder="0"></div><div class="form-group"><label>Amount Paid (Rs.)</label><input type="number" id="give-paid" min="0" step="0.01" inputmode="decimal" placeholder="0"></div></div>
        <div class="form-group"><label>Note (Optional)</label><input type="text" id="give-note" maxlength="120" placeholder="e.g. Cash given"></div>
        ${attachmentFields('give')}
        <button class="btn ledger-confirm give-confirm" id="btn-give" onclick="processGive('${esc(c.id)}')">Confirm Gave</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden'); setTimeout(()=>document.getElementById('give-amount')?.focus(),50);
}

export async function processGive(customerId) {
    const amount=Number.parseFloat(document.getElementById('give-amount')?.value), paidRaw=document.getElementById('give-paid')?.value??'', paid=paidRaw===''?0:Number.parseFloat(paidRaw);
    const note=document.getElementById('give-note')?.value.trim(), billNo=document.getElementById('give-bill-no')?.value.trim()||null, file=selectedAttachment('give');
    if(!Number.isFinite(amount)||amount<=0)return alert('Enter a valid amount greater than zero.');
    if(!Number.isFinite(paid)||paid<0||paid>amount)return alert(`Amount paid must be between Rs. 0 and ${window.formatCurrency(amount)}.`);
    if(!window.currentUserId)return alert('Please log in again.');
    window.showLoading('btn-give',file?'Uploading...':'Saving...');
    try{const customerRef=window.doc(window.db,'customers',customerId),txnRef=window.doc(window.collection(window.db,'customerTransactions'));const attachment=await uploadCustomerAttachment(customerId,txnRef.id,file);await window.runAtomicOrOffline(async transaction=>{const snap=await transaction.get(customerRef);if(!snap.exists())throw new Error('Customer not found.');const current=Math.max(0,Number(snap.data().balance)||0),newBalance=Math.max(0,current+amount-paid);transaction.update(customerRef,{balance:newBalance,updatedAt:new Date().toISOString()});transaction.set(txnRef,{ownerId:window.currentUserId,customerId,type:'manual_debt',amount,amountPaid:paid,debitAmount:amount,creditAmount:paid,balanceAfter:newBalance,date:new Date().toISOString(),note:note||'Gave',billNo,attachment:attachment||null,createdBy:window.authUserId||window.currentUserId});});window.showToast?.('Khata entry saved','success');window.closeModal();openCustomerDetails(customerId);}catch(e){console.error(e);alert(e.message||'Failed to update debt.');}finally{window.hideLoading('btn-give');}
}

export function openReceiveModal(customerId) {
    const c = window.data.customers.find(x => x.id === customerId); if (!c) return;
    const balance = Math.max(0, Number(c.balance)||0); const modal=document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>Received from ${esc(c.name)}</h2><button class="close-btn" onclick="openCustomerDetails('${esc(c.id)}')">&times;</button></div>
        <div class="action-explainer receive-explainer"><strong>Reduce customer's due</strong><span>Current outstanding balance: ${window.formatCurrency(balance)}</span></div>
        <div class="form-group"><label>Amount (Rs.) *</label><input type="number" id="receive-amount" min="0.01" max="${balance}" step="0.01" inputmode="decimal" placeholder="0"></div>
        <div class="form-group"><label>Note (Optional)</label><input type="text" id="receive-note" maxlength="120" placeholder="e.g. Cash received"></div>
        ${attachmentFields('receive')}
        <button class="btn ledger-confirm receive-confirm" id="btn-receive" onclick="processReceive('${esc(c.id)}')">Confirm Received</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden'); setTimeout(()=>document.getElementById('receive-amount')?.focus(),50);
}

export async function processReceive(customerId) {
    const amount=Number.parseFloat(document.getElementById('receive-amount')?.value),note=document.getElementById('receive-note')?.value.trim(),billNo=document.getElementById('receive-bill-no')?.value.trim()||null,file=selectedAttachment('receive');
    if(!Number.isFinite(amount)||amount<=0)return alert('Enter a valid amount greater than zero.'); if(!window.currentUserId)return alert('Please log in again.');
    window.showLoading('btn-receive',file?'Uploading...':'Saving...');
    try{const customerRef=window.doc(window.db,'customers',customerId),txnRef=window.doc(window.collection(window.db,'customerTransactions'));const attachment=await uploadCustomerAttachment(customerId,txnRef.id,file);await window.runAtomicOrOffline(async transaction=>{const snap=await transaction.get(customerRef);if(!snap.exists())throw new Error('Customer not found.');const current=Math.max(0,Number(snap.data().balance)||0),newBalance=Math.max(0,current-amount);transaction.update(customerRef,{balance:newBalance,updatedAt:new Date().toISOString()});transaction.set(txnRef,{ownerId:window.currentUserId,customerId,type:'payment',amount,amountPaid:amount,debitAmount:0,creditAmount:amount,balanceAfter:newBalance,date:new Date().toISOString(),note:note||'Payment received',billNo,attachment:attachment||null,createdBy:window.authUserId||window.currentUserId});});window.showToast?.('Payment recorded','success');window.closeModal();openCustomerDetails(customerId);}catch(e){console.error(e);alert(e.message||'Failed to record payment.');}finally{window.hideLoading('btn-receive');}
}

window.customerAttachmentSelected=customerAttachmentSelected; window.openCustomerModal=openCustomerModal; window.saveCustomer=saveCustomer; window.openCustomerDetails=openCustomerDetails; window.renderCustomerLedgerTable=renderCustomerLedgerTable; window.openCustomerEntryActions=openCustomerEntryActions; window.editCustomerEntry=editCustomerEntry; window.deleteCustomerEntry=deleteCustomerEntry; window.downloadCustomerStatementPdf=downloadCustomerStatementPdf; window.sendPaymentReminder=sendPaymentReminder; window.openGiveModal=openGiveModal; window.processGive=processGive; window.openReceiveModal=openReceiveModal; window.processReceive=processReceive;
