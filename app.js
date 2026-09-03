import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- FIREBASE CONFIG ---
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

// --- GLOBAL STATE ---
let currentUserId = null;
let isLoginMode = true;
let data = { products: [], customers: [], sales: [], expenses: [], settings: {} };
let listeners = [];

// --- AUTHENTICATION ---
window.toggleAuthMode = () => {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-button').innerText = isLoginMode ? 'Log In' : 'Sign Up';
    document.getElementById('toggle-auth').innerText = isLoginMode ? "Don't have an account? Sign Up" : "Already have an account? Log In";
    document.getElementById('login-error').innerText = '';
};

window.handleAuth = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        if (isLoginMode) await signInWithEmailAndPassword(auth, email, pass);
        else await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        errorDiv.innerText = error.message.replace('Firebase: ', '');
    }
};

window.signInWithGoogle = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { alert("Google Sign-In failed."); }
};

window.handleLogout = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        startListeners();
        navigate('dashboard');
    } else {
        currentUserId = null;
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        clearListeners();
        data = { products: [], customers: [], sales: [], expenses: [], settings: {} };
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
}

function clearListeners() { listeners.forEach(unsub => unsub()); listeners = []; }
function refreshCurrentView() {
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav) navigate(activeNav.dataset.page || 'dashboard');
}

// --- NAVIGATION ---
window.navigate = (page) => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-item[onclick="navigate('${page}')"]`);
    if(btn) btn.classList.add('active');

    const content = document.getElementById('app-content');
    const title = document.getElementById('header-title');

    if (page === 'dashboard') { title.innerText = 'Dashboard'; renderDashboard(content); }
    else if (page === 'sales') { title.innerText = 'New Sale'; renderSaleForm(content); }
    else if (page === 'inventory') { title.innerText = 'Inventory'; renderInventory(content); }
    else if (page === 'customers') { title.innerText = 'Customers'; renderCustomers(content); }
    else if (page === 'settings') { title.innerText = 'Settings'; renderSettings(content); }
};

// --- RENDER FUNCTIONS ---
function renderDashboard(container) {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = data.sales.filter(s => s.date && s.date.startsWith(today));
    
    const totalSales = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const totalExpenses = data.expenses.filter(e => e.date && e.date.startsWith(today)).reduce((sum, e) => sum + (e.amount || 0), 0);
    const lowStock = data.products.filter(p => p.stock <= (p.minStock || 5)).length;

    container.innerHTML = `
        <div class="dashboard-grid">
            <div class="card profit"><h3>Today's Sales</h3><div class="value">$${totalSales.toFixed(2)}</div></div>
            <div class="card profit"><h3>Net Profit</h3><div class="value">$${(totalProfit - totalExpenses).toFixed(2)}</div></div>
            <div class="card"><h3>Transactions</h3><div class="value">${todaySales.length}</div></div>
            <div class="card debt"><h3>Low Stock</h3><div class="value">${lowStock}</div></div>
        </div>
        <div class="card">
            <h3>Recent Sales</h3>
            <div id="recent-sales-list">
                ${data.sales.slice().reverse().slice(0, 5).map(s => `
                    <div class="list-item">
                        <div class="list-item-info">
                            <h4>${s.customer || 'Walk-in'}</h4>
                            <p>${new Date(s.date).toLocaleDateString()}</p>
                        </div>
                        <div style="font-weight:bold; color:var(--primary);">$${s.total.toFixed(2)}</div>
                    </div>
                `).join('') || '<p style="color:var(--gray); text-align:center;">No sales yet.</p>'}
            </div>
        </div>
    `;
}

function renderInventory(container) {
    container.innerHTML = `
        <button class="btn" style="margin-bottom:20px;" onclick="openProductModal()">+ Add Product</button>
        <div class="card" id="product-list">
            ${data.products.map(p => `
                <div class="list-item">
                    <div class="list-item-info">
                        <h4>${p.name}</h4>
                        <p>Stock: ${p.stock} | Price: $${p.price}</p>
                    </div>
                    <span class="badge ${p.stock <= (p.minStock||5) ? 'badge-low' : 'badge-ok'}">${p.stock <= (p.minStock||5) ? 'Low' : 'OK'}</span>
                </div>
            `).join('') || '<p style="color:var(--gray); text-align:center;">No products found.</p>'}
        </div>
    `;
}

function renderCustomers(container) {
    container.innerHTML = `
        <button class="btn" style="margin-bottom:20px;" onclick="openCustomerModal()">+ Add Customer</button>
        <div class="card" id="customer-list">
            ${data.customers.map(c => `
                <div class="list-item">
                    <div class="list-item-info">
                        <h4>${c.name}</h4>
                        <p>${c.phone || 'No phone'}</p>
                    </div>
                </div>
            `).join('') || '<p style="color:var(--gray); text-align:center;">No customers found.</p>'}
        </div>
    `;
}

function renderSaleForm(container) {
    container.innerHTML = `
        <div class="card">
            <div class="form-group">
                <label>Customer</label>
                <select id="sale-customer">
                    <option value="Walk-in">Walk-in Customer</option>
                    ${data.customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Product</label>
                <select id="sale-product">
                    <option value="">Select Product</option>
                    ${data.products.map(p => `<option value="${p.id}" data-price="${p.price}" data-cost="${p.cost}" data-stock="${p.stock}">${p.name} (Stock: ${p.stock})</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Quantity</label>
                <input type="number" id="sale-qty" value="1" min="1">
            </div>
            <button class="btn" onclick="addSaleItem()">Add to Cart</button>
        </div>
        <div class="card">
            <h3>Cart</h3>
            <div id="cart-items"></div>
            <hr style="margin:15px 0;">
            <div style="display:flex; justify-content:space-between; font-size:18px; font-weight:bold;">
                <span>Total:</span>
                <span id="cart-total">$0.00</span>
            </div>
            <button class="btn" style="margin-top:15px;" onclick="completeSale()">Complete Sale</button>
        </div>
    `;
    window.cart = [];
}

function renderSettings(container) {
    container.innerHTML = `
        <div class="card">
            <h3>Business Settings</h3>
            <div class="form-group"><label>Business Name</label><input type="text" id="set-name" value="${data.settings.name || ''}"></div>
            <div class="form-group"><label>Currency Symbol</label><input type="text" id="set-currency" value="${data.settings.currency || '$'}"></div>
            <button class="btn" onclick="saveSettings()">Save Settings</button>
        </div>
        <div class="card">
            <h3>Account</h3>
            <p style="margin-bottom:10px;">Logged in as: ${auth.currentUser.email}</p>
            <button class="btn btn-danger" onclick="handleLogout()">Logout</button>
        </div>
    `;
}

// --- ACTIONS ---
window.openProductModal = () => {
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `
        <div class="modal-header"><h2>Add Product</h2><button class="close-btn" onclick="closeModal()">&times;</button></div>
        <div class="form-group"><label>Name</label><input type="text" id="p-name"></div>
        <div class="form-group"><label>Cost Price</label><input type="number" id="p-cost" step="0.01"></div>
        <div class="form-group"><label>Selling Price</label><input type="number" id="p-price" step="0.01"></div>
        <div class="form-group"><label>Stock</label><input type="number" id="p-stock"></div>
        <div class="form-group"><label>Min Stock Alert</label><input type="number" id="p-min" value="5"></div>
        <button class="btn" onclick="saveProduct()">Save Product</button>
    `;
    document.getElementById('modal-overlay').classList.remove('hidden');
};

window.saveProduct = async () => {
    const name = document.getElementById('p-name').value;
    const cost = parseFloat(document.getElementById('p-cost').value);
    const price = parseFloat(document.getElementById('p-price').value);
    const stock = parseInt(document.getElementById('p-stock').value);
    const minStock = parseInt(document.getElementById('p-min').value);

    if(!name || isNaN(cost) || isNaN(price) || isNaN(stock)) return alert("Please fill all fields.");

    await addDoc(collection(db, "products"), { name, cost, price, stock, minStock, ownerId: currentUserId });
    closeModal();
};

window.addSaleItem = () => {
    const select = document.getElementById('sale-product');
    const qty = parseInt(document.getElementById('sale-qty').value);
    const option = select.options[select.selectedIndex];
    
    if(!option.value || qty < 1) return alert("Invalid product or quantity.");
    if(qty > parseInt(option.dataset.stock)) return alert("Not enough stock!");

    const item = {
        id: option.value,
        name: option.text.split(' (')[0],
        price: parseFloat(option.dataset.price),
        cost: parseFloat(option.dataset.cost),
        qty: qty
    };
    window.cart.push(item);
    renderCart();
};

function renderCart() {
    const container = document.getElementById('cart-items');
    let total = 0;
    container.innerHTML = window.cart.map((item, index) => {
        const sub = item.price * item.qty;
        total += sub;
        return `<div class="list-item">
            <div class="list-item-info"><h4>${item.name} x${item.qty}</h4></div>
            <div>$${sub.toFixed(2)} <i class="fas fa-trash" style="color:var(--danger); margin-left:10px; cursor:pointer;" onclick="removeCartItem(${index})"></i></div>
        </div>`;
    }).join('');
    document.getElementById('cart-total').innerText = `$${total.toFixed(2)}`;
}

window.removeCartItem = (index) => { window.cart.splice(index, 1); renderCart(); };

window.completeSale = async () => {
    if(window.cart.length === 0) return alert("Cart is empty!");
    
    const customer = document.getElementById('sale-customer').value;
    let total = 0, profit = 0;
    const stockUpdates = [];

    window.cart.forEach(item => {
        total += item.price * item.qty;
        profit += (item.price - item.cost) * item.qty;
        stockUpdates.push({ id: item.id, newStock: data.products.find(p => p.id === item.id).stock - item.qty });
    });

    await addDoc(collection(db, "sales"), {
        date: new Date().toISOString(),
        customer, items: window.cart, total, profit, ownerId: currentUserId
    });

    const updates = stockUpdates.map(u => updateDoc(doc(db, "products", u.id), { stock: u.newStock }));
    await Promise.all(updates);

    alert("Sale Completed!");
    window.cart = [];
    navigate('dashboard');
};

window.saveSettings = async () => {
    const name = document.getElementById('set-name').value;
    const currency = document.getElementById('set-currency').value;
    await addDoc(collection(db, "settings"), { name, currency, ownerId: currentUserId });
    alert("Settings Saved!");
};

// --- MODAL UTILS ---
window.closeModal = (e) => {
    if(!e || e.target.id === 'modal-overlay' || e.target.classList.contains('close-btn')) {
        document.getElementById('modal-overlay').classList.add('hidden');
    }
};