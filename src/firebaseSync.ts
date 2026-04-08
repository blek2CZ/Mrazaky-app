import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { FreezerData, ItemTemplate } from './types';

// Firebase konfigurace - hodnoty jsou načteny z .env.local (není v gitu)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
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
    return { success: false, reason: 'Firebase není nakonfigurován' };
  }

  try {
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
    
    console.log('📝 Začínám setDoc do Firebase...');
    
    // Přidáme timeout a explicitní error handling
    try {
      await Promise.race([
        setDoc(dataRef, data, { merge: true }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firebase timeout')), 10000)
        )
      ]);
      console.log('✅ setDoc dokončen úspěšně!');
      console.log('✅ Data uložena do Firebase s timestamp:', new Date(newTimestamp).toISOString());
      return { success: true, serverTimestamp: newTimestamp };
    } catch (setDocError: any) {
      console.error('💥 setDoc selhal:', setDocError);
      throw setDocError; // Re-throw pro outer catch
    }
  } catch (error: any) {
    console.error('🔴 CATCH block zachytil chybu:', error);
    console.error('🔴 Error code:', error?.code);
    console.error('🔴 Error message:', error?.message);
    console.error('❌ Chyba při zápisu do Firebase:', error);
    
    // Rozpoznání specifických Firebase chyb
    if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
      console.error('🚫 Vracím QUOTA chybu');
      return { 
        success: false, 
        reason: '🚫 Denní kvóta Firebase byla překročena. Zkuste to zítra nebo použijte jiný synchronizační kód.' 
      };
    } else if (error.code === 'permission-denied') {
      console.error('🚫 Vracím PERMISSION chybu');
      return { 
        success: false, 
        reason: '🚫 Přístup odepřen. Zkontrolujte synchronizační kód.' 
      };
    } else if (error.code === 'unavailable' || error.message?.includes('network')) {
      console.error('📡 Vracím NETWORK chybu');
      return { 
        success: false, 
        reason: '📡 Nelze se připojit k databázi. Zkontrolujte připojení k internetu.' 
      };
    }
    
    console.error('❓ Vracím OBECNOU chybu');
    return { 
      success: false, 
      reason: `Chyba: ${error.message || 'Neznámá chyba při zápisu do cloudu'}` 
    };
  }
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
      
      // Migrace starých dat - přidej smallMama, pokud neexistuje
      if (!data.freezerData.smallMama) {
        data.freezerData.smallMama = { 1: [] };
      }
      
      // Migrace starých dat - přidej cellar, pokud neexistuje
      if (!data.freezerData.cellar) {
        data.freezerData.cellar = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };
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
): Promise<{ success: boolean; serverTimestamp?: number; reason?: string }> => {
  if (!db) {
    return { success: false, reason: 'Firebase není nakonfigurován' };
  }

  try {
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
    
    return { success: true, serverTimestamp: timestamp };
  } catch (error: any) {
    console.error('❌ Chyba při force sync:', error);
    
    if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
      return { 
        success: false, 
        reason: '🚫 Denní kvóta Firebase byla překročena. Zkuste to zítra.' 
      };
    }
    
    return { 
      success: false, 
      reason: `Chyba: ${error.message || 'Neznámá chyba při přepisování dat'}` 
    };
  }
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

    // Migrace starých dat - přidej smallMama, pokud neexistuje
    if (!serverData.freezerData.smallMama) {
      serverData.freezerData.smallMama = { 1: [] };
    }
    
    // Migrace starých dat - přidej cellar, pokud neexistuje
    if (!serverData.freezerData.cellar) {
      serverData.freezerData.cellar = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };
    }

    return {
      success: true,
      data: {
        freezerData: serverData.freezerData,
        templates: serverData.templates,
        lastModified: serverData.lastModified || Date.now()
      }
    };
  } catch (error: any) {
    console.error('❌ Chyba při načítání dat z Firebase:', error);
    
    // Rozpoznání specifických Firebase chyb
    let errorMessage = 'Neznámá chyba při načítání dat';
    
    if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
      errorMessage = '🚫 Denní kvóta Firebase byla překročena. Zkuste to zítra nebo použijte jiný synchronizační kód.';
    } else if (error.code === 'permission-denied') {
      errorMessage = '🚫 Přístup odepřen. Zkontrolujte synchronizační kód.';
    } else if (error.code === 'unavailable' || error.message?.includes('network')) {
      errorMessage = '📡 Nelze se připojit k databázi. Zkontrolujte připojení k internetu.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return { 
      success: false, 
      error: errorMessage
    };
  }
};
