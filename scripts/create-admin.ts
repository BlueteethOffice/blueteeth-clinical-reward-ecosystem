
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';

/**
 * CLINICAL ADMIN INITIALIZATION SCRIPT
 * Forges the official 'admin@blueteeth.in' node in Firebase Auth & Firestore.
 */
async function initializeAdmin() {
  const adminEmail = 'admin@blueteeth.in';
  const adminPass = 'Niteen@102'; // Official Admin Credential Requested

  console.log('>>> [INIT] Forging Admin Identity Node:', adminEmail);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
    const user = userCredential.user;

    await updateProfile(user, { displayName: 'Master Admin' });

    // Sync Master Identity to Clinical Firestore Buffer
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: adminEmail,
      name: 'Master Admin',
      role: 'admin',
      isVerified: true,
      pending: false,
      joinedAt: serverTimestamp(),
      totalPoints: 0,
      walletBalance: 0
    });

    console.log('>>> [SUCCESS] Master Identity Successfully Forged in Clinical Network.');
    return true;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
       console.log('>>> [NOTE] Admin Identity Already Registered in Firebase Auth.');
       return true;
    }
    console.error('>>> [CRITICAL] Forge Failure:', error.message);
    return false;
  }
}

initializeAdmin();
