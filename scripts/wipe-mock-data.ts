
import { db } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';

/**
 * CLINICAL DATA PURGE SCRIPT (PROD-READY WIPE)
 * Eliminates all mock records to ensure a production-ready clean state.
 */
async function wipeMockData() {
  console.log('>>> [PURGE] Initiating Clinical Registry Wipe...');

  try {
    // 1. WIPE ALL CASES
    const casesSnap = await getDocs(collection(db, 'cases'));
    console.log(`>>> [PURGE] Found ${casesSnap.size} Clinical Cases.`);
    for (const docSnap of casesSnap.docs) {
       console.log(`>>> [PURGE] Deleting Case: ${docSnap.id}`);
       await deleteDoc(docSnap.ref);
    }

    // 2. RESET DOCTOR IDENTITY
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`>>> [PURGE] Processing ${usersSnap.size} Identities...`);
    for (const docSnap of usersSnap.docs) {
       console.log(`>>> [PURGE] Resetting Wallet: ${docSnap.id}`);
       await updateDoc(docSnap.ref, {
         totalPoints: 0,
         walletBalance: 0,
         totalEarnings: 0
       });
    }

    console.log('>>> [SUCCESS] All Mock Data & Identies Resetted Perfectly.');
    process.exit(0);
  } catch (error: any) {
    console.error('>>> [CRITICAL] Purge Failure:', error.message);
    process.exit(1);
  }
}

wipeMockData();
