// Professional invoices / Bill Book.
// Invoice numbers are assigned LAZILY the first time someone generates an
// invoice for a sale (via a Firestore transaction incrementing
// settings.nextInvoiceNumber), so old sales are untouched until the shop
// owner actually wants a bill for them, and numbers stay gap-free per
// business regardless of which sale type they came from.
// PDF generation uses jsPDF (loaded from CDN in index.html, window.jspdf).

function getBusinessName() {
    return (window.data.settings && window.data.settings.name) || 'My Business';
}

async function ensureInvoiceNumber(saleId) {
    const sale = window.data.sales.find(s => s.id === saleId);
    if (sale && sale.invoiceNumber) return sale.invoiceNumber;
    let assignedNumber = null;
    await window.runAtomicOrOffline(async (transaction) => {
        const settingsRef = window.doc(window.db, "settings", window.currentUserId);
        const saleRef = window.doc(window.db, "sales", saleId);
        const settingsSnap = await transaction.get(settingsRef);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Sale not found.");
        if (saleSnap.data().invoiceNumber) { assignedNumber = saleSnap.data().invoiceNumber; return; }
        const current = (settingsSnap.exists() && settingsSnap.data().nextInvoiceNumber) || 1001;
        assignedNumber = current;
        transaction.set(settingsRef, { nextInvoiceNumber: current + 1 }, { merge: true });
        transaction.update(saleRef, { invoiceNumber: current });
    });
    return assignedNumber;
}

function buildInvoiceLines(sale) {
    const formatCurrency = window.formatCurrency;
    if (sale.items && sale.items.length > 0 && sale.saleType !== 'bulk') {
        return sale.items.map(item => `${item.name}  x${item.qty}  @ ${formatCurrency(item.price)}  =  ${formatCurrency(item.price * item.qty)}`);
    }
    return [`${sale.note || (sale.saleType === 'bulk' ? 'Bulk / Quick Sale' : 'Sale')}  =  ${formatCurrency(sale.total)}`];
}

export async function openInvoiceModal(saleId) {
    const invoiceNumber = await ensureInvoiceNumber(saleId).catch(err => { alert(err.message || "Failed to generate invoice number."); return null; });
    if (!invoiceNumber) return;
    const sale = window.data.sales.find(s => s.id === saleId);
    const formatCurrency = window.formatCurrency;
    const modal = document.getElementById('modal-body');
    const lines = buildInvoiceLines(sale);
    modal.innerHTML = `
        <div class="modal-header"><h2>Invoice #${invoiceNumber}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
        <div id="invoice-preview" style="border:1px solid #eee; border-radius:8px; padding:15px; margin-bottom:15px; font-size:14px;">
            <div style="text-align:center; margin-bottom:10px;"><strong style="font-size:18px;">${getBusinessName()}</strong><br><span style="color:var(--gray);">Invoice #${invoiceNumber}</span></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;"><span>Date: ${new Date(sale.date).toLocaleDateString()}</span><span>Customer: ${sale.customerName || 'Walk-in'}</span></div>
            <hr>
            <div style="margin:10px 0; white-space:pre-line;">${lines.join('\n')}</div>
            <hr>
            <div style="display:flex; justify-content:space-between;"><span>Subtotal</span><span>${formatCurrency(sale.subtotal !== undefined ? sale.subtotal : sale.total)}</span></div>
            ${sale.discount ? `<div style="display:flex; justify-content:space-between; color:var(--danger);"><span>Discount</span><span>-${formatCurrency(sale.discount)}</span></div>` : ''}
            <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:16px;"><span>Total</span><span>${formatCurrency(sale.total)}</span></div>
            <div style="display:flex; justify-content:space-between;"><span>Paid</span><span>${formatCurrency(sale.amountPaid || 0)}</span></div>
            <div style="display:flex; justify-content:space-between; font-weight:bold; color:${(sale.amountDue || 0) > 0 ? 'var(--danger)' : 'var(--success)'};"><span>${(sale.amountDue || 0) > 0 ? 'Due' : 'Status'}</span><span>${(sale.amountDue || 0) > 0 ? formatCurrency(sale.amountDue) : 'PAID'}</span></div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
            <button class="btn" onclick="downloadInvoicePdf('${saleId}')"><i class="fas fa-file-pdf"></i> Download PDF</button>
            <button class="btn btn-secondary" onclick="printInvoice('${saleId}')"><i class="fas fa-print"></i> Print</button>
            <button class="btn" style="background:#25D366;" onclick="shareInvoiceWhatsApp('${saleId}')"><i class="fab fa-whatsapp"></i> Share via WhatsApp</button>
        </div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

function buildInvoiceDoc(sale, invoiceNumber) {
    if (!window.jspdf) { alert("PDF library not loaded. Check your internet connection and try again."); return null; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a5' });
    const formatCurrency = window.formatCurrency;
    let y = 40;
    doc.setFontSize(16); doc.text(getBusinessName(), 40, y); y += 20;
    doc.setFontSize(11); doc.text(`Invoice #${invoiceNumber}`, 40, y); y += 16;
    doc.text(`Date: ${new Date(sale.date).toLocaleDateString()}`, 40, y); y += 16;
    doc.text(`Customer: ${sale.customerName || 'Walk-in'}`, 40, y); y += 20;
    doc.setLineWidth(0.5); doc.line(40, y, 300, y); y += 16;
    buildInvoiceLines(sale).forEach(line => { doc.text(line, 40, y); y += 16; });
    y += 8; doc.line(40, y, 300, y); y += 18;
    doc.text(`Subtotal: ${formatCurrency(sale.subtotal !== undefined ? sale.subtotal : sale.total)}`, 40, y); y += 16;
    if (sale.discount) { doc.text(`Discount: -${formatCurrency(sale.discount)}`, 40, y); y += 16; }
    doc.setFontSize(13); doc.text(`Total: ${formatCurrency(sale.total)}`, 40, y); y += 18;
    doc.setFontSize(11); doc.text(`Paid: ${formatCurrency(sale.amountPaid || 0)}`, 40, y); y += 16;
    doc.text((sale.amountDue || 0) > 0 ? `Due: ${formatCurrency(sale.amountDue)}` : 'Status: PAID', 40, y);
    return doc;
}

export async function downloadInvoicePdf(saleId) {
    const sale = window.data.sales.find(s => s.id === saleId);
    if (!sale) return alert("Sale not found.");
    const invoiceNumber = await ensureInvoiceNumber(saleId);
    const doc = buildInvoiceDoc(sale, invoiceNumber);
    if (doc) doc.save(`Invoice-${invoiceNumber}.pdf`);
}

export async function printInvoice(saleId) {
    const sale = window.data.sales.find(s => s.id === saleId);
    if (!sale) return alert("Sale not found.");
    const invoiceNumber = await ensureInvoiceNumber(saleId);
    const doc = buildInvoiceDoc(sale, invoiceNumber);
    if (doc) doc.autoPrint(), window.open(doc.output('bloburl'), '_blank');
}

export async function shareInvoiceWhatsApp(saleId) {
    const sale = window.data.sales.find(s => s.id === saleId);
    if (!sale) return alert("Sale not found.");
    const invoiceNumber = await ensureInvoiceNumber(saleId);
    const formatCurrency = window.formatCurrency;
    const text = `Invoice #${invoiceNumber} - ${getBusinessName()}\nDate: ${new Date(sale.date).toLocaleDateString()}\nTotal: ${formatCurrency(sale.total)}\nPaid: ${formatCurrency(sale.amountPaid || 0)}\n${(sale.amountDue || 0) > 0 ? 'Due: ' + formatCurrency(sale.amountDue) : 'Status: PAID'}\n\n(PDF invoice downloaded separately can be attached in WhatsApp)`;
    let phone = '';
    if (sale.customerId) { const c = window.data.customers.find(x => x.id === sale.customerId); if (c && c.phone) phone = c.phone.replace(/[^0-9]/g, ''); }
    const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (navigator.share) {
        navigator.share({ title: `Invoice #${invoiceNumber}`, text }).catch(() => window.open(url, '_blank'));
    } else {
        window.open(url, '_blank');
    }
}

window.openInvoiceModal = openInvoiceModal;
window.downloadInvoicePdf = downloadInvoicePdf;
window.printInvoice = printInvoice;
window.shareInvoiceWhatsApp = shareInvoiceWhatsApp;
