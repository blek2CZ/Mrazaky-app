import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { FreezerData, ItemTemplate } from './types';

// Firebase konfigurace - toto jsou veřejné klíče, je to bezpečné
const firebaseConfig = {
  apiKey: "AIzaSyAgnC9CcCzQMmWcU4vnZaM92cC_paieCYA",
  authDomain: "mrazaky-app.firebaseapp.com",
  projectId: "mrazaky-app",
  storageBucket: "mrazaky-app.firebasestorage.app",
  messagingSenderId: "928251154928",
  appId: "1:928251154928:web:da4da2c2237a30c2424d35"
};

let app: any = null;
let db: any = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.warn('Firebase není nakonfigurován. Synchronizace nebude fungovat.');
}

export const generateSyncCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const saveSyncCode = (code: string) => {
  localStorage.setItem('mrazaky-sync-code', code.toUpperCase());
};

export const getSyncCode = (): string | null => {
  return localStorage.getItem('mrazaky-sync-code');
};

export const clearSyncCode = () => {
  localStorage.removeItem('mrazaky-sync-code');
};

export const syncDataToFirebase = async (
  syncCode: string,
  freezerData: FreezerData,
  templates: ItemTemplate[]
) => {
  if (!db) {
    throw new Error('Firebase není nakonfigurován');
  }

  const dataRef = doc(db, 'sync-data', syncCode.toUpperCase());
  await setDoc(dataRef, {
    freezerData,
    templates,
    lastUpdated: new Date().toISOString()
  });
};

export const subscribeToSync = (
  syncCode: string,
  onDataUpdate: (data: { freezerData: FreezerData; templates: ItemTemplate[] }) => void,
  onInvalidated?: () => void
) => {
  if (!db) {
    throw new Error('Firebase není nakonfigurován');
  }

  const dataRef = doc(db, 'sync-data', syncCode.toUpperCase());
  
  return onSnapshot(dataRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      
      // Kontrola, zda nebyl kód invalidován
      if (data.invalidated && onInvalidated) {
        onInvalidated();
        return;
      }
      
      onDataUpdate({
        freezerData: data.freezerData,
        templates: data.templates
      });
    }
  });
};

export const invalidateSyncCode = async (syncCode: string) => {
  if (!db) {
    throw new Error('Firebase není nakonfigurován');
  }

  const dataRef = doc(db, 'sync-data', syncCode.toUpperCase());
  await setDoc(dataRef, {
    invalidated: true,
    invalidatedAt: new Date().toISOString()
  }, { merge: true });
};

export const isFirebaseConfigured = (): boolean => {
  return db !== null && firebaseConfig.apiKey !== "AIzaSyBOtExampleKey123456789";
};
