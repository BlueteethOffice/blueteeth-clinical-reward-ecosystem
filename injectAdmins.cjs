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
    // [SECURITY HARDENING] Hardcoded credentials removed. Use environment variables.
    const admin1Email = process.env.MASTER_ADMIN_EMAIL || 'admin@blueteeth.in';
    const admin1Pass = process.env.MASTER_ADMIN_PASSWORD;
    const admin2Email = process.env.BACKUP_ADMIN_EMAIL;
    const admin2Pass = process.env.BACKUP_ADMIN_PASSWORD;

    if (admin1Email && admin1Pass) {
        await manageAdmin(admin1Email, admin1Pass, 'Master Admin Node');
    }
    
    if (admin2Email && admin2Pass) {
        await manageAdmin(admin2Email, admin2Pass, 'Backup Admin Node');
    }

    console.log("\n=> ALL SECURITY INJECTIONS COMPLETED.");
    process.exit(0);
}
run();
