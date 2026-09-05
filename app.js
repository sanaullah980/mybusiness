// app.js - The Main Hub
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, setDoc, onSnapshot, query, where, runTransaction, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1. IMPORT ALL MODULES
import { renderDashboard } from './modules/dashboard.js';
import { renderSales, showSaleTab, renderCart, updateSaleDue, addSaleItem, removeCartItem, completeNormalSale, completeManualSale, completeBulkSale } from './modules/sales.js';
import { renderInventory, openProductModal, saveProduct, deleteProduct, openStockAdjustModal, saveStockAdjustment } from './modules/inventory.js';
import { renderCustomers, openCustomerModal, saveCustomer, openCustomerLedger, openAddDebtModal, addCustomerDebt, openRecordPaymentModal, recordCustomerPayment } from './modules/customers.js';
import { renderExpenses, openExpenseModal, saveExpense, deleteExpense } from './modules/expenses.js';
import { renderStockPurchases, openStockPurchaseModal, saveStockPurchase, deleteStockPurchase } from './modules/stockPurchases.js';
import { renderReports, setReportTab, changeReportMonth, resetDailyReport, calculateReportData } from './modules/reports.js';
import { renderMore, openDeleteRecordsModal, deleteCollectionData, deleteEverything } from './modules/more.js';
import { renderSettings, saveSettings, openChangePasswordModal, changePassword } from './modules/settings.js';
import { closeModal, viewSaleDetail } from './modules/modals.js';

// 2. FIREBASE SETUP
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

// 3. GLOBAL STATE & UTILITIES
let currentUserId = null;
let isLoginMode = true;
let data = { products: [], customers: [], sales: [], expenses: [], stockPurchases: [], customerTransactions: [], settings: {} };
let listeners = [];
let cart = [];
let activeReportTab = 'daily';
let currentReportMonth = new Date();

// Expose to window so modules can access them
window.data = data;
window.cart = cart;
window.db = db;
window.auth = auth;
window.activeReportTab = activeReportTab;
window.currentReportMonth = currentReportMonth;

function formatCurrency(amount) { if (amount === null || amount === undefined || isNaN(amount)) return "Unknown"; return "Rs. " + Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function getStartOfDay(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function getEndOfDay(date) { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; }
function getStartOfMonth(date) { const d = new Date(date); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }
function getEndOfMonth(date) { const d = new Date(date); d.setMonth(d.getMonth() + 1); d.setDate(0); d.setHours(23, 59, 59, 999); return d; }
function getLocalDateStr(dateInput) { const d = new Date(dateInput); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function showLoading(btnId, text) { const btn = document.getElementById(btnId); if (btn) { btn.disabled = true; btn.dataset.originalText = btn.innerText; btn.innerText = text || "Processing..."; } }
function hideLoading(btnId) { const btn = document.getElementById(btnId); if (btn) { btn.disabled = false; btn.innerText = btn.dataset.originalText || "Submit"; } }

window.formatCurrency = formatCurrency;
window.getStartOfDay = getStartOfDay;
window.getEndOfDay = getEndOfDay;
window.getStartOfMonth = getStartOfMonth;
window.getEndOfMonth = getEndOfMonth;
window.getLocalDateStr = getLocalDateStr;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.calculateReportData = calculateReportData;

// 4. AUTHENTICATION
window.toggleAuthMode = () => { isLoginMode = !isLoginMode; document.getElementById('auth-button').innerText = isLoginMode ? 'Log In' : 'Sign Up'; document.getElementById('toggle-auth').innerText = isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Log In"; document.getElementById('login-error').innerText = ''; };
window.handleAuth = async (e) => { if (e) e.preventDefault(); const email = document.getElementById('login-email').value.trim(); const pass = document.getElementById('login-password').value; const errorDiv = document.getElementById('login-error'); if (!email || !pass) { errorDiv.innerText = "Please enter both email and password."; return; } showLoading('auth-button', isLoginMode ? "Logging in..." : "Creating account..."); try { if (isLoginMode) await signInWithEmailAndPassword(auth, email, pass); else await createUserWithEmailAndPassword(auth, email, pass); } catch (error) { if (error.code === 'auth/email-already-in-use') errorDiv.innerText = "Email already registered."; else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') errorDiv.innerText = "Invalid email or password."; else errorDiv.innerText = "Authentication failed."; } finally { hideLoading('auth-button'); } };
window.forgotPassword = async (e) => { if (e) e.preventDefault(); const email = document.getElementById('login-email').value.trim(); if (!email) return alert("Enter email first."); try { await sendPasswordResetEmail(auth, email); alert("Reset link sent!"); } catch (error) { alert("If account exists, link sent."); } };
window.signInWithGoogle = async () => { try { await signInWithPopup(auth, googleProvider); } catch (error) { alert("Google Sign-In failed."); } };
window.handleLogout = async () => { if (!confirm("Log out?")) return; await signOut(auth); };

onAuthStateChanged(auth, (user) => {
    document.getElementById('auth-loading').classList.add('hidden');
    window.currentUserId = user ? user.uid : null;
    if (user) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        startListeners();
        navigate('dashboard');
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        clearListeners();
        window.data = { products: [], customers: [], sales: [], expenses: [], stockPurchases: [], customerTransactions: [], settings: {} };
    }
});

// 5. DATA LISTENERS
function startListeners() {
    clearListeners();
    const q = (col) => query(collection(db, col), where("ownerId", "==", window.currentUserId));
    listeners.push(onSnapshot(q("products"), s => { window.data.products = s.docs.map(d => ({ id: d.id, ...d.data() })); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("customers"), s => { window.data.customers = s.docs.map(d => ({ id: d.id, ...d.data() })); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("sales"), s => { window.data.sales = s.docs.map(d => ({ id: d.id, ...d.data() })); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("expenses"), s => { window.data.expenses = s.docs.map(d => ({ id: d.id, ...d.data() })); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("stockPurchases"), s => { window.data.stockPurchases = s.docs.map(d => ({ id: d.id, ...d.data() })); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("customerTransactions"), s => { window.data.customerTransactions = s.docs.map(d => ({ id: d.id, ...d.data() })); refreshCurrentView(); }));
    listeners.push(onSnapshot(doc(db, "settings", window.currentUserId), (snap) => { window.data.settings = snap.exists() ? snap.data() : {}; refreshCurrentView(); }));
}
function clearListeners() { listeners.forEach(unsub => unsub()); listeners = []; }
function refreshCurrentView() { const activeNav = document.querySelector('.nav-item.active'); if (activeNav) navigate(activeNav.dataset.page || 'dashboard'); }

// 6. NAVIGATION
window.navigate = (page) => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (btn) btn.classList.add('active');
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
// --- NEW PRODUCT SELECTION MODAL FUNCTIONS ---
window.openProductSelectionModal = () => {
    const modal = document.getElementById('modal-body');
    const productsListHtml = data.products.map(p => `
        <div class="product-select-item-wrapper" data-name="${p.name.toLowerCase()}" style="border-bottom:1px solid #eee;">
            <div class="product-select-item" onclick="toggleProductRow('${p.id}')" style="display:flex; align-items:center; padding:15px 10px; cursor:pointer;">
                <input type="checkbox" id="chk-${p.id}" style="margin-right:15px; transform: scale(1.5); pointer-events: none;">
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:16px;">${p.name}</div>
                    <div style="font-size:13px; color:var(--gray);">Stock: ${p.stock} | Price: ${formatCurrency(p.price)}</div>
                </div>
                <i class="fas fa-chevron-right" style="color:var(--gray);"></i>
            </div>
            <div id="qty-container-${p.id}" class="hidden" style="padding:10px 15px 15px 45px; background:#f8f9fa;">
                <label style="font-size:14px; font-weight:bold; color:var(--dark);">Quantity:</label>
                <input type="number" id="qty-${p.id}" value="1" min="1" max="${p.stock}" style="width:100px; padding:8px; margin-left:10px; border:1px solid #ddd; border-radius:4px; font-size:16px;">
            </div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="modal-header">
            <h2>Select Products</h2>
            <button class="close-btn" onclick="closeModal()">&times;</button>
        </div>
        <div class="form-group" style="position:sticky; top:0; background:white; padding-bottom:10px; z-index:10;">
            <input type="text" id="product-search" placeholder="Search products..." style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; font-size:16px;" oninput="filterProductSelectionList()">
        </div>
        <div id="product-selection-list" style="max-height: 50vh; overflow-y: auto;">
            ${productsListHtml.length > 0 ? productsListHtml : '<p style="text-align:center; padding:20px; color:var(--gray);">No products found. Add products in Inventory first.</p>'}
        </div>
        <div style="margin-top: 15px;">
            <button class="btn" onclick="addSelectedProductsToCart()">Add Selected to Cart</button>
        </div>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
};

window.toggleProductRow = (id) => {
    const checkbox = document.getElementById(`chk-${id}`);
    checkbox.checked = !checkbox.checked;
    const qtyContainer = document.getElementById(`qty-container-${id}`);
    if (checkbox.checked) {
        qtyContainer.classList.remove('hidden');
        setTimeout(() => document.getElementById(`qty-${id}`).focus(), 10);
    } else {
        qtyContainer.classList.add('hidden');
    }
};

window.filterProductSelectionList = () => {
    const searchTerm = document.getElementById('product-search').value.toLowerCase();
    const items = document.querySelectorAll('.product-select-item-wrapper');
    items.forEach(wrapper => {
        const name = wrapper.dataset.name;
        if (name.includes(searchTerm)) {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
        }
    });
};

window.addSelectedProductsToCart = () => {
    let addedCount = 0;
    let errorMessage = "";

    data.products.forEach(p => {
        const checkbox = document.getElementById(`chk-${p.id}`);
        if (checkbox && checkbox.checked) {
            const qtyInput = document.getElementById(`qty-${p.id}`);
            const qty = parseInt(qtyInput.value);

            if (!qty || qty < 1) {
                errorMessage += `Please enter a valid quantity for ${p.name}.\n`;
                return;
            }
            if (qty > p.stock) {
                errorMessage += `Not enough stock for ${p.name}! Available: ${p.stock}\n`;
                return;
            }

            const existing = cart.find(i => i.id === p.id);
            if (existing) {
                if (existing.qty + qty > p.stock) {
                    errorMessage += `Not enough stock for ${p.name}! Cart already has ${existing.qty}, available: ${p.stock}\n`;
                    return;
                }
                existing.qty += qty;
            } else {
                const item = { id: p.id, name: p.name, price: p.price, cost: p.cost, qty: qty };
                cart.push(item);
            }
            addedCount++;

            // Reset the selection UI
            checkbox.checked = false;
            document.getElementById(`qty-container-${p.id}`).classList.add('hidden');
            qtyInput.value = 1;
        }
    });

    if (errorMessage) {
        alert(errorMessage);
    } else if (addedCount > 0) {
        renderCart();
        closeModal();
    } else {
        alert("Please select at least one product.");
    }
};
// 7. ATTACH MODULE FUNCTIONS TO WINDOW (So HTML onclick works)
window.renderDashboard = renderDashboard;
window.renderSales = renderSales; window.showSaleTab = showSaleTab; window.renderCart = renderCart; window.updateSaleDue = updateSaleDue; window.addSaleItem = addSaleItem; window.removeCartItem = removeCartItem; window.completeNormalSale = completeNormalSale; window.completeManualSale = completeManualSale; window.completeBulkSale = completeBulkSale;
window.renderInventory = renderInventory; window.openProductModal = openProductModal; window.saveProduct = saveProduct; window.deleteProduct = deleteProduct; window.openStockAdjustModal = openStockAdjustModal; window.saveStockAdjustment = saveStockAdjustment;
window.renderCustomers = renderCustomers; window.openCustomerModal = openCustomerModal; window.saveCustomer = saveCustomer; window.openCustomerLedger = openCustomerLedger; window.openAddDebtModal = openAddDebtModal; window.addCustomerDebt = addCustomerDebt; window.openRecordPaymentModal = openRecordPaymentModal; window.recordCustomerPayment = recordCustomerPayment;
window.renderExpenses = renderExpenses; window.openExpenseModal = openExpenseModal; window.saveExpense = saveExpense; window.deleteExpense = deleteExpense;
window.renderStockPurchases = renderStockPurchases; window.openStockPurchaseModal = openStockPurchaseModal; window.saveStockPurchase = saveStockPurchase; window.deleteStockPurchase = deleteStockPurchase;
window.renderReports = renderReports; window.setReportTab = setReportTab; window.changeReportMonth = changeReportMonth; window.resetDailyReport = resetDailyReport;
window.renderMore = renderMore; window.openDeleteRecordsModal = openDeleteRecordsModal; window.deleteCollectionData = deleteCollectionData; window.deleteEverything = deleteEverything;
window.renderSettings = renderSettings; window.saveSettings = saveSettings; window.openChangePasswordModal = openChangePasswordModal; window.changePassword = changePassword;
window.closeModal = closeModal; window.viewSaleDetail = viewSaleDetail;