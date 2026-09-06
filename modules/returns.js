// Sales Returns / Refunds.
// Only supported for itemized sales (saleType 'normal') since only those have
// a real per-product breakdown to reverse against inventory; Manual/Bulk
// sales don't carry product-level data to safely reverse stock against.
//
// Refund accounting (per the "always cash refund by default" instruction,
// applied correctly for partially-paid sales too):
//   1. The returned items' value (proportional to any original discount) is
//      first used to reduce whatever is still DUE on that sale/customer —
//      this isn't optional bookkeeping, it's just correct: if they still owed
//      money for those items, they now owe less, not "owe the same + get cash".
//   2. Whatever refund amount remains beyond the due is paid out as CASH —
//      this is the "always cash" case, and is what happens for the common
//      case of a fully-paid sale (due = 0, so 100% of the refund is cash).
// Every return writes exactly one salesReturns doc, which is the single
// source of truth the Cash Book and Reports read from — no duplicate entries
// anywhere else.

export function openReturnModal(saleId) {
    const sale = window.data.sales.find(s => s.id === saleId);
    if (!sale) return alert("Sale not found.");
    if (sale.saleType !== 'normal' || !sale.items || sale.items.length === 0) {
        return alert("Returns are only supported for itemized (Normal Sale) purchases.");
    }
    const returnable = sale.items.filter(i => (i.qty - (i.returnedQty || 0)) > 0);
    if (returnable.length === 0) return alert("All items from this sale have already been returned.");

    const modal = document.getElementById('modal-body');
    modal.innerHTML = `
        <div class="modal-header"><h2>Return / Refund</h2><button class="close-btn" onclick="viewSaleDetail('${saleId}')">&times;</button></div>
        <p style="font-size:13px; color:var(--gray); margin-bottom:10px;">Select items and quantities being returned. Stock, profit, ${sale.customerId ? 'customer balance, ' : ''}and cash will be updated automatically.</p>
        <div id="return-item-list">
        ${sale.items.map((item, idx) => {
            const maxQty = item.qty - (item.returnedQty || 0);
            if (maxQty <= 0) return `<div class="list-item" style="cursor:default; opacity:0.5;"><div class="list-item-info"><h4>${item.name}</h4><p>Fully returned</p></div></div>`;
            return `<div class="list-item" style="cursor:default;"><div class="list-item-info"><h4>${item.name}</h4><p>Sold: ${item.qty} | Available to return: ${maxQty} | ${window.formatCurrency(item.price)} each</p></div><input type="number" id="ret-qty-${idx}" min="0" max="${maxQty}" value="0" style="width:70px; padding:8px; border:1px solid #ddd; border-radius:6px;"></div>`;
        }).join('')}
        </div>
        <div class="form-group" style="margin-top:15px;"><label>Reason / Note</label><input type="text" id="return-note" placeholder="e.g., Damaged item"></div>
        <button class="btn" id="btn-process-return" style="background:var(--danger);" onclick="processReturn('${saleId}')">Confirm Return</button>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
}

export async function processReturn(saleId) {
    const sale = window.data.sales.find(s => s.id === saleId);
    if (!sale) return alert("Sale not found.");
    const returns = [];
    sale.items.forEach((item, idx) => {
        const input = document.getElementById(`ret-qty-${idx}`);
        if (!input) return;
        const qty = parseInt(input.value) || 0;
        if (qty > 0) returns.push({ index: idx, productId: item.id, name: item.name, price: item.price, cost: item.cost, qty });
    });
    if (returns.length === 0) return alert("Enter a quantity to return for at least one item.");
    const note = document.getElementById('return-note').value.trim();

    window.showLoading('btn-process-return', "Processing...");
    try {
        await window.runAtomicOrOffline(async (transaction) => {
            const saleRef = window.doc(window.db, "sales", saleId);
            const saleSnap = await transaction.get(saleRef);
            if (!saleSnap.exists()) throw new Error("Sale not found.");
            const freshSale = saleSnap.data();

            // Re-validate against the live doc (not the cached copy) to guard
            // against a double-return race from two open tabs.
            for (const r of returns) {
                const freshItem = freshSale.items.find(i => i.id === r.productId && i.name === r.name);
                const already = freshItem ? (freshItem.returnedQty || 0) : 0;
                const originalQty = freshItem ? freshItem.qty : 0;
                if (r.qty > (originalQty - already)) throw new Error(`${r.name}: return quantity exceeds what's available.`);
            }

            const productSnaps = [];
            for (const r of returns) {
                const snap = await transaction.get(window.doc(window.db, "products", r.productId));
                productSnaps.push({ r, snap });
            }
            let customerSnap = null;
            if (freshSale.customerId) customerSnap = await transaction.get(window.doc(window.db, "customers", freshSale.customerId));

            const returnedSubtotal = returns.reduce((sum, r) => sum + r.price * r.qty, 0);
            const returnedProfitRaw = returns.reduce((sum, r) => sum + (r.price - r.cost) * r.qty, 0);
            const subtotalBase = freshSale.subtotal !== undefined ? freshSale.subtotal : freshSale.total;
            const discountRatio = subtotalBase > 0 ? Math.min(1, (freshSale.discount || 0) / subtotalBase) : 0;
            const refundAmount = returnedSubtotal * (1 - discountRatio);
            const profitReversal = returnedProfitRaw * (1 - discountRatio);
            const existingDue = freshSale.amountDue || 0;
            const dueReduction = Math.min(existingDue, refundAmount);
            const cashRefund = Math.max(0, refundAmount - dueReduction);

            // Restock
            for (const { r, snap } of productSnaps) {
                if (snap.exists()) transaction.update(window.doc(window.db, "products", r.productId), { stock: (snap.data().stock || 0) + r.qty });
            }

            // Update the sale doc: reduce totals, mark per-item returnedQty
            const updatedItems = freshSale.items.map(item => {
                const match = returns.find(r => r.productId === item.id && r.name === item.name);
                return match ? { ...item, returnedQty: (item.returnedQty || 0) + match.qty } : item;
            });
            transaction.update(saleRef, {
                items: updatedItems,
                total: freshSale.total - refundAmount,
                totalProfit: (freshSale.totalProfit || 0) - profitReversal,
                amountDue: existingDue - dueReduction,
                returnedAmount: (freshSale.returnedAmount || 0) + refundAmount,
                returnedProfit: (freshSale.returnedProfit || 0) + profitReversal
            });

            // Reduce customer's debt for whatever portion offset the due
            if (freshSale.customerId && dueReduction > 0 && customerSnap && customerSnap.exists()) {
                const newBalance = Math.max(0, (customerSnap.data().balance || 0) - dueReduction);
                transaction.update(window.doc(window.db, "customers", freshSale.customerId), { balance: newBalance });
                const custTxnRef = window.doc(window.collection(window.db, "customerTransactions"));
                transaction.set(custTxnRef, { ownerId: window.currentUserId, customerId: freshSale.customerId, type: 'return_credit', amount: dueReduction, balanceAfter: newBalance, date: new Date().toISOString(), note: `Return credit - Sale #${saleId.substring(0, 8)}`, saleId });
            }

            // Single source of truth for the Cash Book / Reports
            const returnRef = window.doc(window.collection(window.db, "salesReturns"));
            transaction.set(returnRef, {
                ownerId: window.currentUserId, saleId, customerId: freshSale.customerId || null,
                items: returns.map(r => ({ productId: r.productId, name: r.name, qty: r.qty, price: r.price, cost: r.cost })),
                refundAmount, profitReversal, dueReduction, cashRefund,
                date: new Date().toISOString(), note
            });
        });
        alert("Return processed successfully!");
        window.viewSaleDetail(saleId);
    } catch (error) {
        console.error(error);
        alert(error.message || "Failed to process return.");
    } finally {
        window.hideLoading('btn-process-return');
    }
}

window.openReturnModal = openReturnModal;
window.processReturn = processReturn;
