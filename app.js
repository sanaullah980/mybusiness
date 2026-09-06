import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, setDoc, onSnapshot, query, where, runTransaction, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { renderDashboard } from './modules/dashboard.js';
import { renderSales, showSaleTab, renderCart, updateSaleDue, addSaleItem, removeCartItem, completeNormalSale, completeManualSale, completeBulkSale, openProductSelectionModal, toggleProductRow, filterProductSelectionList, addSelectedProductsToCart, addProductByBarcode } from './modules/sales.js';
import { renderInventory, openProductModal, saveProduct, deleteProduct, openStockAdjustModal, saveStockAdjustment } from './modules/inventory.js';
import { renderCustomers, openCustomerModal, saveCustomer, openCustomerDetails, renderCustomerLedgerTable, downloadCustomerStatementPdf, sendPaymentReminder, openGiveModal, processGive, openReceiveModal, processReceive } from './modules/customers.js';
import { renderExpenses, openExpenseModal, saveExpense, deleteExpense } from './modules/expenses.js';
import { renderStockPurchases, openStockPurchaseModal, showStockPurchaseTab, onStockPurchaseProductChange, saveStockPurchase, deleteStockPurchase } from './modules/stockPurchases.js';
import { renderReports, setReportTab, changeReportMonth, resetDailyReport, calculateReportData } from './modules/report.js';
import { renderMore, openDeleteRecordsModal, deleteCollectionData, deleteEverything } from './modules/more.js';
import { renderSettings, saveSettings, selectTheme, toggleDarkMode, openChangePasswordModal, changePassword } from './modules/setting.js';
import { closeModal, viewSaleDetail } from './modules/modals.js';
import { renderSuppliers, openSupplierModal, saveSupplier, deleteSupplier, openSupplierDetails, openSupplierPayModal, processSupplierPayment, openSupplierDebtModal, processSupplierDebt } from './modules/suppliers.js';
import { renderCashBook, buildCashBookEntries, openSetOpeningBalanceModal, saveOpeningBalance, openCashEntryModal, saveCashEntry } from './modules/cashbook.js';
import { openGlobalSearchModal, runGlobalSearch } from './modules/search.js';
import { openInvoiceModal, downloadInvoicePdf, printInvoice, shareInvoiceWhatsApp } from './modules/invoices.js';
import { openReturnModal, processReturn } from './modules/returns.js';
import { renderStaff, openStaffModal, saveStaff, deleteStaff, openAttendanceModal, saveAttendance } from './modules/staff.js';
import { renderReminders, openReminderModal, saveReminder, completeReminder, deleteReminder } from './modules/reminders.js';
import { renderBusinessCard, saveBusinessCard, shareBusinessCard } from './modules/business.js';
import { renderBackup, exportBusinessBackup, importBusinessBackup } from './modules/backup.js';
import { renderAppLock, saveAppLock, removeAppLock, checkAppLock } from './modules/appLock.js';

const firebaseConfig = {
    apiKey: "AIzaSyBQqnIhMCGd4_FRApjkns3HjIrqw2V1qFc",
    authDomain: "mybusinessapp-4734c.firebaseapp.com",
    projectId: "mybusinessapp-4734c",
    storageBucket: "mybusinessapp-4734c.firebasestorage.app",
    messagingSenderId: "367002926256",
    appId: "1:367002926256:web:0b5139dab24d901d9c8f75",
    measurementId: "G-HBC31ZFKMG"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
let db;
try {
    db = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
} catch (error) {
    console.warn('Persistent Firestore cache unavailable; using default Firestore.', error);
    db = getFirestore(firebaseApp);
}
const googleProvider = new GoogleAuthProvider();
setPersistence(auth, browserLocalPersistence).catch(error => console.warn('Auth persistence setup failed:', error));

const COLLECTIONS = ['products','customers','sales','expenses','stockPurchases','customerTransactions','stockAdjustments','suppliers','supplierTransactions','cashTransactions','salesReturns','staff','attendance','reminders'];
let currentUserId = null;
let isLoginMode = true;
let data = Object.fromEntries(COLLECTIONS.map(name => [name, []]));
data.settings = {};
let listeners = [];
let cart = [];
let activeReportTab = 'daily';
let currentReportMonth = new Date();
let currentPage = 'dashboard';
let authResolved = false;
let syncPending = false;
let pendingSources = new Set();

Object.assign(window, { data, cart, db, auth, activeReportTab, currentReportMonth, currentUserId: null });
window.doc = doc; window.collection = collection; window.updateDoc = updateDoc; window.addDoc = addDoc;
window.runTransaction = runTransaction; window.deleteDoc = deleteDoc; window.setDoc = setDoc;
window.query = query; window.where = where; window.getDocs = getDocs; window.writeBatch = writeBatch;
window.EmailAuthProvider = EmailAuthProvider; window.reauthenticateWithCredential = reauthenticateWithCredential; window.updatePassword = updatePassword;

// Atomic writes normally use Firestore transactions. Transactions require a live
// connection, so MyBusiness provides a safe offline fallback using the locally
// cached data + a Firestore batch. This keeps the app usable without internet;
// when online again, queued writes synchronize automatically.
function offlineDocSnapshot(ref) {
    const parts = String(ref?.path || '').split('/');
    const collectionName = parts[0]; const id = parts[1];
    const item = (data[collectionName] || []).find(x => x.id === id);
    return { exists: () => !!item, data: () => item ? { ...item } : undefined };
}
async function runAtomicOrOffline(work) {
    try {
        return await runTransaction(db, work);
    } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        const offlineError = !navigator.onLine || ['unavailable','failed-precondition','deadline-exceeded'].includes(error?.code) || message.includes('offline') || message.includes('network');
        if (!offlineError) throw error;
        console.warn('Firestore transaction unavailable; using offline batch fallback.', error);
        const batch = writeBatch(db);
        const fakeTransaction = {
            get: async ref => offlineDocSnapshot(ref),
            set: (ref, value, options) => batch.set(ref, value, options),
            update: (ref, value) => batch.update(ref, value),
            delete: ref => batch.delete(ref)
        };
        await work(fakeTransaction);
        await batch.commit();
        return undefined;
    }
}
window.runAtomicOrOffline = runAtomicOrOffline;

function formatCurrency(amount) {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return 'Rs. 0';
    return 'Rs. ' + Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function getStartOfDay(date) { const d = new Date(date); d.setHours(0,0,0,0); return d; }
function getEndOfDay(date) { const d = new Date(date); d.setHours(23,59,59,999); return d; }
function getStartOfMonth(date) { const d = new Date(date); d.setDate(1); d.setHours(0,0,0,0); return d; }
function getEndOfMonth(date) { const d = new Date(date); d.setMonth(d.getMonth()+1,0); d.setHours(23,59,59,999); return d; }
function getLocalDateStr(dateInput) { const d = new Date(dateInput); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function showLoading(btnId, text='Processing...') { const btn=document.getElementById(btnId); if(btn){btn.disabled=true;btn.dataset.originalText=btn.dataset.originalText||btn.innerText;btn.innerText=text;} }
function hideLoading(btnId) { const btn=document.getElementById(btnId); if(btn){btn.disabled=false;btn.innerText=btn.dataset.originalText||'Submit';} }
Object.assign(window,{formatCurrency,getStartOfDay,getEndOfDay,getStartOfMonth,getEndOfMonth,getLocalDateStr,showLoading,hideLoading,calculateReportData});

const THEME_KEY='mybusiness-theme'; const DARK_KEY='mybusiness-dark';
function applyTheme(theme=localStorage.getItem(THEME_KEY)||'teal', dark=localStorage.getItem(DARK_KEY)==='1') {
    const safe=['teal','orange','blue','purple','rose'].includes(theme)?theme:'teal';
    document.documentElement.dataset.theme=safe;
    document.documentElement.classList.toggle('dark-mode',!!dark);
    localStorage.setItem(THEME_KEY,safe); localStorage.setItem(DARK_KEY,dark?'1':'0');
    window.currentTheme=safe; window.darkMode=!!dark;
}
function saveLocalPreferences(theme,dark){
    applyTheme(theme,dark);
    if(currentUserId) setDoc(doc(db,'settings',currentUserId),{theme,darkMode:!!dark,ownerId:currentUserId},{merge:true}).catch(e=>console.warn('Preference sync failed:',e));
}
function applyStoredOrCloudTheme(){
    const theme=data.settings?.theme||localStorage.getItem(THEME_KEY)||'teal';
    const dark=data.settings?.darkMode ?? (localStorage.getItem(DARK_KEY)==='1');
    applyTheme(theme,dark);
}
Object.assign(window,{applyTheme,saveLocalPreferences});
applyTheme();

function updateConnectionIndicator(extra={}) {
    const el=document.getElementById('connection-indicator'); const text=document.getElementById('connection-text');
    if(!el) return;
    const offline=!navigator.onLine;
    el.classList.toggle('offline',offline); el.classList.toggle('online',!offline);
    let label=offline?'Offline':(syncPending?'Syncing':'Online');
    el.setAttribute('aria-label',label);
    el.title=offline?'Offline — cached data is available and Firestore will retry pending writes when connected.':(syncPending?'Changes are syncing.':'Online and synced.');
    el.innerHTML=offline?'<i class="fas fa-cloud"></i>':(syncPending?'<i class="fas fa-rotate"></i>':'<i class="fas fa-wifi"></i>');
    if(text) text.textContent=label;
    const banner=document.getElementById('offline-banner');
    if(banner){banner.classList.toggle('hidden',!offline); banner.querySelector('span').textContent=offline?'Offline mode — cached data remains available. New changes will be queued and synchronized when you reconnect.':'Online — changes are synchronized automatically.';}
}
window.updateConnectionIndicator=updateConnectionIndicator;
window.addEventListener('online',()=>updateConnectionIndicator()); window.addEventListener('offline',()=>updateConnectionIndicator());

window.toggleAuthMode=()=>{
    isLoginMode=!isLoginMode;
    document.getElementById('auth-button').innerText=isLoginMode?'Log In':'Sign Up';
    document.getElementById('toggle-auth').innerText=isLoginMode?"Don't have an account? Sign Up":"Already have an account? Log In";
    document.getElementById('login-error').innerText='';
};
window.handleAuth=async(e)=>{
    if(e)e.preventDefault();
    const email=document.getElementById('login-email').value.trim(); const pass=document.getElementById('login-password').value; const errorDiv=document.getElementById('login-error');
    if(!email||!pass){errorDiv.innerText='Please enter both email and password.';return;}
    showLoading('auth-button',isLoginMode?'Logging in...':'Creating account...');
    try { if(isLoginMode) await signInWithEmailAndPassword(auth,email,pass); else await createUserWithEmailAndPassword(auth,email,pass); }
    catch(error){
        console.error('Authentication error:',error);
        const messages={'auth/invalid-api-key':'Firebase configuration is invalid.','auth/api-key-not-valid':'Firebase configuration is invalid.','auth/invalid-credential':'Invalid email or password.','auth/wrong-password':'Invalid email or password.','auth/user-not-found':'Invalid email or password.','auth/email-already-in-use':'Email already registered.','auth/weak-password':'Password must be at least 6 characters.','auth/invalid-email':'Enter a valid email address.','auth/too-many-requests':'Too many attempts. Please try again later.','auth/network-request-failed':'Network unavailable. Check your connection and try again.'};
        errorDiv.innerText=messages[error.code]||error.message||'Authentication failed.';
    } finally { hideLoading('auth-button'); }
};
window.forgotPassword=async(e)=>{
    if(e)e.preventDefault(); const email=document.getElementById('login-email').value.trim(); if(!email)return alert('Enter your email first.');
    try{await sendPasswordResetEmail(auth,email);alert('Password reset link sent.');}catch(error){console.error(error);alert('Unable to send the reset link. Check the email and your connection.');}
};
window.signInWithGoogle=async()=>{
    try{await signInWithPopup(auth,googleProvider);}
    catch(error){console.error('Google Sign-In error:',error); if(error.code==='auth/popup-closed-by-user')return; if(error.code==='auth/unauthorized-domain')alert('This website domain is not authorized in Firebase Authentication.'); else if(error.code==='auth/popup-blocked')alert('Your browser blocked the Google sign-in popup. Allow popups and try again.'); else alert(error.message||'Google Sign-In failed.');}
};
window.handleLogout=async()=>{if(!confirm('Log out?'))return;try{await signOut(auth);}catch(e){console.error(e);alert('Could not log out. Please try again.');}};

function clearListeners(){listeners.forEach(unsub=>{try{unsub();}catch(_){}});listeners=[];}
function resetData(){data=Object.fromEntries(COLLECTIONS.map(name=>[name,[]]));data.settings={};window.data=data;}
function setAuthVisibility(user){
    const loading=document.getElementById('auth-loading'); const authScreen=document.getElementById('auth-screen'); const main=document.getElementById('main-app');
    if(loading) loading.classList.add('hidden');
    if(user){authScreen?.classList.add('hidden');main?.classList.remove('hidden');}
    else{main?.classList.add('hidden');authScreen?.classList.remove('hidden');}
}
function handleListenerSnapshot(name,snapshot){
    data[name]=snapshot.docs.map(d=>({id:d.id,...d.data()}));
    window.data=data;
    if(snapshot.docs.some(d=>d.metadata.hasPendingWrites)) pendingSources.add(name); else pendingSources.delete(name);
    syncPending=pendingSources.size>0;
    updateConnectionIndicator();
    if(currentPage==='dashboard') renderDashboard(document.getElementById('app-content'));
    if(currentPage==='customers') renderCustomers(document.getElementById('app-content'));
    if(currentPage==='inventory') renderInventory(document.getElementById('app-content'));
}
function startDataListeners(uid){
    clearListeners(); resetData(); currentUserId=uid; window.currentUserId=uid; window.data=data;
    syncPending=false;
    pendingSources.clear();
    for(const name of COLLECTIONS){
        const q=query(collection(db,name),where('ownerId','==',uid));
        const unsub=onSnapshot(q,snapshot=>handleListenerSnapshot(name,snapshot),error=>{
            console.error(`Firestore listener failed for ${name}:`,error);
            if(error.code==='permission-denied') console.warn(`Firestore rules denied access to ${name}. Deploy firestore.rules if needed.`);
        });
        listeners.push(unsub);
    }
    const settingsRef=doc(db,'settings',uid);
    listeners.push(onSnapshot(settingsRef,snapshot=>{
        data.settings=snapshot.exists()?snapshot.data():{}; window.data=data; applyStoredOrCloudTheme();
        if(currentPage==='settings') renderSettings(document.getElementById('app-content'));
    },error=>console.warn('Settings listener failed:',error)));
    updateConnectionIndicator();
}

window.navigate=(page)=>{
    currentPage=page;
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    const content=document.getElementById('app-content'); if(!content)return;
    const title=document.getElementById('header-title'); const subtitle=document.getElementById('header-subtitle');
    const meta={dashboard:['Dashboard','Today at a glance'],sales:['New Sale','Record a sale quickly'],inventory:['Inventory','Products & stock'],customers:['Khata','Customers & balances'],more:['More','Tools & business settings'],expenses:['Expenses','Track business spending'],stockPurchases:['Purchases','Stock coming in'],reports:['Reports','Understand your business'],settings:['Settings','Personalize MyBusiness'],suppliers:['Suppliers','Supplier balances'],cashbook:['Cash Book','Money in & out'],staff:['Staff Book','Team & attendance'],reminders:['Reminders','Follow up payments'],businessCard:['Business Card','Share your business'],backup:['Backup & Restore','Keep your data safe'],appLock:['App Lock','Protect the app']};
    const m=meta[page]||[page,'']; if(title)title.innerText=m[0]; if(subtitle)subtitle.innerText=m[1];
    const renderers={dashboard:renderDashboard,sales:renderSales,inventory:renderInventory,customers:renderCustomers,more:renderMore,expenses:renderExpenses,stockPurchases:renderStockPurchases,reports:renderReports,settings:renderSettings,suppliers:renderSuppliers,cashbook:renderCashBook,staff:renderStaff,reminders:renderReminders,businessCard:renderBusinessCard,backup:renderBackup,appLock:renderAppLock};
    if(renderers[page]) renderers[page](content);
    updateConnectionIndicator();
};

Object.assign(window,{
    renderDashboard,renderSales,showSaleTab,renderCart,updateSaleDue,addSaleItem,removeCartItem,completeNormalSale,completeManualSale,completeBulkSale,openProductSelectionModal,toggleProductRow,filterProductSelectionList,addSelectedProductsToCart,
    renderInventory,openProductModal,saveProduct,deleteProduct,openStockAdjustModal,saveStockAdjustment,
    renderCustomers,openCustomerModal,saveCustomer,openCustomerDetails,renderCustomerLedgerTable,downloadCustomerStatementPdf,sendPaymentReminder,openGiveModal,processGive,openReceiveModal,processReceive,
    renderExpenses,openExpenseModal,saveExpense,deleteExpense,renderStockPurchases,openStockPurchaseModal,showStockPurchaseTab,onStockPurchaseProductChange,saveStockPurchase,deleteStockPurchase,
    renderReports,setReportTab,changeReportMonth,resetDailyReport,renderMore,openDeleteRecordsModal,deleteCollectionData,deleteEverything,
    renderSettings,saveSettings,selectTheme,toggleDarkMode,openChangePasswordModal,changePassword,closeModal,viewSaleDetail,
    renderSuppliers,openSupplierModal,saveSupplier,deleteSupplier,openSupplierDetails,openSupplierPayModal,processSupplierPayment,openSupplierDebtModal,processSupplierDebt,
    renderCashBook,buildCashBookEntries,openSetOpeningBalanceModal,saveOpeningBalance,openCashEntryModal,saveCashEntry,openGlobalSearchModal,runGlobalSearch,addProductByBarcode,
    openInvoiceModal,downloadInvoicePdf,printInvoice,shareInvoiceWhatsApp,openReturnModal,processReturn,
    renderStaff,openStaffModal,saveStaff,deleteStaff,openAttendanceModal,saveAttendance,renderReminders,openReminderModal,saveReminder,completeReminder,deleteReminder,
    renderBusinessCard,saveBusinessCard,shareBusinessCard,renderBackup,exportBusinessBackup,importBusinessBackup,renderAppLock,saveAppLock,removeAppLock,checkAppLock
});

// Firebase Auth is the single source of truth for whether the app is ready.
// The listener also fires after a refresh, so the app does not get stuck on the loading screen.
onAuthStateChanged(auth, async user=>{
    authResolved=true;
    if(!user){
        clearListeners(); currentUserId=null; window.currentUserId=null; resetData(); setAuthVisibility(null); updateConnectionIndicator(); return;
    }
    currentUserId=user.uid; window.currentUserId=user.uid;
    setAuthVisibility(user);
    try{
        startDataListeners(user.uid);
        applyStoredOrCloudTheme();
        window.navigate('dashboard');
        setTimeout(()=>checkAppLock().catch?.(()=>{}),100);
    }catch(error){
        console.error('App initialization failed:',error);
        const err=document.getElementById('login-error'); if(err)err.textContent='The app could not initialize. Please refresh.';
        setAuthVisibility(null);
    }
});

// Last-resort recovery: a broken network/module should never leave the user staring
// at an infinite "Checking authentication..." screen.
setTimeout(()=>{
    if(!authResolved){
        console.warn('Authentication state did not resolve within 12 seconds.');
        const loading=document.getElementById('auth-loading'); const screen=document.getElementById('auth-screen'); const error=document.getElementById('login-error');
        loading?.classList.add('hidden'); screen?.classList.remove('hidden'); if(error)error.textContent='Authentication is taking too long. Check your connection and refresh.';
    }
},12000);

updateConnectionIndicator();
