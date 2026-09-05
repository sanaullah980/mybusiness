// Firebase imports
import { 
    collection, 
    query, 
    where, 
    onSnapshot,
    doc,
    updateDoc,
    addDoc,
    deleteDoc,
    runTransaction
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Import all modules
import { renderDashboard } from './modules/dashboard.js';
import { renderCustomers } from './modules/customers.js';
import { renderSales } from './modules/sales.js';
import { renderInventory } from './modules/inventory.js';
import { renderMore } from './modules/more.js';
import { renderSettings } from './modules/setting.js';
import { renderExpenses } from './modules/expenses.js';
import { renderReport } from './modules/report.js';

// Initialize global data object
window.data = {
    sales: [],
    products: [],
    customers: [],
    customerTransactions: [],
    expenses: [],
    stockPurchases: [],
    userSettings: { businessName: '', currency: 'Rs.' }
};

// Utility functions
window.formatCurrency = (amount) => {
    const currency = window.data.userSettings?.currency || 'Rs.';
    return `${currency} ${(amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

window.getStartOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

window.getEndOfDay = (date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

window.calculateReportData = (startDate, endDate) => {
    const salesInRange = window.data.sales.filter(s => {
        const saleDate = new Date(s.date);
        return saleDate >= startDate && saleDate <= endDate;
    });

    const totalSales = salesInRange.reduce((sum, s) => sum + (s.total || 0), 0);
    const knownProfit = salesInRange
        .filter(s => s.profitKnown)
        .reduce((sum, s) => sum + ((s.total || 0) - (s.cost || 0)), 0);
    
    const totalExpenses = window.data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalSales - totalExpenses;
    
    const outstandingDebt = window.data.customers.reduce((sum, c) => sum + (c.balance || 0), 0);

    return { totalSales, knownProfit, netProfit, outstandingDebt };
};

// Navigation and page rendering
window.currentPage = 'dashboard';

window.navigate = (page) => {
    window.currentPage = page;
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === page) {
            item.classList.add('active');
        }
    });

    // Render page content
    const container = document.getElementById('app-content');
    container.innerHTML = '';

    try {
        switch (page) {
            case 'dashboard':
                document.getElementById('header-title').textContent = 'Dashboard';
                renderDashboard(container);
                break;
            case 'customers':
                document.getElementById('header-title').textContent = 'Customers';
                renderCustomers(container);
                break;
            case 'sales':
                document.getElementById('header-title').textContent = 'Sales';
                renderSales(container);
                break;
            case 'inventory':
                document.getElementById('header-title').textContent = 'Inventory';
                renderInventory(container);
                break;
            case 'expenses':
                document.getElementById('header-title').textContent = 'Expenses';
                renderExpenses(container);
                break;
            case 'reports':
                document.getElementById('header-title').textContent = 'Reports';
                renderReport(container);
                break;
            case 'more':
                document.getElementById('header-title').textContent = 'More';
                renderMore(container);
                break;
            case 'settings':
                document.getElementById('header-title').textContent = 'Settings';
                renderSettings(container);
                break;
            default:
                renderDashboard(container);
        }
    } catch (error) {
        console.error('Error rendering page:', error);
        container.innerHTML = '<div class="card"><p style="color: var(--danger);">Error loading page. Check console.</p></div>';
    }
};

// Modal functions
window.closeModal = (event) => {
    if (event && event.target.id !== 'modal-overlay') return;
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
};

// Real-time data listeners
function setupDataListeners() {
    if (!window.auth || !window.currentUserId) {
        console.error('Auth not initialized');
        return;
    }

    console.log('[app] Setting up real-time listeners for user:', window.currentUserId);

    // Listen to sales
    const salesQuery = query(collection(window.db, 'sales'), where('ownerId', '==', window.currentUserId));
    onSnapshot(salesQuery, (snapshot) => {
        window.data.sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[app] Sales updated:', window.data.sales.length);
        if (window.currentPage === 'dashboard' || window.currentPage === 'sales' || window.currentPage === 'reports') {
            window.navigate(window.currentPage);
        }
    }, (error) => console.error('Sales listener error:', error));

    // Listen to products
    const productsQuery = query(collection(window.db, 'products'), where('ownerId', '==', window.currentUserId));
    onSnapshot(productsQuery, (snapshot) => {
        window.data.products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[app] Products updated:', window.data.products.length);
        if (window.currentPage === 'inventory') {
            window.navigate(window.currentPage);
        }
    }, (error) => console.error('Products listener error:', error));

    // Listen to customers
    const customersQuery = query(collection(window.db, 'customers'), where('ownerId', '==', window.currentUserId));
    onSnapshot(customersQuery, (snapshot) => {
        window.data.customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[app] Customers updated:', window.data.customers.length);
        if (window.currentPage === 'customers' || window.currentPage === 'dashboard') {
            window.navigate(window.currentPage);
        }
    }, (error) => console.error('Customers listener error:', error));

    // Listen to customer transactions
    const txnsQuery = query(collection(window.db, 'customerTransactions'), where('ownerId', '==', window.currentUserId));
    onSnapshot(txnsQuery, (snapshot) => {
        window.data.customerTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[app] Transactions updated:', window.data.customerTransactions.length);
    }, (error) => console.error('Transactions listener error:', error));

    // Listen to expenses
    const expensesQuery = query(collection(window.db, 'expenses'), where('ownerId', '==', window.currentUserId));
    onSnapshot(expensesQuery, (snapshot) => {
        window.data.expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[app] Expenses updated:', window.data.expenses.length);
        if (window.currentPage === 'expenses' || window.currentPage === 'dashboard' || window.currentPage === 'reports') {
            window.navigate(window.currentPage);
        }
    }, (error) => console.error('Expenses listener error:', error));

    // Listen to stock purchases
    const stockQuery = query(collection(window.db, 'stockPurchases'), where('ownerId', '==', window.currentUserId));
    onSnapshot(stockQuery, (snapshot) => {
        window.data.stockPurchases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('[app] Stock purchases updated:', window.data.stockPurchases.length);
    }, (error) => console.error('Stock purchases listener error:', error));

    // Listen to user settings
    const userSettingsRef = doc(window.db, 'users', window.currentUserId);
    onSnapshot(userSettingsRef, (doc) => {
        if (doc.exists()) {
            window.data.userSettings = doc.data();
            console.log('[app] Settings updated');
        }
    }, (error) => console.error('Settings listener error:', error));
}

// Main initialization function
export function initializeApp() {
    console.log('[app] Initializing application for user:', window.currentUserId);
    
    if (!window.currentUserId) {
        console.error('[app] No user ID available');
        return;
    }

    try {
        // Setup real-time data listeners
        setupDataListeners();

        // Load initial page
        window.navigate('dashboard');

        console.log('[app] Application initialized successfully');
    } catch (error) {
        console.error('[app] Initialization error:', error);
        alert('Error initializing app. Check console.');
    }
}

// Make functions globally available
window.initializeApp = initializeApp;
window.navigate = window.navigate;
window.closeModal = window.closeModal;

console.log('[app.js] Module loaded and ready');
