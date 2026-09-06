export function renderDashboard(container) {
    const data = window.data;
    const formatCurrency = window.formatCurrency;
    const getStartOfDay = window.getStartOfDay;
    const getEndOfDay = window.getEndOfDay;
    const calculateReportData = window.calculateReportData;
    const startOfDay = getStartOfDay(new Date());
    const endOfDay = getEndOfDay(new Date());
    const stats = calculateReportData(startOfDay, endOfDay);
    const totalExpensesAll = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalStockPurchasesAll = data.stockPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPayable = (data.suppliers || []).reduce((sum, s) => sum + (s.balance || 0), 0);

    // Cash in hand: reuse the same running-balance logic as the Cash Book so
    // the two numbers can never disagree.
    let cashInHand = (data.settings && data.settings.cashOpeningBalance) || 0;
    if (window.buildCashBookEntries) {
        window.buildCashBookEntries().forEach(e => { cashInHand += e.type === 'in' ? e.amount : -e.amount; });
    }

    const lowStockProducts = (data.products || []).filter(p => (p.stock || 0) <= (p.minStock || 5)).sort((a, b) => a.stock - b.stock);
    const outOfStockCount = lowStockProducts.filter(p => (p.stock || 0) <= 0).length;

    // Combined recent-activity feed across sales, expenses, purchases and
    // customer/supplier payments, newest first.
    const activity = [];
    data.sales.forEach(s => activity.push({ date: s.date, icon: 'fa-cash-register', text: `Sale to ${s.customerName || 'Walk-in'}`, amount: s.total, color: 'var(--primary)', onclick: `viewSaleDetail('${s.id}')` }));
    data.expenses.forEach(e => activity.push({ date: e.date, icon: 'fa-receipt', text: `Expense${e.category ? ' - ' + e.category : ''}`, amount: -(e.amount || 0), color: 'var(--danger)' }));
    (data.customerTransactions || []).forEach(t => { if (t.type === 'payment') activity.push({ date: t.date, icon: 'fa-hand-holding-usd', text: `Customer payment received`, amount: t.amount, color: 'var(--success)' }); });
    (data.supplierTransactions || []).forEach(t => { if (t.type === 'payment') activity.push({ date: t.date, icon: 'fa-truck', text: `Paid supplier`, amount: -(t.amount || 0), color: 'var(--danger)' }); });
    activity.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentActivity = activity.slice(0, 8);

    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="card profit"><h3>Today's Sales</h3><div class="value">${formatCurrency(stats.totalSales)}</div></div>
            <div class="card profit"><h3>Net Profit (Today)</h3><div class="value">${formatCurrency(stats.netProfit)}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card"><h3>Cash in Hand</h3><div class="value" style="font-size:22px;">${formatCurrency(cashInHand)}</div></div>
            <div class="card debt"><h3>Receivables</h3><div class="value" style="font-size:22px;">${formatCurrency(stats.outstandingDebt)}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card debt"><h3>Payables</h3><div class="value" style="font-size:22px;">${formatCurrency(totalPayable)}</div></div>
            <div class="card"><h3>Total Expenses</h3><div class="value" style="font-size:22px;">${formatCurrency(totalExpensesAll)}</div></div>
        </div>
        ${lowStockProducts.length > 0 ? `
        <div class="card" style="border-left:4px solid var(--warning);">
            <h3 style="color:var(--warning);"><i class="fas fa-exclamation-triangle"></i> Stock Alerts ${outOfStockCount > 0 ? `(${outOfStockCount} out of stock)` : ''}</h3>
            ${lowStockProducts.slice(0, 5).map(p => `<div class="list-item" onclick="openStockAdjustModal('${p.id}')"><div class="list-item-info"><h4>${p.name}</h4><p>Stock: ${p.stock}</p></div><span class="badge ${p.stock <= 0 ? 'badge-low' : 'badge-low'}">${p.stock <= 0 ? 'Out of Stock' : 'Low'}</span></div>`).join('')}
            ${lowStockProducts.length > 5 ? `<p style="text-align:center; font-size:13px; color:var(--gray); margin-top:8px;">+${lowStockProducts.length - 5} more low-stock items</p>` : ''}
        </div>` : ''}
        <button class="btn" style="margin-bottom:20px;" onclick="navigate('reports')">View Detailed Reports</button>
        <div class="card">
            <h3>Recent Activity</h3>
            ${recentActivity.length === 0 ? '<p style="color:var(--gray); text-align:center; padding:10px;">No activity yet.</p>' : recentActivity.map(a => `
                <div class="list-item" ${a.onclick ? `onclick="${a.onclick}"` : 'style="cursor:default;"'}>
                    <div class="list-item-info">
                        <h4><i class="fas ${a.icon}" style="color:${a.color}; margin-right:6px;"></i>${a.text}</h4>
                        <p>${new Date(a.date).toLocaleString()}</p>
                    </div>
                    <div style="font-weight:bold; color:${a.color};">${a.amount < 0 ? '-' : ''}${formatCurrency(Math.abs(a.amount))}</div>
                </div>
            `).join('')}
        </div>
    `;
}

window.renderDashboard = renderDashboard;
