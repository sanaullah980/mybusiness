// calculateReportData is also used by the Dashboard for "today" stats, so it
// stays focused on the core numbers and now correctly nets out sales returns
// (a returned item's revenue/profit shouldn't still count as a sale).
export function calculateReportData(startDate, endDate) {
    const data = window.data;
    let totalSales = 0, knownProfit = 0, wholesaleProfit = 0, retailProfit = 0, unknownCount = 0, txCount = 0;
    let totalExpenses = 0, totalStockPurchases = 0, customerPayments = 0, newDebt = 0, returnedAmount = 0;
    data.sales.forEach(s => { const d = new Date(s.date); if (d >= startDate && d <= endDate) { totalSales += (s.total || 0); if (s.profitKnown) { knownProfit += (s.totalProfit || 0); const type=s.saleType==='retail'?'retail':'wholesale'; if(type==='retail') retailProfit += (s.totalProfit || 0); else wholesaleProfit += (s.totalProfit || 0); } else unknownCount++; txCount++; } });
    (data.salesReturns || []).forEach(r => { const d = new Date(r.date); if (d >= startDate && d <= endDate) { returnedAmount += (r.refundAmount || 0); } });
    data.expenses.forEach(e => { const d = new Date(e.date); if (d >= startDate && d <= endDate) totalExpenses += (e.amount || 0); });
    data.stockPurchases.forEach(p => { const d = new Date(p.date); if (d >= startDate && d <= endDate) totalStockPurchases += (p.amount || 0); });
    data.customerTransactions.forEach(t => { const d = new Date(t.date); if (d >= startDate && d <= endDate) { if (t.type === 'payment') customerPayments += (t.amount || 0); else if (t.type === 'sale_debt' || t.type === 'manual_debt') newDebt += (t.amount || 0); } });
    const netProfit = knownProfit - totalExpenses;
    const outstandingDebt = data.customers.reduce((sum, c) => sum + (c.balance || 0), 0);
    return { totalSales, knownProfit, wholesaleProfit, retailProfit, unknownCount, totalExpenses, netProfit, totalStockPurchases, customerPayments, newDebt, outstandingDebt, txCount, returnedAmount };
}

// Everything beyond the core dashboard numbers lives here so the Dashboard's
// per-render cost doesn't grow with every new report section.
function calculateAdvancedReportData(startDate, endDate) {
    const data = window.data;

    let cashIn = 0, cashOut = 0;
    if (window.buildCashBookEntries) {
        window.buildCashBookEntries().forEach(e => {
            const d = new Date(e.date);
            if (d >= startDate && d <= endDate) { if (e.type === 'in') cashIn += e.amount; else cashOut += e.amount; }
        });
    }
    let cashInHand = (data.settings && data.settings.cashOpeningBalance) || 0;
    if (window.buildCashBookEntries) window.buildCashBookEntries().forEach(e => { cashInHand += e.type === 'in' ? e.amount : -e.amount; });

    const stockValueCost = (data.products || []).reduce((sum, p) => sum + (p.cost || 0) * (p.stock || 0), 0);
    const stockValuePrice = (data.products || []).reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0);
    const lowStock = (data.products || []).filter(p => (p.stock || 0) <= (p.minStock || 5));
    const outOfStock = lowStock.filter(p => (p.stock || 0) <= 0);

    let purchasesTotal = 0, purchasesPaid = 0, purchasesDue = 0;
    (data.stockPurchases || []).forEach(p => {
        const d = new Date(p.date);
        if (d >= startDate && d <= endDate) {
            purchasesTotal += p.amount || 0;
            purchasesPaid += (p.amountPaid !== undefined ? p.amountPaid : p.amount) || 0;
            purchasesDue += p.amountDue || 0;
        }
    });

    const topDebtors = (data.customers || []).filter(c => (c.balance || 0) > 0).sort((a, b) => (b.balance || 0) - (a.balance || 0)).slice(0, 5);
    const totalReceivable = (data.customers || []).reduce((sum, c) => sum + (c.balance || 0), 0);
    const topPayables = (data.suppliers || []).filter(s => (s.balance || 0) > 0).sort((a, b) => (b.balance || 0) - (a.balance || 0)).slice(0, 5);
    const totalPayable = (data.suppliers || []).reduce((sum, s) => sum + (s.balance || 0), 0);

    const productStats = {};
    (data.sales || []).forEach(s => {
        const d = new Date(s.date);
        if (d >= startDate && d <= endDate && (s.saleType === 'normal' || s.saleType === 'wholesale' || s.saleType === 'retail') && s.items) {
            s.items.forEach(item => {
                const key = item.id || item.name;
                if (!productStats[key]) productStats[key] = { name: item.name, qty: 0, revenue: 0 };
                productStats[key].qty += item.qty;
                productStats[key].revenue += item.price * item.qty;
            });
        }
    });
    const bestSellers = Object.values(productStats).sort((a, b) => b.qty - a.qty).slice(0, 5);

    return { cashIn, cashOut, cashInHand, stockValueCost, stockValuePrice, lowStock, outOfStock, purchasesTotal, purchasesPaid, purchasesDue, topDebtors, totalReceivable, topPayables, totalPayable, bestSellers };
}

export function renderReports(container) {
    const data = window.data; const formatCurrency = window.formatCurrency;
    const getStartOfDay = window.getStartOfDay; const getEndOfDay = window.getEndOfDay;
    const getStartOfMonth = window.getStartOfMonth; const getEndOfMonth = window.getEndOfMonth;
    let startDate, endDate;
    if (window.activeReportTab === 'daily') {
        const dayStart = getStartOfDay(new Date());
        const customStart = data.settings?.businessDayStart ? new Date(data.settings.businessDayStart) : null;
        startDate = (customStart && !isNaN(customStart) && customStart > dayStart && customStart <= new Date()) ? customStart : dayStart;
        endDate = getEndOfDay(new Date());
    }
    else if (window.activeReportTab === 'monthly') { startDate = getStartOfMonth(window.currentReportMonth); endDate = getEndOfMonth(window.currentReportMonth); }
    else if (window.activeReportTab === 'custom') {
        const fromVal = document.getElementById('report-custom-from')?.value || window.getLocalDateStr(new Date());
        const toVal = document.getElementById('report-custom-to')?.value || window.getLocalDateStr(new Date());
        startDate = new Date(fromVal + 'T00:00:00'); endDate = new Date(toVal + 'T23:59:59');
    }
    else { startDate = new Date(2000, 0, 1); endDate = new Date(); }

    const stats = calculateReportData(startDate, endDate);
    const adv = calculateAdvancedReportData(startDate, endDate);
    const monthName = window.currentReportMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    const todayStr = window.getLocalDateStr(new Date());

    container.innerHTML = `
        <div class="tabs">
            <button class="tab-btn ${window.activeReportTab === 'daily' ? 'active' : ''}" onclick="setReportTab('daily')">Daily</button>
            <button class="tab-btn ${window.activeReportTab === 'monthly' ? 'active' : ''}" onclick="setReportTab('monthly')">Monthly</button>
            <button class="tab-btn ${window.activeReportTab === 'total' ? 'active' : ''}" onclick="setReportTab('total')">Total</button>
            <button class="tab-btn ${window.activeReportTab === 'custom' ? 'active' : ''}" onclick="setReportTab('custom')">Custom</button>
        </div>
        ${window.activeReportTab === 'monthly' ? `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;"> <button class="btn btn-sm btn-secondary" onclick="changeReportMonth(-1)"> <i class="fas fa-chevron-left"> </i> </button> <h3 style="margin:0;">${monthName} </h3> <button class="btn btn-sm btn-secondary" onclick="changeReportMonth(1)"> <i class="fas fa-chevron-right"> </i> </button> </div> ` : ''}
        ${window.activeReportTab === 'custom' ? `<div class="form-row" style="margin-bottom:15px;"><div class="form-group"><label>From</label><input type="date" id="report-custom-from" value="${todayStr}" onchange="renderReports(document.getElementById('app-content'))"></div><div class="form-group"><label>To</label><input type="date" id="report-custom-to" value="${todayStr}" onchange="renderReports(document.getElementById('app-content'))"></div></div>` : ''}
        ${window.activeReportTab === 'daily' ? `<button class="btn btn-secondary" style="margin-bottom:15px;" id="btn-reset-day" onclick="resetDailyReport()"> <i class="fas fa-sync-alt"> </i> Start New Business Day </button> ` : ''}

        <h3 style="margin:10px 0;">Sales &amp; Profit</h3>
        <div class="dashboard-grid">
            <div class="card profit"><h3>Total Sales</h3><div class="value">${formatCurrency(stats.totalSales)}</div></div>
            <div class="card profit"><h3>Wholesale Profit</h3><div class="value">${formatCurrency(stats.wholesaleProfit)}</div></div><div class="card profit"><h3>Retail Profit</h3><div class="value">${formatCurrency(stats.retailProfit)}</div></div><div class="card profit"><h3>Total Known Profit</h3><div class="value">${formatCurrency(stats.knownProfit)}</div></div>
            <div class="card"><h3>Transactions</h3><div class="value">${stats.txCount}</div></div>
            <div class="card"><h3>Unknown Profit Txns</h3><div class="value" style="color:var(--warning);">${stats.unknownCount}</div></div>
            <div class="card debt"><h3>Expenses</h3><div class="value">${formatCurrency(stats.totalExpenses)}</div></div>
            <div class="card profit"><h3>Net Profit</h3><div class="value">${formatCurrency(stats.netProfit)}</div></div>
            <div class="card debt"><h3>Sales Returns</h3><div class="value">${formatCurrency(stats.returnedAmount)}</div></div>
            <div class="card"><h3>Customer Payments In</h3><div class="value" style="color:var(--primary);">${formatCurrency(stats.customerPayments)}</div></div>
        </div>

        <h3 style="margin:20px 0 10px;">Cash Flow</h3>
        <div class="dashboard-grid">
            <div class="card"><h3>Cash In (Period)</h3><div class="value" style="color:var(--success); font-size:20px;">${formatCurrency(adv.cashIn)}</div></div>
            <div class="card"><h3>Cash Out (Period)</h3><div class="value" style="color:var(--danger); font-size:20px;">${formatCurrency(adv.cashOut)}</div></div>
        </div>
        <div class="card"><h3>Current Cash in Hand</h3><div class="value">${formatCurrency(adv.cashInHand)}</div></div>

        <h3 style="margin:20px 0 10px;">Inventory</h3>
        <div class="dashboard-grid">
            <div class="card"><h3>Stock Value (Cost)</h3><div class="value" style="font-size:20px;">${formatCurrency(adv.stockValueCost)}</div></div>
            <div class="card"><h3>Stock Value (Selling)</h3><div class="value" style="font-size:20px;">${formatCurrency(adv.stockValuePrice)}</div></div>
        </div>
        <div class="card"><h3>Low / Out of Stock</h3><div class="value">${adv.lowStock.length} items low (${adv.outOfStock.length} out)</div>${adv.lowStock.slice(0, 5).map(p => `<div class="list-item" style="cursor:default;"><div class="list-item-info"><h4>${p.name}</h4><p>Stock: ${p.stock}</p></div></div>`).join('')}</div>

        <h3 style="margin:20px 0 10px;">Purchases</h3>
        <div class="dashboard-grid">
            <div class="card"><h3>Total Purchased</h3><div class="value" style="font-size:20px;">${formatCurrency(adv.purchasesTotal)}</div></div>
            <div class="card"><h3>Paid / Due</h3><div class="value" style="font-size:16px;">${formatCurrency(adv.purchasesPaid)} / <span style="color:var(--danger);">${formatCurrency(adv.purchasesDue)}</span></div></div>
        </div>

        <h3 style="margin:20px 0 10px;">Customer &amp; Supplier Dues</h3>
        <div class="dashboard-grid">
            <div class="card debt"><h3>Total Receivable</h3><div class="value" style="font-size:20px;">${formatCurrency(adv.totalReceivable)}</div></div>
            <div class="card debt"><h3>Total Payable</h3><div class="value" style="font-size:20px;">${formatCurrency(adv.totalPayable)}</div></div>
        </div>
        <div class="card">
            <h3>Top Debtors</h3>
            ${adv.topDebtors.length === 0 ? '<p style="color:var(--gray); text-align:center; padding:10px;">None</p>' : adv.topDebtors.map(c => `<div class="list-item" onclick="openCustomerDetails('${c.id}')"><div class="list-item-info"><h4>${c.name}</h4></div><span style="font-weight:bold; color:var(--danger);">${formatCurrency(c.balance)}</span></div>`).join('')}
        </div>
        <div class="card">
            <h3>Top Payables</h3>
            ${adv.topPayables.length === 0 ? '<p style="color:var(--gray); text-align:center; padding:10px;">None</p>' : adv.topPayables.map(s => `<div class="list-item" onclick="openSupplierDetails('${s.id}')"><div class="list-item-info"><h4>${s.name}</h4></div><span style="font-weight:bold; color:var(--danger);">${formatCurrency(s.balance)}</span></div>`).join('')}
        </div>

        <h3 style="margin:20px 0 10px;">Best Sellers</h3>
        <div class="card report-ranking-card">
            ${adv.bestSellers.length === 0 ? '<p style="color:var(--gray); text-align:center; padding:10px;">No itemized sales in this period</p>' : adv.bestSellers.map((p, i) => { const maxQty=Math.max(1,...adv.bestSellers.map(x=>x.qty)); const width=Math.max(8,Math.round((p.qty/maxQty)*100)); return `<div class="report-rank-row"><div class="report-rank-head"><strong>#${i + 1} ${window.esc?.(p.name) || p.name}</strong><span>${p.qty} sold</span></div><div class="report-rank-track"><span style="width:${width}%"></span></div><div class="report-rank-foot"><span>Revenue</span><strong>${formatCurrency(p.revenue)}</strong></div></div>`; }).join('')}
        </div>

        <div class="card debt"><h3>Outstanding Customer Debt (legacy)</h3><div class="value">${formatCurrency(stats.outstandingDebt)}</div><p style="font-size:13px; color:var(--gray); margin-top:5px;">Same figure as Total Receivable above</p></div>
    `;
}

export function setReportTab(tab) { window.activeReportTab = tab; renderReports(document.getElementById('app-content')); }
export function changeReportMonth(direction) { window.currentReportMonth.setMonth(window.currentReportMonth.getMonth() + direction); renderReports(document.getElementById('app-content')); }
export async function resetDailyReport() { if (!confirm("Start new business day? Previous records remain in Monthly/Total reports.")) return; window.showLoading('btn-reset-day', "Resetting..."); try { await window.setDoc(window.doc(window.db, "settings", window.currentUserId), { businessDayStart: new Date().toISOString() }, { merge: true }); window.data.settings.businessDayStart = new Date().toISOString(); alert("New day started!"); renderReports(document.getElementById('app-content')); } catch (error) { alert("Failed."); } finally { window.hideLoading('btn-reset-day'); } }

window.renderReports = renderReports;
window.setReportTab = setReportTab;
window.changeReportMonth = changeReportMonth;
window.resetDailyReport = resetDailyReport;
