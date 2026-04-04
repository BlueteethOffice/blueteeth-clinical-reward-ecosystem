import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

  // VERIFIED HARDCODED CONFIG (ULTIMATE SURGERY)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC2zJc4VWoOBXVZlOP2vzsd5EWeMZBdytQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "blueteeth-rewards.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "blueteeth-rewards",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "blueteeth-rewards.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "900814150641",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:900814150641:web:576b875aa2a370af138250"
};

// Initialize Firebase only if config is valid
let app: any;
let auth: any;
let db: any;
let storage: any;

try {
  if (getApps().length > 0) {
    app = getApp();
  } else {
    console.log("Firebase Initializing: blueteeth-rewards [PRODUCTION]");
    app = initializeApp(firebaseConfig);
  }

  if (app) {
    auth = getAuth(app);
    
    // ULTIMATE STABILITY MODE
    db = getFirestore(app);
    storage = getStorage(app);
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

// Global db instance with safety
export { auth, db, storage };
