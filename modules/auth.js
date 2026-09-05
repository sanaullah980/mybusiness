// Firebase imports (ensure these are available in index.html via script tags)
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
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Firebase configuration - Update these with your actual Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyDGr1v7kK5lH7P6sZaQ8nM9oP0qR1sT2uV", // Replace with your API key
    authDomain: "mybusiness-app.firebaseapp.com", // Replace with your auth domain
    projectId: "mybusiness-app-project", // Replace with your project ID
    storageBucket: "mybusiness-app.appspot.com", // Replace with your storage bucket
    messagingSenderId: "123456789012", // Replace with your sender ID
    appId: "1:123456789012:web:abcdef1234567890" // Replace with your app ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Store auth state globally
window.auth = auth;
window.db = db;
window.currentUserId = null;

// Auth state monitoring
export function initializeAuthListener(onAuthReady) {
    onAuthStateChanged(auth, async (user) => {
        try {
            if (user) {
                window.currentUserId = user.uid;
                // Hide auth screen, show main app
                document.getElementById('auth-loading').classList.add('hidden');
                document.getElementById('auth-screen').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                
                // Load user data and initialize app
                if (onAuthReady) onAuthReady(user);
            } else {
                window.currentUserId = null;
                // Show auth screen, hide main app
                document.getElementById('auth-loading').classList.add('hidden');
                document.getElementById('auth-screen').classList.remove('hidden');
                document.getElementById('main-app').classList.add('hidden');
            }
        } catch (error) {
            console.error('Auth state change error:', error);
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
        return;
    }
    
    try {
        window.showLoading('auth-button', authMode === 'signup' ? 'Signing up...' : 'Logging in...');
        
        if (authMode === 'signup') {
            // Create new user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Create user document in Firestore
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                createdAt: new Date().toISOString(),
                businessName: '',
                currency: 'Rs.',
                theme: 'light'
            });
            
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
            errorDiv.textContent = '';
        }
    } catch (error) {
        console.error('Auth error:', error);
        errorDiv.textContent = getAuthErrorMessage(error.code);
        errorDiv.style.color = 'var(--danger)';
    } finally {
        window.hideLoading('auth-button');
    }
}

// Google Sign-In
export async function signInWithGoogle() {
    const errorDiv = document.getElementById('login-error');
    
    try {
        window.showLoading('google-btn', 'Signing in...');
        
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Check if user exists in Firestore, if not create profile
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
            await setDoc(userDocRef, {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: new Date().toISOString(),
                businessName: '',
                currency: 'Rs.',
                theme: 'light'
            });
        }
        
        errorDiv.textContent = '';
    } catch (error) {
        console.error('Google sign-in error:', error);
        if (error.code !== 'auth/popup-closed-by-user') {
            errorDiv.textContent = 'Google sign-in failed. Please try again.';
            errorDiv.style.color = 'var(--danger)';
        }
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
    
    try {
        await sendPasswordResetEmail(auth, email);
        errorDiv.textContent = 'Password reset email sent! Check your inbox.';
        errorDiv.style.color = 'var(--primary)';
        
        setTimeout(() => {
            errorDiv.textContent = '';
        }, 5000);
    } catch (error) {
        console.error('Password reset error:', error);
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
    try {
        await signOut(auth);
        window.currentUserId = null;
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    }
}

// Helper function to display user-friendly error messages
function getAuthErrorMessage(errorCode) {
    const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered. Try logging in.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/operation-not-allowed': 'Email/password sign-up is not enabled.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/too-many-requests': 'Too many failed attempts. Try again later.',
        'auth/account-exists-with-different-credential': 'Account exists with different sign-in method.',
        'auth/invalid-credential': 'Invalid credentials. Please check and try again.'
    };
    
    return errorMessages[errorCode] || 'Authentication failed. Please try again.';
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
