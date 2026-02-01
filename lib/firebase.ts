import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDaWTt4is5Gy6BHWdtTbsMHNlM2d11i7us",
    authDomain: "sailsetulogin.firebaseapp.com",
    projectId: "sailsetulogin",
    storageBucket: "sailsetulogin.firebasestorage.app",
    messagingSenderId: "378044735157",
    appId: "1:378044735157:web:5ae978f7338d0e7bf6e8fc",
    measurementId: "G-M0S43WCG64"
};

// Initialize Firebase (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
    prompt: 'select_account'
});
