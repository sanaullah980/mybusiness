function safe(value = '') {
    return window.esc ? window.esc(value) : String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
}

function trendMarkup(current, previous, label = 'vs yesterday') {
    const c = Number(current || 0), p = Number(previous || 0);
    if (p === 0 && c === 0) return `<span class="dash-trend neutral"><i class="fas fa-minus"></i> No change</span>`;
    if (p === 0) return `<span class="dash-trend up"><i class="fas fa-arrow-up"></i> New today</span>`;
    const pct = Math.round(((c - p) / Math.abs(p)) * 100);
    if (pct === 0) return `<span class="dash-trend neutral"><i class="fas fa-minus"></i> 0% ${label}</span>`;
    return `<span class="dash-trend ${pct > 0 ? 'up' : 'down'}"><i class="fas fa-arrow-${pct > 0 ? 'up' : 'down'}"></i> ${Math.abs(pct)}% ${label}</span>`;
}

export function renderDashboard(container) {
    const data = window.data || {};
    const formatCurrency = window.formatCurrency;
    const getStartOfDay = window.getStartOfDay;
    const getEndOfDay = window.getEndOfDay;
    const today = new Date();
    const startToday = getStartOfDay(today), endToday = getEndOfDay(today);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const startYesterday = getStartOfDay(yesterday), endYesterday = getEndOfDay(yesterday);
    const stats = window.calculateReportData(startToday, endToday);
    const yesterdayStats = window.calculateReportData(startYesterday, endYesterday);

    let cashInHand = (data.settings?.cashOpeningBalance || 0);
    if (window.buildCashBookEntries) {
        window.buildCashBookEntries().forEach(e => { cashInHand += e.type === 'in' ? e.amount : -e.amount; });
    }
    const totalPayable = (data.suppliers || []).reduce((sum, s) => sum + (s.balance || 0), 0);
    const totalExpensesAll = (data.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    const lowStockProducts = (data.products || [])
        .filter(p => (p.stock || 0) <= (p.minStock || 5))
        .sort((a, b) => (a.stock || 0) - (b.stock || 0));
    const outOfStockCount = lowStockProducts.filter(p => (p.stock || 0) <= 0).length;

    const activity = [];
    (data.sales || []).forEach(s => activity.push({ date:s.date, icon:'fa-cash-register', title:'Sale', subtitle:s.customerName || 'Walk-in customer', amount:Number(s.total || 0), tone:'sales', onclick:s.id ? `viewSaleDetail('${s.id}')` : '' }));
    (data.expenses || []).forEach(e => activity.push({ date:e.date, icon:'fa-receipt', title:'Expense', subtitle:e.category || 'Business expense', amount:-Number(e.amount || 0), tone:'expense' }));
    (data.customerTransactions || []).forEach(t => { if (t.type === 'payment') activity.push({ date:t.date, icon:'fa-hand-holding-usd', title:'Customer payment', subtitle:'Payment received', amount:Number(t.amount || 0), tone:'payment' }); });
    (data.supplierTransactions || []).forEach(t => { if (t.type === 'payment') activity.push({ date:t.date, icon:'fa-truck', title:'Supplier payment', subtitle:'Payment made', amount:-Number(t.amount || 0), tone:'supplier' }); });
    (data.salesReturns || []).forEach(r => activity.push({ date:r.date, icon:'fa-undo', title:'Sales return', subtitle:'Refund processed', amount:-Number(r.refundAmount || 0), tone:'return' }));
    activity.sort((a,b) => new Date(b.date) - new Date(a.date));

    const businessName = data.settings?.name || 'MyBusiness';
    const initials = businessName.trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase() || 'MB';
    const hour = today.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const dateText = today.toLocaleDateString('en-PK', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

    container.innerHTML = `
        <div class="dashboard-premium">
            <section class="dash-business-hero">
                <div class="dash-hero-top">
                    <div class="dash-brand-row">
                        <div class="dash-avatar">${safe(initials)}</div>
                        <div class="dash-business-copy">
                            <span class="dash-kicker">MYBUSINESS</span>
                            <h1>${safe(businessName)}</h1>
                            <p><i class="far fa-calendar"></i> ${dateText}</p>
                        </div>
                    </div>
                    <button class="dash-menu-btn" onclick="openDashboardMenu()" aria-label="Open menu"><i class="fas fa-bars"></i></button>
                </div>
                <div class="dash-greeting">
                    <div>
                        <span>${greeting} 👋</span>
                        <strong>Here's your business at a glance.</strong>
                    </div>
                    <div class="dash-live-pill"><i class="fas fa-circle"></i> Today</div>
                </div>
            </section>

            <section class="dash-section">
                <div class="dash-section-heading"><div><span>PERFORMANCE</span><h2>Today at a glance</h2></div><i class="fas fa-chart-line"></i></div>
                <div class="dash-hero-grid">
                    <button class="dash-performance-card sales" onclick="navigate('sales')">
                        <div class="dash-card-icon"><i class="fas fa-chart-line"></i></div>
                        <div class="dash-card-label">Today's Sales</div>
                        <div class="dash-card-value">${formatCurrency(stats.totalSales)}</div>
                        ${trendMarkup(stats.totalSales, yesterdayStats.totalSales)}
                    </button>
                    <button class="dash-performance-card profit" onclick="navigate('reports')">
                        <div class="dash-card-icon"><i class="fas fa-coins"></i></div>
                        <div class="dash-card-label">Today's Profit</div>
                        <div class="dash-card-value">${formatCurrency(stats.netProfit)}</div>
                        ${trendMarkup(stats.netProfit, yesterdayStats.netProfit)}
                    </button>
                </div>
            </section>

            <section class="dash-money-grid">
                <div class="dash-money-card cash"><div class="dash-money-icon"><i class="fas fa-wallet"></i></div><div><span>Cash in Hand</span><strong>${formatCurrency(cashInHand)}</strong></div><i class="fas fa-arrow-right dash-card-arrow"></i></div>
                <div class="dash-money-card receivable"><div class="dash-money-icon"><i class="fas fa-user-clock"></i></div><div><span>Receivable</span><strong>${formatCurrency(stats.outstandingDebt)}</strong></div><i class="fas fa-arrow-right dash-card-arrow"></i></div>
                <div class="dash-money-card payable"><div class="dash-money-icon"><i class="fas fa-truck-loading"></i></div><div><span>Payable</span><strong>${formatCurrency(totalPayable)}</strong></div><i class="fas fa-arrow-right dash-card-arrow"></i></div>
            </section>

            <section class="dash-section">
                <div class="dash-section-heading"><div><span>SHORTCUTS</span><h2>Quick Actions</h2></div></div>
                <div class="dash-quick-grid">
                    <button onclick="navigate('sales')"><span class="qa-icon sale"><i class="fas fa-plus"></i></span><strong>New Sale</strong><small>Record sale</small></button>
                    <button onclick="navigate('customers')"><span class="qa-icon customer"><i class="fas fa-user-plus"></i></span><strong>Customer</strong><small>Manage Khata</small></button>
                    <button onclick="navigate('inventory')"><span class="qa-icon stock"><i class="fas fa-box-open"></i></span><strong>Inventory</strong><small>Manage stock</small></button>
                    <button onclick="navigate('cashbook')"><span class="qa-icon cash"><i class="fas fa-wallet"></i></span><strong>Cash Book</strong><small>Money movement</small></button>
                    <button onclick="navigate('stockPurchases')"><span class="qa-icon purchase"><i class="fas fa-shopping-cart"></i></span><strong>Purchase</strong><small>Add stock</small></button>
                    <button onclick="navigate('expenses')"><span class="qa-icon expense"><i class="fas fa-receipt"></i></span><strong>Expense</strong><small>Track spending</small></button>
                </div>
            </section>

            <section class="dash-section">
                <div class="dash-section-heading"><div><span>BUSINESS HEALTH</span><h2>Quick overview</h2></div></div>
                <div class="dash-overview-grid">
                    <div class="dash-overview-card"><span><i class="fas fa-receipt"></i> Expenses</span><strong>${formatCurrency(totalExpensesAll)}</strong><small>Total recorded</small></div>
                    <div class="dash-overview-card"><span><i class="fas fa-boxes"></i> Stock Items</span><strong>${(data.products || []).length}</strong><small>${lowStockProducts.length} need attention</small></div>
                    <div class="dash-overview-card"><span><i class="fas fa-users"></i> Customers</span><strong>${(data.customers || []).length}</strong><small>${(data.customers || []).filter(c => (c.balance || 0) > 0).length} with due</small></div>
                    <div class="dash-overview-card"><span><i class="fas fa-file-invoice-dollar"></i> Today's Bills</span><strong>${stats.txCount}</strong><small>Sales transactions</small></div>
                </div>
            </section>

            ${lowStockProducts.length ? `
            <section class="dash-alert-card">
                <div class="dash-alert-head"><div class="dash-alert-title"><span class="dash-alert-icon"><i class="fas fa-exclamation"></i></span><div><span>ATTENTION NEEDED</span><h2>Low Stock</h2></div></div><button onclick="navigate('inventory')">View all <i class="fas fa-arrow-right"></i></button></div>
                <p class="dash-alert-summary">${outOfStockCount ? `<b>${outOfStockCount}</b> item${outOfStockCount > 1 ? 's are' : ' is'} out of stock` : 'Some products are running low'}.</p>
                <div class="dash-stock-list">
                    ${lowStockProducts.slice(0,4).map(p => `<button class="dash-stock-row" onclick="openStockAdjustModal('${p.id}')"><span class="dash-stock-box"><i class="fas fa-box"></i></span><span class="dash-stock-name"><strong>${safe(p.name)}</strong><small>Minimum: ${p.minStock || 5}</small></span><span class="dash-stock-count ${Number(p.stock || 0) <= 0 ? 'out' : ''}">${Number(p.stock || 0) <= 0 ? 'Out' : `${p.stock} left`}</span><i class="fas fa-chevron-right"></i></button>`).join('')}
                </div>
            </section>` : `
            <section class="dash-success-card"><span><i class="fas fa-check"></i></span><div><strong>Stock looks healthy</strong><small>No products are currently below their minimum stock level.</small></div></section>`}

            <section class="dash-section dash-recent-section">
                <div class="dash-section-heading"><div><span>LATEST ACTIVITY</span><h2>Recent Transactions</h2></div><button onclick="navigate('reports')">View reports</button></div>
                <div class="dash-activity-card">
                    ${activity.length ? activity.slice(0,6).map(a => `<button class="dash-activity-row" ${a.onclick ? `onclick="${a.onclick}"` : ''}><span class="activity-icon ${a.tone}"><i class="fas ${a.icon}"></i></span><span class="activity-copy"><strong>${safe(a.title)}</strong><small>${safe(a.subtitle)} · ${new Date(a.date).toLocaleDateString('en-PK',{day:'numeric',month:'short'})}</small></span><span class="activity-amount ${a.amount >= 0 ? 'positive' : 'negative'}">${a.amount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(a.amount))}</span></button>`).join('') : `<div class="dash-empty"><i class="fas fa-receipt"></i><strong>No transactions yet</strong><span>Your recent business activity will appear here.</span></div>`}
                </div>
            </section>

            <button class="dash-reports-btn" onclick="navigate('reports')"><span><i class="fas fa-chart-pie"></i></span><div><strong>Open Detailed Reports</strong><small>Sales, profit, cash flow and more</small></div><i class="fas fa-arrow-right"></i></button>
        </div>
    `;
}

window.renderDashboard = renderDashboard;
