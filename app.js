import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, setDoc, getDoc, onSnapshot, query, where, runTransaction, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import { renderDashboard } from './modules/dashboard.js';
import { renderSales, showSaleTab, renderCart, updateSaleDue, addSaleItem, removeCartItem, completeNormalSale, completeWholesaleSale, completeRetailSale, completeManualSale, completeBulkSale, openProductSelectionModal, toggleProductRow, filterProductSelectionList, addSelectedProductsToCart, addProductByBarcode, startBarcodeScanner } from './modules/sales.js';
import { renderInventory, openProductModal, saveProduct, deleteProduct, openStockAdjustModal, saveStockAdjustment } from './modules/inventory.js';
import { renderCustomers, openCustomerModal, saveCustomer, openCustomerDetails, renderCustomerLedgerTable, filterCustomerLedger, downloadCustomerStatementPdf, openCustomerReportOptions, sendCustomerReport, sendCustomerSms, sendPaymentReminder, openCustomerSetDate, saveCustomerDueDate, openGiveModal, processGive, openReceiveModal, processReceive } from './modules/customers.js';
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
import { renderStaff, openStaffModal, saveStaff, deleteStaff, openAttendanceModal, onAttendanceDateChange, saveAttendance } from './modules/staff.js';
import { renderReminders, openReminderModal, saveReminder, completeReminder, deleteReminder } from './modules/reminders.js';
import { renderBusinessCard, saveBusinessCard, shareBusinessCard } from './modules/business.js';
import { renderBackup, exportBusinessBackup, importBusinessBackup } from './modules/backup.js';
import { renderAppLock, saveAppLock, removeAppLock, checkAppLock } from './modules/appLock.js';
import { renderTeam, createEmployeeInvite, cancelEmployeeInvite, toggleEmployeeActive, deleteEmployee } from './modules/team.js';

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
const storage = getStorage(firebaseApp);
setPersistence(auth, browserLocalPersistence).catch(error => console.warn('Auth persistence setup failed:', error));

const COLLECTIONS = ['products','customers','sales','expenses','stockPurchases','customerTransactions','stockAdjustments','suppliers','supplierTransactions','cashTransactions','salesReturns','staff','attendance','reminders'];
let currentUserId = null; // business owner UID used by existing data documents
let authUserId = null; // actual Firebase Authentication UID
let currentRole = null;
let currentPermissions = {};
let currentMemberName = '';
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
let initialSnapshotSources = new Set();
let initialDataReady = false;
let expectedInitialSources = COLLECTIONS.length;
let initialRevealTimer = null;
let scheduledPageRender = false;
let navigationReady = false;
let handlingPopState = false;
let deferredInstallPrompt = null;
let currentLanguage = localStorage.getItem('mybusiness-language') || 'en';
let onboardingStep = 0;
const LAST_SYNC_KEY = 'mybusiness-last-sync';

const i18n = {
  en: { home:'Home', sales:'Sales', stock:'Stock', khata:'Khata', more:'More', online:'Online', offline:'Offline', syncing:'Syncing…', search:'Search', language:'Language', install:'Install MyBusiness', installSub:'Use MyBusiness like a real app.', notSynced:'Not synced yet', justNow:'Just now', back:'Back', save:'Save', cancel:'Cancel', close:'Close', done:'Done', delete:'Delete', welcome:'Welcome to MyBusiness', onboarding1Title:'Welcome to MyBusiness', onboarding2Title:'Work offline', onboarding3Title:'Your business at a glance', onboarding1:'Everything you need to manage your shop, customers, sales and stock in one place.', onboarding2:'Keep working when the internet is unavailable. Your saved changes can sync when you are back online.', onboarding3:'Get quick access to sales, Khata, stock and reports from a clean dashboard.', getStarted:'Get Started', next:'Next', skip:'Skip', chooseLanguage:'Choose language', english:'English', urdu:'اردو' },
  ur: { home:'ہوم', sales:'فروخت', stock:'اسٹاک', khata:'کھاتہ', more:'مزید', online:'آن لائن', offline:'آف لائن', syncing:'ہم وقت ہو رہا ہے…', search:'تلاش', language:'زبان', install:'MyBusiness انسٹال کریں', installSub:'MyBusiness کو ایک حقیقی ایپ کی طرح استعمال کریں۔', notSynced:'ابھی سنک نہیں ہوا', justNow:'ابھی', back:'واپس', save:'محفوظ کریں', cancel:'منسوخ', close:'بند کریں', done:'مکمل', delete:'حذف کریں', welcome:'MyBusiness میں خوش آمدید', onboarding1:'اپنی دکان، گاہکوں، فروخت اور اسٹاک کو ایک ہی جگہ آسانی سے منظم کریں۔', onboarding2:'انٹرنیٹ نہ ہونے پر بھی کام جاری رکھیں۔ کنکشن واپس آنے پر تبدیلیاں سنک ہو جائیں گی۔', onboarding3:'صاف ستھرے ڈیش بورڈ سے فروخت، کھاتہ، اسٹاک اور رپورٹس تک فوری رسائی حاصل کریں۔', getStarted:'شروع کریں', next:'اگلا', skip:'چھوڑیں', chooseLanguage:'زبان منتخب کریں', english:'English', urdu:'اردو' }
};
function esc(value=''){ return String(value ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
function tr(key){ return i18n[currentLanguage]?.[key] || i18n.en[key] || key; }
const phraseTranslations={
  'Dashboard':'ڈیش بورڈ','Today at a glance':'آج کا خلاصہ','New Sale':'نئی فروخت','Sales':'فروخت','Stock':'اسٹاک','Khata':'کھاتہ','More':'مزید','Search':'تلاش','Settings':'ترتیبات','Reports':'رپورٹس','Expenses':'اخراجات','Purchases':'خریداری','Suppliers':'سپلائرز','Cash Book':'کیش بک','Staff Book':'اسٹاف بک','Reminders':'یاد دہانیاں','Business Card':'بزنس کارڈ','Backup & Restore':'بیک اپ اور بحالی','App Lock':'ایپ لاک','Save':'محفوظ کریں','Cancel':'منسوخ','Delete':'حذف کریں','Done':'مکمل','Edit':'ترمیم','Add':'شامل کریں','Update':'اپ ڈیٹ','Close':'بند کریں','Back':'واپس','Next':'اگلا','Skip':'چھوڑیں','Add Reminder':'یاد دہانی شامل کریں','Add Customer':'گاہک شامل کریں','Add Product':'پروڈکٹ شامل کریں','Add Supplier':'سپلائر شامل کریں','Add Staff':'اسٹاف شامل کریں','No products yet':'ابھی کوئی پروڈکٹ نہیں','No customers yet':'ابھی کوئی گاہک نہیں','No suppliers yet':'ابھی کوئی سپلائر نہیں','No reminders yet':'ابھی کوئی یاد دہانی نہیں','No expenses yet':'ابھی کوئی اخراجات نہیں','No transactions yet':'ابھی کوئی لین دین نہیں','Total Sales':'کل فروخت','Known Profit':'معلوم منافع','Transactions':'لین دین','Expenses':'اخراجات','Net Profit':'خالص منافع','Sales Returns':'فروخت کی واپسی','Customer Payments In':'گاہکوں سے وصولی','Cash Flow':'نقدی کا بہاؤ','Inventory':'انوینٹری','Purchases':'خریداری','Customer & Supplier Dues':'گاہک اور سپلائر کے واجبات','Best Sellers':'زیادہ فروخت ہونے والی اشیاء','Select Products':'پروڈکٹس منتخب کریں','Search products...':'پروڈکٹس تلاش کریں...','Add Selected to Cart':'منتخب اشیاء کارٹ میں شامل کریں','Quantity':'مقدار','Walk-in Customer':'واک اِن گاہک','Payment reminders':'ادائیگی کی یاد دہانیاں','Enable notifications':'اطلاعات فعال کریں','Notifications enabled':'اطلاعات فعال ہیں','No pending reminders':'کوئی زیرِ التوا یاد دہانی نہیں'
};
function translateVisibleText(){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(n=>{ const raw=n.nodeValue; const trimmed=raw.trim(); if(!trimmed||trimmed.length>120)return; if(!n.parentElement)return;
    if(currentLanguage==='ur'){ const t=phraseTranslations[trimmed]; if(t){ n.parentElement.dataset.i18nOriginal=trimmed; n.nodeValue=raw.replace(trimmed,t); } }
    else if(n.parentElement.dataset.i18nOriginal){ const original=n.parentElement.dataset.i18nOriginal; n.nodeValue=raw.replace(trimmed,original); delete n.parentElement.dataset.i18nOriginal; }
  });
}

function setLanguage(lang){ currentLanguage=lang==='ur'?'ur':'en'; localStorage.setItem('mybusiness-language',currentLanguage); document.documentElement.lang=currentLanguage; document.documentElement.dir=currentLanguage==='ur'?'rtl':'ltr'; applyLanguageToShell(); if(currentUserId && currentRole==='admin') setDoc(doc(db,'settings',currentUserId),{language:currentLanguage,ownerId:currentUserId},{merge:true}).catch(()=>{}); if(typeof window.refreshCurrentPage==='function') window.refreshCurrentPage(); setTimeout(translateVisibleText,40); }
function applyLanguageToShell(){ document.querySelectorAll('[data-i18n]').forEach(el=>{const k=el.dataset.i18n;if(k)el.textContent=tr(k);}); const ct=document.getElementById('connection-text'); if(ct && !syncPending) ct.textContent=navigator.onLine?tr('online'):tr('offline'); const ls=document.getElementById('last-sync-text'); if(ls) ls.textContent=formatLastSync(); document.getElementById('install-title')?.replaceChildren(document.createTextNode(tr('install'))); document.getElementById('install-subtitle')?.replaceChildren(document.createTextNode(tr('installSub'))); }
function openLanguagePicker(){ const m=document.getElementById('modal-body'); m.innerHTML=`<div class="modal-header"><h2>${tr('chooseLanguage')}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><div class="language-options"><button class="language-choice ${currentLanguage==='en'?'active':''}" onclick="setLanguage('en');closeModal()"><span>🇬🇧</span><strong>English</strong></button><button class="language-choice ${currentLanguage==='ur'?'active':''}" onclick="setLanguage('ur');closeModal()"><span>🇵🇰</span><strong>اردو</strong></button></div>`; document.getElementById('modal-overlay').classList.remove('hidden'); }
function saveLastSync(){ localStorage.setItem(LAST_SYNC_KEY,Date.now().toString()); const el=document.getElementById('last-sync-text'); if(el)el.textContent=formatLastSync(); }
function formatLastSync(){ const t=Number(localStorage.getItem(LAST_SYNC_KEY)||0); if(!t)return tr('notSynced'); const diff=Math.max(0,Date.now()-t); if(diff<60000)return tr('justNow'); const min=Math.floor(diff/60000); if(min<60)return currentLanguage==='ur'?`${min} منٹ پہلے`:`${min} min ago`; const hr=Math.floor(min/60); if(hr<24)return currentLanguage==='ur'?`${hr} گھنٹے پہلے`:`${hr} hr ago`; return new Date(t).toLocaleDateString(currentLanguage==='ur'?'ur-PK':'en-PK'); }
function setupInstallPrompt(){ window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e; if(!localStorage.getItem('mybusiness-install-dismissed')) document.getElementById('install-banner')?.classList.remove('hidden');}); window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;document.getElementById('install-banner')?.classList.add('hidden');showToast(currentLanguage==='ur'?'MyBusiness انسٹال ہو گیا':'MyBusiness installed');}); }
async function installPWA(){ if(!deferredInstallPrompt){showToast(currentLanguage==='ur'?'انسٹال آپشن دستیاب نہیں':'Install option is not available yet','info');return;} deferredInstallPrompt.prompt(); const r=await deferredInstallPrompt.userChoice; deferredInstallPrompt=null; if(r.outcome==='accepted') document.getElementById('install-banner')?.classList.add('hidden'); }
function dismissInstallPrompt(){localStorage.setItem('mybusiness-install-dismissed','1');document.getElementById('install-banner')?.classList.add('hidden');}
function startOnboarding(){ if(localStorage.getItem('mybusiness-onboarding-done')==='1')return; onboardingStep=0; renderOnboarding(); document.getElementById('onboarding-overlay')?.classList.remove('hidden'); }
function renderOnboarding(){ const steps=[['fa-store','welcome','onboarding1'],['fa-cloud-arrow-down','onboarding2Title','onboarding2'],['fa-bolt','onboarding3Title','onboarding3']]; const st=steps[onboardingStep]; document.getElementById('onboarding-icon').innerHTML=`<i class="fas ${st[0]}"></i>`; document.getElementById('onboarding-title').textContent=tr(st[1]); document.getElementById('onboarding-text').textContent=tr(st[2]); document.getElementById('onboarding-step').textContent=`${onboardingStep+1} / 3`; document.getElementById('onboarding-next').textContent=onboardingStep===2?tr('getStarted'):tr('next'); document.querySelectorAll('.onboarding-dots span').forEach((d,i)=>d.classList.toggle('active',i===onboardingStep)); document.querySelector('.onboarding-skip').textContent=tr('skip'); }
function nextOnboarding(){ if(onboardingStep<2){onboardingStep++;renderOnboarding();}else skipOnboarding(); }
function skipOnboarding(){localStorage.setItem('mybusiness-onboarding-done','1');document.getElementById('onboarding-overlay')?.classList.add('hidden');}
function setupNotifications(){ if(!('Notification' in window))return; checkDueReminders(); setInterval(checkDueReminders,60000); document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDueReminders();}); window.addEventListener('focus',checkDueReminders); }
async function requestReminderNotifications(){ if(!('Notification' in window))return false; if(Notification.permission==='default') await Notification.requestPermission(); return Notification.permission==='granted'; }
async function showReminderNotification(title,body){ try{ const reg=await navigator.serviceWorker?.getRegistration(); if(reg?.showNotification) return reg.showNotification(title,{body,icon:'icon-192.png',badge:'icon-192.png',tag:'mybusiness-reminder'}); }catch(_){} try{ new Notification(title,{body,icon:'icon-192.png'}); }catch(_){} }
function checkDueReminders(){ if(!('Notification' in window)||Notification.permission!=='granted'||!currentUserId)return; const today=getLocalDateStr(new Date()); const seen=JSON.parse(localStorage.getItem('mybusiness-notified-reminders')||'{}'); (data.reminders||[]).filter(r=>!r.completed && String(r.dueDate)<=today).forEach(r=>{const key=`${r.id}:${r.dueDate}`;if(seen[key])return;const c=(data.customers||[]).find(x=>x.id===r.customerId); showReminderNotification('MyBusiness',`${c?.name||'Customer'}: ${formatCurrency(r.amount||0)} payment reminder.`);seen[key]=Date.now();}); localStorage.setItem('mybusiness-notified-reminders',JSON.stringify(seen));}
Object.assign(window,{esc,tr,setLanguage,openLanguagePicker,installPWA,dismissInstallPrompt,startOnboarding,nextOnboarding,skipOnboarding,requestReminderNotifications,checkDueReminders,formatLastSync});


Object.assign(window, { data, cart, db, auth, storage, activeReportTab, currentReportMonth, currentUserId: null, authUserId: null, currentRole: null, currentPermissions: {}, currentMemberName: '' });
window.doc = doc; window.collection = collection; window.updateDoc = updateDoc; window.addDoc = addDoc;
window.runTransaction = runTransaction; window.deleteDoc = deleteDoc; window.setDoc = setDoc;
window.query = query; window.where = where; window.getDocs = getDocs; window.getDoc = getDoc; window.writeBatch = writeBatch;
window.storageRef = storageRef; window.uploadBytes = uploadBytes; window.getDownloadURL = getDownloadURL;
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
function showLoading(btnId, text='Processing...') { const btn=document.getElementById(btnId); if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');btn.dataset.originalText=btn.dataset.originalText||btn.innerHTML;btn.innerHTML=`<span class="btn-loader" aria-hidden="true"></span><span>${text}</span>`;} }
function hideLoading(btnId) { const btn=document.getElementById(btnId); if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');btn.innerHTML=btn.dataset.originalText||'Submit';} }
Object.assign(window,{formatCurrency,getStartOfDay,getEndOfDay,getStartOfMonth,getEndOfMonth,getLocalDateStr,showLoading,hideLoading,calculateReportData});

// Global in-app notification center. Existing business logic remains unchanged;
// this only replaces blocking alert feedback with accessible, queued UI messages.
window.showToast=(message,type='info',options={})=>{
    const duration=options.duration ?? (type==='error'?4200:2800);
    let host=document.getElementById('mybiz-toast-region');
    if(!host){host=document.createElement('div');host.id='mybiz-toast-region';host.className='mybiz-toast-region';host.setAttribute('aria-live','polite');host.setAttribute('aria-atomic','true');document.body.appendChild(host);}
    const toast=document.createElement('div');
    const icon=type==='error'?'fa-circle-exclamation':type==='warning'?'fa-triangle-exclamation':type==='success'?'fa-circle-check':'fa-circle-info';
    toast.className=`mybiz-toast ${type}`;
    toast.innerHTML=`<i class="fas ${icon}" aria-hidden="true"></i><span class="mybiz-toast-message"></span><button type="button" class="mybiz-toast-close" aria-label="Dismiss notification"><i class="fas fa-xmark"></i></button>`;
    toast.querySelector('.mybiz-toast-message').textContent=String(message||'');
    const dismiss=()=>{toast.classList.remove('show');setTimeout(()=>toast.remove(),220)};
    toast.querySelector('.mybiz-toast-close').addEventListener('click',dismiss);
    host.appendChild(toast);
    requestAnimationFrame(()=>toast.classList.add('show'));
    if(duration>0) setTimeout(dismiss,duration);
    return toast;
};
window.showSuccess=(message)=>window.showToast(message,'success');
window.showError=(message)=>window.showToast(message,'error');
window.showInfo=(message)=>window.showToast(message,'info');
// Preserve confirm dialogs for destructive actions. Non-blocking alerts become toasts.
if(!window.__mybizNativeAlert){window.__mybizNativeAlert=window.alert.bind(window);window.alert=(message)=>window.showToast(message,'info');}

window.refreshCurrentPage=async()=>{
    const content=document.getElementById('app-content'); if(!content)return;
    const page=currentPage;
    const renderer={dashboard:renderDashboard,sales:renderSales,inventory:renderInventory,customers:renderCustomers,more:renderMore,expenses:renderExpenses,stockPurchases:renderStockPurchases,reports:renderReports,settings:renderSettings,suppliers:renderSuppliers,cashbook:renderCashBook,staff:renderStaff,reminders:renderReminders,businessCard:renderBusinessCard,backup:renderBackup,appLock:renderAppLock}[page];
    if(renderer){renderer(content); updateConnectionIndicator();}
    try{ await navigator.serviceWorker?.getRegistration().then(r=>r?.update()); }catch(_){}
    window.showToast('Page refreshed','info');
};

// Pull-to-refresh for touch devices. It only activates when the page is already
// at the top, so normal vertical scrolling remains unaffected.
(()=>{
    let startY=0,pulling=false;
    const indicator=()=>document.getElementById('pull-refresh-indicator');
    document.addEventListener('touchstart',e=>{if(window.scrollY===0 && e.touches[0]){startY=e.touches[0].clientY;pulling=true;}},{passive:true});
    document.addEventListener('touchmove',e=>{if(!pulling||!e.touches[0])return;const d=e.touches[0].clientY-startY;if(d>12&&d<130){const el=indicator();if(el){el.style.setProperty('--pull',`${Math.min(d,100)}px`);el.classList.add('pulling');}}else if(d<=12){pulling=false;}},{passive:true});
    document.addEventListener('touchend',async()=>{if(!pulling)return;const el=indicator();const pull=parseFloat(el?.style.getPropertyValue('--pull')||'0');pulling=false;if(el)el.classList.remove('pulling');if(pull>=70){if(el)el.classList.add('refreshing');await window.refreshCurrentPage();setTimeout(()=>el?.classList.remove('refreshing'),700);}});
})();


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
    if(currentUserId && currentRole==='admin') setDoc(doc(db,'settings',currentUserId),{theme,darkMode:!!dark,ownerId:currentUserId},{merge:true}).catch(e=>console.warn('Preference sync failed:',e));
}
function applyStoredOrCloudTheme(){
    if(data.settings?.language && !localStorage.getItem('mybusiness-language')){currentLanguage=data.settings.language==='ur'?'ur':'en';localStorage.setItem('mybusiness-language',currentLanguage);}
    const theme=data.settings?.theme||localStorage.getItem(THEME_KEY)||'teal';
    const dark=data.settings?.darkMode ?? (localStorage.getItem(DARK_KEY)==='1');
    applyTheme(theme,dark);
}
Object.assign(window,{applyTheme,saveLocalPreferences});
applyTheme();

function updateConnectionIndicator(extra={}) {
    const el=document.getElementById('connection-indicator'); const text=document.getElementById('connection-text'); const icon=document.getElementById('connection-icon'); const sync=document.getElementById('last-sync-text');
    if(!el) return;
    const offline=!navigator.onLine; const label=syncPending?tr('syncing'):(offline?tr('offline'):tr('online'));
    el.classList.toggle('offline',offline); el.classList.toggle('online',!offline); el.classList.toggle('syncing',syncPending&&!offline);
    el.setAttribute('aria-label',label); el.title=offline?'Offline — cached data is available.':(syncPending?'Changes are syncing.':'Online and synced.');
    if(icon) icon.className=`fas ${offline?'fa-cloud':(syncPending?'fa-rotate fa-spin':'fa-wifi')}`;
    if(text) text.textContent=label; if(sync) sync.textContent=formatLastSync();
    const banner=document.getElementById('offline-banner');
    if(banner){banner.classList.toggle('hidden',!offline); const b=banner.querySelector('span'); if(b)b.textContent=offline?(currentLanguage==='ur'?'آف لائن موڈ — محفوظ ڈیٹا دستیاب ہے اور نئی تبدیلیاں دوبارہ کنکشن پر سنک ہوں گی۔':'Offline mode — cached data remains available. New changes will sync when you reconnect.'):(currentLanguage==='ur'?'آن لائن — تبدیلیاں خودکار طور پر سنک ہو رہی ہیں۔':'Online — changes are synchronized automatically.');}
}

window.updateConnectionIndicator=updateConnectionIndicator;
window.addEventListener('online',()=>{updateConnectionIndicator();saveLastSync();checkDueReminders();}); window.addEventListener('offline',()=>updateConnectionIndicator());

const USERNAME_DOMAIN='@mybusiness.local';
function normalizeUsername(value=''){ return String(value).trim().toLowerCase().replace(/^@/,''); }
function usernameToAuthEmail(username){ return `${normalizeUsername(username)}${USERNAME_DOMAIN}`; }
function validateUsername(username){ return /^[a-z0-9._-]{3,30}$/.test(normalizeUsername(username)); }
function selectedSignupRole(){ return document.querySelector('input[name="signup-role"]:checked')?.value || 'admin'; }
function setSignupRoleFields(){ const employee=selectedSignupRole()==='employee'; const code=document.getElementById('signup-code-wrap'); if(code) code.classList.toggle('hidden',!employee); }
window.toggleAuthMode=()=>{
    isLoginMode=!isLoginMode;
    document.getElementById('auth-button').innerText=isLoginMode?'Log In':'Create Account';
    document.getElementById('toggle-auth').innerText=isLoginMode?"Don't have an account? Sign Up":"Already have an account? Log In";
    document.getElementById('auth-heading').innerText=isLoginMode?'Welcome Back':'Create Your Account';
    document.getElementById('auth-subheading').innerText=isLoginMode?'Log in quickly with your username.':'Set up your role once. You will not be asked again.';
    document.querySelectorAll('.signup-only').forEach(el=>el.classList.toggle('hidden',isLoginMode));
    document.getElementById('forgot-password-link')?.classList.toggle('hidden',!isLoginMode);
    document.getElementById('login-error').innerText=''; setSignupRoleFields();
};
document.addEventListener('change',e=>{if(e.target?.name==='signup-role') setSignupRoleFields();});
window.handleAuth=async(e)=>{
    if(e)e.preventDefault();
    const username=normalizeUsername(document.getElementById('login-username').value);
    const pass=document.getElementById('login-password').value;
    const errorDiv=document.getElementById('login-error'); errorDiv.innerText='';
    if(!validateUsername(username)){ errorDiv.innerText='Username must be 3–30 characters and use only letters, numbers, dot, underscore or hyphen.'; return; }
    if(!pass || pass.length<6){ errorDiv.innerText='Password must be at least 6 characters.'; return; }
    const authEmail=usernameToAuthEmail(username);
    if(isLoginMode){
        showLoading('auth-button','Logging in...');
        try{ await signInWithEmailAndPassword(auth,authEmail,pass); }
        catch(error){ console.error('Authentication error:',error); errorDiv.innerText=({'auth/invalid-credential':'Invalid username or password.','auth/wrong-password':'Invalid username or password.','auth/user-not-found':'Invalid username or password.','auth/too-many-requests':'Too many attempts. Please try again later.','auth/network-request-failed':'Network unavailable. Check your connection and try again.'}[error.code]||'Login failed. Please try again.'); }
        finally{ hideLoading('auth-button'); }
        return;
    }
    const name=document.getElementById('signup-name').value.trim(); const role=selectedSignupRole();
    const phone=document.getElementById('signup-phone').value.trim(); const email=document.getElementById('signup-email').value.trim().toLowerCase();
    const inviteCode=(document.getElementById('signup-invite-code')?.value||'').trim().toUpperCase();
    if(!name){errorDiv.innerText='Please enter your name.';return;}
    if(role==='employee'&&!inviteCode){errorDiv.innerText='Enter the business invite code provided by your Admin.';return;}
    if(email && !/^\S+@\S+\.\S+$/.test(email)){errorDiv.innerText='Enter a valid email or leave it empty.';return;}
    sessionStorage.setItem('mybiz-pending-profile',JSON.stringify({name,username,role,phone,email,inviteCode,createdAt:new Date().toISOString()}));
    showLoading('auth-button','Creating account...');
    try{ await createUserWithEmailAndPassword(auth,authEmail,pass); }
    catch(error){ console.error('Signup error:',error); sessionStorage.removeItem('mybiz-pending-profile'); errorDiv.innerText=({'auth/email-already-in-use':'That username is already taken.','auth/weak-password':'Password must be at least 6 characters.','auth/network-request-failed':'Network unavailable. Check your connection and try again.'}[error.code]||error.message||'Could not create the account.'); hideLoading('auth-button'); }
};
window.forgotPassword=async(e)=>{
    if(e)e.preventDefault(); const username=normalizeUsername(document.getElementById('login-username').value); if(!validateUsername(username)) return alert('Enter your username first.');
    alert('Password reset for username-only accounts requires a recovery email. Add an email in your profile, then reset from the recovery option.');
};
window.signInWithGoogle=async()=>{
    sessionStorage.setItem('mybiz-google-signin','1');
    try{await signInWithPopup(auth,googleProvider);}
    catch(error){
        console.error('Google Sign-In error:',error);
        if(error.code==='auth/popup-closed-by-user'){ sessionStorage.removeItem('mybiz-google-signin'); return; }
        if(error.code==='auth/unauthorized-domain'){ sessionStorage.removeItem('mybiz-google-signin'); alert('This website domain is not authorized in Firebase Authentication.'); return; }
        // Popups need a live iframe on the authDomain to relay sign-in state back to this
        // page. Browsers that partition third-party storage (Safari ITP, Chrome storage
        // partitioning, some in-app browsers) block that relay, which surfaces as a
        // "missing initial state" / storage error rather than a normal auth error code.
        // Falling back to a full-page redirect avoids the cross-origin relay entirely.
        const storagePartitioned = error.code==='auth/web-storage-unsupported' || /missing initial state|storage is inaccessible|sessionstorage/i.test(error?.message||'');
        if(storagePartitioned || error.code==='auth/popup-blocked'){
            try{ await signInWithRedirect(auth,googleProvider); return; }
            catch(redirectError){ console.error('Google redirect sign-in error:',redirectError); sessionStorage.removeItem('mybiz-google-signin'); alert(redirectError.message||'Google Sign-In failed.'); return; }
        }
        sessionStorage.removeItem('mybiz-google-signin');
        alert(error.message||'Google Sign-In failed.');
    }
};
// Completes the flow started by signInWithRedirect above. onAuthStateChanged also fires
// on return, but resolving the redirect result first surfaces redirect-specific errors
// (e.g. an account already existing under a different sign-in method) instead of silently
// leaving the user on the login screen.
getRedirectResult(auth).catch(error=>{
    console.error('Google redirect result error:',error);
    sessionStorage.removeItem('mybiz-google-signin');
    const err=document.getElementById('login-error');
    if(err) err.textContent = error.code==='auth/account-exists-with-different-credential'
        ? 'An account already exists with this email using a different sign-in method.'
        : (error.message||'Google Sign-In failed.');
});
window.handleLogout=async()=>{if(!confirm('Log out?'))return;try{await signOut(auth);}catch(e){console.error(e);alert('Could not log out. Please try again.');}};

// Permanently removes the signed-in user's access profile and Firebase Auth account.
// Business records are intentionally not deleted here; account deletion must never erase
// shared business data by accident.
window.deleteMyAccount=async()=>{
    const user=auth.currentUser;
    if(!user) return;
    if(!confirm('Permanently delete your account? You will lose access to MyBusiness on this account. Shared business records will not be deleted. This cannot be undone.')) return;
    try{
        const providers=(user.providerData||[]).map(p=>p.providerId);
        if(providers.includes('password')){
            const password=prompt('For security, enter your password to permanently delete your account:');
            if(password===null) return;
            if(!password) throw new Error('Password is required to delete your account.');
            await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));
        }else if(providers.includes('google.com')){
            await reauthenticateWithPopup(user,googleProvider);
        }
        // Remove this user's business membership first. The rules allow a user to remove
        // their own membership only after the explicit account-deletion flow is enabled.
        const memberRef=doc(db,'businessMembers',user.uid);
        try{ await deleteDoc(memberRef); }catch(error){ console.warn('Could not remove membership before account deletion:',error); throw error; }
        await deleteUser(user);
        alert('Your account has been permanently deleted.');
    }catch(error){
        console.error('Account deletion failed:',error);
        const code=error?.code||'';
        if(code==='auth/requires-recent-login') alert('Please log in again and try deleting your account immediately afterward.');
        else if(code==='auth/wrong-password'||code==='auth/invalid-credential') alert('Incorrect password. Your account was not deleted.');
        else alert(error?.message||'Could not delete your account. Please try again.');
    }
};

function clearListeners(){listeners.forEach(unsub=>{try{unsub();}catch(_){}});listeners=[];}
function resetData(){data=Object.fromEntries(COLLECTIONS.map(name=>[name,[]]));data.settings={};window.data=data;}
function setAuthVisibility(user){
    const loading=document.getElementById('auth-loading'); const authScreen=document.getElementById('auth-screen'); const main=document.getElementById('main-app');
    if(loading) loading.classList.add('hidden');
    if(user){authScreen?.classList.add('hidden');main?.classList.remove('hidden');}
    else{main?.classList.add('hidden');authScreen?.classList.remove('hidden');}
}
function revealAppWhenReady(){
    if(initialDataReady) return;
    initialDataReady=true;
    if(initialRevealTimer) clearTimeout(initialRevealTimer);
    const user=auth.currentUser;
    if(user) setAuthVisibility(user);
}
function scheduleCurrentPageRender(){
    if(scheduledPageRender) return;
    scheduledPageRender=true;
    requestAnimationFrame(()=>{
        scheduledPageRender=false;
        const content=document.getElementById('app-content');
        if(!content) return;
        if(currentPage==='dashboard') renderDashboard(content);
        else if(currentPage==='customers') renderCustomers(content);
        else if(currentPage==='inventory') renderInventory(content);
    });
}
function handleListenerSnapshot(name,snapshot){
    data[name]=snapshot.docs.map(d=>({id:d.id,...d.data()}));
    window.data=data;
    initialSnapshotSources.add(name);
    if(snapshot.docs.some(d=>d.metadata.hasPendingWrites)) pendingSources.add(name); else pendingSources.delete(name);
    syncPending=pendingSources.size>0;
    if(initialSnapshotSources.size >= expectedInitialSources && !syncPending) saveLastSync();
    checkDueReminders();
    applyLanguageToShell();
    updateConnectionIndicator();
    if(initialSnapshotSources.size >= expectedInitialSources) revealAppWhenReady();
    scheduleCurrentPageRender();
}
function startDataListeners(ownerId){
    clearListeners(); resetData(); currentUserId=ownerId; window.currentUserId=ownerId; window.data=data;
    syncPending=false;
    pendingSources.clear();
    initialSnapshotSources.clear();
    initialDataReady=false;
    if(initialRevealTimer) clearTimeout(initialRevealTimer);
    const adminOnlyCollections=['expenses','stockPurchases','stockAdjustments','cashTransactions','salesReturns','staff','attendance'];
    const employeeExcluded=currentPermissions.suppliers ? adminOnlyCollections : [...adminOnlyCollections,'supplierTransactions'];
    const activeCollections=currentRole==='employee' ? COLLECTIONS.filter(name=>!employeeExcluded.includes(name)) : COLLECTIONS;
    expectedInitialSources=activeCollections.length;
    for(const name of activeCollections){
        const q=(name==='sales' && currentRole==='employee') ? query(collection(db,name),where('ownerId','==',ownerId),where('createdBy','==',authUserId)) : query(collection(db,name),where('ownerId','==',ownerId));
        const unsub=onSnapshot(q,snapshot=>handleListenerSnapshot(name,snapshot),error=>{
            console.error(`Firestore listener failed for ${name}:`,error);
            if(error.code==='permission-denied') console.warn(`Firestore rules denied access to ${name}. Deploy firestore.rules if needed.`);
        });
        listeners.push(unsub);
    }
    if(currentRole==='admin'){
        const teamQ=query(collection(db,'businessMembers'),where('ownerId','==',ownerId));
        listeners.push(onSnapshot(teamQ,snapshot=>{data.teamMembers=snapshot.docs.map(d=>({id:d.id,...d.data()}));window.data=data;if(currentPage==='team')renderTeam(document.getElementById('app-content'));},e=>console.warn('Team listener failed:',e)));
    }
    const settingsRef=doc(db,'settings',ownerId);
    listeners.push(onSnapshot(settingsRef,snapshot=>{
        data.settings=snapshot.exists()?snapshot.data():{}; window.data=data; applyStoredOrCloudTheme();
        if(currentPage==='settings') renderSettings(document.getElementById('app-content'));
    },error=>console.warn('Settings listener failed:',error)));
    // Keep the loading shell visible until the first data burst has settled.
    // This prevents the dashboard from flashing empty and then repainting 2–3 times.
    initialRevealTimer=setTimeout(()=>revealAppWhenReady(),2500);
    updateConnectionIndicator();
}

window.navigate=(page, options={})=>{
    const {history=true, replace=false}=options||{};
    const restricted=['reports','expenses','stockPurchases','staff','backup','appLock','settings','businessCard','team','cashbook'];
    if(currentRole==='employee' && restricted.includes(page)){ window.showToast?.('This area is available to the Admin only.','warning'); return; }
    if(currentRole==='employee' && page==='suppliers' && !currentPermissions.suppliers){ window.showToast?.('Ask your Admin to grant Suppliers access.','warning'); return; }
    if (history && !handlingPopState && currentPage !== page) {
        const state={myBusiness:true,page};
        if (replace) window.history.replaceState(state,'',`#${page}`);
        else window.history.pushState(state,'',`#${page}`);
    } else if (replace) {
        window.history.replaceState({myBusiness:true,page},'',`#${page}`);
    }
    currentPage=page;
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    const content=document.getElementById('app-content'); if(!content)return;
    content.className = `page-shell page-${page} page-loading`;
    content.setAttribute('aria-busy','true');
    const title=document.getElementById('header-title'); const subtitle=document.getElementById('header-subtitle');
    const meta={dashboard:[data.settings?.name||'MyBusiness',new Date().toLocaleDateString('en-PK',{weekday:'long',day:'numeric',month:'short'})],sales:['New Sale','Record a sale quickly'],inventory:['Inventory','Products & stock'],customers:['Khata','Customers & balances'],more:['More','Tools & business settings'],expenses:['Expenses','Track business spending'],stockPurchases:['Purchases','Stock coming in'],reports:['Reports','Understand your business'],settings:['Settings','Personalize MyBusiness'],suppliers:['Suppliers','Supplier balances'],cashbook:['Cash Book','Money in & out'],staff:['Staff Book','Team & attendance'],reminders:['Reminders','Follow up payments'],businessCard:['Business Card','Share your business'],backup:['Backup & Restore','Keep your data safe'],appLock:['App Lock','Protect the app'],team:['Team','Employees & access']};
    const m=meta[page]||[page,'']; const titleUr={'Dashboard':'ڈیش بورڈ','New Sale':'نئی فروخت','Inventory':'اسٹاک','Khata':'کھاتہ','More':'مزید','Expenses':'اخراجات','Purchases':'خریداری','Reports':'رپورٹس','Settings':'ترتیبات','Suppliers':'سپلائرز','Cash Book':'کیش بک','Staff Book':'اسٹاف بک','Reminders':'یاد دہانیاں','Business Card':'بزنس کارڈ','Backup & Restore':'بیک اپ اور بحالی','App Lock':'ایپ لاک'}; const subUr={'Today at a glance':'آج کا خلاصہ','Record a sale quickly':'فروخت جلدی ریکارڈ کریں','Products & stock':'پروڈکٹس اور اسٹاک','Customers & balances':'گاہک اور بیلنس','Tools & business settings':'ٹولز اور کاروباری ترتیبات','Track business spending':'کاروباری اخراجات','Stock coming in':'آنے والا اسٹاک','Understand your business':'اپنے کاروبار کو سمجھیں','Personalize MyBusiness':'MyBusiness کو اپنی مرضی کے مطابق کریں','Supplier balances':'سپلائر بیلنس','Money in & out':'رقم کا لین دین','Team & attendance':'ٹیم اور حاضری','Follow up payments':'ادائیگیوں کی پیروی','Share your business':'اپنا کاروبار شیئر کریں','Keep your data safe':'اپنا ڈیٹا محفوظ رکھیں','Protect the app':'ایپ کو محفوظ کریں'}; if(title)title.innerText=currentLanguage==='ur'?(titleUr[m[0]]||m[0]):m[0]; if(subtitle)subtitle.innerText=currentLanguage==='ur'?(subUr[m[1]]||m[1]):m[1];
    const renderers={dashboard:renderDashboard,sales:renderSales,inventory:renderInventory,customers:renderCustomers,more:renderMore,expenses:renderExpenses,stockPurchases:renderStockPurchases,reports:renderReports,settings:renderSettings,suppliers:renderSuppliers,cashbook:renderCashBook,staff:renderStaff,reminders:renderReminders,businessCard:renderBusinessCard,backup:renderBackup,appLock:renderAppLock,team:renderTeam};
    if(renderers[page]) renderers[page](content);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{content.classList.remove('page-loading');content.removeAttribute('aria-busy');}));
    updateConnectionIndicator();
};


// Android/browser back + gesture navigation should behave like an in-app stack.
// A back gesture returns to the previous MyBusiness page instead of leaving the app.
function handleAppPopState(event){
    if (document.getElementById('modal-overlay')?.classList.contains('hidden') === false) {
        closeModal();
        window.history.pushState({myBusiness:true,page:currentPage},'',`#${currentPage}`);
        return;
    }
    const page=event.state?.myBusiness ? event.state.page : 'dashboard';
    handlingPopState=true;
    try {
        window.navigate(page,{history:false});
        if (page==='dashboard' && !event.state?.myBusiness) {
            window.history.replaceState({myBusiness:true,page:'dashboard'},'', '#dashboard');
        }
    } finally { handlingPopState=false; }
}
window.addEventListener('popstate',handleAppPopState);
if(!window.history.state?.myBusiness){
    window.history.replaceState({myBusiness:true,page:'dashboard'},'', '#dashboard');
}


// Dashboard account drawer: UI-only controls wired to existing actions.
function openDashboardMenu(){
    const menu=document.getElementById('dashboard-menu');
    const backdrop=document.getElementById('dashboard-menu-backdrop');
    if(!menu||!backdrop) return;
    const business=data.settings?.name || 'MyBusiness';
    const owner=auth.currentUser?.displayName || auth.currentUser?.email || 'Business Owner';
    document.getElementById('dashboard-menu-business')?.replaceChildren(document.createTextNode(business));
    document.getElementById('dashboard-menu-owner')?.replaceChildren(document.createTextNode(owner));
    backdrop.classList.remove('hidden');
    requestAnimationFrame(()=>{backdrop.classList.add('show');menu.classList.add('open');menu.setAttribute('aria-hidden','false');document.body.classList.add('dashboard-menu-open');});
}
function closeDashboardMenu(){
    const menu=document.getElementById('dashboard-menu');
    const backdrop=document.getElementById('dashboard-menu-backdrop');
    if(!menu||!backdrop) return;
    menu.classList.remove('open');menu.setAttribute('aria-hidden','true');backdrop.classList.remove('show');document.body.classList.remove('dashboard-menu-open');
    setTimeout(()=>{if(!menu.classList.contains('open')) backdrop.classList.add('hidden');},240);
}
function hasPermission(key){ return currentRole==='admin' || currentPermissions[key]===true; }
window.hasPermission=hasPermission;
function navigateFromDashboardMenu(page){ closeDashboardMenu(); setTimeout(()=>navigate(page),40); }
function openPasswordFromDashboardMenu(){ closeDashboardMenu(); setTimeout(()=>openChangePasswordModal(),40); }
function openDeleteFromDashboardMenu(){ closeDashboardMenu(); setTimeout(()=>openDeleteRecordsModal(),40); }
function logoutFromDashboardMenu(){ closeDashboardMenu(); setTimeout(()=>handleLogout(),40); }

Object.assign(window,{
    renderDashboard,renderSales,showSaleTab,renderCart,updateSaleDue,addSaleItem,removeCartItem,completeNormalSale,completeWholesaleSale,completeRetailSale,completeManualSale,completeBulkSale,openProductSelectionModal,toggleProductRow,filterProductSelectionList,addSelectedProductsToCart,
    renderInventory,openProductModal,saveProduct,deleteProduct,openStockAdjustModal,saveStockAdjustment,
    renderCustomers,openCustomerModal,saveCustomer,openCustomerDetails,renderCustomerLedgerTable,filterCustomerLedger,downloadCustomerStatementPdf,openCustomerReportOptions,sendCustomerReport,sendCustomerSms,sendPaymentReminder,openCustomerSetDate,saveCustomerDueDate,openGiveModal,processGive,openReceiveModal,processReceive,
    renderExpenses,openExpenseModal,saveExpense,deleteExpense,renderStockPurchases,openStockPurchaseModal,showStockPurchaseTab,onStockPurchaseProductChange,saveStockPurchase,deleteStockPurchase,
    renderReports,setReportTab,changeReportMonth,resetDailyReport,renderMore,openDeleteRecordsModal,deleteCollectionData,deleteEverything,
    renderSettings,saveSettings,selectTheme,toggleDarkMode,openChangePasswordModal,changePassword,closeModal,viewSaleDetail,
    renderSuppliers,openSupplierModal,saveSupplier,deleteSupplier,openSupplierDetails,openSupplierPayModal,processSupplierPayment,openSupplierDebtModal,processSupplierDebt,
    renderCashBook,buildCashBookEntries,openSetOpeningBalanceModal,saveOpeningBalance,openCashEntryModal,saveCashEntry,openGlobalSearchModal,runGlobalSearch,addProductByBarcode,startBarcodeScanner,
    openInvoiceModal,downloadInvoicePdf,printInvoice,shareInvoiceWhatsApp,openReturnModal,processReturn,
    renderStaff,openStaffModal,saveStaff,deleteStaff,openAttendanceModal,onAttendanceDateChange,saveAttendance,renderReminders,openReminderModal,saveReminder,completeReminder,deleteReminder,
    renderBusinessCard,saveBusinessCard,shareBusinessCard,renderBackup,exportBusinessBackup,importBusinessBackup,renderAppLock,saveAppLock,removeAppLock,checkAppLock,renderTeam,createEmployeeInvite,cancelEmployeeInvite,toggleEmployeeActive,deleteEmployee,
    openDashboardMenu,closeDashboardMenu,navigateFromDashboardMenu,openPasswordFromDashboardMenu,openDeleteFromDashboardMenu,logoutFromDashboardMenu,deleteMyAccount
});

// Mobile keyboard UX: keep modal lists/forms inside the visible viewport.
// Product selection is intentionally top-anchored so the keyboard never covers the list.
function syncModalToVisualViewport(){
    const overlay=document.getElementById('modal-overlay');
    const modal=document.getElementById('modal-body');
    if(!overlay || overlay.classList.contains('hidden') || !modal) return;
    const vv=window.visualViewport;
    const height=vv?.height || window.innerHeight;
    const keyboardLikely=!!vv && (window.innerHeight - vv.height > 120);
    const focused=document.activeElement;
    const inputFocused=!!focused && /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName);
    if(keyboardLikely || inputFocused || modal.classList.contains('product-selection-modal')){
        overlay.classList.add('modal-keyboard-open');
        modal.style.maxHeight=`${Math.max(220, height-12)}px`;
        modal.style.marginTop='6px';
        modal.style.marginBottom='0';
        if (modal.classList.contains('product-selection-modal')) {
            modal.style.height=`${Math.max(260, height-12)}px`;
            window.requestAnimationFrame(()=>window.syncProductPickerHeight?.());
        }
    }else{
        overlay.classList.remove('modal-keyboard-open');
        modal.style.maxHeight='';
        modal.style.marginTop='';
        modal.style.marginBottom='';
    }
}
function setupKeyboardViewportHandling(){
    document.addEventListener('focusin',()=>setTimeout(syncModalToVisualViewport,0));
    document.addEventListener('focusout',()=>setTimeout(syncModalToVisualViewport,80));
    window.visualViewport?.addEventListener('resize',syncModalToVisualViewport);
    window.visualViewport?.addEventListener('scroll',syncModalToVisualViewport);
}
window.syncModalToVisualViewport=syncModalToVisualViewport;
setupKeyboardViewportHandling();
setupInstallPrompt();
setupNotifications();
applyLanguageToShell();

// Firebase Auth is the single source of truth for whether the app is ready.
// The listener also fires after a refresh, so the app does not get stuck on the loading screen.
onAuthStateChanged(auth, async user=>{
    authResolved=true;
    if(!user){
        clearListeners(); currentUserId=null; authUserId=null; currentRole=null; currentPermissions={}; currentMemberName=''; window.currentUserId=null; window.authUserId=null; window.currentRole=null; window.currentPermissions={}; window.currentMemberName=''; resetData(); setAuthVisibility(null); updateConnectionIndicator(); return;
    }
    authUserId=user.uid; window.authUserId=user.uid;
    // Resolve the role once. Existing accounts stay compatible; new username/Google
    // users complete setup only when no profile exists.
    try{
        const memberRef=doc(db,'businessMembers',user.uid);
        let memberSnap=await getDoc(memberRef);
        if(!memberSnap.exists()){
            let pending=null; try{pending=JSON.parse(sessionStorage.getItem('mybiz-pending-profile')||'null');}catch(_){}
            const googleFirstTime=sessionStorage.getItem('mybiz-google-signin')==='1';
            if(googleFirstTime && !pending){
                const defaultName=user.displayName||'';
                const defaultUsername=normalizeUsername((user.email||'').split('@')[0]).replace(/[^a-z0-9._-]/g,'').slice(0,30);
                await signOut(auth);
                sessionStorage.removeItem('mybiz-google-signin');
                document.getElementById('login-error').textContent='Google profile details were filled in. Choose a username and role to finish setup.';
                isLoginMode=true; toggleAuthMode();
                document.getElementById('signup-name').value=defaultName;
                document.getElementById('login-username').value=defaultUsername;
                document.getElementById('signup-email').value=user.email||'';
                return;
            }
            if(!pending){
                // Legacy accounts remain Admins so existing business data keeps working.
                await setDoc(memberRef,{ownerId:user.uid,role:'admin',active:true,displayName:user.displayName||user.email||'Business Owner',username:normalizeUsername((user.email||'').split('@')[0]),email:(user.email||'').toLowerCase(),phone:'',permissions:{},createdAt:new Date().toISOString()});
                memberSnap=await getDoc(memberRef);
            }else if(pending.role==='employee'){
                const inviteRef=doc(db,'businessInvites',pending.inviteCode);
                const inviteSnap=await getDoc(inviteRef);
                if(!inviteSnap.exists()||inviteSnap.data().status!=='pending') throw new Error('Invalid or already used business invite code.');
                const inv=inviteSnap.data();
                await setDoc(memberRef,{ownerId:inv.ownerId,role:'employee',active:true,displayName:pending.name,username:pending.username,email:pending.email||'',phone:pending.phone||'',permissions:inv.permissions||{},inviteId:inviteSnap.id,createdAt:new Date().toISOString()});
                await updateDoc(inviteRef,{status:'claimed',claimedBy:user.uid,claimedAt:new Date().toISOString()});
                memberSnap=await getDoc(memberRef);
            }else{
                await setDoc(memberRef,{ownerId:user.uid,role:'admin',active:true,displayName:pending.name,username:pending.username,email:pending.email||'',phone:pending.phone||'',permissions:{},createdAt:new Date().toISOString()});
                memberSnap=await getDoc(memberRef);
            }
            sessionStorage.removeItem('mybiz-pending-profile'); sessionStorage.removeItem('mybiz-google-signin');
        }
        const member=memberSnap.data();
        if(member.active===false){ await signOut(auth); throw new Error('Your access to this business has been disabled.'); }
        currentRole=member.role||'employee'; currentPermissions=member.permissions||{}; currentMemberName=member.displayName||member.username||user.displayName||'User'; currentUserId=member.ownerId;
        window.currentRole=currentRole; window.currentPermissions=currentPermissions; window.currentMemberName=currentMemberName; window.currentUserId=currentUserId;
        document.body.dataset.role=currentRole;
        startDataListeners(currentUserId);
        applyStoredOrCloudTheme();
        window.navigate('dashboard',{replace:true});
        if(currentRole==='admin') setTimeout(()=>checkAppLock().catch?.(()=>{}),100);
        setTimeout(()=>startOnboarding(),450); setTimeout(()=>checkDueReminders(),900);
    }catch(error){
        console.error('App initialization failed:',error);
        const err=document.getElementById('login-error');
        if(err){
            const friendly=error?.code==='permission-denied'
                ? 'The app could not initialize: Firestore denied access. This usually means the security rules in this build have not been deployed to your Firebase project yet (run "firebase deploy --only firestore:rules"). Please refresh after deploying.'
                : `The app could not initialize (${error?.code||error?.message||'unknown error'}). Please refresh.`;
            err.textContent=friendly;
        }
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
