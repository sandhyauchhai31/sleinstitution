import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const liveConfig = {
  apiKey: 'AIzaSyAHNDDgxu7nF0TuB8cRyfMKh56ssJyuVP0',
  authDomain: 'slesinstitution-42396.firebaseapp.com',
  projectId: 'slesinstitution-42396',
  storageBucket: 'slesinstitution-42396.firebasestorage.app',
  messagingSenderId: '754758452502',
  appId: '1:754758452502:web:b3ee3130c14b3adfd13c37',
  measurementId: 'G-5ZNCXDTVXC'
};

const app = initializeApp(liveConfig);
const db = getFirestore(app);

const COLLECTIONS = [
  'students',
  'applications',
  'franchisees',
  'branches',
  'courses',
  'course_subjects',
  'exams',
  'exam_results',
  'hall_tickets',
  'marksheets',
  'directors',
  'transactions',
  'system_settings',
  'plans',
  'inquiries',
  'coaching_students',
  'coaching_applications',
  'users',
  'settings',
  'notifications'
];

async function backupLive() {
  console.log('Starting full backup from live Firestore (slesinstitution-42396)...');
  const backupData = {};
  let totalDocs = 0;

  for (const col of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, col));
      backupData[col] = [];
      snap.forEach(d => {
        backupData[col].push({
          id: d.id,
          data: d.data()
        });
      });
      console.log(`Fetched collection '${col}': ${backupData[col].length} documents`);
      totalDocs += backupData[col].length;
    } catch (err) {
      console.warn(`Collection '${col}' fetch notice:`, err.message);
      backupData[col] = [];
    }
  }

  fs.writeFileSync('live_db_complete_backup.json', JSON.stringify(backupData, null, 2));
  console.log(`\nSuccessfully created live_db_complete_backup.json with ${totalDocs} total documents across ${COLLECTIONS.length} collections!`);
  process.exit(0);
}

backupLive().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
