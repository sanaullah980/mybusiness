// Firebase imports
import { 
    initializeApp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Firebase configuration - IMPORTANT: Update these with your actual Firebase project settings
// Get these from: https://console.firebase.google.com/ > Project Settings > Web App Config
const firebaseConfig = {
    apiKey: "AIzaSyDGr1v7kK5lH7P6sZaQ8nM9oP0qR1sT2uV",
    authDomain: "mybusiness-app.firebaseapp.com",
    projectId: "mybusiness-app-project",
    storageBucket: "mybusiness-app.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

let app, auth, db;

try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Enable persistence
    setPersistence(auth, browserLocalPersistence).catch(err => {
        console.warn('[auth] Persistence error (non-critical):', err);
    });
    
    // Configure Google Auth Provider
    const googleProvider = new GoogleAuthProvider();
    googleProvider.addScope('profile');
    googleProvider.addScope('email');
    googleProvider.setCustomParameters({
        'prompt': 'select_account'
    });
    
    window.googleProvider = googleProvider;
    
    console.log('[auth] Firebase initialized successfully');
} catch (error) {
    console.error('[auth] Firebase initialization failed:', error);
    alert('Firebase initialization error. Check console. Ensure Firebase config is correct.');
}

// Store auth and db globally
window.auth = auth;
window.db = db;
window.currentUserId = null;

// Auth state monitoring
export function initializeAuthListener(onAuthReady) {
    if (!auth) {
        console.error('[auth] Auth not initialized');
        document.getElementById('auth-loading').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        alert('Authentication system failed to initialize. Check Firebase config.');
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        try {
            if (user) {
                console.log('[auth] User authenticated:', user.email);
                window.currentUserId = user.uid;
                window.auth = auth;
                window.db = db;
                
                // Hide auth screen, show main app
                document.getElementById('auth-loading').classList.add('hidden');
                document.getElementById('auth-screen').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                
                // Load user data and initialize app
                if (onAuthReady) {
                    try {
                        await onAuthReady(user);
                    } catch (err) {
                        console.error('[auth] onAuthReady error:', err);
                    }
                }
            } else {
                console.log('[auth] User logged out');
                window.currentUserId = null;
                // Show auth screen, hide main app
                document.getElementById('auth-loading').classList.add('hidden');
                document.getElementById('auth-screen').classList.remove('hidden');
                document.getElementById('main-app').classList.add('hidden');
            }
        } catch (error) {
            console.error('[auth] Auth state change error:', error);
            document.getElementById('auth-loading').classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('hidden');
        }
    });
}

// Email/Password Authentication
export async function handleAuth() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorDiv = document.getElementById('login-error');
    const authMode = document.getElementById('auth-form').getAttribute('data-mode') || 'login';
    
    if (!email || !password) {
        errorDiv.textContent = 'Please enter email and password.';
        errorDiv.style.color = 'var(--danger)';
        return;
    }

    if (!auth || !db) {
        errorDiv.textContent = 'Authentication system not initialized. Refresh and try again.';
        errorDiv.style.color = 'var(--danger)';
        return;
    }
    
    try {
        window.showLoading('auth-button', authMode === 'signup' ? 'Signing up...' : 'Logging in...');
        
        if (authMode === 'signup') {
            // Create new user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            console.log('[auth] New user created:', user.uid);
            
            // Create user document in Firestore
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    email: user.email,
                    createdAt: new Date().toISOString(),
                    businessName: '',
                    currency: 'Rs.',
                    theme: 'light'
                });
                console.log('[auth] User profile created in Firestore');
            } catch (firestoreErr) {
                console.error('[auth] Firestore error (non-critical):', firestoreErr);
            }
            
            errorDiv.textContent = 'Account created! Logging in...';
            errorDiv.style.color = 'var(--primary)';
            
            // Reset form
            setTimeout(() => {
                document.getElementById('login-email').value = '';
                document.getElementById('login-password').value = '';
                toggleAuthMode();
            }, 1000);
        } else {
            // Sign in with email and password
            await signInWithEmailAndPassword(auth, email, password);
            console.log('[auth] User signed in with email/password');
            errorDiv.textContent = '';
        }
    } catch (error) {
        console.error('[auth] Auth error:', error);
        errorDiv.textContent = getAuthErrorMessage(error.code);
        errorDiv.style.color = 'var(--danger)';
    } finally {
        window.hideLoading('auth-button');
    }
}

// Google Sign-In
export async function signInWithGoogle() {
    const errorDiv = document.getElementById('login-error');
    const googleBtn = document.getElementById('google-btn');
    
    if (!auth || !db) {
        errorDiv.textContent = 'Authentication system not initialized. Refresh and try again.';
        errorDiv.style.color = 'var(--danger)';
        return;
    }

    if (!window.googleProvider) {
        errorDiv.textContent = 'Google authentication not configured. Check console.';
        errorDiv.style.color = 'var(--danger)';
        console.error('[auth] Google provider not initialized');
        return;
    }
    
    try {
        window.showLoading('google-btn', 'Signing in...');
        errorDiv.textContent = '';
        
        console.log('[auth] Attempting Google sign-in...');
        
        const result = await signInWithPopup(auth, window.googleProvider);
        const user = result.user;
        
        console.log('[auth] Google sign-in successful:', user.email);
        
        // Check if user exists in Firestore, if not create profile
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (!userDocSnap.exists()) {
                console.log('[auth] Creating new user profile...');
                await setDoc(userDocRef, {
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    createdAt: new Date().toISOString(),
                    businessName: '',
                    currency: 'Rs.',
                    theme: 'light'
                });
                console.log('[auth] User profile created');
            } else {
                console.log('[auth] User profile already exists');
            }
        } catch (firestoreErr) {
            console.error('[auth] Firestore error during Google sign-in:', firestoreErr);
            // Don't fail the sign-in, user is already authenticated
        }
        
        errorDiv.textContent = '';
    } catch (error) {
        console.error('[auth] Google sign-in error:', error);
        
        if (error.code === 'auth/popup-closed-by-user') {
            errorDiv.textContent = 'Sign-in cancelled.';
        } else if (error.code === 'auth/popup-blocked') {
            errorDiv.textContent = 'Pop-up blocked. Enable pop-ups and try again.';
        } else if (error.code === 'auth/operation-not-allowed') {
            errorDiv.textContent = 'Google sign-in is not enabled. Check Firebase console.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorDiv.textContent = 'This domain is not authorized. Check Firebase console > Authentication > Authorized domains.';
        } else {
            errorDiv.textContent = 'Google sign-in failed: ' + (error.message || 'Unknown error');
        }
        errorDiv.style.color = 'var(--danger)';
    } finally {
        window.hideLoading('google-btn');
    }
}

// Password Reset
export async function forgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const errorDiv = document.getElementById('login-error');
    
    if (!email) {
        errorDiv.textContent = 'Please enter your email address.';
        errorDiv.style.color = 'var(--danger)';
        return;
    }

    if (!auth) {
        errorDiv.textContent = 'Auth not initialized.';
        errorDiv.style.color = 'var(--danger)';
        return;
    }
    
    try {
        await sendPasswordResetEmail(auth, email);
        errorDiv.textContent = 'Password reset email sent! Check your inbox.';
        errorDiv.style.color = 'var(--primary)';
        
        setTimeout(() => {
            errorDiv.textContent = '';
        }, 5000);
    } catch (error) {
        console.error('[auth] Password reset error:', error);
        errorDiv.textContent = 'Could not send reset email. Check if email exists.';
        errorDiv.style.color = 'var(--danger)';
    }
}

// Toggle between Login and Signup modes
export function toggleAuthMode() {
    const form = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('toggle-auth');
    const currentMode = form.getAttribute('data-mode') || 'login';
    const newMode = currentMode === 'login' ? 'signup' : 'login';
    
    form.setAttribute('data-mode', newMode);
    
    if (newMode === 'signup') {
        document.querySelector('.login-box h2').textContent = '📝 Create Account';
        document.getElementById('auth-button').textContent = 'Sign Up';
        toggleBtn.textContent = 'Already have an account? Log In';
    } else {
        document.querySelector('.login-box h2').textContent = '🔒 Access Dashboard';
        document.getElementById('auth-button').textContent = 'Log In';
        toggleBtn.textContent = 'Don\'t have an account? Sign Up';
    }
    
    document.getElementById('login-error').textContent = '';
}

// Logout
export async function handleLogout() {
    if (!auth) {
        console.error('[auth] Auth not initialized');
        return;
    }

    try {
        await signOut(auth);
        window.currentUserId = null;
        console.log('[auth] User logged out');
    } catch (error) {
        console.error('[auth] Logout error:', error);
        alert('Logout failed. Please try again.');
    }
}

// Helper function to display user-friendly error messages
function getAuthErrorMessage(errorCode) {
    const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered. Try logging in.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/operation-not-allowed': 'Email/password sign-up is not enabled in Firebase Console.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/too-many-requests': 'Too many failed attempts. Try again later.',
        'auth/account-exists-with-different-credential': 'Account exists with different sign-in method.',
        'auth/invalid-credential': 'Invalid credentials. Please check and try again.',
        'auth/network-request-failed': 'Network error. Check your connection.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/invalid-api-key': 'Invalid API key. Check Firebase config.',
        'auth/app-not-authorized': 'App not authorized. Check Firebase config.',
    };
    
    return errorMessages[errorCode] || 'Authentication failed: ' + errorCode;
}

// Utility: Show loading state on button
window.showLoading = function(buttonId, text = 'Loading...') {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = true;
        button.setAttribute('data-original-text', button.textContent);
        button.textContent = text;
    }
};

// Utility: Hide loading state on button
window.hideLoading = function(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = false;
        button.textContent = button.getAttribute('data-original-text') || 'Submit';
    }
};

// Export functions to window for onclick handlers in HTML
window.handleAuth = handleAuth;
window.signInWithGoogle = signInWithGoogle;
window.forgotPassword = forgotPassword;
window.toggleAuthMode = toggleAuthMode;
window.handleLogout = handleLogout;
window.initializeAuthListener = initializeAuthListener;

console.log('[auth.js] Module loaded');
