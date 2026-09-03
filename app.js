import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth, setPersistence, browserLocalPersistence,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
    sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, setDoc,
    onSnapshot, query, where, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBQqnIhMCGd4_FRApjkns3HjIrqw2V1qFc",
    authDomain: "mybusinessapp-4734c.firebaseapp.com",
    projectId: "mybusinessapp-4734c",
    storageBucket: "mybusinessapp-4734c.firebasestorage.app",
    messagingSenderId: "367002926256",
    appId: "1:367002926256:web:0b5139dab24d901d9c8f75",
    measurementId: "G-HBC31ZFKMG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence).catch(console.error);

let currentUserId = null;
let isLoginMode = true;
let data = { products: [], customers: [], sales: [], expenses: [], stockPurchases: [], customerTransactions: [], settings: {} };
let listeners = [];
let cart = [];
let activeReportTab = 'daily';
let currentReportMonth = new Date();

// --- UTILITIES ---
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return "Unknown";
    return "Rs. " + Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getStartOfDay(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function getEndOfDay(date) { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; }
function getStartOfMonth(date) { const d = new Date(date); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
function getEndOfMonth(date) { const d = new Date(date); d.setMonth(d.getMonth() + 1); d.setDate(0); d.setHours(23, 59, 59, 999); return d; }

function showLoading(btnId, text) {
    const btn = document.getElementById(btnId);
    if (btn) { btn.disabled = true; btn.dataset.originalText = btn.innerText; btn.innerText = text || "Processing..."; }
}
function hideLoading(btnId) {
    const btn = document.getElementById(btnId);
    if (btn) { btn.disabled = false; btn.innerText = btn.dataset.originalText || "Submit"; }
}

function getLocalDateStr(dateInput) {
    const d = new Date(dateInput);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- AUTHENTICATION ---
window.toggleAuthMode = () => {
    isLoginMode = !isLoginMode;
    const btn = document.getElementById('auth-button');
    const toggle = document.getElementById('toggle-auth');
    document.getElementById('login-error').innerText = '';
    document.getElementById('login-password').value = '';
    btn.innerText = isLoginMode ? 'Log In' : 'Sign Up';
    toggle.innerText = isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Log In";
};

window.handleAuth = async (e) => {
    if (e) e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const btn = document.getElementById('auth-button');

    if (!email || !pass) { errorDiv.innerText = "Please enter both email and password."; return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errorDiv.innerText = "Please enter a valid email address."; return; }

    showLoading('auth-button', isLoginMode ? "Logging in..." : "Creating account...");
    errorDiv.innerText = "";

    try {
        if (isLoginMode) await signInWithEmailAndPassword(auth, email, pass);
        else await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        console.error("Auth error:", error);
        if (error.code === 'auth/email-already-in-use') errorDiv.innerText = "Email already registered. Please log in.";
        else if (error.code === 'auth/weak-password') errorDiv.innerText = "Password must be at least 6 characters.";
        else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') errorDiv.innerText = "Invalid email or password.";
        else errorDiv.innerText = "Authentication failed. Please try again.";
    } finally {
        hideLoading('auth-button');
    }
};

window.forgotPassword = async (e) => {
    if (e) e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    if (!email || !email.includes('@')) {
        alert("Please enter your email address in the field above first.");
        document.getElementById('login-email').focus();
        return;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        alert("Password reset email sent! Please check your inbox.");
    } catch (error) {
        console.error(error);
        alert("If an account exists with this email, a reset link has been sent.");
    }
};

window.signInWithGoogle = async () => {
    const btn = document.querySelector('.google-btn');
    btn.disabled = true;
    try { await signInWithPopup(auth, googleProvider); }
    catch (error) {
        console.error("Google Sign-In error:", error);
        alert("Google Sign-In failed. Please try again.");
    } finally {
        btn.disabled = false;
    }
};

window.handleLogout = async () => {
    if (!confirm("Are you sure you want to log out?")) return;
    try { await signOut(auth); }
    catch (error) { console.error("Logout error:", error); alert("Failed to log out."); }
};

onAuthStateChanged(auth, (user) => {
    document.getElementById('auth-loading').classList.add('hidden');
    if (user) {
        currentUserId = user.uid;
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        startListeners();
        navigate('dashboard');
    } else {
        currentUserId = null;
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        clearListeners();
        data = { products: [], customers: [], sales: [], expenses: [], stockPurchases: [], customerTransactions: [], settings: {} };
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        document.getElementById('login-error').innerText = '';
    }
});

// --- DATA LISTENERS ---
function startListeners() {
    clearListeners();
    const q = (col) => query(collection(db, col), where("ownerId", "==", currentUserId));

    listeners.push(onSnapshot(q("products"), s => { data.products = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("customers"), s => { data.customers = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("sales"), s => { data.sales = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("expenses"), s => { data.expenses = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("stockPurchases"), s => { data.stockPurchases = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("customerTransactions"), s => { data.customerTransactions = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(doc(db, "settings", currentUserId), (snap) => {
        data.settings = snap.exists() ? snap.data() : {};
        refreshCurrentView();
    }));
}

function clearListeners() { listeners.forEach(unsub => unsub()); listeners = []; }
function refreshCurrentView() {
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) navigate(activeNav.dataset.page || 'dashboard');
}

// --- NAVIGATION ---
window.navigate = (page) => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if(btn) btn.classList.add('active');

    const content = document.getElementById('app-content');
    const title = document.getElementById('header-title');

    if (page === 'dashboard') { title.innerText = 'Dashboard'; renderDashboard(content); }
    else if (page === 'sales') { title.innerText = 'New Sale'; renderSales(content); }
    else if (page === 'inventory') { title.innerText = 'Inventory'; renderInventory(content); }
    else if (page === 'customers') { title.innerText = 'Customers'; renderCustomers(content); }
    else if (page === 'more') { title.innerText = 'More'; renderMore(content); }
    else if (page === 'expenses') { title.innerText = 'Expenses'; renderExpenses(content); }
    else if (page === 'stockPurchases') { title.innerText = 'Stock Purchases'; renderStockPurchases(content); }
    else if (page === 'reports') { title.innerText = 'Reports'; renderReports(content); }
    else if (page === 'settings') { title.innerText = 'Settings'; renderSettings(content); }
};

// --- REPORT CALCULATION LOGIC ---
function calculateReportData(startDate, endDate) {
    let totalSales = 0, knownProfit = 0, unknownCount = 0, txCount = 0;
    let totalExpenses = 0, totalStockPurchases = 0, customerPayments = 0, newDebt = 0;

    data.sales.forEach(s => {
        const d = new Date(s.date);
        if (d >= startDate && d <= endDate) {
            totalSales += (s.total || 0);
            if (s.profitKnown) knownProfit += (s.totalProfit || 0);
            else unknownCount++;
            txCount++;
        }
    });

    data.expenses.forEach(e => {
        const d = new Date(e.date);
        if (d >= startDate && d <= endDate) totalExpenses += (e.amount || 0);
    });

    data.stockPurchases.forEach(p => {
        const d = new Date(p.date);
        if (d >= startDate && d <= endDate) totalStockPurchases += (p.amount || 0);
    });

    data.customerTransactions.forEach(t => {
        const d = new Date(t.date);
        if (d >= startDate && d <= endDate) {
            if (t.type === 'payment') customerPayments += (t.amount || 0);
            else if (t.type === 'sale_debt' || t.type === 'manual_debt') newDebt += (t.amount || 0);
        }
    });

    const netProfit = knownProfit - totalExpenses;
    const outstandingDebt = data.customers.reduce((sum, c) => sum + (c.balance || 0), 0);

    return { totalSales, knownProfit, unknownCount, totalExpenses, netProfit, totalStockPurchases, customerPayments, newDebt, outstandingDebt, txCount };
}

// --- SALE DETAIL MODAL ---
window.viewSaleDetail = (saleId) => {
    const sale = data.sales.find(s => s.id === saleId);
    if (!sale) return;

    // Find customer's debt before and after this sale
    const customerTxns = data.customerTransactions
        .filter(t => t.customerId === sale.customerId && new Date(t.date) <= new Date(sale.date))
        .sort((a,b) => new Date(a.date) - new Date(b.date));
    
    let debtBeforeSale = 0;
    if (customerTxns.length > 0) {
        // Find the transaction right before this sale
        const saleTxn = customerTxns.find(t => t.saleId === saleId);
        if (saleTxn) {
            debtBeforeSale = saleTxn.balanceAfter - (sale.amountDue || 0);
        }
    }

    const modal = document.getElementById('modal-body');
    modal.innerHTML = `
        <div class="modal-header">
            <h2>Sale Details</h2>
            <button class="close-btn" onclick="closeModal()">&times;</button>
        </div>
        <div class="sale-detail-header">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div><div class="label">Date & Time</div><div class="val">${new Date(sale.date).toLocaleString()}</div></div>
                <div style="text-align:right;"><div class="label">Customer</div><div class="val">${sale.customerName || 'Walk-in'}</div></div>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <div><div class="label">Sale Type</div><div class="val">${sale.saleType ? sale.saleType.charAt(0).toUpperCase() + sale.saleType.slice(1) : 'Normal'}</div></div>
                <div style="text-align:right;"><div class="label">Profit Status</div><div class="val" style="color:${sale.profitKnown ? 'var(--primary)' : 'var(--warning)'};">${sale.profitKnown ?[...]
            </div>
        </div>
        ${sale.customerId && sale.customerId !== 'walk-in' ? `
        <div class="debt-alert">
            <strong>Customer Debt Info:</strong><br>
            Debt before this sale: ${formatCurrency(debtBeforeSale)}<br>
            Amount due from this sale: ${formatCurrency(sale.amountDue || 0)}<br>
            <strong>Total debt after sale: ${formatCurrency((debtBeforeSale + (sale.amountDue || 0)))}</strong>
        </div>
        ` : ''}
        <h3 style="margin:15px 0 10px 0; font-size:16px;">Items Purchased</h3>
        <div style="max-height:250px; overflow-y:auto;">
            ${(sale.items || []).map(item => `
                <div class="sale-detail-row">
                    <div>
                        <div class="item-name">${item.name} x${item.qty}</div>
                        <div class="item-details">Cost: ${formatCurrency(item.cost)} | Price: ${formatCurrency(item.price)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div class="item-total">${formatCurrency(item.price * item.qty)}</div>
                        <div class="item-details">Profit: ${formatCurrency((item.price - item.cost) * item.qty)}</div>
                    </div>
                </div>
            `).join('') || '<p style="color:var(--gray); text-align:center;">No item details</p>'}
        </div>
        <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-top:15px;">
            <div class="sale-detail-row" style="border:none; padding:5px 0;">
                <span>Subtotal:</span><span style="font-weight:bold;">${formatCurrency(sale.total)}</span>
            </div>
            <div class="sale-detail-row" style="border:none; padding:5px 0;">
                <span>Amount Paid:</span><span style="font-weight:bold; color:var(--primary);">${formatCurrency(sale.amountPaid || 0)}</span>
            </div>
            <div class="sale-detail-row" style="border:none; padding:5px 0;">
                <span>Amount Due:</span><span style="font-weight:bold; color:var(--danger);">${formatCurrency(sale.amountDue || 0)}</span>
            </div>
            <div class="sale-detail-row" style="border:none; padding:5px 0; border-top:2px solid var(--dark); margin-top:5px; padding-top:10px;">
                <span style="font-weight:bold;">Total Profit:</span>
                <span style="font-weight:bold; color:${sale.profitKnown ? 'var(--primary)' : 'var(--warning)'};">${sale.profitKnown ? formatCurrency(sale.totalProfit) : 'Unknown'}</span>
            </div>
        </div>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
};

// --- RENDER FUNCTIONS ---
function renderDashboard(container) {
    const dayStartStr = data.settings.businessDayStart || getStartOfDay(new Date()).toISOString();
    const stats = calculateReportData(new Date(dayStartStr), new Date());

    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="card profit"><h3>Today's Sales</h3><div class="value">${formatCurrency(stats.totalSales)}</div></div>
            <div class="card profit"><h3>Known Profit</h3><div class="value">${formatCurrency(stats.knownProfit)}</div></div>
            <div class="card"><h3>Net Profit</h3><div class="value">${formatCurrency(stats.netProfit)}</div></div>
            <div class="card debt"><h3>Customer Debt</h3><div class="value">${formatCurrency(stats.outstandingDebt)}</div></div>
        </div>
        <div class="dashboard-grid">
            <div class="card"><h3>Today's Expenses</h3><div class="value">${formatCurrency(stats.totalExpenses)}</div></div>
            <div class="card"><h3>Stock Purchases</h3><div class="value">${formatCurrency(stats.totalStockPurchases)}</div></div>
        </div>
        <button class="btn" style="margin-bottom:20px;" onclick="navigate('reports')">View Detailed Reports</button>
        <div class="card">
            <h3>Recent Sales (Click to view details)</h3>
            ${data.sales.slice().reverse().slice(0, 5).map(s => `
                <div class="list-item" onclick="viewSaleDetail('${s.id}')">
                    <div class="list-item-info">
                        <h4>${s.customerName || 'Walk-in'} <span class="badge ${s.profitKnown ? 'badge-ok' : 'badge-low'}">${s.profitKnown ? 'Known' : 'Unknown'}</span></h4>
                        <p>${new Date(s.date).toLocaleString()}</p>
                    </div>
                    <div style="font-weight:bold; color:var(--primary);">${formatCurrency(s.total)}</div>
                </div>
            `).join('') || '<p style="color:var(--gray); text-align:center; padding:10px;">No sales yet.</p>'}
        </div>
    `;
}

function renderSales(container) {
    container.innerHTML = `
        <div class="tabs">
            <button class="tab-btn active" onclick="showSaleTab('normal', this)">Normal Sale</button>
            <button class="tab-btn" onclick="showSaleTab('manual', this)">Manual Item</button>
            <button class="tab-btn" onclick="showSaleTab('bulk', this)">Quick / Bulk</button>
        </div>
        <div id="sale-tab-normal" class="sale-tab">
            <div class="card">
                <div class="form-group">
                    <label>Customer (Optional)</label>
                    <select id="sale-customer" onchange="onSaleCustomerChange()">
                        <option value="">Walk-in Customer</option>
                        ${data.customers.map(c => `<option value="${c.id}">${c.name} (Debt: ${formatCurrency(c.balance || 0)})</option>`).join('')}
                    </select>
                    <div id="customer-debt-display"></div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="flex:2;">
                        <label>Product</label>
                        <select id="sale-product">
                            <option value="">Select Product</option>
                            ${data.products.map(p => `<option value="${p.id}" data-price="${p.price}" data-cost="${p.cost}" data-stock="${p.stock}">${p.name} (Stock: ${p.stock})</option>`).join('[...]
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Qty</label>
                        <input type="number" id="sale-qty" value="1" min="1">
                    </div>
                </div>
                <button class="btn" onclick="addSaleItem()">Add to Cart</button>
            </div>
            <div class="card">
                <h3>Cart</h3>
                <div id="cart-items"></div>
                <hr style="margin:15px 0;">
                <div class="form-row">
                    <div class="form-group"><label>Total</label><input type="text" id="cart-total-display" readonly value="Rs. 0"></div>
                    <div class="form-group"><label>Amount Paid</label><input type="number" id="sale-amount-paid" value="0" min="0" oninput="updateSaleDue()"></div>
                </div>
                <div class="form-group"><label>Remaining Due (Added to Debt)</label><input type="text" id="sale-amount-due" readonly value="Rs. 0"></div>
                <button class="btn" id="btn-complete-sale" onclick="completeNormalSale()">Complete Sale</button>
            </div>
        </div>
        <div id="sale-tab-manual" class="sale-tab hidden">
            <div class="card">
                <h3>Manual Item Sale</h3>
                <div class="form-group">
                    <label>Customer (Optional)</label>
                    <select id="manual-customer" onchange="onManualCustomerChange()">
                        <option value="">Walk-in Customer</option>
                        ${data.customers.map(c => `<option value="${c.id}">${c.name} (Debt: ${formatCurrency(c.balance || 0)})</option>`).join('')}
                    </select>
                    <div id="manual-customer-debt-display"></div>
                </div>
                <div class="form-group"><label>Item Name *</label><input type="text" id="manual-item-name"></div>
                <div class="form-row">
                    <div class="form-group"><label>Selling Amount (Rs.) *</label><input type="number" id="manual-amount" min="0"></div>
                    <div class="form-group"><label>Estimated Profit (Rs.)</label><input type="number" id="manual-profit" min="0"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Amount Paid (Rs.)</label><input type="number" id="manual-paid" value="0" min="0"></div>
                </div>
                <button class="btn" id="btn-manual-sale" onclick="completeManualSale()">Record Manual Sale</button>
            </div>
        </div>
        <div id="sale-tab-bulk" class="sale-tab hidden">
            <div class="card">
                <h3>Quick / Bulk Sale</h3>
                <div class="form-group">
                    <label>Customer (Optional)</label>
                    <select id="bulk-customer" onchange="onBulkCustomerChange()">
                        <option value="">Walk-in Customer</option>
                        ${data.customers.map(c => `<option value="${c.id}">${c.name} (Debt: ${formatCurrency(c.balance || 0)})</option>`).join('')}
                    </select>
                    <div id="bulk-customer-debt-display"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Total Selling Amount (Rs.) *</label><input type="number" id="bulk-total" min="0"></div>
                    <div class="form-group"><label>Estimated Profit (Rs.) <small>(Leave blank if unknown)</small></label><input type="number" id="bulk-profit" min="0"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Amount Paid (Rs.)</label><input type="number" id="bulk-paid" value="0" min="0"></div>
                    <div class="form-group"><label>Note</label><input type="text" id="bulk-note" placeholder="e.g., Evening sales"></div>
                </div>
                <button class="btn" id="btn-bulk-sale" onclick="completeBulkSale()">Record Bulk Sale</button>
            </div>
        </div>
    `;
    cart = [];
    renderCart();
}

// Customer debt display handlers
window.onSaleCustomerChange = () => {
    const customerId = document.getElementById('sale-customer').value;
    const display = document.getElementById('customer-debt-display');
    if (!customerId) { display.innerHTML = ''; return; }
    const c = data.customers.find(x => x.id === customerId);
    if (c && c.balance > 0) {
        display.innerHTML = `<div class="customer-debt-display"><span class="debt-label">Current Debt:</span> <span class="debt-amount">${formatCurrency(c.balance)}</span></div>`;
    } else if (c) {
        display.innerHTML = `<div class="customer-debt-display" style="background:#e8f5e9; border-color:#a5d6a7;"><span class="debt-label">Current Debt:</span> <span class="debt-amount" style="co`;
    }
};

window.onManualCustomerChange = () => {
    const customerId = document.getElementById('manual-customer').value;
    const display = document.getElementById('manual-customer-debt-display');
    if (!customerId) { display.innerHTML = ''; return; }
    const c = data.customers.find(x => x.id === customerId);
    if (c && c.balance > 0) {
        display.innerHTML = `<div class="customer-debt-display"><span class="debt-label">Current Debt:</span> <span class="debt-amount">${formatCurrency(c.balance)}</span></div>`;
    } else if (c) {
        display.innerHTML = `<div class="customer-debt-display" style="background:#e8f5e9; border-color:#a5d6a7;"><span class="debt-label">Current Debt:</span> <span class="debt-amount" style="co`;
    }
};

window.onBulkCustomerChange = () => {
    const customerId = document.getElementById('bulk-customer').value;
    const display = document.getElementById('bulk-customer-debt-display');
    if (!customerId) { display.innerHTML = ''; return; }
    const c = data.customers.find(x => x.id === customerId);
    if (c && c.balance > 0) {
        display.innerHTML = `<div class="customer-debt-display"><span class="debt-label">Current Debt:</span> <span class="debt-amount">${formatCurrency(c.balance)}</span></div>`;
    } else if (c) {
        display.innerHTML = `<div class="customer-debt-display" style="background:#e8f5e9; border-color:#a5d6a7;"><span class="debt-label">Current Debt:</span> <span class="debt-amount" style="co`;
    }
};

window.showSaleTab = (tab, btn) => {
    document.querySelectorAll('.sale-tab').forEach(t => t.classList.add('hidden'));
    document.getElementById(`sale-tab-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
};

function renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    let total = 0;
    if (cart.length === 0) {
        container.innerHTML = '<p style="color:var(--gray); text-align:center; padding:10px;">Cart is empty.</p>';
    } else {
        container.innerHTML = cart.map((item, index) => {
            const sub = item.price * item.qty;
            total += sub;
            return `<div class="list-item" style="cursor:default;">
                <div class="list-item-info"><h4>${item.name} x${item.qty}</h4><p>${formatCurrency(item.price)} each</p></div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:bold;">${formatCurrency(sub)}</span>
                    <i class="fas fa-trash" style="color:var(--danger); cursor:pointer; padding:5px;" onclick="removeCartItem(${index})"></i>
                </div>
            </div>`;
        }).join('');
    }
    document.getElementById('cart-total-display').value = formatCurrency(total);
    updateSaleDue();
}

window.updateSaleDue = () => {
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const paid = parseFloat(document.getElementById('sale-amount-paid')?.value) || 0;
    const due = Math.max(0, total - paid);
    if(document.getElementById('sale-amount-due')) document.getElementById('sale-amount-due').value = formatCurrency(due);
};

window.addSaleItem = () => {
    const select = document.getElementById('sale-product');
    const qtyInput = document.getElementById('sale-qty');
    const qty = parseInt(qtyInput.value);
    const option = select.options[select.selectedIndex];

    if (!option.value) return alert("Please select a product.");
    if (!qty || qty < 1) return alert("Quantity must be at least 1.");

    const availableStock = parseInt(option.dataset.stock);
    const item = { id: option.value, name: option.text.split(' (')[0], price: parseFloat(option.dataset.price), cost: parseFloat(option.dataset.cost), qty: qty };

    const existing = cart.find(i => i.id === item.id);
    if (existing) {
        if (existing.qty + qty > availableStock) return alert(`Not enough stock! Available: ${availableStock}`);
        existing.qty += qty;
    } else {
        if (qty > availableStock) return alert(`Not enough stock! Available: ${availableStock}`);
        cart.push(item);
    }
    renderCart();
    qtyInput.value = 1;
    select.selectedIndex = 0;
};

window.removeCartItem = (index) => { cart.splice(index, 1); renderCart(); };

window.completeNormalSale = async () => {
    if(cart.length === 0) return alert("Cart is empty!");
    const btn = document.getElementById('btn-complete-sale');
    showLoading('btn-complete-sale', "Processing...");

    try {
        const customerId = document.getElementById('sale-customer').value || null;
        const amountPaid = parseFloat(document.getElementById('sale-amount-paid').value) || 0;

        await runTransaction(db, async (transaction) => {
            const productSnapshots = [];
            for (const item of cart) {
                const snap = await transaction.get(doc(db, "products", item.id));
                productSnapshots.push({ item, snap });
            }
            let customerSnap = null;
            if (customerId) customerSnap = await transaction.get(doc(db, "customers", customerId));

            let total = 0, totalProfit = 0;
            for (const { item, snap } of productSnapshots) {
                if (!snap.exists()) throw new Error(`Product ${item.name} not found.`);
                const pData = snap.data();
                if (pData.ownerId !== currentUserId) throw new Error("Unauthorized product access.");
                if (pData.stock < item.qty) throw new Error(`Insufficient stock for ${item.name}.`);
                total += item.price * item.qty;
                totalProfit += (item.price - pData.cost) * item.qty;
            }

            const amountDue = Math.max(0, total - amountPaid);
            let newCustomerBalance = 0;
            if (customerId && customerSnap && customerSnap.exists()) {
                newCustomerBalance = (customerSnap.data().balance || 0) + amountDue;
            }

            const saleRef = doc(collection(db, "sales"));
            const customerName = (customerId && customerSnap && customerSnap.exists()) ? customerSnap.data().name : "Walk-in";

            transaction.set(saleRef, {
                ownerId: currentUserId, customerId: customerId || null, customerName, saleType: 'normal',
                date: new Date().toISOString(), items: cart, total, amountPaid, amountDue, totalProfit, profitKnown: true, note: ''
            });

            for (const { item, snap } of productSnapshots) {
                transaction.update(doc(db, "products", item.id), { stock: snap.data().stock - item.qty });
            }

            if (customerId && amountDue > 0) {
                transaction.update(doc(db, "customers", customerId), { balance: newCustomerBalance });
                const txnRef = doc(collection(db, "customerTransactions"));
                transaction.set(txnRef, {
                    ownerId: currentUserId, customerId, type: 'sale_debt', amount: amountDue, balanceAfter: newCustomerBalance,
                    date: new Date().toISOString(), note: `Sale #${saleRef.id.substring(0,8)}`, saleId: saleRef.id
                });
            }
        });

        alert("Sale completed successfully!");
        cart = [];
        navigate('dashboard');
    } catch (error) {
        console.error("Sale error:", error);
        alert(error.message || "Unable to complete sale. Please try again.");
    } finally {
        hideLoading('btn-complete-sale');
    }
};

window.completeManualSale = async () => {
    const name = document.getElementById('manual-item-name').value.trim();
    const amount = parseFloat(document.getElementById('manual-amount').value);
    const profitInput = document.getElementById('manual-profit').value;
    const amountPaid = parseFloat(document.getElementById('manual-paid').value) || 0;
    const customerId = document.getElementById('manual-customer').value || null;

    if (!name) return alert("Please enter an item name.");
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid selling amount.");

    const btn = document.getElementById('btn-manual-sale');
    showLoading('btn-manual-sale', "Saving...");

    try {
        const profitKnown = profitInput !== "";
        const totalProfit = profitKnown ? parseFloat(profitInput) : 0;
        const amountDue = Math.max(0, amount - amountPaid);

        let customerName = "Walk-in";
        if (customerId) {
            const c = data.customers.find(x => x.id === customerId);
            if (c) customerName = c.name;
        }

        await runTransaction(db, async (transaction) => {
            let customerSnap = null;
            if (customerId) customerSnap = await transaction.get(doc(db, "customers", customerId));

            const saleRef = doc(collection(db, "sales"));
            transaction.set(saleRef, {
                ownerId: currentUserId, customerId: customerId || null, customerName, saleType: 'manual',
                date: new Date().toISOString(), items: [{ name, price: amount, cost: amount - totalProfit, qty: 1 }],
                total: amount, amountPaid: Math.min(amountPaid, amount), amountDue, totalProfit, profitKnown, note: "Manual entry"
            });

            if (customerId && amountDue > 0 && customerSnap && customerSnap.exists()) {
                const newBalance = (customerSnap.data().balance || 0) + amountDue;
                transaction.update(doc(db, "customers", customerId), { balance: newBalance });
                const txnRef = doc(collection(db, "customerTransactions"));
                transaction.set(txnRef, {
                    ownerId: currentUserId, customerId, type: 'sale_debt', amount: amountDue, balanceAfter: newBalance,
                    date: new Date().toISOString(), note: `Manual Sale #${saleRef.id.substring(0,8)}`, saleId: saleRef.id
                });
            }
        });
        alert("Manual sale recorded!");
        navigate('dashboard');
    } catch (error) {
        console.error(error);
        alert("Failed to record sale.");
    } finally {
        hideLoading('btn-manual-sale');
    }
};

window.completeBulkSale = async () => {
    const customerId = document.getElementById('bulk-customer').value || null;
    const total = parseFloat(document.getElementById('bulk-total').value);
    const profitInput = document.getElementById('bulk-profit').value;
    const amountPaid = parseFloat(document.getElementById('bulk-paid').value) || 0;
    const note = document.getElementById('bulk-note').value.trim();

    if (isNaN(total) || total <= 0) return alert("Please enter a valid total amount.");

    const btn = document.getElementById('btn-bulk-sale');
    showLoading('btn-bulk-sale', "Saving...");

    try {
        const profitKnown = profitInput !== "";
        const totalProfit = profitKnown ? parseFloat(profitInput) : 0;
        const amountDue = Math.max(0, total - amountPaid);

        await runTransaction(db, async (transaction) => {
            let customerSnap = null;
            if (customerId) customerSnap = await transaction.get(doc(db, "customers", customerId));

            const newCustomerBalance = (customerId && amountDue > 0 && customerSnap && customerSnap.exists())
                ? (customerSnap.data().balance || 0) + amountDue
                : (customerSnap && customerSnap.exists() ? customerSnap.data().balance || 0 : 0);

            const saleRef = doc(collection(db, "sales"));
            const customerName = (customerId && customerSnap && customerSnap.exists()) ? customerSnap.data().name : "Walk-in";

            transaction.set(saleRef, {
                ownerId: currentUserId, customerId: customerId || null, customerName, saleType: 'bulk',
                date: new Date().toISOString(), items: [], total, amountPaid: Math.min(amountPaid, total), amountDue, totalProfit, profitKnown, note
            });

            if (customerId && amountDue > 0) {
                transaction.update(doc(db, "customers", customerId), { balance: newCustomerBalance });
                const txnRef = doc(collection(db, "customerTransactions"));
                transaction.set(txnRef, {
                    ownerId: currentUserId, customerId, type: 'sale_debt', amount: amountDue, balanceAfter: newCustomerBalance,
                    date: new Date().toISOString(), note: `Bulk Sale #${saleRef.id.substring(0,8)}`, saleId: saleRef.id
                });
            }
        });
        alert("Bulk sale recorded!");
        navigate('dashboard');
    } catch (error) {
        console.error(error);
        alert("Failed to record bulk sale.");
    } finally {
        hideLoading('btn-bulk-sale');
    }
};

// --- INVENTORY ---
function renderInventory(container) {
    container.innerHTML = `
        <button class="btn" style="margin-bottom:20px;" onclick="openProductModal()">+ Add Product</button>
        <div class="card" id="product-list">
            ${data.products.length === 0 ? '<p style="color:var(--gray); text-align:center; padding:10px;">No products found.</p>' :
              data.products.map(p => `
                <div class="list-item" style="cursor:default;">
                    <div class="list-item-info">
                        <h4>${p.name}</h4>
                        <p>Cost: ${formatCurrency(p.cost)} | Price: ${formatCurrency(p.price)}</p>
                        <p>Stock: ${p.stock}</p>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                        <span class="badge ${p.stock <= (p.minStock||5) ? 'badge-low' : 'badge-ok'}">${p.stock <= (p.minStock||5) ? 'Low Stock' : 'OK'}</span>
                        <div style="display:flex; gap:5px;">
                            <button class="btn btn-sm btn-secondary" onclick="openStockAdjustModal('${p.id}')">Adjust</button>
                            <button class="btn btn-sm" onclick="openProductModal('${p.id}')">Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

window.openProductModal = (productId = null) => {
    const p = productId ? data.products.find(x => x.id === productId) : null;
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `
        <div class="modal-header"><h2>${p ? 'Edit' : 'Add'} Product</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Product Name *</label><input type="text" id="p-name" value="${p ? p.name : ''}"></div>
        <div class="form-row">
            <div class="form-group"><label>Cost Price (Rs.) *</label><input type="number" id="p-cost" step="0.01" min="0" value="${p ? p.cost : ''}"></div>
            <div class="form-group"><label>Selling Price (Rs.) *</label><input type="number" id="p-price" step="0.01" min="0" value="${p ? p.price : ''}"></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Current Stock *</label><input type="number" id="p-stock" min="0" value="${p ? p.stock : ''}"></div>
            <div class="form-group"><label>Min Stock Alert</label><input type="number" id="p-min" min="0" value="${p ? (p.minStock||5) : 5}"></div>
        </div>
        <button class="btn" id="btn-save-product" onclick="saveProduct('${productId || ''}')">${p ? 'Update' : 'Save'} Product</button>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
};

window.saveProduct = async (productId) => {
    const name = document.getElementById('p-name').value.trim();
    const cost = parseFloat(document.getElementById('p-cost').value);
    const price = parseFloat(document.getElementById('p-price').value);
    const stock = parseInt(document.getElementById('p-stock').value);
    const minStock = parseInt(document.getElementById('p-min').value) || 5;

    if (!name) return alert("Product name is required.");
    if (isNaN(cost) || cost < 0) return alert("Please enter a valid cost price.");
    if (isNaN(price) || price < 0) return alert("Please enter a valid selling price.");
    if (isNaN(stock) || stock < 0) return alert("Please enter a valid stock quantity.");

    showLoading('btn-save-product', "Saving...");
    try {
        const pData = { name, cost, price, stock, minStock, ownerId: currentUserId };
        if (productId) await updateDoc(doc(db, "products", productId), pData);
        else await addDoc(collection(db, "products"), pData);
        alert(productId ? "Product updated!" : "Product added!");
        closeModal();
    } catch (error) {
        console.error(error);
        alert("Failed to save product.");
    } finally { hideLoading('btn-save-product'); }
};

window.deleteProduct = async (id) => {
    if (!confirm("Are you sure you want to delete this product? This cannot be undone.")) return;
    try { await deleteDoc(doc(db, "products", id)); }
    catch (error) { console.error(error); alert("Failed to delete product."); }
};

window.openStockAdjustModal = (productId) => {
    const p = data.products.find(x => x.id === productId);
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `
        <div class="modal-header"><h2>Adjust Stock: ${p.name}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
        <p style="margin-bottom:15px; color:var(--gray);">Current Stock: <strong>${p.stock}</strong></p>
        <div class="form-group">
            <label>Action</label>
            <select id="adj-type">
                <option value="add">Add Stock</option>
                <option value="remove">Remove Stock</option>
            </select>
        </div>
        <div class="form-group"><label>Quantity</label><input type="number" id="adj-qty" min="1" value="1"></div>
        <div class="form-group"><label>Note (Optional)</label><input type="text" id="adj-note" placeholder="e.g., Received from supplier"></div>
        <button class="btn" id="btn-save-adj" onclick="saveStockAdjustment('${productId}')">Update Stock</button>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
};

window.saveStockAdjustment = async (productId) => {
    const type = document.getElementById('adj-type').value;
    const qty = parseInt(document.getElementById('adj-qty').value);
    const note = document.getElementById('adj-note').value.trim();

    if (!qty || qty <= 0) return alert("Please enter a valid quantity.");
    const p = data.products.find(x => x.id === productId);
    if (type === 'remove' && p.stock - qty < 0) return alert("Cannot reduce stock below zero.");

    showLoading('btn-save-adj', "Updating...");
    try {
        const newStock = type === 'add' ? p.stock + qty : p.stock - qty;
        await updateDoc(doc(db, "products", productId), { stock: newStock });
        await addDoc(collection(db, "stockAdjustments"), {
            ownerId: currentUserId, productId, type, quantity: qty,
            date: new Date().toISOString(), note: note || `${type === 'add' ? 'Added' : 'Removed'} stock`
        });
        alert("Stock updated successfully!");
        closeModal();
    } catch (error) {
        console.error(error);
        alert("Failed to update stock.");
    } finally { hideLoading('btn-save-adj'); }
};

// --- CUSTOMERS ---
function renderCustomers(container) {
    container.innerHTML = `
        <button class="btn" style="margin-bottom:20px;" onclick="openCustomerModal()">+ Add Customer</button>
        <div class="card" id="customer-list">
            ${data.customers.length === 0 ? '<p style="color:var(--gray); text-align:center; padding:10px;">No customers found.</p>' :
              data.customers.map(c => `
                <div class="list-item" style="cursor:default;">
                    <div class="list-item-info">
                        <h4>${c.name}</h4>
                        <p>${c.phone || 'No phone'} | Debt: <span style="color:var(--danger); font-weight:bold;">${formatCurrency(c.balance || 0)}</span></p>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
                        <button class="btn btn-sm" onclick="openCustomerLedger('${c.id}')">Ledger</button>
                        <div style="display:flex; gap:5px;">
                            <button class="btn btn-sm btn-secondary" onclick="openAddDebtModal('${c.id}')">+ Debt</button>
                            <button class="btn btn-sm btn-secondary" onclick="openRecordPaymentModal('${c.id}')">Payment</button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

window.openCustomerModal = (customerId = null) => {
    const c = customerId ? data.customers.find(x => x.id === customerId) : null;
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `
        <div class="modal-header"><h2>${c ? 'Edit' : 'Add'} Customer</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Customer Name *</label><input type="text" id="c-name" value="${c ? c.name : ''}"></div>
        <div class="form-group"><label>Phone / Contact</label><input type="text" id="c-phone" value="${c ? (c.phone || '') : ''}"></div>
        <div class="form-group"><label>Notes</label><textarea id="c-notes" rows="2" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px;">${c ? (c.notes || '') : ''}</textar`,
  