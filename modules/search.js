// Global search across products, customers and suppliers. Opened from the
// header search icon; results jump straight into the existing detail modals
// so it reuses all existing render logic instead of duplicating it.

export function openGlobalSearchModal() {
    const modal = document.getElementById('modal-body');
    modal.innerHTML = `<div class="modal-header"><h2>Search</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><div class="form-group"><input type="text" id="global-search-input" placeholder="Search products, customers, suppliers..." oninput="runGlobalSearch()"></div><div id="global-search-results"></div>`;
    document.getElementById('modal-overlay').classList.remove('hidden');
    setTimeout(() => document.getElementById('global-search-input') && document.getElementById('global-search-input').focus(), 50);
}

export function runGlobalSearch() {
    const term = document.getElementById('global-search-input').value.trim().toLowerCase();
    const resultsDiv = document.getElementById('global-search-results');
    if (!term) { resultsDiv.innerHTML = '<p style="color:var(--gray); text-align:center; padding:15px;">Start typing to search.</p>'; return; }
    const data = window.data;
    const formatCurrency = window.formatCurrency; const esc = window.esc;

    const products = (data.products || []).filter(p => p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.includes(term))).slice(0, 8);
    const customers = (data.customers || []).filter(c => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term))).slice(0, 8);
    const suppliers = (data.suppliers || []).filter(s => s.name.toLowerCase().includes(term) || (s.phone && s.phone.includes(term))).slice(0, 8);

    if (products.length === 0 && customers.length === 0 && suppliers.length === 0) {
        resultsDiv.innerHTML = '<p style="color:var(--gray); text-align:center; padding:15px;">No matches found.</p>';
        return;
    }

    let html = '';
    if (products.length) html += `<h3 style="font-size:13px; color:var(--gray); margin:15px 0 5px;">PRODUCTS</h3>` + products.map(p => `<div class="list-item" onclick="closeModal(); navigate('inventory'); setTimeout(() => openProductModal('${p.id}'), 150);"><div class="list-item-info"><h4>${esc(p.name)}</h4><p>Stock: ${p.stock} | ${formatCurrency(p.price)}</p></div></div>`).join('');
    if (customers.length) html += `<h3 style="font-size:13px; color:var(--gray); margin:15px 0 5px;">CUSTOMERS</h3>` + customers.map(c => `<div class="list-item" onclick="closeModal(); setTimeout(() => openCustomerDetails('${c.id}'), 150);"><div class="list-item-info"><h4>${esc(c.name)}</h4><p>Debt: ${formatCurrency(c.balance || 0)}</p></div></div>`).join('');
    if (suppliers.length) html += `<h3 style="font-size:13px; color:var(--gray); margin:15px 0 5px;">SUPPLIERS</h3>` + suppliers.map(s => `<div class="list-item" onclick="closeModal(); setTimeout(() => openSupplierDetails('${s.id}'), 150);"><div class="list-item-info"><h4>${esc(s.name)}</h4><p>Payable: ${formatCurrency(s.balance || 0)}</p></div></div>`).join('');
    resultsDiv.innerHTML = html;
}

window.openGlobalSearchModal = openGlobalSearchModal;
window.runGlobalSearch = runGlobalSearch;
