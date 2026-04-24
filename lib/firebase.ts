import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// 🛡️ VERIFIED HARDCODED CONFIG (IDENTITY HARDENING)
// These values are sourced directly from the Firebase Cloud Console as of 4/21/2026
const firebaseConfig = {
  apiKey: "AIzaSyC2zJc4VWoOBXVZlOP2vzsd5EWeMZBdytQ",
  authDomain: "blueteeth-rewards.firebaseapp.com",
  projectId: "blueteeth-rewards",
  storageBucket: "blueteeth-rewards.firebasestorage.app",
  messagingSenderId: "900814150641",
  appId: "1:900814150641:web:576b875aa2a370af138250"
};

// Initialize Firebase with Ultimate Persistence
let app: any;
let auth: any;
let db: any;
let storage: any;

try {
  if (getApps().length > 0) {
    app = getApp();
  } else {
    console.log(">>> [CLINICAL CORE]: Connecting to blueteeth-rewards...");
    app = initializeApp(firebaseConfig);
  }

  if (app) {
    auth = getAuth(app);
    storage = getStorage(app);

    // [PERFORMANCE] Use modern persistentLocalCache for instant offline/refresh loading
    // This replaces deprecated enableMultiTabIndexedDbPersistence which silently fails
    if (typeof window !== 'undefined') {
      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        });
        console.log('>>> [CLINICAL CORE]: Persistent cache enabled (multi-tab).');
      } catch (e) {
        // Already initialized (e.g. HMR in dev) - fall back to default
        db = getFirestore(app);
        console.warn('>>> [CLINICAL CORE]: Using default Firestore (cache already set).');
      }
    } else {
      // SSR: no cache
      db = getFirestore(app);
    }
  }
} catch (error) {
  console.error(">>> [CLINICAL CORE FAILURE]:", error);
}

export { auth, db, storage };
