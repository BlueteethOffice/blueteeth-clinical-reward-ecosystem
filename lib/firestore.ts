import { 
  collection, addDoc, query, where, getDocs, getDoc,
  setDoc, updateDoc, doc, increment, serverTimestamp, writeBatch, onSnapshot 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

// --- UTILITIES ---

/**
 * Timeout wrapper to prevent eternal hangs on poor connections.
 * Resolves with a timeout status instead of rejecting to prevent unhandled crashes.
 */
const withTimeout = async <T>(promiseFn: () => Promise<T>, timeoutMs: number = 30000, retries: number = 3): Promise<{success: boolean, data?: T, error?: string}> => {
  let lastError = '';
  
  for (let i = 0; i < retries; i++) {
    try {
      const timeoutPromise = new Promise<{success: boolean, error: string}>((resolve) => 
        setTimeout(() => resolve({ success: false, error: 'Operation timed out (Clinical Network Failure)' }), timeoutMs)
      );

      const result = await Promise.race([
        promiseFn().then(res => ({ success: true, data: res })),
        timeoutPromise
      ]);

      if (result.success) return result as any;
      lastError = (result as any).error || 'Unknown network error';
      console.warn(`[RETRY ${i+1}/${retries}] Clinical node re-syncing...`);
      // Wait a bit before retry (exponential backoff)
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    } catch (err: any) {
      lastError = err.message;
    }
  }

  return { success: false, error: lastError || 'Clinical Network Access Denied' };
};

// --- STORAGE UTILITIES ---

/**
 * Uploads a profile image or document to Firebase Storage.
 * Supports custom paths for KYC documents.
 */
export const uploadProfileImage = async (uid: string, base64String: string, customPath?: string) => {
  try {
    if (!storage) throw new Error('Storage not initialized');
    
    // Use custom path or default to avatar
    const filePath = customPath ? `${customPath}/${uid}/doc_${Date.now()}.jpg` : `profiles/${uid}/avatar.jpg`;
    const storageRef = ref(storage, filePath);
    
    const base64Data = base64String.split(',')[1] || base64String;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    const uploadResult = await withTimeout(() => uploadBytes(storageRef, byteArray, {
      contentType: 'image/jpeg'
    }), 30000);

    if (!uploadResult.success) throw new Error(uploadResult.error);
    
    const urlResult = await withTimeout(() => getDownloadURL(storageRef), 10000);
    if (!urlResult.success) throw new Error(urlResult.error);

    return { success: true, url: urlResult.data };
  } catch (error: any) {
    console.warn('Clinical Storage Sync Failure:', error.message);
    return { success: false, error: error.message };
  }
};

// --- CORE CLINICAL LOGIC ---

/**
 * Generates a human-readable unique Case ID (BT-XXXXXX)
 */
export const generateCaseId = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `BT-${result}`;
};

// 1. Submit a new case with Anti-Fraud (Duplicate check)
export const submitNewCase = async (doctorUid: string, caseData: any) => {
  try {
    if (!db) throw new Error('Clinical Database Offline (No Connection)');

    // 1. DUPLICATE CHECK with 8s Fast Timeout
    const q = query(collection(db, 'cases'), where('patientMobile', '==', caseData.patientMobile));
    const queryResult = await withTimeout(() => getDocs(q), 15000);
    
    if (!queryResult.success) {
      throw new Error('Verification Delay: Clinical registry is too slow to respond (8s Timeout).');
    }

    if (queryResult.data && !queryResult.data.empty) {
      // SMART LOGIC: Only block if the same patient (mobile) is submitting the SAME treatment again.
      const activeDuplicate = queryResult.data.docs.find(doc => 
        doc.data().status !== 'Rejected' && 
        doc.data().treatmentName === caseData.treatmentName
      );
      
      if (activeDuplicate) {
        throw new Error(`Duplicate Case: This patient has already submitted a case for ${caseData.treatmentName}.`);
      }
    }

    // 2. DATA SUBMISSION with 10s Fast Timeout
    const customCaseId = generateCaseId();
    const submissionResult = await withTimeout(() => addDoc(collection(db, 'cases'), {
      ...caseData,
      doctorUid,
      customCaseId, // Save the professional ID
      status: 'Pending',
      submittedBy: caseData.submittedBy || 'associate',
      doctorName: caseData.doctorName || 'Practitioner', // DENORMALIZED for speed
      doctorRole: caseData.doctorRole || 'doctor',
      initialProof: caseData.initialProof || caseData.proofUrl || '',
      submittedAt: serverTimestamp(),
    }), 20000);

    if (!submissionResult.success) {
      throw new Error('Archive Sync Failed: Cloud transmission timed out after 10s.');
    }
    
    return { success: true, id: submissionResult.data?.id, customCaseId };
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

    // USE POINTS FROM DATABASE (NOT CLIENT) TO PREVENT TAMPERING
    const finalPoints = Number(caseData.points || 0);

    await updateDoc(caseRef, {
      status: 'Approved',
      approvedAt: serverTimestamp(),
    });

    // Use setDoc with merge to create user document if it doesn't exist (UPSERT)
    await setDoc(doctorRef, {
      totalPoints: increment(finalPoints),
      walletBalance: increment(finalPoints * exchangeRate),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // NEW: Handle Clinician Payment if assigned
    if (caseData.clinicianId && caseData.clinicianFee) {
        const clinicianRef = doc(db, 'users', caseData.clinicianId);
        await setDoc(clinicianRef, {
            walletBalance: increment(caseData.clinicianFee),
            updatedAt: serverTimestamp()
        }, { merge: true });

        await createNotification(
            caseData.clinicianId,
            'Payment Released',
            `₹${caseData.clinicianFee} credited for case: ${caseData.patientName}.`,
            'success'
        );
    }

    // Send real-time notification to the doctor
    await createNotification(
      doctorUid, 
      'B-Points Credited', 
      `${points} points awarded for case ID: ${caseData.customCaseId || caseId.slice(-6).toUpperCase()}.`, 
      'success'
    );

    return { success: true };
  } catch (error: any) {
    console.error('Approval Error:', error);
    if (error.code === 'not-found') return { success: true };
    return { success: false, error: error.message };
  }
};

// 2b. Admin: Assign Clinician
export const assignClinician = async (caseId: string, clinicianId: string, clinicianFee: number, clinicianName?: string, clinicianRegNo?: string) => {
    try {
        const caseRef = doc(db, 'cases', caseId);
        await updateDoc(caseRef, {
            clinicianId,
            clinicianFee,
            clinicianName: clinicianName || '',
            clinicianRegNo: clinicianRegNo || '',
            status: 'Assigned',
            assignedAt: serverTimestamp()
        });

        await createNotification(
            clinicianId,
            'New Case Assigned',
            `A new case has been assigned to you. Start work now.`,
            'info'
        );

        return { success: true };
    } catch (error: any) {
        console.error('Assignment Error:', error);
        return { success: false, error: error.message };
    }
};

// 2c. Clinician: Update status to In Progress
export const startCaseWork = async (caseId: string) => {
    try {
        const caseRef = doc(db, 'cases', caseId);
        const result = await withTimeout(() => updateDoc(caseRef, {
            status: 'In Progress',
            startedAt: serverTimestamp()
        }), 15000);

        if (!result.success) throw new Error(result.error);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

// 2d. Clinician: Submit Final Proof
export const submitClinicianWork = async (caseId: string, finalProof: string, notes: string, solvedDetails: { name: string, regNo: string }) => {
    try {
        const caseRef = doc(db, 'cases', caseId);
        const result = await withTimeout(() => updateDoc(caseRef, {
            finalProof,
            clinicianNotes: notes,
            solvedByName: solvedDetails.name,
            solvedByRegNo: solvedDetails.regNo,
            status: 'Submitted',
            clinicianSubmittedAt: serverTimestamp()
        }), 30000);


        if (!result.success) throw new Error(result.error);

        // Notify Admin (Background)
        createNotification(
            'admin',
            'Clinician Submitted Work',
            `A technician has submitted final proof for a case. Review required.`,
            'info'
        ).catch(() => {});

        return { success: true };
    } catch (error: any) {
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
    if (!caseSnap.exists()) return { success: false, error: 'Case not found' };
    
    const caseData = caseSnap.data();
    await updateDoc(caseRef, {
      status: 'Pending',
      revokedAt: serverTimestamp(),
    });

    // USE POINTS FROM DATABASE (NOT CLIENT) TO PREVENT TAMPERING
    const finalPoints = Number(caseData.points || 0);

    // Deduct points from the doctor (Negative increment)
    await updateDoc(doctorRef, {
      totalPoints: increment(-finalPoints),
      walletBalance: increment(-(finalPoints * exchangeRate)),
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

// 3. User: Request Withdrawal - Hardened with Role-Specific Policy Enforcement
export const requestWithdrawal = async (doctorUid: string, amount: number, methodData: any) => {
  try {
    // 1. Fetch User Identity & Global Policy
    const [userSnap, settingsSnap] = await Promise.all([
      getDoc(doc(db, 'users', doctorUid)),
      getDoc(doc(db, 'settings', 'global'))
    ]);

    const userData = userSnap.exists() ? userSnap.data() : { role: 'associate' };
    const policy = settingsSnap.exists() ? settingsSnap.data() : {};
    
    // 2. Identify Role Threshold
    const isClinician = userData.role === 'clinician' || userData.role === 'specialist';
    const minAmount = isClinician 
      ? (policy.clinicianMinPayout || 500) 
      : (policy.settlementMinimum || 500);

    if (amount < minAmount) {
      throw new Error(`Policy Violation: Minimum withdrawal threshold for your role (${userData.role}) is ₹${minAmount.toLocaleString()}.`);
    }

    // 2.5 BALANCE VERIFICATION: Deep Audit Mechanism
    let currentBalance = Number(userData.walletBalance || 0);
    
    // [DEEP AUDIT] If balance is zero or NaN, we perform a real-time ledger verification
    if (isNaN(currentBalance) || currentBalance <= 0) {
       console.log(">>> [DEEP AUDIT ACTIVE] Re-calculating balance from master ledger...");
       const casesQuery = query(collection(db, 'cases'), where('clinicianId', '==', doctorUid), where('status', '==', 'Approved'));
       const withdrawalsQuery = query(collection(db, 'redemptions'), where('doctorUid', '==', doctorUid), where('status', 'in', ['Paid', 'Processing', 'Pending']));
       
       const [casesSnap, withdrawalsSnap] = await Promise.all([getDocs(casesQuery), getDocs(withdrawalsQuery)]);
       
       let totalEarned = 0;
       casesSnap.forEach(d => { totalEarned += Number(d.data().clinicianFee || 0); });
       
       let totalWithdrawnAndPending = 0;
       withdrawalsSnap.forEach(d => { totalWithdrawnAndPending += Number(d.data().amount || 0); });
       
       currentBalance = totalEarned - totalWithdrawnAndPending;
       
       // [AUTO-HEAL] Update the corrupted Firestore document with the corrected audit results
       console.log(">>> [AUTO-HEAL] Repairing corrupted identity node for:", doctorUid);
       const userRef = doc(db, 'users', doctorUid);
       updateDoc(userRef, {
          walletBalance: currentBalance,
          totalEarned: totalEarned,
          totalWithdrawn: totalWithdrawnAndPending,
          updatedAt: serverTimestamp()
       }).catch(err => console.error(">>> [HEAL FAILURE]:", err));
       
       // If balance is STILL less than requested amount, then it's truly insufficient
       if (amount > currentBalance) {
          throw new Error(`Insufficient Funds: Audit reveals a liquid balance of ₹${currentBalance.toLocaleString()}. You requested ₹${amount.toLocaleString()}.`);
       }
    } else {
       // Standard check for users with healthy balance nodes
       const pendingQuery = query(collection(db, 'redemptions'), where('doctorUid', '==', doctorUid), where('status', '==', 'Pending'));
       const pendingSnap = await getDocs(pendingQuery);
       let totalPending = 0;
       pendingSnap.forEach(d => { totalPending += (d.data().amount || 0); });

       if ((totalPending + amount) > currentBalance) {
         throw new Error(`Insufficient Funds: You have ₹${totalPending.toLocaleString()} pending. Total limit ₹${currentBalance.toLocaleString()}.`);
       }
    }

    // 3. Create High-Fidelity Redemption Node
    const docRef = await addDoc(collection(db, 'redemptions'), {
      doctorUid,
      doctorName: userData.name || 'Practitioner',
      doctorEmail: userData.email || '',
      role: userData.role || 'associate',
      amount,
      method: methodData.method || 'upi',
      details: methodData.details || {},
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

// 6a. Fetch All Cases for a Clinician
export const fetchClinicianCases = async (clinicianId: string) => {
  try {
    const q = query(collection(db, 'cases'), where('clinicianId', '==', clinicianId));
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
    console.error('Error fetching clinician cases:', error);
    throw new Error(error.message || 'Clinician Registry Sync Failure');
  }
};

// 7. Update User Profile (Hardened with Binary Support & Fail-Safe Timeouts)
export const updateUserProfile = async (uid: string, profileData: any) => {
  console.log('[DEBUG] Syncing identity with 30s clinical buffer...');
  try {
    if (!db) throw new Error('Firestore is not initialized (Database OFFLINE)');
    const userRef = doc(db, 'users', uid);
    
    const syncResult = await withTimeout(() => setDoc(userRef, {
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
}; export const fetchCaseById = async (caseId: string) => {
  try {
    const docRef = doc(db, 'cases', caseId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error: any) {
    console.error('Error fetching case:', error);
    return null;
  }
};

// 8. Admin: Fetch Cases by Status - Optimized with Doctor Identity Cache
export const fetchAdminCases = async (status: 'Pending' | 'Approved' | 'Assigned' | 'In Progress' | 'Submitted' | 'Rejected' = 'Pending') => {
  console.log(`[DEBUG] Opening Case Review Stream: ${status}...`);
  try {
    // Build both queries upfront — fire in parallel with Promise.all to eliminate sequential latency
    const drQuery = query(collection(db as any, 'users'), where('role', 'in', ['doctor', 'associate', 'clinician']));

    let casesQuery;
    if (status === 'Assigned') {
      casesQuery = query(
        collection(db as any, 'cases'),
        where('status', 'in', ['Assigned', 'In Progress', 'Submitted'])
      );
    } else {
      casesQuery = query(
        collection(db as any, 'cases'),
        where('status', '==', status)
      );
    }

    // 🚀 PARALLEL FETCH — both queries hit Firestore simultaneously (2x faster)
    const [drSnap, querySnapshot] = await Promise.all([getDocs(drQuery), getDocs(casesQuery)]);

    // Build identity cache from user results
    const drCache: Record<string, any> = {};
    drSnap.forEach(d => {
      drCache[d.id] = {
        name: d.data().name || 'Unknown Practitioner',
        phone: d.data().phone || d.data().mobile || 'N/A',
        email: d.data().email || '',
        role: d.data().role || 'doctor'
      };
    });
    
    const cases = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const dr = drCache[data.doctorUid] || { name: 'Unknown Practitioner', phone: 'N/A', email: '', role: 'doctor' };
      const cl = drCache[data.clinicianId] || { name: 'Not Assigned' };
      
      return { 
        id: docSnap.id, 
        ...data, 
        doctorName: dr.name, 
        doctorPhone: dr.phone,
        doctorEmail: dr.email, // CRITICAL: Mapping email for notifications
        doctorRole: dr.role,
        clinicianName: data.solvedByName || data.clinicianName || cl.name,
        clinicianRegNo: data.solvedByRegNo || data.clinicianRegNo || cl.regNo || ''
      };
    });
    
    return cases.sort((a: any, b: any) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
  } catch (error: any) {
    console.error(`Error fetching ${status} cases:`, error);
    return [];
  }
};

export const listenAdminCases = (
  status: 'Pending' | 'Approved' | 'Assigned' | 'In Progress' | 'Submitted' | 'Rejected' | 'All',
  callback: (cases: any[]) => void
) => {
  if (!db) return () => {};

  const drQuery = query(collection(db, 'users'), where('role', 'in', ['doctor', 'associate', 'clinician']));
  
  let casesQuery;
  if (status === 'Assigned') {
    casesQuery = query(collection(db, 'cases'), where('status', 'in', ['Assigned', 'In Progress', 'Submitted']));
  } else if (status === 'All') {
    casesQuery = collection(db, 'cases');
  } else {
    casesQuery = query(collection(db, 'cases'), where('status', '==', status));
  }

  let drCache: Record<string, any> = {};
  let casesData: any[] = [];
  
  const mapData = () => {
    if (Object.keys(drCache).length === 0 && casesData.length > 0) return; // Wait for at least initial identity load
    const mapped = casesData.map(data => {
      const dr = drCache[data.doctorUid] || { name: 'Unknown Practitioner', phone: 'N/A', email: '', role: 'doctor' };
      const cl = drCache[data.clinicianId] || { name: 'Not Assigned' };
      return { 
        ...data, 
        doctorName: dr.name, doctorPhone: dr.phone || dr.mobile || 'N/A', doctorEmail: dr.email, doctorRole: dr.role,
        clinicianName: data.solvedByName || data.clinicianName || cl.name,
        clinicianRegNo: data.solvedByRegNo || data.clinicianRegNo || cl.regNo || ''
      };
    });
    callback(mapped.sort((a: any, b: any) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)));
  };

  const unsubUsers = onSnapshot(drQuery, (snap: any) => {
    snap.docs.forEach((d: any) => {
      const data = d.data();
      drCache[d.id] = { name: data.name, phone: data.phone || data.mobile, email: data.email, role: data.role };
    });
    mapData();
  });

  const unsubCases = onSnapshot(casesQuery, (snap: any) => {
    casesData = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    mapData();
  });

  return () => {
    unsubUsers();
    unsubCases();
  };
};

// 8a. Admin: Fetch All Doctors - Enhanced with Fail-Safe Global Registry
export const fetchDoctors = async () => {
  try {
    const q = query(collection(db, 'users'), where('role', 'in', ['doctor', 'associate']));
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

// 8b. Admin: Fetch All Clinicians
export const fetchClinicians = async () => {
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'clinician'));
    const querySnapshot = await getDocs(q);
    const clinicians: any[] = [];
    querySnapshot.forEach((docSnap) => {
      clinicians.push({ id: docSnap.id, ...docSnap.data() });
    });

    return clinicians;
  } catch (error) {
    console.error('Error fetching clinician list:', error);
    return [];
  }
};

// 8b. Admin: Create a New Practitioner Manually
export const createPractitioner = async (doctorData: any) => {
  try {
    if (!db) throw new Error('Clinical Registry Offline (Firestore OFFLINE)');

    // DUPLICATE IDENTITY CHECK
    const q = query(collection(db, 'users'), where('email', '==', doctorData.email));
    const checkResult = await withTimeout(() => getDocs(q), 5000);
    
    if (checkResult.success && !checkResult.data?.empty) {
      throw new Error('Identity Conflict: A practitioner with this email already exists.');
    }

    // CREATE IDENTITY NODE
    const result = await withTimeout(() => addDoc(collection(db, 'users'), {
      ...doctorData,
      role: 'associate',
      walletBalance: 0,
      totalPoints: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'Active'
    }), 20000);

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
    const doctorsQuery = query(collection(db, 'users'), where('role', 'in', ['doctor', 'associate']));
    const cliniciansQuery = query(collection(db, 'users'), where('role', '==', 'clinician'));
    const pendingCasesQuery = query(collection(db, 'cases'), where('status', '==', 'Pending'));
    const allApprovedQuery = query(collection(db, 'cases'), where('status', '==', 'Approved'));

    const [doctorsSnap, cliniciansSnap, pendingCasesSnap, allApprovedCasesSnap] = await Promise.all([
      getDocs(doctorsQuery),
      getDocs(cliniciansQuery),
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
      totalClinicians: cliniciansSnap.size,
      pendingReviews: pendingCasesSnap.size,
      approvedCases: allApprovedCasesSnap.size,
      totalRewarded: totalRewardedPoints * exchangeRate,
      totalPoints: totalRewardedPoints
    };

    return stats;
  } catch (error: any) {
    console.warn('Admin Stats Sync Failure (Defaulting to Zero):', error.message);
    return {
      totalDoctors: 0,
      totalClinicians: 0,
      pendingReviews: 0,
      approvedCases: 0,
      totalRewarded: 0,
      totalPoints: 0
    };
  }
};

// 9b. Admin: Fetch Withdrawal Requests - Optimized with Identity Cache
export const fetchWithdrawals = async () => {
  try {
    // 1. Fetch Doctor Cache
    const drQuery = query(collection(db, 'users'), where('role', 'in', ['doctor', 'associate']));
    const drSnap = await getDocs(drQuery);
    const drCache: Record<string, any> = {};
    drSnap.forEach(d => {
      drCache[d.id] = { name: d.data().name || 'Unknown Practitioner', phone: d.data().phone || d.data().mobile || 'N/A' };
    });

    const q = query(collection(db as any, 'redemptions'));
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
export const updateWithdrawalStatus = async (id: string, status: 'Processing' | 'Paid', additionalData: any = {}) => {
  try {
    const withdrawalRef = doc(db, 'redemptions', id);
    const withdrawalSnap = await getDoc(withdrawalRef);
    
    if (!withdrawalSnap.exists()) throw new Error("Withdrawal request not found.");
    const data = withdrawalSnap.data();

    // Prevent double processing
    if (data.status === 'Paid') return { success: true, message: 'ALREADY_PAID' };

    await updateDoc(withdrawalRef, { 
      status,
      processedAt: serverTimestamp(),
      ...additionalData
    });

    if (status === 'Paid') {
       const doctorRef = doc(db, 'users', data.doctorUid);
       const exchangeRate = 50; // Default or fetch from settings
       
       // Deduct Balance and Points
       // Note: totalPoints is often treated as current balance in this system
       const pointsToDeduct = data.points || (data.amount / exchangeRate);
       
       await updateDoc(doctorRef, { 
         walletBalance: increment(-data.amount),
         totalPoints: increment(-pointsToDeduct),
         updatedAt: serverTimestamp()
       });

       await createNotification(data.doctorUid, 'Payment Dispatched', `Your withdrawal of ₹${data.amount.toLocaleString()} has been processed.`, 'success');
    }
    return { success: true };
  } catch (error) {
    console.warn('Payout Sync Failure:', error);
    return { success: false, error: (error as any).message };
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
