export function renderSettings(container) {
    const data = window.data;
    const auth = window.auth;
    const user = auth.currentUser;
    const userEmail = user ? user.email : 'Not logged in';
    const isEmailUser = user && user.providerData.some(p => p.providerId === 'password');
    const theme = window.currentTheme || data.settings.theme || 'teal';
    const dark = !!window.darkMode;
    const themes = [
        ['teal','Teal','var(--theme-teal)'], ['orange','Orange','var(--theme-orange)'],
        ['blue','Blue','var(--theme-blue)'], ['purple','Purple','var(--theme-purple)'], ['rose','Rose','var(--theme-rose)']
    ];
    container.innerHTML = `
      <div class="settings-hero"><div class="settings-hero-icon"><i class="fas fa-sliders-h"></i></div><div><span class="eyebrow">PERSONALIZE</span><h2>Make MyBusiness yours</h2><p>Choose a comfortable look. Your choice also works offline.</p></div></div>
      <div class="card theme-card"><div class="section-title"><div><h3>Appearance</h3><p>Pick your accent and light or dark mode.</p></div><i class="fas fa-palette"></i></div>
        <div class="theme-options">${themes.map(([id,label]) => `<button class="theme-choice ${theme===id?'active':''}" data-theme-choice="${id}" onclick="selectTheme('${id}')"><span class="theme-dot theme-${id}"></span><span>${label}</span>${theme===id?'<i class="fas fa-check"></i>':''}</button>`).join('')}</div>
        <button class="mode-toggle" onclick="toggleDarkMode()"><span class="mode-icon"><i class="fas ${dark?'fa-moon':'fa-sun'}"></i></span><span><strong>${dark?'Dark mode':'Light mode'}</strong><small>${dark?'Easier on the eyes at night':'Bright, clean and familiar'}</small></span><span class="switch ${dark?'on':''}"><span></span></span></button>
      </div>
      <div class="card"><div class="section-title"><div><h3>Business</h3><p>These details appear throughout your app.</p></div><i class="fas fa-store"></i></div>
        <div class="form-group"><label>Business Name</label><input type="text" id="set-name" value="${data.settings.name || ''}" placeholder="e.g. Sana General Store"></div>
        <div class="form-group"><label>Currency Symbol</label><input type="text" id="set-currency" value="${data.settings.currency || 'Rs.'}" maxlength="8" placeholder="Rs."></div>
        <button class="btn" id="btn-save-settings" onclick="saveSettings()">Save Business Settings</button>
      </div>
      <div class="card offline-card"><div class="section-title"><div><h3>Offline-first</h3><p>MyBusiness keeps your cached records available without internet. New Firestore changes wait on the device and sync automatically when the connection returns.</p></div><i class="fas fa-cloud"></i></div><div class="offline-status-row"><span class="status-dot ${navigator.onLine?'online':'offline'}"></span><strong>${navigator.onLine?'Connected':'Working offline'}</strong><span class="muted">${navigator.onLine?'Sync is available':'Changes will sync automatically'}</span></div></div>
      <div class="card"><div class="section-title"><div><h3>Android app</h3><p>Install the MyBusiness Android package when available.</p></div><i class="fab fa-android"></i></div><a href="/downloads/mybusiness.apk" download class="btn btn-secondary download-btn"><i class="fas fa-download"></i> Download Android App</a></div>
      ${isEmailUser ? `<div class="card"><div class="section-title"><div><h3>Account security</h3><p>Signed in as ${userEmail}</p></div><i class="fas fa-shield-alt"></i></div><button class="btn btn-secondary" onclick="openChangePasswordModal()">Change Password</button></div>` : `<div class="card"><div class="section-title"><div><h3>Account</h3><p>Signed in with Google as ${userEmail}</p></div><i class="fab fa-google"></i></div></div>`}
    `;
}

export function selectTheme(theme) {
    const dark = !!window.darkMode;
    window.saveLocalPreferences(theme, dark);
    if (window.renderSettings) window.renderSettings(document.getElementById('app-content'));
}
export function toggleDarkMode() {
    const theme = window.currentTheme || 'teal';
    window.saveLocalPreferences(theme, !window.darkMode);
    if (window.renderSettings) window.renderSettings(document.getElementById('app-content'));
}

export async function saveSettings() {
    const name = document.getElementById('set-name').value.trim();
    const currency = document.getElementById('set-currency').value.trim() || 'Rs.';
    window.showLoading('btn-save-settings', 'Saving...');
    try {
        await setDoc(doc(window.db, 'settings', window.currentUserId), { name, currency, theme: window.currentTheme || 'teal', darkMode: !!window.darkMode, ownerId: window.currentUserId }, { merge: true });
        window.data.settings = { ...window.data.settings, name, currency };
        alert('Business settings saved.');
    } catch (error) {
        // Firestore persistence can accept the write while offline; if the SDK
        // rejects it, preserve the business details locally for the next retry.
        localStorage.setItem('mybusiness-business-settings', JSON.stringify({ name, currency }));
        window.data.settings = { ...window.data.settings, name, currency };
        alert(navigator.onLine ? 'Could not save settings. Please try again.' : 'Saved on this device. It will sync when you are online.');
    } finally { window.hideLoading('btn-save-settings'); }
}

export function openChangePasswordModal() { const modal = document.getElementById('modal-body'); modal.innerHTML = `<div class="modal-header"><h2>Change Password</h2><button class="close-btn" onclick="closeModal()">&times;</button></div><div class="form-group"><label>Current Password</label><input type="password" id="cp-current" autocomplete="current-password"></div><div class="form-group"><label>New Password</label><input type="password" id="cp-new" autocomplete="new-password"></div><div class="form-group"><label>Confirm New Password</label><input type="password" id="cp-confirm" autocomplete="new-password"></div><button class="btn" id="btn-cp-submit" onclick="changePassword()">Update Password</button>`; document.getElementById('modal-overlay').classList.remove('hidden'); }
export async function changePassword() { const current = document.getElementById('cp-current').value; const newPass = document.getElementById('cp-new').value; const confirm = document.getElementById('cp-confirm').value; if (!current || !newPass || !confirm) return alert('All fields required.'); if (newPass.length < 6) return alert('Minimum 6 characters.'); if (newPass !== confirm) return alert("Passwords don't match."); window.showLoading('btn-cp-submit', 'Updating...'); try { const user = window.auth.currentUser; const credential = EmailAuthProvider.credential(user.email, current); await reauthenticateWithCredential(user, credential); await updatePassword(user, newPass); alert('Password updated!'); closeModal(); } catch (error) { if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') alert('Incorrect current password.'); else if (error.code === 'auth/requires-recent-login') alert('Please log out and log back in first.'); else alert('Failed to update password.'); } finally { window.hideLoading('btn-cp-submit'); } }
