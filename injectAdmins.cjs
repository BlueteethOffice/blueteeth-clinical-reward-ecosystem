const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyC2zJc4VWoOBXVZlOP2vzsd5EWeMZBdytQ",
  authDomain: "blueteeth-rewards.firebaseapp.com",
  projectId: "blueteeth-rewards",
  storageBucket: "blueteeth-rewards.firebasestorage.app",
  messagingSenderId: "900814150641",
  appId: "1:900814150641:web:576b875aa2a370af138250"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function manageAdmin(email, password, name) {
    console.log(`\n=> Setting up Database Profile for: ${email}...`);
    let user;
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        user = cred.user;
        console.log(`✅ SUCCESS: Created highly secured Master account: ${email}`);
    } catch(e) {
        if (e.code === 'auth/email-already-in-use') {
            console.log(`⚠️ ALREADY IN USE: The account ${email} is already in the database. Trying login...`);
            const cred = await signInWithEmailAndPassword(auth, email, password).catch(() => null);
            if (!cred) {
               console.log(`❌ FAILED: The account ${email} exists, but the previous password does not match ${password}.`);
               return;
            }
            user = cred.user;
            console.log(`✅ SUCCESS: Verified existing account matches required password.`);
        } else {
            console.error(`❌ FAILED: `, e.message);
            return;
        }
    }
    
    // Set to firestore
    try {
        await setDoc(doc(db, 'users', user.uid), {
           email: email,
           role: 'admin',
           name: name,
           emailVerified: true,
           pending: false,
           isVerified: true
        }, { merge: true });
        console.log(`✅ SUCCESS: Database Sync completed. Admin privileges assigned permanently.`);
    } catch (e) {
        console.log(`❌ DB ERROR:`, e.message);
    }
}

async function run() {
    await manageAdmin('master_core_01@blueteeth.in', 'Niteen@102', 'Master Admin Niteen02');
    await manageAdmin('backup_core_02@blueteeth.in', 'Niteen@0987', 'Backup Admin');
    console.log("\n=> ALL SECURITY INJECTIONS COMPLETED.");
    process.exit(0);
}
run();
