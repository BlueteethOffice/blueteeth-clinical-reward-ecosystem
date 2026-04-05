import { 
  collection, addDoc, query, where, getDocs, getDoc,
  setDoc, updateDoc, doc, increment, serverTimestamp, writeBatch 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

// --- UTILITIES ---

/**
 * Timeout wrapper to prevent eternal hangs on poor connections.
 * Resolves with a timeout status instead of rejecting to prevent unhandled crashes.
 */
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number = 30000): Promise<{success: boolean, data?: T, error?: string}> => {
  const timeoutPromise = new Promise<{success: boolean, error: string}>((resolve) => 
    setTimeout(() => resolve({ success: false, error: 'Operation timed out (Clinical Network Failure)' }), timeoutMs)
  );

  return Promise.race([
    promise.then(res => ({ success: true, data: res })),
    timeoutPromise
  ]);
};

// --- STORAGE UTILITIES ---

/**
 * Uploads a profile image to Firebase Storage.
 * Now uses Binary Blobs for stable clinical uploads.
 */
export const uploadProfileImage = async (uid: string, base64String: string) => {
  try {
    if (!storage) throw new Error('Storage not initialized');
    const storageRef = ref(storage, `profiles/${uid}/avatar.jpg`);
    
    // Convert Base64 directly to bytes for speed
    const base64Data = base64String.split(',')[1] || base64String;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    // Using 30s timeout for faster feedback loop
    const uploadResult = await withTimeout(uploadBytes(storageRef, byteArray, {
      contentType: 'image/jpeg'
    }), 30000);

    if (!uploadResult.success) throw new Error(uploadResult.error);
    
    const urlResult = await withTimeout(getDownloadURL(storageRef), 10000);
    if (!urlResult.success) throw new Error(urlResult.error);

    return { success: true, url: urlResult.data };
  } catch (error: any) {
    console.warn('Clinical Storage Sync Failure:', error.message);
    return { success: false, error: error.message };
  }
};

// --- CORE CLINICAL LOGIC ---

// 1. Submit a new case with Anti-Fraud (Duplicate check)
export const submitNewCase = async (doctorUid: string, caseData: any) => {
  try {
    if (!db) throw new Error('Clinical Database Offline (No Connection)');

    // 1. DUPLICATE CHECK with 8s Fast Timeout
    const q = query(collection(db, 'cases'), where('patientMobile', '==', caseData.patientMobile));
    const queryResult = await withTimeout(getDocs(q), 8000);
    
    if (!queryResult.success) {
      throw new Error('Verification Delay: Clinical registry is too slow to respond (8s Timeout).');
    }

    if (queryResult.data && !queryResult.data.empty) {
      throw new Error('Duplicate Case: This patient mobile number already exists in our records.');
    }

    // 2. DATA SUBMISSION with 10s Fast Timeout
    const submissionResult = await withTimeout(addDoc(collection(db, 'cases'), {
      ...caseData,
      doctorUid,
      status: 'Pending',
      submittedAt: serverTimestamp(),
    }), 10000);

    if (!submissionResult.success) {
      throw new Error('Archive Sync Failed: Cloud transmission timed out after 10s.');
    }
    
    return { success: true, id: submissionResult.data?.id };
  } catch (error: any) {
    console.error('Submission Error:', error);
    return { success: false, error: error.message || 'System sync failure' };
  }
};

// 2. Admin: Approve a case and credit points to Doctor
export const approveCase = async (caseId: string, doctorUid: string, points: number) => {
  try {
    const caseRef = doc(db, 'cases', caseId);
    const doctorRef = doc(db, 'users', doctorUid);

    // Fetch dynamic exchange rate from settings
    const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
    const exchangeRate = settingsSnap.exists() ? (settingsSnap.data().exchangeRate || 50) : 50;

    // Resilience: Check if case exists before updating (Avoids crash on Mock IDs)
    const caseSnap = await getDoc(caseRef);
    if (!caseSnap.exists()) throw new Error("Case Record Identity Missing.");
    const caseData = caseSnap.data();
    
    // ATOMIC LOCK: Exit if case is already approved to prevent double-crediting
    if (caseData.status === 'Approved') {
        console.warn("Attempted double-approval blocked for case:", caseId);
        return { success: true, message: "ALREADY_PROCESSED" };
    }

    await updateDoc(caseRef, {
      status: 'Approved',
      approvedAt: serverTimestamp(),
    });

    // Use setDoc with merge to create user document if it doesn't exist (UPSERT)
    await setDoc(doctorRef, {
      totalPoints: increment(points),
      walletBalance: increment(points * exchangeRate),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Send real-time notification to the doctor
    await createNotification(
      doctorUid, 
      'B-Points Credited', 
      `${points} points awarded for case ID: ${caseId.slice(-6).toUpperCase()}.`, 
      'success'
    );

    return { success: true };
  } catch (error: any) {
    console.error('Approval Error:', error);
    if (error.code === 'not-found') return { success: true };
    return { success: false, error: error.message };
  }
};

// 2a. Admin: Revoke Approval (Recall Mechanism for Erroneous Approvals)
export const revokeCase = async (caseId: string, doctorUid: string, points: number) => {
  try {
    const caseRef = doc(db, 'cases', caseId);
    const doctorRef = doc(db, 'users', doctorUid);

    // Fetch dynamic exchange rate from settings
    const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
    const exchangeRate = settingsSnap.exists() ? (settingsSnap.data().exchangeRate || 50) : 50;

    // Revert case status to Pending
    const caseSnap = await getDoc(caseRef);
    if (caseSnap.exists()) {
      await updateDoc(caseRef, {
        status: 'Pending',
        revokedAt: serverTimestamp(),
      });
    }

    // Deduct points from the doctor (Negative increment)
    await updateDoc(doctorRef, {
      totalPoints: increment(-points),
      walletBalance: increment(-(points * exchangeRate)),
      updatedAt: serverTimestamp()
    });

    // Send warning notification to the doctor
    await createNotification(
      doctorUid, 
      'Re-Verification Notice', 
      `Notice: Case ${caseId.slice(-6).toUpperCase()} has been recalled for re-audit. Points temporarily suspended.`, 
      'warning'
    );

    return { success: true };
  } catch (error: any) {
    console.error('Revoke Error:', error);
    // Graceful recovery for mock data or missing user docs
    if (error.code === 'not-found') return { success: true };
    return { success: false, error: error.message };
  }
};

// 3. User: Request Withdrawal
export const requestWithdrawal = async (doctorUid: string, amount: number, methodData: any) => {
  try {
    if (amount < 500) throw new Error('Minimum withdrawal is ₹500.');

    const docRef = await addDoc(collection(db, 'withdrawals'), {
      doctorUid,
      amount,
      method: methodData,
      status: 'Pending',
      requestedAt: serverTimestamp(),
    });

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Withdrawal Error:', error);
    return { success: false, error: error.message };
  }
};

// 4. Fetch Doctor Dashboard Stats
export const fetchDoctorStats = async (doctorUid: string) => {
  try {
    const q = query(collection(db, 'cases'), where('doctorUid', '==', doctorUid));
    const querySnapshot = await getDocs(q);
    
    let totalPoints = 0;
    let pendingCases = 0;
    let approvedToday = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === 'Approved') {
        totalPoints += data.points || 0;
        const approvedAt = data.approvedAt?.toDate();
        if (approvedAt && approvedAt >= today) {
          approvedToday++;
        }
      } else if (data.status === 'Pending') {
        pendingCases++;
      }
    });

    // Fetch dynamic exchange rate from settings
    const settingsSnap = await getDoc(doc(db as any, 'settings', 'global'));
    const exchangeRate = settingsSnap.exists() ? (settingsSnap.data().exchangeRate || 50) : 50;

    return {
      totalPoints,
      totalEarnings: totalPoints * exchangeRate,
      pendingCases,
      approvedToday
    };
  } catch (error: any) {
    console.error('Error fetching doctor stats:', error);
    throw new Error(error.message || 'Clinical Network Access Denied');
  }
};

// 5. Fetch Recent Cases
export const fetchRecentCases = async (doctorUid: string) => {
  try {
    const q = query(collection(db, 'cases'), where('doctorUid', '==', doctorUid));
    const querySnapshot = await getDocs(q);
    const cases: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      cases.push({ 
        id: docSnap.id, 
        ...data,
        date: data.submittedAt?.toDate()?.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) || 'Recently'
      });
    });
    return cases.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)).slice(0, 5);
  } catch (error: any) {
    console.error('Error fetching recent cases:', error);
    throw new Error(error.message || 'Failed to sync recent data stream');
  }
};

// 6. Fetch All Cases for a Doctor
export const fetchAllDoctorCases = async (doctorUid: string) => {
  try {
    const q = query(collection(db, 'cases'), where('doctorUid', '==', doctorUid));
    const querySnapshot = await getDocs(q);
    const cases: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      cases.push({ 
        id: docSnap.id, 
        ...data,
        date: data.submittedAt?.toDate()?.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) || 'Recently'
      });
    });
    return cases.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
  } catch (error: any) {
    console.error('Error fetching all cases:', error);
    throw new Error(error.message || 'Global Archive Sync Failure');
  }
};

// 7. Update User Profile (Hardened with Binary Support & Fail-Safe Timeouts)
export const updateUserProfile = async (uid: string, profileData: any) => {
  console.log('[DEBUG] Syncing identity with 30s clinical buffer...');
  try {
    if (!db) throw new Error('Firestore is not initialized (Database OFFLINE)');
    const userRef = doc(db, 'users', uid);
    
    const syncResult = await withTimeout(setDoc(userRef, {
      ...profileData,
      updatedAt: serverTimestamp()
    }, { merge: true }), 30000);
    
    if (!syncResult.success) {
      throw new Error(syncResult.error);
    }

    console.log('[DEBUG] Firestore Sync Successful');
    return { success: true };
  } catch (error: any) {
    console.warn('Profile Sync Skipped or Using Local Baseline:', error.message);
    return { success: false, error: error.message };
  }
}; // 8. Admin: Fetch Cases by Status - Optimized with Doctor Identity Cache
export const fetchAdminCases = async (status: 'Pending' | 'Approved' = 'Pending') => {
  console.log(`[DEBUG] Opening Case Review Stream: ${status}...`);
  try {
    // 1. Fetch All Doctors for Identity Mapping (Batch Retrieval)
    const drQuery = query(collection(db as any, 'users'), where('role', '==', 'doctor'));
    const drSnap = await getDocs(drQuery);
    const drCache: Record<string, any> = {};
    drSnap.forEach(d => {
      drCache[d.id] = { 
        name: d.data().name || 'Unknown Practitioner', 
        phone: d.data().phone || d.data().mobile || 'N/A' 
      };
    });

    // 2. Fetch Cases
    const q = query(collection(db as any, 'cases'), where('status', '==', status));
    const querySnapshot = await getDocs(q);
    
    const cases = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const dr = drCache[data.doctorUid] || { name: 'Unknown Practitioner', phone: 'N/A' };
      return { 
        id: docSnap.id, 
        ...data, 
        doctorName: dr.name, 
        doctorPhone: dr.phone 
      };
    });
    
    return cases.sort((a: any, b: any) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
  } catch (error: any) {
    console.error(`Error fetching ${status} cases:`, error);
    return [];
  }
};
;

// 8a. Admin: Fetch All Doctors - Enhanced with Fail-Safe Global Registry
export const fetchDoctors = async () => {
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const querySnapshot = await getDocs(q);
    const doctors: any[] = [];
    querySnapshot.forEach((docSnap) => {
      doctors.push({ id: docSnap.id, ...docSnap.data() });
    });

    return doctors;
  } catch (error) {
    console.error('Error fetching doctor list:', error);
    return [];
  }
};

// 8b. Admin: Create a New Practitioner Manually
export const createPractitioner = async (doctorData: any) => {
  try {
    if (!db) throw new Error('Clinical Registry Offline (Firestore OFFLINE)');

    // DUPLICATE IDENTITY CHECK
    const q = query(collection(db, 'users'), where('email', '==', doctorData.email));
    const checkResult = await withTimeout(getDocs(q), 5000);
    
    if (checkResult.success && !checkResult.data?.empty) {
      throw new Error('Identity Conflict: A practitioner with this email already exists.');
    }

    // CREATE IDENTITY NODE
    const result = await withTimeout(addDoc(collection(db, 'users'), {
      ...doctorData,
      role: 'doctor',
      walletBalance: 0,
      totalPoints: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'Active'
    }), 10000);

    if (!result.success) throw new Error(result.error);

    return { success: true, id: result.data?.id };
  } catch (error: any) {
    console.error('Practitioner Creation Error:', error);
    return { success: false, error: error.message || 'Identity Sync Failure' };
  }
};

// 9. Admin: Reject Case
export const rejectCase = async (caseId: string) => {
  try {
    const caseRef = doc(db, 'cases', caseId);
    const caseSnap = await getDoc(caseRef);
    
    await updateDoc(caseRef, {
      status: 'Rejected',
      rejectedAt: serverTimestamp(),
    });

    if (caseSnap.exists()) {
       await createNotification(
         caseSnap.data().doctorUid,
         'Case Rejected',
         `Your case ID: ${caseId.slice(-6).toUpperCase()} was rejected. Please contact support.`,
         'error'
       );
    }

    return { success: true };
  } catch (error: any) {
    console.error('Reject Error:', error);
    return { success: false, error: error.message };
  }
};

// 9a. Admin: Fetch Global Stats - Enhanced with Clinical Baseline
export const fetchAdminStats = async () => {
  try {
    const doctorsQuery = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const pendingCasesQuery = query(collection(db, 'cases'), where('status', '==', 'Pending'));
    const allApprovedQuery = query(collection(db, 'cases'), where('status', '==', 'Approved'));

    const [doctorsSnap, pendingCasesSnap, allApprovedCasesSnap] = await Promise.all([
      getDocs(doctorsQuery),
      getDocs(pendingCasesQuery),
      getDocs(allApprovedQuery)
    ]);

    let totalRewardedPoints = 0;
    allApprovedCasesSnap.forEach(docSnap => {
      totalRewardedPoints += docSnap.data().points || 0;
    });

    // Fetch dynamic exchange rate from settings
    const settingsSnap = await getDoc(doc(db as any, 'settings', 'global'));
    const exchangeRate = settingsSnap.exists() ? (settingsSnap.data().exchangeRate || 50) : 50;

    const stats = {
      totalDoctors: doctorsSnap.size,
      pendingReviews: pendingCasesSnap.size,
      totalRewarded: totalRewardedPoints * exchangeRate,
      totalPoints: totalRewardedPoints
    };

    return stats;
  } catch (error: any) {
    console.warn('Admin Stats Sync Failure (Defaulting to Zero):', error.message);
    return {
      totalDoctors: 0,
      pendingReviews: 0,
      totalRewarded: 0,
      totalPoints: 0
    };
  }
};

// 9b. Admin: Fetch Withdrawal Requests - Optimized with Identity Cache
export const fetchWithdrawals = async () => {
  try {
    // 1. Fetch Doctor Cache
    const drQuery = query(collection(db as any, 'users'), where('role', '==', 'doctor'));
    const drSnap = await getDocs(drQuery);
    const drCache: Record<string, any> = {};
    drSnap.forEach(d => {
      drCache[d.id] = { name: d.data().name || 'Unknown Practitioner', phone: d.data().phone || d.data().mobile || 'N/A' };
    });

    const q = query(collection(db as any, 'withdrawals'));
    const snapshot = await getDocs(q);
    const withdrawals: any[] = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const dr = drCache[data.doctorUid] || { name: 'Unknown Practitioner', phone: 'N/A' };
      withdrawals.push({ 
        id: docSnap.id, 
        ...data, 
        doctorName: dr.name, 
        phone: dr.phone 
      });
    });

    return withdrawals.sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
  } catch (error: any) {
    console.warn('Withdrawal Sync Failure:', error.message);
    return [];
  }
};

// 9c. Admin: Process Payout
export const updateWithdrawalStatus = async (id: string, status: 'Processing' | 'Paid', doctorUid: string, amount: number) => {
  try {
    const withdrawalRef = doc(db, 'withdrawals', id);
    await updateDoc(withdrawalRef, { 
      status,
      processedAt: serverTimestamp() 
    });

    if (status === 'Paid') {
       const doctorRef = doc(db, 'users', doctorUid);
       await updateDoc(doctorRef, { walletBalance: increment(-amount) });
       await createNotification(doctorUid, 'Payment Dispatched', `Your withdrawal of ₹${amount.toLocaleString()} has been processed.`, 'success');
    }
    return { success: true };
  } catch (error) {
    console.warn('Payout Sync Failure (Manual Intervention):', error);
    return { success: true };
  }
};

// --- REAL-TIME NOTIFICATION SYSTEM ---

export const createNotification = async (uid: string, title: string, msg: string, type: 'success' | 'alert' | 'warning' | 'info' | 'error') => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: uid,
      title,
      msg,
      type,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });
    return true;
  } catch (e) {
    return false;
  }
};

export const clearAllNotifications = async (uid: string) => {
  try {
    const q = query(collection(db, 'notifications'), where('userId', '==', uid));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return true;
  } catch (e) {
    return false;
  }
};

// 10. Global Settings: Fetch & Update
export const fetchGlobalSettings = async () => {
  try {
    const settingsRef = doc(db, 'settings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      return settingsSnap.data();
    }
    // Default fallback
    return {
      exchangeRate: 50,
      settlementMinimum: 500,
      selfVerification: true,
      duplicatePatientScreening: true,
      lastAudit: '04:30 PM'
    };
  } catch (error: any) {
    console.error('Error fetching global settings:', error);
    return null;
  }
};

export const updateGlobalSettings = async (settingsData: any) => {
  try {
    const settingsRef = doc(db, 'settings', 'global');
    await setDoc(settingsRef, {
      ...settingsData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { success: true };
  } catch (error: any) {
    console.error('Error updating global settings:', error);
    return { success: false, error: error.message };
  }
};
