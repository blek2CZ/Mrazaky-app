import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
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
  templates: ItemTemplate[],
  localTimestamp: number,
  adminPasswordHash?: string
): Promise<{ success: boolean; serverTimestamp?: number; reason?: string }> => {
  if (!db) {
    throw new Error('Firebase není nakonfigurován');
  }

  const dataRef = doc(db, 'sync-data', syncCode.toUpperCase());
  
  // Přečti aktuální data z Firebase
  const snapshot = await getDoc(dataRef);
  
  if (snapshot.exists()) {
    const serverData = snapshot.data();
    const serverTimestamp = serverData.lastModified || 0;
    
    // Pokud máme starší data než server, odmítni zápis
    if (localTimestamp < serverTimestamp) {
      console.warn('⚠️ Zápis odmítnut: lokální data jsou starší než server', {
        local: new Date(localTimestamp).toISOString(),
        server: new Date(serverTimestamp).toISOString()
      });
      return { 
        success: false, 
        serverTimestamp,
        reason: 'Lokální data jsou starší než data v databázi. Načítám aktuální verzi...'
      };
    }
  }
  
  const newTimestamp = Date.now();
  const data: any = {
    freezerData,
    templates,
    lastModified: newTimestamp,
    lastUpdated: new Date().toISOString()
  };
  
  // Při vytvoření nového kódu uložíme i hash hesla
  if (adminPasswordHash) {
    data.adminPasswordHash = adminPasswordHash;
  }
  
  await setDoc(dataRef, data, { merge: true });
  console.log('✅ Data uložena do Firebase s timestamp:', new Date(newTimestamp).toISOString());
  
  return { success: true, serverTimestamp: newTimestamp };
};

export const subscribeToSync = (
  syncCode: string,
  onDataUpdate: (data: { freezerData: FreezerData; templates: ItemTemplate[]; lastModified: number }) => void,
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
        templates: data.templates,
        lastModified: data.lastModified || Date.now()
      });
    }
  });
};

export const syncDataToFirebaseForce = async (
  syncCode: string,
  freezerData: FreezerData,
  templates: ItemTemplate[],
  timestamp: number
): Promise<void> => {
  if (!db) {
    throw new Error('Firebase není nakonfigurován');
  }

  const dataRef = doc(db, 'sync-data', syncCode.toUpperCase());
  
  // Force sync - ignoruj kontrolu timestampu, vždy přepiš
  const data: any = {
    freezerData,
    templates,
    lastModified: timestamp,
    lastUpdated: new Date().toISOString()
  };
  
  await setDoc(dataRef, data, { merge: true });
  console.log('✅ Force sync - data přepsána v Firebase s timestamp:', new Date(timestamp).toISOString());
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

export const getAdminPasswordHash = async (syncCode: string): Promise<string | null> => {
  if (!db) {
    throw new Error('Firebase není nakonfigurován');
  }

  const dataRef = doc(db, 'sync-data', syncCode.toUpperCase());
  const snapshot = await getDoc(dataRef);
  
  if (snapshot.exists()) {
    const data = snapshot.data();
    return data.adminPasswordHash || null;
  }
  
  return null;
};

export const isFirebaseConfigured = (): boolean => {
  return db !== null && firebaseConfig.apiKey !== "AIzaSyBOtExampleKey123456789";
};

export const fetchDataFromFirebase = async (
  syncCode: string
): Promise<{
  success: boolean;
  data?: { freezerData: FreezerData; templates: ItemTemplate[]; lastModified: number };
  invalidated?: boolean;
  error?: string;
}> => {
  if (!db) {
    return { success: false, error: 'Firebase není nakonfigurován' };
  }

  try {
    const dataRef = doc(db, 'sync-data', syncCode.toUpperCase());
    const snapshot = await getDoc(dataRef);

    if (!snapshot.exists()) {
      return { success: false, error: 'Synchronizační kód nebyl nalezen' };
    }

    const serverData = snapshot.data();

    // Kontrola, zda nebyl kód invalidován
    if (serverData.invalidated) {
      return { success: false, invalidated: true, error: 'Synchronizační kód byl invalidován' };
    }

    return {
      success: true,
      data: {
        freezerData: serverData.freezerData,
        templates: serverData.templates,
        lastModified: serverData.lastModified || Date.now()
      }
    };
  } catch (error) {
    console.error('❌ Chyba při načítání dat z Firebase:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Neznámá chyba při načítání dat' 
    };
  }
};
