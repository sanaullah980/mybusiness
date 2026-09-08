function esc(v=''){return window.esc?window.esc(v):String(v)}
function randomCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<8;i++)s+=a[Math.floor(Math.random()*a.length)];return s;}
export function renderTeam(container){
  if(window.currentRole!=='admin'){container.innerHTML='<div class="empty-state"><i class="fas fa-lock"></i><h3>Admin only</h3><p>Only the business Admin can manage employees.</p></div>';return;}
  const members=window.data.teamMembers||[];
  container.innerHTML=`<div class="page-header"><div><h2>Team & Access</h2><p>Invite an employee to use the same business from their own phone.</p></div></div>
  <div class="card"><h3>Invite Employee</h3><input id="emp-name" placeholder="Employee name (label only)">
  <div class="permission-grid"><label><input type="checkbox" id="perm-sales" checked> Sales</label><label><input type="checkbox" id="perm-customers" checked> Customers</label><label><input type="checkbox" id="perm-payments" checked> Payments</label><label><input type="checkbox" id="perm-suppliers"> Suppliers</label></div>
  <button class="btn" id="btn-invite-employee" onclick="createEmployeeInvite()"><i class="fas fa-user-plus"></i> Create Invite Code</button><p class="form-help">Give this code to your employee. They select Employee during first-time signup and enter the code. No email is required.</p><div id="invite-code-result"></div></div>
  <div class="card"><h3>Team</h3>${members.length?members.map(m=>`<div class="list-item"><div class="list-item-info"><h4><i class="fas fa-user"></i> ${esc(m.displayName||m.username||m.id)}</h4><p>@${esc(m.username||'')} • ${m.role||'employee'} • ${m.active===false?'Disabled':'Active'}</p></div>${m.role==='employee'?`<button class="btn btn-secondary btn-sm" onclick="toggleEmployeeActive('${m.id}',${m.active===false})">${m.active===false?'Enable':'Disable'}</button>`:''}</div>`).join(''):'<p style="color:var(--gray);padding:8px 0;">No employees yet.</p>'}</div>`;
}
export async function createEmployeeInvite(){
  if(window.currentRole!=='admin') return window.showToast?.('Admin access required.','warning');
  const name=document.getElementById('emp-name')?.value.trim(); if(!name)return alert('Enter an employee name.');
  const permissions={sales:!!document.getElementById('perm-sales')?.checked,customers:!!document.getElementById('perm-customers')?.checked,payments:!!document.getElementById('perm-payments')?.checked,suppliers:!!document.getElementById('perm-suppliers')?.checked};
  window.showLoading('btn-invite-employee','Creating...');
  try{let code=randomCode(); for(let i=0;i<4;i++){const ref=window.doc(window.db,'businessInvites',code); const snap=await window.getDoc(ref); if(!snap.exists())break; code=randomCode();}
    await window.setDoc(window.doc(window.db,'businessInvites',code),{ownerId:window.currentUserId,name,role:'employee',permissions,status:'pending',code,createdAt:new Date().toISOString()});
    const result=document.getElementById('invite-code-result'); if(result)result.innerHTML=`<div class="invite-code"><strong>Employee invite code</strong><div>${code}</div><small>Share this code with ${esc(name)}.</small></div>`;
    window.showToast?.('Invite code created successfully.','success');
  }catch(e){console.error(e);alert(e.message||'Could not create invite code.');}finally{window.hideLoading('btn-invite-employee');}
}
export async function cancelEmployeeInvite(id){ await window.deleteDoc(window.doc(window.db,'businessInvites',id)); }
export async function toggleEmployeeActive(id,next){try{await window.updateDoc(window.doc(window.db,'businessMembers',id),{active:!!next,updatedAt:new Date().toISOString()});window.showToast?.(next?'Employee enabled.':'Employee disabled.','success');}catch(e){alert('Could not update employee access.');}}
