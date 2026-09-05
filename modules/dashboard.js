export function renderDashboard(container) {
    const data = window.data;
    const formatCurrency = window.formatCurrency;
    const getStartOfDay = window.getStartOfDay;
    const getEndOfDay = window.getEndOfDay;
    const calculateReportData = window.calculateReportData;
    const navigate = window.navigate;
    const startOfDay = getStartOfDay(new Date());
    const endOfDay = getEndOfDay(new Date());
    const stats = calculateReportData(startOfDay, endOfDay);
    const totalExpensesAll = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalStockPurchasesAll = data.stockPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
    const sortedSales = [...data.sales].sort((a, b) => new Date(a.date) - new Date(b.date)).reverse();
    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="card profit"><h3>Today's Sales</h3><div class="value">${formatCurrency(stats.totalSales)}</div></div>
            <div class="card profit"><h3>Known Profit</h3><div class="value">${formatCurrency(stats.knownProfit)}</div></div>
            <div class="card"><h3>Net Profit</h3><div class="value">${formatCurrency(stats.netProfit)}</div></div>
            <div class="card debt"><h3>Customer Debt</h3><div class="value">${formatCurrency(stats.outstandingDebt)}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card"><h3>Total Expenses</h3><div class="value">${formatCurrency(totalExpensesAll)}</div></div>
            <div class="card"><h3>Total Stock Purchases</h3><div class="value">${formatCurrency(totalStockPurchasesAll)}</div></div>
        </div>
        <button class="btn" style="margin-bottom:20px;" onclick="navigate('reports')">View Detailed Reports</button>
        <div class="card">
            <h3>Recent Sales (Tap to view details)</h3>
            ${sortedSales.slice(0, 5).map(s => `
                <div class="list-item" onclick="viewSaleDetail('${s.id}')">
                    <div class="list-item-info">
                        <h4>${s.customerName || 'Walk-in'} <span class="badge ${s.profitKnown ? 'badge-ok' : 'badge-unknown'}">${s.profitKnown ? 'Known' : 'Unknown'}</span></h4>
                        <p>${new Date(s.date).toLocaleString()}</p>
                    </div>
                    <div style="font-weight:bold; color:var(--primary);">${formatCurrency(s.total)}</div>
                </div>
            `).join('') || '<p style="color:var(--gray); text-align:center; padding:10px;">No sales yet.</p>'}
        </div>
    `;
}