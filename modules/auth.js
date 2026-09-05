```javascript
// MyBusinessApp/modules/auth.js

// Firebase App
import {
    initializeApp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';

// Firebase Authentication
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

// Firebase Firestore
import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';


// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyBQqnIhMCGd4_FRApjkns3HjIrqw2V1qFc",
    authDomain: "mybusinessapp-4734c.firebaseapp.com",
    projectId: "mybusinessapp-4734c",
    storageBucket: "mybusinessapp-4734c.firebasestorage.app",
    messagingSenderId: "367002926256",
    appId: "1:367002926256:web:0b5139dab24d901d9c8f75",
    measurementId: "G-HBC31ZFKMG"
};


// ============================================================
// INITIALIZE FIREBASE
// ============================================================

let app = null;
let auth = null;
let db = null;
let googleProvider = null;

try {
    app = initializeApp(firebaseConfig);

    auth = getAuth(app);
    db = getFirestore(app);

    // Keep users logged in after closing/reopening the app.
    setPersistence(auth, browserLocalPersistence)
        .catch((error) => {
            console.warn('[auth] Persistence could not be enabled:', error);
        });

    // Google provider
    googleProvider = new GoogleAuthProvider();

    googleProvider.addScope('profile');
    googleProvider.addScope('email');

    googleProvider.setCustomParameters({
        prompt: 'select_account'
    });

    console.log('[auth] Firebase initialized successfully');

} catch (error) {
    console.error('[auth] Firebase initialization failed:', error);
}


// ============================================================
// GLOBAL AUTH STATE
// ============================================================

window.auth = auth;
window.db = db;
window.googleProvider = googleProvider;
window.currentUserId = null;


// ============================================================
// SAFE UI HELPERS
// ============================================================

function showAuthScreen() {
    const loading = document.getElementById('auth-loading');
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');

    if (loading) loading.classList.add('hidden');
    if (authScreen) authScreen.classList.remove('hidden');
    if (mainApp) mainApp.classList.add('hidden');
}

function showMainApp() {
    const loading = document.getElementById('auth-loading');
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');

    if (loading) loading.classList.add('hidden');
    if (authScreen) authScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
}


// ============================================================
// AUTH STATE LISTENER
// ============================================================

export function initializeAuthListener(onAuthReady) {

    if (!auth) {
        console.error('[auth] Firebase Auth is not initialized.');

        showAuthScreen();

        const errorDiv = document.getElementById('login-error');

        if (errorDiv) {
            errorDiv.textContent =
                'Authentication could not be initialized. Please refresh the page.';
            errorDiv.style.color = 'var(--danger)';
        }

        return;
    }

    console.log('[auth] Starting authentication listener...');

    onAuthStateChanged(auth, async (user) => {

        try {

            if (user) {

                console.log('[auth] User authenticated:', user.email);

                window.currentUserId = user.uid;
                window.auth = auth;
                window.db = db;

                // Show application immediately.
                // This prevents the user from getting stuck on the loading screen.
                showMainApp();

                if (typeof onAuthReady === 'function') {
                    try {
                        await onAuthReady(user);
                    } catch (error) {
                        console.error(
                            '[auth] Application initialization error:',
                            error
                        );
                    }
                }

            } else {

                console.log('[auth] No authenticated user.');

                window.currentUserId = null;

                showAuthScreen();
            }

        } catch (error) {

            console.error('[auth] Auth state error:', error);

            window.currentUserId = null;

            showAuthScreen();
        }

    });
}


// ============================================================
// EMAIL / PASSWORD LOGIN + SIGNUP
// ============================================================

export async function handleAuth() {

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const form = document.getElementById('auth-form');
    const errorDiv = document.getElementById('login-error');

    if (!emailInput || !passwordInput || !form) {
        console.error('[auth] Authentication form not found.');
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const authMode =
        form.getAttribute('data-mode') || 'login';

    if (!email || !password) {

        if (errorDiv) {
            errorDiv.textContent =
                'Please enter your email address and password.';
            errorDiv.style.color = 'var(--danger)';
        }

        return;
    }

    if (!auth || !db) {

        if (errorDiv) {
            errorDiv.textContent =
                'Authentication system is not ready. Please refresh the page.';
            errorDiv.style.color = 'var(--danger)';
        }

        return;
    }

    try {

        window.showLoading(
            'auth-button',
            authMode === 'signup'
                ? 'Creating account...'
                : 'Logging in...'
        );

        if (authMode === 'signup') {

            const userCredential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            const user = userCredential.user;

            console.log('[auth] Account created:', user.uid);

            // Create user's Firestore profile.
            try {

                await setDoc(
                    doc(db, 'users', user.uid),
                    {
                        email: user.email,
                        createdAt: new Date().toISOString(),
                        businessName: '',
                        currency: 'Rs.',
                        theme: 'light'
                    },
                    {
                        merge: true
                    }
                );

            } catch (firestoreError) {

                // Firestore failure should NOT log the user out.
                console.warn(
                    '[auth] Could not create Firestore profile:',
                    firestoreError
                );
            }

            if (errorDiv) {
                errorDiv.textContent =
                    'Account created successfully!';
                errorDiv.style.color = 'var(--primary)';
            }

        } else {

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            console.log('[auth] Email login successful.');

            if (errorDiv) {
                errorDiv.textContent = '';
            }
        }

    } catch (error) {

        console.error('[auth] Email authentication error:', error);

        if (errorDiv) {
            errorDiv.textContent =
                getAuthErrorMessage(error.code);
            errorDiv.style.color = 'var(--danger)';
        }

    } finally {

        window.hideLoading('auth-button');
    }
}


// ============================================================
// GOOGLE SIGN-IN
// ============================================================

export async function signInWithGoogle() {

    const errorDiv =
        document.getElementById('login-error');

    if (!auth || !googleProvider) {

        if (errorDiv) {
            errorDiv.textContent =
                'Google authentication is not ready. Please refresh the page.';
            errorDiv.style.color = 'var(--danger)';
        }

        return;
    }

    try {

        window.showLoading(
            'google-btn',
            'Signing in...'
        );

        if (errorDiv) {
            errorDiv.textContent = '';
        }

        console.log('[auth] Starting Google sign-in...');

        const result =
            await signInWithPopup(
                auth,
                googleProvider
            );

        const user = result.user;

        console.log(
            '[auth] Google sign-in successful:',
            user.email
        );

        // Create profile if it does not exist.
        try {

            const userRef =
                doc(db, 'users', user.uid);

            const userSnapshot =
                await getDoc(userRef);

            if (!userSnapshot.exists()) {

                await setDoc(
                    userRef,
                    {
                        email: user.email || '',
                        displayName: user.displayName || '',
                        photoURL: user.photoURL || '',
                        createdAt: new Date().toISOString(),
                        businessName: '',
                        currency: 'Rs.',
                        theme: 'light'
                    },
                    {
                        merge: true
                    }
                );

                console.log(
                    '[auth] Google user profile created.'
                );
            }

        } catch (firestoreError) {

            // VERY IMPORTANT:
            // A Firestore profile error must NOT cancel
            // an already successful Google login.

            console.warn(
                '[auth] Firestore profile error:',
                firestoreError
            );
        }

        // Authentication succeeded.
        // onAuthStateChanged will open the application.

    } catch (error) {

        console.error(
            '[auth] Google sign-in error:',
            error
        );

        if (errorDiv) {

            switch (error.code) {

                case 'auth/popup-closed-by-user':
                    errorDiv.textContent =
                        'Google sign-in was cancelled.';
                    break;

                case 'auth/popup-blocked':
                    errorDiv.textContent =
                        'Your browser blocked the Google sign-in window. Allow pop-ups and try again.';
                    break;

                case 'auth/operation-not-allowed':
                    errorDiv.textContent =
                        'Google Sign-In is disabled in Firebase. Enable Google under Authentication → Sign-in method.';
                    break;

                case 'auth/unauthorized-domain':
                    errorDiv.textContent =
                        'This website domain is not authorized in Firebase Authentication.';
                    break;

                case 'auth/invalid-api-key':
                    errorDiv.textContent =
                        'Firebase API key is invalid. Make sure the latest Firebase configuration is being used.';
                    break;

                case 'auth/network-request-failed':
                    errorDiv.textContent =
                        'Network error. Check your internet connection and try again.';
                    break;

                default:
                    errorDiv.textContent =
                        'Google sign-in failed: ' +
                        (error.message || 'Unknown error.');
            }

            errorDiv.style.color = 'var(--danger)';
        }

    } finally {

        window.hideLoading('google-btn');
    }
}


// ============================================================
// FORGOT PASSWORD
// ============================================================

export async function forgotPassword(event) {

    if (event) {
        event.preventDefault();
    }

    const emailInput =
        document.getElementById('login-email');

    const errorDiv =
        document.getElementById('login-error');

    const email =
        emailInput
            ? emailInput.value.trim()
            : '';

    if (!email) {

        if (errorDiv) {
            errorDiv.textContent =
                'Enter your email address first.';
            errorDiv.style.color = 'var(--danger)';
        }

        return;
    }

    if (!auth) {

        if (errorDiv) {
            errorDiv.textContent =
                'Authentication is not initialized.';
            errorDiv.style.color = 'var(--danger)';
        }

        return;
    }

    try {

        await sendPasswordResetEmail(
            auth,
            email
        );

        if (errorDiv) {
            errorDiv.textContent =
                'Password reset email sent. Check your inbox.';
            errorDiv.style.color = 'var(--primary)';
        }

    } catch (error) {

        console.error(
            '[auth] Password reset error:',
            error
        );

        if (errorDiv) {
            errorDiv.textContent =
                getAuthErrorMessage(error.code);
            errorDiv.style.color = 'var(--danger)';
        }
    }
}


// ============================================================
// TOGGLE LOGIN / SIGNUP
// ============================================================

export function toggleAuthMode() {

    const form =
        document.getElementById('auth-form');

    const toggleBtn =
        document.getElementById('toggle-auth');

    const heading =
        document.querySelector('.login-box h2');

    const authButton =
        document.getElementById('auth-button');

    if (!form) return;

    const currentMode =
        form.getAttribute('data-mode') || 'login';

    const newMode =
        currentMode === 'login'
            ? 'signup'
            : 'login';

    form.setAttribute(
        'data-mode',
        newMode
    );

    if (newMode === 'signup') {

        if (heading)
            heading.textContent = '📝 Create Account';

        if (authButton)
            authButton.textContent = 'Sign Up';

        if (toggleBtn)
            toggleBtn.textContent =
                'Already have an account? Log In';

    } else {

        if (heading)
            heading.textContent = '🔒 Access Dashboard';

        if (authButton)
            authButton.textContent = 'Log In';

        if (toggleBtn)
            toggleBtn.textContent =
                "Don't have an account? Sign Up";
    }

    const errorDiv =
        document.getElementById('login-error');

    if (errorDiv) {
        errorDiv.textContent = '';
    }
}


// ============================================================
// LOGOUT
// ============================================================

export async function handleLogout() {

    if (!auth) {
        console.error('[auth] Firebase Auth not initialized.');
        return;
    }

    try {

        await signOut(auth);

        window.currentUserId = null;

        console.log('[auth] User logged out.');

    } catch (error) {

        console.error(
            '[auth] Logout error:',
            error
        );

        alert(
            'Logout failed. Please try again.'
        );
    }
}


// ============================================================
// USER-FRIENDLY AUTH ERRORS
// ============================================================

function getAuthErrorMessage(errorCode) {

    const errorMessages = {

        'auth/email-already-in-use':
            'This email is already registered. Try logging in.',

        'auth/invalid-email':
            'Please enter a valid email address.',

        'auth/operation-not-allowed':
            'This sign-in method is not enabled in Firebase.',

        'auth/weak-password':
            'Password must be at least 6 characters.',

        'auth/user-not-found':
            'No account was found with this email.',

        'auth/wrong-password':
            'Incorrect password.',

        'auth/invalid-credential':
            'The email or password is incorrect.',

        'auth/too-many-requests':
            'Too many failed attempts. Please wait and try again.',

        'auth/account-exists-with-different-credential':
            'An account already exists using a different sign-in method.',

        'auth/network-request-failed':
            'Network error. Check your internet connection.',

        'auth/user-disabled':
            'This account has been disabled.',

        'auth/invalid-api-key':
            'Firebase API key is invalid.',

        'auth/app-not-authorized':
            'This Firebase app is not authorized.',

        'auth/unauthorized-domain':
            'This website domain is not authorized in Firebase.'
    };

    return (
        errorMessages[errorCode] ||
        'Authentication failed. Please try again.'
    );
}


// ============================================================
// BUTTON LOADING HELPERS
// ============================================================

window.showLoading = function (
    buttonId,
    text = 'Loading...'
) {

    const button =
        document.getElementById(buttonId);

    if (!button) return;

    if (!button.hasAttribute('data-original-text')) {

        button.setAttribute(
            'data-original-text',
            button.textContent
        );
    }

    button.disabled = true;
    button.textContent = text;
};


window.hideLoading = function (buttonId) {

    const button =
        document.getElementById(buttonId);

    if (!button) return;

    button.disabled = false;

    const originalText =
        button.getAttribute(
            'data-original-text'
        );

    if (originalText) {

        button.textContent =
            originalText;

        button.removeAttribute(
            'data-original-text'
        );
    }
};


// ============================================================
// GLOBAL FUNCTIONS FOR index.html onclick HANDLERS
// ============================================================

window.handleAuth = handleAuth;
window.signInWithGoogle = signInWithGoogle;
window.forgotPassword = forgotPassword;
window.toggleAuthMode = toggleAuthMode;
window.handleLogout = handleLogout;
window.initializeAuthListener = initializeAuthListener;

console.log('[auth.js] Authentication module loaded successfully.');
```
