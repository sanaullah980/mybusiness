export function renderInventory(container) { const data = window.data; const formatCurrency = window.formatCurrency; container.innerHTML = `<button class="btn" style="margin-bottom:20px;" onclick="openProductModal()">+ Add Product</button><div class="card" id="product-list">${data.products.length === 0 ? '<p style="color:var(--gray); text-align:center; padding:10px;">No products found.</p>' : data.products.map(p => `<div class="list-item" style="cursor:default;"> <div class="list-item-info"> <h4>${p.name}</h4> <p>Cost: ${formatCurrency(p.cost)} | Price: ${formatCurrency(p.price)}</p> <p>Stock: ${p.stock}${p.barcode ? ' | Barcode: ' + p.barcode : ''}</p> </div> <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;"> <span class="badge ${p.stock <= (p.minStock||5) ? 'badge-low' : 'badge-ok'}">${p.stock <= (p.minStock||5) ? 'Low Stock' : 'OK'}</span> <div style="display:flex; gap:5px;"> <button class="btn btn-sm btn-secondary" onclick="openStockAdjustModal('${p.id}')">Adjust</button> <button class="btn btn-sm" onclick="openProductModal('${p.id}')">Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Delete</button> </div> </div> </div>`).join('')}</div>`; }
export function openProductModal(productId = null) { const p = productId ? window.data.products.find(x => x.id === productId) : null; const modal = document.getElementById('modal-body'); modal.innerHTML = `<div class="modal-header"><h2>${p ? 'Edit' : 'Add'} Product</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><div class="form-group"><label>Product Name *</label><input type="text" id="p-name" value="${p ? p.name : ''}"></div><div class="form-group"><label>Barcode (Optional)</label><input type="text" id="p-barcode" value="${p ? (p.barcode || '') : ''}" placeholder="Scan with a barcode scanner or type manually"></div><div class="form-row"><div class="form-group"><label>Cost Price (Rs.) *</label><input type="number" id="p-cost" step="0.01" min="0" value="${p ? p.cost : ''}"></div><div class="form-group"><label>Selling Price (Rs.) *</label><input type="number" id="p-price" step="0.01" min="0" value="${p ? p.price : ''}"></div></div><div class="form-row"><div class="form-group"><label>Current Stock *</label><input type="number" id="p-stock" min="0" value="${p ? p.stock : ''}"></div><div class="form-group"><label>Min Stock Alert</label><input type="number" id="p-min" min="0" value="${p ? (p.minStock||5) : 5}"></div></div><button class="btn" id="btn-save-product" onclick="saveProduct('${productId || ''}')">${p ? 'Update' : 'Save'} Product</button>`; document.getElementById('modal-overlay').classList.remove('hidden'); }
export async function saveProduct(productId) { const name = document.getElementById('p-name').value.trim(); const barcode = document.getElementById('p-barcode').value.trim(); const cost = parseFloat(document.getElementById('p-cost').value); const price = parseFloat(document.getElementById('p-price').value); const stock = parseInt(document.getElementById('p-stock').value); const minStock = parseInt(document.getElementById('p-min').value) || 5; if (!name || isNaN(cost) || isNaN(price) || isNaN(stock)) return alert("Fill all fields."); if (cost < 0 || price < 0 || stock < 0) return alert("No negative values."); if (barcode) { const dupe = window.data.products.find(x => x.barcode === barcode && x.id !== productId); if (dupe) return alert(`Barcode already used by "${dupe.name}".`); } window.showLoading('btn-save-product', "Saving..."); try { const pData = { name, barcode, cost, price, stock, minStock, ownerId: window.currentUserId }; if (productId) await window.updateDoc(window.doc(window.db, "products", productId), pData); else await window.addDoc(window.collection(window.db, "products"), pData); alert(productId ? "Updated!" : "Added!"); closeModal(); } catch (error) { console.error(error); alert("Failed."); } finally { window.hideLoading('btn-save-product'); } }
export async function deleteProduct(id) { if (!confirm("Delete?")) return; try { await deleteDoc(doc(window.db, "products", id)); } catch (error) { alert("Failed."); } }
export function openStockAdjustModal(productId) { const p = window.data.products.find(x => x.id === productId); const modal = document.getElementById('modal-body'); modal.innerHTML = `<div class="modal-header"><h2>Adjust Stock: ${p.name}</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><p style="margin-bottom:15px; color:var(--gray);">Current Stock: <strong>${p.stock}</strong></p><div class="form-group"><label>Action</label><select id="adj-type"><option value="add">Add Stock</option><option value="remove">Remove Stock</option></select></div><div class="form-group"><label>Quantity</label><input type="number" id="adj-qty" min="1" value="1"></div><div class="form-group"><label>Note</label><input type="text" id="adj-note"></div><button class="btn" id="btn-save-adj" onclick="saveStockAdjustment('${productId}')">Update Stock</button>`; document.getElementById('modal-overlay').classList.remove('hidden'); }
export async function saveStockAdjustment(productId) {
    const type=document.getElementById('adj-type').value;
    const qty=parseInt(document.getElementById('adj-qty').value);
    const note=document.getElementById('adj-note').value.trim();
    if(!qty||qty<=0)return alert('Enter a valid quantity.');
    if(!window.currentUserId)return alert('Please log in again.');
    window.showLoading('btn-save-adj','Updating...');
    try{
        const productRef=window.doc(window.db,'products',productId);
        if(!navigator.onLine){
            const p=window.data.products.find(x=>x.id===productId); if(!p)throw new Error('Product not found.');
            const current=Math.max(0,Number(p.stock)||0); const newStock=type==='add'?current+qty:current-qty;
            if(newStock<0)throw new Error('Cannot reduce stock below zero.');
            const batch=window.writeBatch(window.db);
            batch.update(productRef,{stock:newStock,updatedAt:new Date().toISOString()});
            const ref=window.doc(window.collection(window.db,'stockAdjustments'));
            batch.set(ref,{ownerId:window.currentUserId,productId,type,quantity:qty,date:new Date().toISOString(),note:note||`${type==='add'?'Added':'Removed'} stock`,offlineCreated:true});
            await batch.commit();
        }else{
            await window.runAtomicOrOffline(async transaction=>{
                const snap=await transaction.get(productRef);
                if(!snap.exists())throw new Error('Product not found.');
                if(snap.data().ownerId!==window.currentUserId)throw new Error('Unauthorized.');
                const current=Math.max(0,Number(snap.data().stock)||0); const newStock=type==='add'?current+qty:current-qty;
                if(newStock<0)throw new Error('Cannot reduce stock below zero.');
                transaction.update(productRef,{stock:newStock,updatedAt:new Date().toISOString()});
                const ref=window.doc(window.collection(window.db,'stockAdjustments'));
                transaction.set(ref,{ownerId:window.currentUserId,productId,type,quantity:qty,date:new Date().toISOString(),note:note||`${type==='add'?'Added':'Removed'} stock`});
            });
        }
        alert('Stock updated successfully.'); closeModal(); window.navigate('inventory');
    }catch(error){console.error(error);alert(error.message||'Failed to update stock.');}
    finally{window.hideLoading('btn-save-adj');}
}
