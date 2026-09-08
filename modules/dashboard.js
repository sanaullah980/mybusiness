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
    (data.salesReturns || []).forEach(r => activity.push({ date: r.date, icon: 'fa-undo', text: `Sales return`, amount: -(r.refundAmount || 0), color: 'var(--danger)' }));
    activity.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentActivity = activity.slice(0, 8);

    const businessName = data.settings?.name || 'MyBusiness';
    container.innerHTML = `
        <div class="home-hero">
            <div class="home-hero-top">
                <div><span class="eyebrow">YOUR BUSINESS</span><h2>${businessName}</h2><p>${new Date().toLocaleDateString('en-PK',{weekday:'long',day:'numeric',month:'short'})}</p></div>
                <button class="welcome-settings" onclick="navigate('settings')" title="Appearance"><i class="fas fa-palette"></i></button>
            </div>
            <div class="home-hero-balance">
                <span>Today's Sales</span>
                <strong>${formatCurrency(stats.totalSales)}</strong>
                <em>Net Profit Today: ${formatCurrency(stats.netProfit)}</em>
            </div>
        </div>
        <div class="home-stat-row">
            <div class="home-stat-ring"><span class="ring-icon" style="background:#2EC4B6"><i class="fas fa-wallet"></i></span><strong>${formatCurrency(cashInHand)}</strong><small>Cash in Hand</small></div>
            <div class="home-stat-ring"><span class="ring-icon" style="background:#FF6B6B"><i class="fas fa-hand-holding-usd"></i></span><strong>${formatCurrency(stats.outstandingDebt)}</strong><small>Receivables</small></div>
            <div class="home-stat-ring"><span class="ring-icon" style="background:#FFA62B"><i class="fas fa-truck"></i></span><strong>${formatCurrency(totalPayable)}</strong><small>Payables</small></div>
        </div>
        <div class="card action-grid-card">
            <div class="action-grid">
                <button class="action-tile" onclick="navigate('sales')"><span class="tile-icon tile-1"><i class="fas fa-plus"></i></span><span>New Sale</span></button>
                <button class="action-tile" onclick="navigate('customers')"><span class="tile-icon tile-2"><i class="fas fa-user-friends"></i></span><span>Khata</span></button>
                <button class="action-tile" onclick="navigate('inventory')"><span class="tile-icon tile-3"><i class="fas fa-box-open"></i></span><span>Stock</span></button>
                <button class="action-tile" onclick="navigate('cashbook')"><span class="tile-icon tile-4"><i class="fas fa-wallet"></i></span><span>Cash Book</span></button>
                <button class="action-tile" onclick="navigate('reports')"><span class="tile-icon tile-5"><i class="fas fa-chart-line"></i></span><span>Reports</span></button>
                <button class="action-tile" onclick="navigate('suppliers')"><span class="tile-icon tile-6"><i class="fas fa-truck"></i></span><span>Suppliers</span></button>
                <button class="action-tile" onclick="navigate('expenses')"><span class="tile-icon tile-7"><i class="fas fa-receipt"></i></span><span>Expenses</span></button>
                <button class="action-tile" onclick="navigate('more')"><span class="tile-icon tile-8"><i class="fas fa-th-large"></i></span><span>More</span></button>
            </div>
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
