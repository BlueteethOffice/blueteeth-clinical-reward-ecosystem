import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC2zJc4VWoOBXVZlOP2vzsd5EWeMZBdytQ",
  authDomain: "blueteeth-rewards.firebaseapp.com",
  projectId: "blueteeth-rewards",
  storageBucket: "blueteeth-rewards.firebasestorage.app",
  messagingSenderId: "900814150641",
  appId: "1:900814150641:web:576b875aa2a370af138250"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const seedCases = async () => {
  const cases = [
    {
      patientName: 'Rahul Mehra',
      patientMobile: '9876543210',
      treatment: 'Dental Implant',
      treatmentId: 'implant',
      points: 10,
      location: 'Delhi Central',
      notes: 'Post-op observation stable. Implant placed successfully.',
      status: 'Pending',
      doctorUid: 'niteen02', // Master ID for testing
      submittedAt: new Date()
    },
    {
      patientName: 'Anjali Sharma',
      patientMobile: '8877665544',
      treatment: 'Root Canal (RCT)',
      treatmentId: 'rct',
      points: 5,
      location: 'Mumbai West',
      notes: 'Second sitting completed. Permanent filling done.',
      status: 'Pending',
      doctorUid: 'niteen02',
      submittedAt: new Date(Date.now() - 86400000) // Yesterday
    }
  ];

  for (const c of cases) {
    await addDoc(collection(db, 'cases'), c);
    console.log(`Added case for ${c.patientName}`);
  }
  process.exit(0);
};

seedCases();
