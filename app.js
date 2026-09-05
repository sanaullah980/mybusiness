// app.js - The Main Hub
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, setDoc, onSnapshot, query, where, runTransaction, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1. IMPORT ALL MODULES
import { renderDashboard } from './modules/dashboard.js';
import { renderSales, showSaleTab, renderCart, updateSaleDue, addSaleItem, removeCartItem, completeNormalSale, completeManualSale, completeBulkSale } from './modules/sales.js';
import { renderInventory, openProductModal, saveProduct, deleteProduct, openStockAdjustModal, saveStockAdjustment } from './modules/inventory.js';
import { renderCustomers, openCustomerModal, saveCustomer, openCustomerLedger, openAddDebtModal, addCustomerDebt, openRecordPaymentModal, recordCustomerPayment } from './modules/customer.js';
import { renderExpenses, openExpenseModal, saveExpense, deleteExpense } from './modules/expenses.js';
import { renderStockPurchases, openStockPurchaseModal, saveStockPurchase, deleteStockPurchase } from './modules/stockPurchases.js';
import { renderReports, setReportTab, changeReportMonth, resetDailyReport, calculateReportData } from './modules/report.js';
import { renderMore, openDeleteRecordsModal, deleteCollectionData, deleteEverything } from './modules/more.js';
import { renderSettings, saveSettings, openChangePasswordModal, changePassword } from './modules/setting.js';
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
window.toggleAuthMode = () => { 
    isLoginMode = !isLoginMode; 
    document.getElementById('auth-button').innerText = isLoginMode ? 'Log In' : 'Sign Up'; 
    document.getElementById('toggle-auth').innerText = isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Log In"; 
    document.getElementById('login-error').innerText = ''; 
};

window.handleAuth = async (e) => { 
    if (e) e.preventDefault(); 
    const email = document.getElementById('login-email').value.trim(); 
    const pass = document.getElementById('login-password').value; 
    const errorDiv = document.getElementById('login-error'); 
    if (!email || !pass) { errorDiv.innerText = "Please enter both email and password."; return; } 
    showLoading('auth-button', isLoginMode ? "Logging in..." : "Creating account..."); 
    try { 
        if (isLoginMode) await signInWithEmailAndPassword(auth, email, pass); 
        else await createUserWithEmailAndPassword(auth, email, pass); 
    } catch (error) { 
        if (error.code === 'auth/email-already-in-use') errorDiv.innerText = "Email already registered."; 
        else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') errorDiv.innerText = "Invalid email or password."; 
        else errorDiv.innerText = "Authentication failed."; 
    } finally { hideLoading('auth-button'); } 
};

window.forgotPassword = async (e) => { 
    if (e) e.preventDefault(); 
    const email = document.getElementById('login-email').value.trim(); 
    if (!email) return alert("Enter email first."); 
    try { await sendPasswordResetEmail(auth, email); alert("Reset link sent!"); } 
    catch (error) { alert("If account exists, link sent."); } 
};

window.signInWithGoogle = async () => { 
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { alert("Google Sign-In failed."); } 
};

window.handleLogout = async () => { 
    if (!confirm("Log out?")) return; 
    await signOut(auth); 
};

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
    listeners.push(onSnapshot(q("products"), s => { window.data.products = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("customers"), s => { window.data.customers = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("sales"), s => { window.data.sales = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("expenses"), s => { window.data.expenses = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("stockPurchases"), s => { window.data.stockPurchases = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(q("customerTransactions"), s => { window.data.customerTransactions = s.docs.map(d => ({id: d.id, ...d.data()})); refreshCurrentView(); }));
    listeners.push(onSnapshot(doc(db, "settings", window.currentUserId), (snap) => { window.data.settings = snap.exists() ? snap.data() : {}; refreshCurrentView(); }));
}

function clearListeners() { listeners.forEach(unsub => unsub()); listeners = []; }
function refreshCurrentView() { const activeNav = document.querySelector('.nav-item.active'); if (activeNav) navigate(activeNav.dataset.page || 'dashboard'); }

// 6. NAVIGATION
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

// 7. ATTACH MODULE FUNCTIONS TO WINDOW
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