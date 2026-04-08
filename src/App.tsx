import { useState, useEffect, useRef, useMemo } from 'react';
import Freezer from './Freezer';
import TemplatesManager from './TemplatesManager';
import SyncModal from './SyncModal';
import LoadingOverlay from './components/LoadingOverlay';
import { DisconnectModal } from './components/DisconnectModal';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import { NotificationSnackbar } from './components/NotificationSnackbar';
import { FreezerData, Item, ItemTemplate } from './types';
import { loadFreezerData, saveFreezerData, loadItemTemplates, saveItemTemplates } from './storage';
import { exportData, importData } from './dataSync';
import { getSyncCode, saveSyncCode, clearSyncCode, syncDataToFirebase, syncDataToFirebaseForce, fetchDataFromFirebase, isFirebaseConfigured, invalidateSyncCode, getAdminPasswordHash } from './firebaseSync';
import { verifyPasswordHash } from './adminAuth';
import './App.css';

// Počty šuplíků/polic pro každý mrazák/sklep – jedna konstanta pro celou aplikaci
const DRAWER_COUNTS = { small: 3, large: 7, smallMama: 1, cellar: 9 } as const;

// Funkce pro načtení posledního synchronizovaného stavu
const loadLastSyncedData = (): { freezerData: FreezerData; templates: ItemTemplate[] } => {
  const stored = localStorage.getItem('mrazaky-lastSyncedData');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Pokud není platný JSON, vrať aktuální data
      return { freezerData: loadFreezerData(), templates: loadItemTemplates() };
    }
  }
  // Při prvním spuštění vrať aktuální data
  return { freezerData: loadFreezerData(), templates: loadItemTemplates() };
};

// Funkce pro uložení posledního synchronizovaného stavu
const saveLastSyncedData = (data: { freezerData: FreezerData; templates: ItemTemplate[] }) => {
  localStorage.setItem('mrazaky-lastSyncedData', JSON.stringify(data));
};

function App() {
  const [freezerData, setFreezerData] = useState<FreezerData>(loadFreezerData);
  const [templates, setTemplates] = useState<ItemTemplate[]>(loadItemTemplates);
  const [syncCode, setSyncCode] = useState<string | null>(getSyncCode());
  const [showSyncModal, setShowSyncModal] = useState<'generate' | 'enter' | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [openFreezers, setOpenFreezers] = useState<Set<string>>(new Set()); // Sbalené mrazáky
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  const [conflictServerData, setConflictServerData] = useState<{ freezerData: FreezerData; templates: ItemTemplate[]; lastModified: number } | null>(null);
  const [lastModified, setLastModified] = useState<number>(() => {
    const stored = localStorage.getItem('mrazaky-lastModified');
    return stored ? parseInt(stored) : 0; // 0 = ještě nebyly načteny data z Firebase
  });
  const [showSyncActions, setShowSyncActions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ freezerType: 'small' | 'large' | 'smallMama' | 'cellar'; drawerId: number; itemId: string; itemName: string; itemQuantity: number } | null>(null);
  const [showDeleteTemplateConfirm, setShowDeleteTemplateConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const initialSyncDone = useRef<boolean>(false);
  const firebaseConfigured = isFirebaseConfigured();
  const lastSyncedData = useRef<{ freezerData: FreezerData; templates: ItemTemplate[] }>(loadLastSyncedData());

  // Detekce mobilního zařízení při změně velikosti okna
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Automatické ukládání do localStorage
  useEffect(() => {
    saveFreezerData(freezerData);
  }, [freezerData]);

  useEffect(() => {
    saveItemTemplates(templates);
  }, [templates]);

  // Funkce pro hluboké porovnání dat s normalizací
  const areDataEqual = (data1: FreezerData, data2: FreezerData, templates1: ItemTemplate[], templates2: ItemTemplate[]): boolean => {
    // Jednoduchá normalizace - stringify s replacer pro seřazení klíčů
    const normalize = (obj: any): string => {
      return JSON.stringify(obj, (_key, value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          // Seřadit klíče objektu
          return Object.keys(value).sort().reduce((sorted: any, key) => {
            sorted[key] = value[key];
            return sorted;
          }, {});
        }
        return value;
      });
    };
    
    const data1Str = normalize(data1);
    const data2Str = normalize(data2);
    const templates1Str = normalize(templates1);
    const templates2Str = normalize(templates2);
    
    const dataEqual = data1Str === data2Str;
    const templatesEqual = templates1Str === templates2Str;
    
    return dataEqual && templatesEqual;
  };

  // Detekce změn oproti poslednímu synchronizovanému stavu
  useEffect(() => {
    const hasChanges = !areDataEqual(freezerData, lastSyncedData.current.freezerData, templates, lastSyncedData.current.templates);
    setHasUnsavedChanges(hasChanges);
  }, [freezerData, templates]);

  // Při prvním načtení synchronizovat lastSyncedData s aktuálními daty, pokud neexistuje mrazaky-lastSyncedData
  useEffect(() => {
    const stored = localStorage.getItem('mrazaky-lastSyncedData');
    if (!stored) {
      // Při prvním spuštění nastavit lastSyncedData na aktuální stav
      const currentData = { freezerData, templates };
      lastSyncedData.current = currentData;
      saveLastSyncedData(currentData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Spustit pouze při mount s aktuálními hodnotami freezerData a templates

  // Warning při pokusu o reload/zavření s neuloženými změnami
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Funkce pro zahození neuložených změn
  const handleDiscardChanges = () => {
    setFreezerData(lastSyncedData.current.freezerData);
    setTemplates(lastSyncedData.current.templates);
    saveFreezerData(lastSyncedData.current.freezerData);
    saveItemTemplates(lastSyncedData.current.templates);
    setShowSyncConfirm(false);
    // hasUnsavedChanges se automaticky nastaví na false díky useEffect
  };

  useEffect(() => {
    localStorage.setItem('mrazaky-lastModified', lastModified.toString());
  }, [lastModified]);

  // Funkce pro kontrolu a načtení dat z Firebase
  const checkForUpdates = async (showSuccessMessage: boolean = false, isManualCheck: boolean = false) => {
    if (!syncCode || !firebaseConfigured) {
      setErrorMessage('Synchronizace není k dispozici.');
      setTimeout(() => setErrorMessage(null), 10000);
      return;
    }

    setIsCheckingForUpdates(true);

    try {
      const result = await fetchDataFromFirebase(syncCode);

      if (!result.success) {
        const isFirstLoad = lastModified === 0;
        if (result.invalidated) {
          setErrorMessage('Synchronizační kód již není platný. Admin změnil kód.');
          clearSyncCode();
          setSyncCode(null);
          setIsSyncing(false);
          setShowSyncModal('enter');
        } else {
          const errorMsg = result.error || 'Nepodařilo se načíst data z cloudu.';
          setErrorMessage(isFirstLoad 
            ? `⚠️ Nepodařilo se načíst data při spuštění: ${errorMsg}` 
            : errorMsg
          );
        }
        setTimeout(() => setErrorMessage(null), 10000);
        setIsCheckingForUpdates(false);
        return;
      }

      const { data } = result;
      if (!data) {
        setErrorMessage('⚠️ Data z cloudu jsou neplatná nebo poškozená.');
        setTimeout(() => setErrorMessage(null), 10000);
        setIsCheckingForUpdates(false);
        return;
      }

      // Migrace dat - přidej smallMama, pokud neexistuje
      if (!data.freezerData.smallMama) {
        data.freezerData.smallMama = { 1: [] };
      }

      // Porovnej timestamp
      console.log('🔍 Porovnání timestampů:', {
        lokalniTimestamp: lastModified,
        lokalniDatum: new Date(lastModified).toISOString(),
        serverTimestamp: data.lastModified,
        serverDatum: new Date(data.lastModified).toISOString(),
        rozdil: data.lastModified - lastModified,
        serverJeNovejsi: data.lastModified > lastModified
      });

      if (data.lastModified > lastModified) {
        console.log('🔄 Nová data nalezena - načítám z cloudu');

        // Upozorni uživatele, pokud má neuložené změny
        if (hasUnsavedChanges) {
          const confirm = window.confirm(
            '⚠️ V cloudu jsou novější data!\n\n' +
            'Máte neuložené lokální změny. Co chcete udělat?\n\n' +
            'OK = Načíst data z cloudu (ztratíte lokální změny)\n' +
            'Zrušit = Ponechat lokální data'
          );
          if (!confirm) {
            setLastChecked(Date.now());
            setIsCheckingForUpdates(false);
            return; // Ponechat lokální data
          }
          // hasUnsavedChanges se automaticky nastaví na false díky useEffect
        }

        setFreezerData(data.freezerData);
        setTemplates(data.templates);
        setLastModified(data.lastModified);
        saveFreezerData(data.freezerData);
        saveItemTemplates(data.templates);
        // Uložit jako poslední synchronizovaná data
        lastSyncedData.current = { freezerData: data.freezerData, templates: data.templates };
        saveLastSyncedData(lastSyncedData.current);
        console.log('✅ Data úspěšně načtena z cloudu');
        if (showSuccessMessage) {
          setSuccessMessage('Nová data byla načtena z cloudu');
          setTimeout(() => setSuccessMessage(null), 5000);
        }
      } else {
        console.log('✅ Lokální timestamp je stejný nebo novější než server');
        
        // Když je timestamp stejný, cloud je referenční bod - vždy aktualizuj lastSyncedData
        if (data.lastModified === lastModified) {
          lastSyncedData.current = { freezerData: data.freezerData, templates: data.templates };
          saveLastSyncedData(lastSyncedData.current);
          console.log('✅ Timestamp stejný - lastSyncedData nastaven na data z cloudu');
        }
        
        // Porovnej data z cloudu s posledním synchronizovaným stavem
        const cloudMatchesLastSynced = JSON.stringify(data.freezerData) === JSON.stringify(lastSyncedData.current.freezerData) &&
                                        JSON.stringify(data.templates) === JSON.stringify(lastSyncedData.current.templates);
        
        // Porovnej aktuální lokální data s daty z cloudu
        const localMatchesCloud = JSON.stringify(data.freezerData) === JSON.stringify(freezerData) &&
                                  JSON.stringify(data.templates) === JSON.stringify(templates);
        
        // Detekce desynchronizace pouze při manuální kontrole
        // Desynchronizace = cloud se liší od posledního syncu I od aktuálního stavu
        if (isManualCheck) {
          console.log('🔍 Kontrola desynchronizace:', {
            cloudMatchesLastSynced,
            localMatchesCloud,
            sameTimestamp: data.lastModified === lastModified
          });
        }
        
        if (!cloudMatchesLastSynced && !localMatchesCloud && data.lastModified === lastModified && isManualCheck) {
          console.warn('⚠️ DESYNCHRONIZACE: Stejný timestamp, ale jiná data!');
          const action = window.confirm(
            '⚠️ Detekována desynchronizace dat!\n\n' +
            'Lokální data se liší od dat v cloudu, přestože mají stejný timestamp.\n\n' +
            'OK = Načíst data z cloudu (přepíše lokální)\n' +
            'Zrušit = Ponechat lokální data a označit jako neuložené změny'
          );
          
          if (action) {
            setFreezerData(data.freezerData);
            setTemplates(data.templates);
            saveFreezerData(data.freezerData);
            saveItemTemplates(data.templates);
            lastSyncedData.current = { freezerData: data.freezerData, templates: data.templates };
            saveLastSyncedData(lastSyncedData.current);
            initialSyncDone.current = true;
            setSuccessMessage('Data synchronizována z cloudu');
            setTimeout(() => setSuccessMessage(null), 5000);
          } else {
            // Ponechat lokální data - hasUnsavedChanges se automaticky nastaví díky useEffect
            setShowSyncConfirm(true);
            setSuccessMessage('Lokální data ponechána - můžete je odeslat nebo zahodit');
            setTimeout(() => setSuccessMessage(null), 5000);
          }
        } else if (showSuccessMessage) {
          if (data.lastModified === lastModified) {
            setSuccessMessage('Data jsou aktuální - stejná verze jako v cloudu');
            setTimeout(() => setSuccessMessage(null), 5000);
          } else {
            // Lokální data jsou novější - hasUnsavedChanges se automaticky nastaví díky useEffect
            console.log('⚠️ Lokální data jsou novější');
            setSuccessMessage('Lokální data jsou novější než v cloudu - použijte tlačítko pro odeslání');
            setTimeout(() => setSuccessMessage(null), 6000);
          }
        }
      }

      setLastChecked(Date.now());
      setIsSyncing(true);
      initialSyncDone.current = true;
    } catch (error) {
      const isFirstLoad = lastModified === 0;
      console.error('❌ Chyba při kontrole dat:', error);
      const errorMsg = error instanceof Error ? error.message : 'Neznámá chyba';
      
      // Detekce síťových chyb
      if (errorMsg.includes('network') || errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        setErrorMessage('📡 Není připojení k internetu. Zkontrolujte síťové připojení.');
      } else if (isFirstLoad) {
        setErrorMessage(`⚠️ Nepodařilo se načíst data při spuštění: ${errorMsg}`);
      } else {
        setErrorMessage(`Chyba při kontrole dat: ${errorMsg}`);
      }
      
      setTimeout(() => setErrorMessage(null), 10000);
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  // Kontrola dat při startu aplikace
  useEffect(() => {
    if (syncCode && firebaseConfigured) {
      console.log('🚀 Aplikace spuštěna - načítám data z cloudu...');
      checkForUpdates(false, false); // false = nezobrazovat success hlášku, false = není manuální kontrola
    } else if (syncCode && !firebaseConfigured) {
      console.error('❌ Firebase není nakonfigurován');
      setErrorMessage('Firebase databáze není dostupná. Aplikace funguje pouze offline.');
      setTimeout(() => setErrorMessage(null), 10000);
    }
  }, [syncCode, firebaseConfigured]);

  // Manuální sync funkce
  const handleManualSync = async () => {
    if (!syncCode || !firebaseConfigured || !hasUnsavedChanges) return;
    setShowSyncConfirm(true);
  };

  const handleConfirmSync = async () => {
    console.log('🚀 handleConfirmSync zavoláno');
    setShowSyncConfirm(false);
    setIsUploading(true);
    
    if (!syncCode || !firebaseConfigured) {
      console.error('❌ Sync nelze provést:', { syncCode, firebaseConfigured });
      setErrorMessage('Synchronizace není k dispozici. Zkontrolujte připojení.');
      setTimeout(() => setErrorMessage(null), 10000);
      setIsUploading(false);
      return;
    }
    
    // KROK 1: Kontrola timestamp na serveru PŘED odesláním
    console.log('🔍 Kontroluji timestamp na serveru před odesláním...');
    
    try {
      const serverCheck = await fetchDataFromFirebase(syncCode);
      
      if (!serverCheck.success) {
        console.error('❌ Nepodařilo se načíst data ze serveru:', serverCheck.error);
        setErrorMessage(serverCheck.error || 'Nepodařilo se ověřit aktuálnost dat na serveru.');
        setTimeout(() => setErrorMessage(null), 10000);
        setIsUploading(false);
        return;
      }
      
      const serverTimestamp = serverCheck.data?.lastModified || 0;
      console.log('⏱️ Porovnání timestampů:', {
        local: lastModified,
        server: serverTimestamp,
        konflikt: serverTimestamp > lastModified
      });
      
      // KROK 2: Detekce konfliktu
      if (serverTimestamp > lastModified) {
        console.warn('⚠️ KONFLIKT: Server má novější data!');
        setIsUploading(false);
        setConflictServerData(serverCheck.data!);
        setShowConflictResolution(true);
        return;
      }
      
      // KROK 3: Žádný konflikt → odeslat normálně
      console.log('✅ Žádný konflikt, odesílám data...');
      const newTimestamp = Date.now();
      const result = await syncDataToFirebase(syncCode, freezerData, templates, newTimestamp);
      console.log('📥 Odpověď z Firebase:', result);
      
      if (result.success && result.serverTimestamp) {
        console.log('✅ Úspěch! Data odeslána do cloudu');
        setLastModified(result.serverTimestamp);
        // Uložit aktuální stav jako poslední synchronizovaný
        lastSyncedData.current = { freezerData, templates };
        saveLastSyncedData(lastSyncedData.current);
        setHasUnsavedChanges(false); // Explicitně nastavit false po úspěšném uploadu
        setSuccessMessage('Změny byly úspěšně odeslány do cloudu');
        setTimeout(() => setSuccessMessage(null), 5000);
        setIsUploading(false);
      } else if (!result.success) {
        console.error('❌ Firebase vrátil chybu:', result.reason);
        const errorMsg = result.reason || 'Neznámá chyba';
        setErrorMessage(errorMsg);
        setTimeout(() => setErrorMessage(null), 10000);
        setIsUploading(false);
        // Ponechat hasUnsavedChanges=true aby uživatel mohl zkusit znovu
      } else {
        console.error('⚠️ Neočekávaná odpověď z Firebase:', result);
        setErrorMessage('Neočekávaná odpověď z databáze. Zkuste to znovu.');
        setTimeout(() => setErrorMessage(null), 10000);
        setIsUploading(false);
      }
    } catch (error) {
      console.error('❌ Exception při odesílání do Firebase:', error);
      const errorMsg = error instanceof Error ? error.message : 'Neznámá chyba';
      setErrorMessage(`Chyba při odesílání dat: ${errorMsg}`);
      setTimeout(() => setErrorMessage(null), 10000);
      setIsUploading(false);
      // Ponechat hasUnsavedChanges=true aby uživatel mohl zkusit znovu
    }
  };

  // Funkce pro force upload (přepsat cloud mými daty)
  const handleForceUpload = async () => {
    if (!syncCode || !firebaseConfigured) return;
    
    setShowConflictResolution(false);
    setIsUploading(true);
    
    try {
      const newTimestamp = Date.now();
      const result = await syncDataToFirebaseForce(syncCode, freezerData, templates, newTimestamp);
      
      if (result.success && result.serverTimestamp) {
        setLastModified(result.serverTimestamp);
        // Aktualizovat lastSyncedData
        lastSyncedData.current = { freezerData, templates };
        saveLastSyncedData(lastSyncedData.current);
        setHasUnsavedChanges(false); // Explicitně nastavit false po úspěšném uploadu
        setSuccessMessage('✅ Vaše data byla odeslána do cloudu (přepsána)');
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage(result.reason || 'Chyba při přepisování dat na serveru');
        setTimeout(() => setErrorMessage(null), 10000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Neznámá chyba';
      setErrorMessage(`Chyba: ${errorMsg}`);
      setTimeout(() => setErrorMessage(null), 10000);
    } finally {
      setIsUploading(false);
      setConflictServerData(null);
    }
  };

  // Funkce pro použití dat z cloudu (zahodit lokální změny)
  const handleUseServerData = () => {
    if (!conflictServerData) return;
    
    setFreezerData(conflictServerData.freezerData);
    setTemplates(conflictServerData.templates);
    setLastModified(conflictServerData.lastModified);
    // Aktualizovat lastSyncedData - hasUnsavedChanges se automaticky nastaví díky useEffect
    lastSyncedData.current = { freezerData: conflictServerData.freezerData, templates: conflictServerData.templates };
    saveLastSyncedData(lastSyncedData.current);
    setShowConflictResolution(false);
    setConflictServerData(null);
    setSuccessMessage('✅ Data z cloudu byla načtena');
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleAddItem = (freezerType: 'small' | 'large' | 'smallMama' | 'cellar', drawerId: number, item: Item) => {
    // Kontrola, zda položka se stejným názvem už v šuplíku není (pojistka)
    const existingItem = freezerData[freezerType][drawerId]?.find(i => i.name.toLocaleLowerCase('cs') === item.name.toLocaleLowerCase('cs'));
    
    if (existingItem) {
      setErrorMessage(`❌ Položka "${item.name}" už v tomto ${freezerType === 'cellar' ? 'policí' : 'šuplíku'} je!`);
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }
    
    const newFreezerData = {
      ...freezerData,
      [freezerType]: {
        ...freezerData[freezerType],
        [drawerId]: [...(freezerData[freezerType][drawerId] || []), item],
      },
    };
    setFreezerData(newFreezerData);

    // Pokud je to nová položka (custom), přidej do templates
    if (!templates.find(t => t.name === item.name)) {
      const newTemplate: ItemTemplate = {
        id: Date.now().toString(),
        name: item.name,
      };
      const newTemplates = [...templates, newTemplate];
      saveItemTemplates(newTemplates);
      setTemplates(newTemplates);
    }
  };

  const handleUpdateItem = (freezerType: 'small' | 'large' | 'smallMama' | 'cellar', drawerId: number, itemId: string, quantity: number) => {
    if (quantity <= 0) {
      handleDeleteItem(freezerType, drawerId, itemId);
      return;
    }

    const newFreezerData = {
      ...freezerData,
      [freezerType]: {
        ...freezerData[freezerType],
        [drawerId]: freezerData[freezerType][drawerId].map(item =>
          item.id === itemId ? { ...item, quantity } : item
        ),
      },
    };
    
    setFreezerData(newFreezerData);
  };

  const handleDeleteItem = (freezerType: 'small' | 'large' | 'smallMama' | 'cellar', drawerId: number, itemId: string) => {
    // Najít název položky pro potvrzovací dialog
    const item = freezerData[freezerType][drawerId].find(item => item.id === itemId);
    if (!item) return;
    
    // Zobrazit toast s potvrzením
    setItemToDelete({
      freezerType,
      drawerId,
      itemId,
      itemName: item.name,
      itemQuantity: item.quantity
    });
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;

    const newFreezerData = {
      ...freezerData,
      [itemToDelete.freezerType]: {
        ...freezerData[itemToDelete.freezerType],
        [itemToDelete.drawerId]: freezerData[itemToDelete.freezerType][itemToDelete.drawerId].filter(item => item.id !== itemToDelete.itemId),
      },
    };
    
    setFreezerData(newFreezerData);
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  };

  const handleAddTemplate = (name: string) => {
    const newTemplate: ItemTemplate = {
      id: Date.now().toString(),
      name,
    };
    setTemplates(prev => [...prev, newTemplate]);
  };

  // Pomocná funkce – přejmenuje položky s daným názvem ve všech šuplících najednou
  const renameItemsInAllFreezers = (oldName: string, newName: string): FreezerData => {
    const freezerTypes = ['small', 'large', 'smallMama', 'cellar'] as const;
    const result: Partial<FreezerData> = {};
    for (const type of freezerTypes) {
      result[type] = Object.fromEntries(
        Object.entries(freezerData[type]).map(([drawerId, items]) => [
          drawerId,
          (items as Item[]).map(item => item.name === oldName ? { ...item, name: newName } : item)
        ])
      ) as { [drawerId: number]: Item[] };
    }
    return result as FreezerData;
  };

  const handleEditTemplate = (id: string, newName: string) => {
    // Najdi starý název šablony
    const oldTemplate = templates.find(t => t.id === id);
    if (!oldTemplate) return;
    
    const oldName = oldTemplate.name;
    if (oldName === newName) return;

    setFreezerData(renameItemsInAllFreezers(oldName, newName));
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
  };

  const handleEditItemName = (oldName: string, newName: string) => {
    if (oldName === newName) return;

    setFreezerData(renameItemsInAllFreezers(oldName, newName));
    setTemplates(prev => prev.map(t => t.name === oldName ? { ...t, name: newName } : t));
  };

  const handleMoveItem = async (
    sourceFreezerType: 'small' | 'large' | 'smallMama' | 'cellar',
    sourceDrawerId: number, 
    itemId: string, 
    targetFreezer: 'small' | 'large' | 'smallMama' | 'cellar', 
    targetDrawer: number
  ) => {
    console.log('=== PŘESUN POLOŽKY - START ===');
    console.log('Zdroj:', sourceFreezerType, 'šuplík', sourceDrawerId);
    console.log('Cíl:', targetFreezer, 'šuplík', targetDrawer);
    
    // KROK 1: Najdi položku ve zdrojovém šuplíku
    const sourceItem = freezerData[sourceFreezerType][sourceDrawerId]?.find(item => item.id === itemId);
    if (!sourceItem) {
      console.error('❌ Položka nenalezena!');
      setErrorMessage('❌ Chyba při přesunu: položka nebyla nalezena.');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }
    console.log('✓ Položka nalezena:', sourceItem.name, `(${sourceItem.quantity} ks)`);

    // KROK 2: Deep copy všech dat (IMMUTABLE)
    console.log('📋 Vytváření kopie všech dat...');
    const newFreezerData: FreezerData = {
      small: Object.fromEntries(
        Object.entries(freezerData.small).map(([id, items]) => [id, [...items]])
      ) as { [drawerId: number]: Item[] },
      large: Object.fromEntries(
        Object.entries(freezerData.large).map(([id, items]) => [id, [...items]])
      ) as { [drawerId: number]: Item[] },
      smallMama: Object.fromEntries(
        Object.entries(freezerData.smallMama).map(([id, items]) => [id, [...items]])
      ) as { [drawerId: number]: Item[] },
      cellar: Object.fromEntries(
        Object.entries(freezerData.cellar).map(([id, items]) => [id, [...items]])
      ) as { [drawerId: number]: Item[] }
    };
    console.log('✓ Kopie vytvořena');
    
    // KROK 4: Kontrola - počet položek před změnou
    const totalItemsBefore = 
      Object.values(newFreezerData.small).flat().length + 
      Object.values(newFreezerData.large).flat().length +
      Object.values(newFreezerData.smallMama).flat().length +
      Object.values(newFreezerData.cellar).flat().length;
    console.log('📊 Celkem položek před změnou:', totalItemsBefore);
    
    // KROK 5: PŘIDEJ DO CÍLE (priorita - nejdřív přidat)
    if (!newFreezerData[targetFreezer][targetDrawer]) {
      newFreezerData[targetFreezer][targetDrawer] = [];
    }
    const targetBefore = newFreezerData[targetFreezer][targetDrawer].length;
    newFreezerData[targetFreezer][targetDrawer] = [
      ...newFreezerData[targetFreezer][targetDrawer], 
      { ...sourceItem } // kopie položky, ne reference
    ];
    const targetAfter = newFreezerData[targetFreezer][targetDrawer].length;
    console.log(`✓ PŘIDÁNO do cíle: ${targetBefore} → ${targetAfter} položek`);
    
    // KROK 6: Kontrola přidání
    const addedItem = newFreezerData[targetFreezer][targetDrawer].find(item => item.id === itemId);
    if (!addedItem) {
      console.error('❌ CHYBA: Položka se nepřidala do cíle!');
      setErrorMessage('❌ Chyba při přesunu: položka se nepřidala do cílového šuplíku.');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }
    console.log('✓ Kontrola: Položka je v cíli');

    // KROK 7: ODEBER ZE ZDROJE (až po úspěšném přidání)
    const sourceBefore = newFreezerData[sourceFreezerType][sourceDrawerId].length;
    newFreezerData[sourceFreezerType][sourceDrawerId] = 
      newFreezerData[sourceFreezerType][sourceDrawerId].filter(item => item.id !== itemId);
    const sourceAfter = newFreezerData[sourceFreezerType][sourceDrawerId].length;
    console.log(`✓ ODEBRÁNO ze zdroje: ${sourceBefore} → ${sourceAfter} položek`);
    
    // KROK 8: Kontrola odebrání
    const stillInSource = newFreezerData[sourceFreezerType][sourceDrawerId].find(item => item.id === itemId);
    if (stillInSource) {
      console.error('❌ CHYBA: Položka stále v zdrojovém šuplíku!');
      setErrorMessage('❌ Chyba při přesunu: položka se neodebrala ze zdrojového šuplíku.');
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }
    console.log('✓ Kontrola: Položka není ve zdroji');
    
    // KROK 9: Kontrola - celkový počet položek (musí zůstat stejný)
    const totalItemsAfter = 
      Object.values(newFreezerData.small).flat().length + 
      Object.values(newFreezerData.large).flat().length +
      Object.values(newFreezerData.smallMama).flat().length +
      Object.values(newFreezerData.cellar).flat().length;
    console.log('📊 Celkem položek po změně:', totalItemsAfter);
    
    if (totalItemsBefore !== totalItemsAfter) {
      console.error('❌ KRITICKÁ CHYBA: Počet položek se změnil!', {
        před: totalItemsBefore,
        po: totalItemsAfter,
        rozdíl: totalItemsAfter - totalItemsBefore
      });
      setErrorMessage('❌ Kritická chyba při přesunu: počet položek se změnil. Přesun zrušen.');
      setTimeout(() => setErrorMessage(null), 7000);
      return;
    }
    console.log('✓ Kontrola: Celkový počet položek zachován');

    // KROK 10: Nastav nová data (uloží se až při potvrzení)
    console.log('✓ Nastavuji nová data...');
    setFreezerData(newFreezerData);
    console.log('=== PŘESUN POLOŽKY - DOKONČENO ✓ ===');
  };

  const handleDeleteTemplate = (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;
    
    // Zobrazit toast s potvrzením
    setTemplateToDelete({ id, name: template.name });
    setShowDeleteTemplateConfirm(true);
  };

  const handleConfirmDeleteTemplate = () => {
    if (!templateToDelete) return;

    setTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
    setShowDeleteTemplateConfirm(false);
    setTemplateToDelete(null);
  };

  const isTemplateUsed = (name: string): boolean => {
    const allItems = [
      ...Object.values(freezerData.small).flat(),
      ...Object.values(freezerData.large).flat(),
      ...Object.values(freezerData.smallMama).flat(),
      ...Object.values(freezerData.cellar).flat(),
    ];
    return allItems.some(item => item.name === name);
  };

  // Výsledky vyhledávání - přepočítají se pouze při změně dotazu nebo dat
  const searchResults = useMemo(() => {
    const query = searchQuery.trim();
    if (query === '') return null;

    const results: { item: Item; freezerType: string; freezerName: string; drawerNum: number }[] = [];
    const freezers = [
      { type: 'small' as const, name: 'Malý', data: freezerData.small },
      { type: 'large' as const, name: 'Velký', data: freezerData.large },
      { type: 'smallMama' as const, name: 'Malý mama', data: freezerData.smallMama },
      { type: 'cellar' as const, name: '📦 Sklep', data: freezerData.cellar }
    ];

    freezers.forEach(freezer => {
      Object.entries(freezer.data).forEach(([drawerKey, items]) => {
        const drawerNum = parseInt(drawerKey.replace('drawer', ''));
        items.forEach((item: Item) => {
          if (item.name.toLocaleLowerCase('cs').includes(query.toLocaleLowerCase('cs'))) {
            results.push({ item, freezerType: freezer.type, freezerName: freezer.name, drawerNum });
          }
        });
      });
    });

    // Seskupení a sloučení výsledků podle názvu + umístění
    const groupedResults: { [name: string]: typeof results } = {};
    results.forEach(result => {
      if (!groupedResults[result.item.name]) groupedResults[result.item.name] = [];
      groupedResults[result.item.name].push(result);
    });

    Object.keys(groupedResults).forEach(itemName => {
      const locationMap = new Map<string, typeof results[0]>();
      groupedResults[itemName].forEach(result => {
        const key = `${result.freezerType}-${result.drawerNum}`;
        const existing = locationMap.get(key);
        if (existing) {
          existing.item.quantity += result.item.quantity;
        } else {
          locationMap.set(key, { ...result, item: { ...result.item } });
        }
      });
      groupedResults[itemName] = Array.from(locationMap.values());
    });

    return { groupedResults, totalCount: results.length };
  }, [searchQuery, freezerData]);

  const handleToggleFreezer = (freezerType: string) => {
    setOpenFreezers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(freezerType)) {
        newSet.delete(freezerType);
      } else {
        newSet.add(freezerType);
      }
      return newSet;
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateSync = async (code: string, passwordHash: string) => {
    // Pokud už máme starý kód, invalidujeme ho
    if (syncCode && firebaseConfigured) {
      await invalidateSyncCode(syncCode);
    }
    
    saveSyncCode(code);
    setSyncCode(code);
    setShowSyncModal(null);
    if (firebaseConfigured) {
      // Uložíme data včetně hash hesla
      const newTimestamp = Date.now();
      const result = await syncDataToFirebase(code, freezerData, templates, newTimestamp, passwordHash);
      if (result.success && result.serverTimestamp) {
        setLastModified(result.serverTimestamp);
      }
    }
  };

  const handleEnterSync = (code: string) => {
    saveSyncCode(code);
    setSyncCode(code);
    setShowSyncModal(null);
  };

  const handleDisconnectSync = () => {
    setShowDisconnectModal(true);
  };

  const handleConfirmDisconnect = async (password: string) => {
    if (!syncCode || !firebaseConfigured) {
      return false;
    }

    // Ověříme heslo proti hash v Firebase
    const storedHash = await getAdminPasswordHash(syncCode);
    if (!storedHash) {
      return false;
    }

    const isValid = await verifyPasswordHash(password, storedHash);
    if (!isValid) {
      return false;
    }
    
    // Invalidujeme kód pro ostatní uživatele
    await invalidateSyncCode(syncCode);
    
    initialSyncDone.current = false;
    clearSyncCode();
    setSyncCode(null);
    setIsSyncing(false);
    setShowDisconnectModal(false);
    
    // Po odpojení nabídneme vytvoření nového kódu
    setTimeout(() => {
      setShowSyncModal('generate');
    }, 500);
    
    return true;
  };

  const handleExport = () => {
    exportData(freezerData, templates);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { freezerData: importedFreezerData, templates: importedTemplates } = await importData(file);
      
      // Pokud jsme připojení k Firebase, vyžaduj admin heslo
      if (syncCode && firebaseConfigured) {
        const password = prompt('🔐 Pro nahrať importovaných dat do databáze zadejte admin heslo:');
        
        if (!password) {
          // Zrušeno uživatelem - neuložíme ani lokálně
          alert('Import zrušen');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }
        
        // Ověř heslo
        const storedHash = await getAdminPasswordHash(syncCode);
        if (!storedHash) {
          alert('Chyba: Nelze ověřit admin heslo');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }
        
        const isValid = await verifyPasswordHash(password, storedHash);
        if (!isValid) {
          alert('❌ Nesprávné admin heslo! Import zrušen.');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }
      }
      
      // Ulož lokálně
      setFreezerData(importedFreezerData);
      setTemplates(importedTemplates);
      saveFreezerData(importedFreezerData);
      saveItemTemplates(importedTemplates);
      
      // Force sync do Firebase s novým timestampem (ignoruje kontrolu starých dat)
      if (syncCode && firebaseConfigured) {
        try {
          const newTimestamp = Date.now();
          // Použijeme speciální funkci pro force sync
          await syncDataToFirebaseForce(syncCode, importedFreezerData, importedTemplates, newTimestamp);
          setLastModified(newTimestamp);
          console.log('✅ Importovaná data nahraána do Firebase');
          alert('✅ Data úspěšně importována a nahraána do databáze!');
        } catch (error) {
          console.error('Chyba při nahrávání do Firebase:', error);
          alert('Data importována lokálně, ale nahrání do databáze selhalo!');
        }
      } else {
        alert('Data úspěšně importována!');
      }
    } catch (error) {
      alert('Chyba při importu dat: ' + (error as Error).message);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div onClick={() => setOpenSection(null)}>
      <div className="app-header" onClick={(e) => e.stopPropagation()}>
        <h1>🧊 Evidence mrazáků</h1>
        <div className="app-actions">
          <button onClick={() => setShowSyncActions(!showSyncActions)} title="Zobrazit/skrýt možnosti synchronizace">
            {showSyncActions ? '👁️ Skrýt sync' : '👁️ Zobrazit sync'}
          </button>
          {showSyncActions && (
            <>
              {firebaseConfigured ? (
                syncCode ? (
                  <>
                    <div className="sync-status connected">
                      <span className="sync-indicator"></span>
                      Sync: {syncCode}
                    </div>
                    <button onClick={handleDisconnectSync} title="Odpojit a změnit synchronizaci">🚫 Odpojit</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setShowSyncModal('enter')} title="Zadat existující synchronizační kód">🔑 Zadat kód</button>
                  </>
                )
              ) : (
                <div className="sync-status disconnected" title="Firebase není nakonfigurován">
                  <span className="sync-indicator"></span>
                  Sync nedostupný
                </div>
              )}
              <button onClick={handleExport} title="Stáhnout zálohu dat">📥 Export</button>
              <button onClick={handleImportClick} title="Nahrát data ze zálohy">📤 Import</button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {showSyncModal && (
        <SyncModal
          mode={showSyncModal}
          onClose={() => setShowSyncModal(null)}
          onGenerate={handleGenerateSync}
          onEnter={handleEnterSync}
          existingSyncCode={syncCode}
        />
      )}

      {showDisconnectModal && (
        <DisconnectModal
          onClose={() => setShowDisconnectModal(false)}
          onConfirm={handleConfirmDisconnect}
        />
      )}

      {showConflictResolution && conflictServerData && (
        <ConflictResolutionModal
          localData={{ freezerData, templates, lastModified }}
          serverData={conflictServerData}
          onUseLocal={handleForceUpload}
          onUseServer={handleUseServerData}
          onCancel={() => {
            setShowConflictResolution(false);
            setConflictServerData(null);
          }}
        />
      )}

      {errorMessage && (
        <NotificationSnackbar
          type="error"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {successMessage && (
        <NotificationSnackbar
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {showSyncConfirm && (
        <div className="sync-toast" onClick={(e) => e.stopPropagation()} style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          backgroundColor: 'white',
          padding: '20px 30px',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          minWidth: '300px',
          maxWidth: '500px',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div className="sync-toast-title" style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '500' }}>
            📊 Máte <strong>neuložené změny</strong>
          </div>
          <div className="sync-toast-message" style={{ marginBottom: '20px', color: '#666' }}>
            Chcete je odeslat do cloudu?
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between' }}>
            <button
              className="sync-toast-discard"
              onClick={handleDiscardChanges}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                backgroundColor: '#ff5252',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              🗑️ Zahodit změny
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="sync-toast-cancel"
                onClick={() => setShowSyncConfirm(false)}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Pokračovat v úpravách
              </button>
              <button
                className="sync-toast-confirm"
                onClick={handleConfirmSync}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ☁️ Odeslat hned
            </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && itemToDelete && (
        <div className="sync-toast" onClick={(e) => e.stopPropagation()} style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          backgroundColor: 'white',
          padding: '20px 30px',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          minWidth: '300px',
          maxWidth: '500px',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div className="sync-toast-title" style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '500' }}>
            🗑️ Smazat položku?
          </div>
          <div className="sync-toast-message" style={{ marginBottom: '20px', color: '#666' }}>
            <strong>{itemToDelete.itemName}</strong> ({itemToDelete.itemQuantity} ks)
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              className="sync-toast-cancel"
              onClick={() => {
                setShowDeleteConfirm(false);
                setItemToDelete(null);
              }}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Zrušit
            </button>
            <button
              className="sync-toast-discard"
              onClick={handleConfirmDelete}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                backgroundColor: '#ff5252',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Smazat
            </button>
          </div>
        </div>
      )}

      {/* Toast pro potvrzení smazání šablony */}
      {showDeleteTemplateConfirm && templateToDelete && (
        <div className="sync-toast" onClick={(e) => e.stopPropagation()} style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 10000,
          minWidth: '300px',
          maxWidth: '90vw'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>Opravdu smazat šablonu?</h3>
          <div className="sync-toast-message" style={{ marginBottom: '20px', color: '#666' }}>
            <strong>{templateToDelete.name}</strong>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              className="sync-toast-cancel"
              onClick={() => {
                setShowDeleteTemplateConfirm(false);
                setTemplateToDelete(null);
              }}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Zrušit
            </button>
            <button
              className="sync-toast-discard"
              onClick={handleConfirmDeleteTemplate}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                backgroundColor: '#ff5252',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Smazat
            </button>
          </div>
        </div>
      )}

      {isSyncing && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'flex-end'
        }}>
          {hasUnsavedChanges && (
            <button
              onClick={handleManualSync}
              style={{
                padding: '15px 30px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <span style={{ fontSize: '20px' }}>☁️</span>
              <span>Odeslat změny do cloudu</span>
            </button>
          )}
          <button
            onClick={() => checkForUpdates(true, true)}
            disabled={isCheckingForUpdates}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: isCheckingForUpdates ? '#ccc' : '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isCheckingForUpdates ? 'not-allowed' : 'pointer',
              boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isCheckingForUpdates ? 0.6 : 1
            }}
          >
            <span style={{ fontSize: '18px' }}>{isCheckingForUpdates ? '⏳' : '🔄'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>{isCheckingForUpdates ? 'Kontroluji...' : 'Zkontrolovat nová data'}</span>
              {lastChecked && !isCheckingForUpdates && (
                <span style={{ fontSize: '11px', opacity: 0.8 }}>
                  Naposledy: {new Date(lastChecked).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </button>
        </div>
      )}
      
      {/* Vyhledávání */}
      <div className="templates-manager">
        <div className="templates-header" onClick={(e) => { e.stopPropagation(); setOpenSection(openSection === 'search' ? null : 'search'); }}>
          <h2>🔍 Vyhledávání</h2>
          <button type="button" className="toggle-button" onClick={(e) => { e.stopPropagation(); setOpenSection(openSection === 'search' ? null : 'search'); }}>
            {openSection === 'search' ? '▼' : '▶'}
          </button>
        </div>
        {openSection === 'search' && (
          <div className="search-section" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '1rem', backgroundColor: 'rgb(183, 183, 183)', borderRadius: '6px', marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Zadejte název položky..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '1rem',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#333'
                }}
              />
            </div>
            <div className="search-results-container">
              {searchQuery.trim() === '' ? (
                <p style={{ color: '#999', textAlign: 'center', padding: '2rem', fontStyle: 'italic' }}>
                  Začněte psát pro vyhledávání...
                </p>
              ) : searchResults && searchResults.totalCount > 0 ? (
                <>
                  <p style={{ color: '#646cff', fontWeight: '600', marginBottom: '0.75rem', padding: '0 1rem' }}>
                    {(() => {
                      const n = Object.keys(searchResults.groupedResults).length;
                      return `Nalezeno ${n} ${n === 1 ? 'položka' : n < 5 ? 'položky' : 'položek'}:`;
                    })()}
                  </p>
                  <div className="items-list">
                    {Object.entries(searchResults.groupedResults).map(([itemName, locations]) => {
                      const totalQuantity = locations.reduce((sum, loc) => sum + loc.item.quantity, 0);
                      const hasMultipleLocations = locations.length > 1;
                      return (
                        <div key={itemName} className="item">
                          <div className="item-info">
                            <span className="item-name">{itemName}</span>
                            <span className="item-quantity">{totalQuantity} ks</span>
                          </div>
                          {hasMultipleLocations ? (
                            <div style={{ fontSize: '0.9em', color: '#999', marginTop: '0.25rem', marginLeft: '-0.5rem', marginRight: '-0.5rem', paddingLeft: '0.5rem' }}>
                              {locations.map((result, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', marginTop: idx > 0 ? '0.15rem' : '0' }}>
                                  <span style={{ display: 'inline-block', textAlign: 'right', minWidth: '55px', marginRight: '8px' }}>{result.item.quantity} ks</span>
                                  <span>— {result.freezerName} → {result.freezerType === 'cellar' ? 'Police' : 'Šuplík'} {result.drawerNum}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="item-location">
                              {locations[0].item.quantity} ks — {locations[0].freezerName} → {locations[0].freezerType === 'cellar' ? 'Police' : 'Šuplík'} {locations[0].drawerNum}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#999', fontSize: '1.1rem' }}>
                  ❌ Nenalezeno
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <TemplatesManager
        templates={templates}
        onAddTemplate={handleAddTemplate}
        onEditTemplate={handleEditTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        isTemplateUsed={isTemplateUsed}
        isExpanded={openSection === 'template-manager'}
        onToggle={() => setOpenSection(openSection === 'template-manager' ? null : 'template-manager')}
      />

<Freezer
        title={isMobile ? "❄️ Malý mraz." : "❄️ Malý mrazák"}
        drawerCount={DRAWER_COUNTS.small}
        freezerType="small"
        drawers={freezerData.small}
        allDrawersFromBothFreezers={{
          ...Object.fromEntries(Object.entries(freezerData.small).map(([id, items]) => [`small-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.large).map(([id, items]) => [`large-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.smallMama).map(([id, items]) => [`smallMama-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.cellar).map(([id, items]) => [`cellar-${id}`, items]))
        }}
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('small', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('small', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('small', drawerId, itemId)}
        onEditItem={handleEditItemName}
        onMoveItem={(sourceDrawerId, itemId, targetFreezer, targetDrawer) => 
          handleMoveItem('small', sourceDrawerId, itemId, targetFreezer, targetDrawer)
        }
        totalDrawers={DRAWER_COUNTS}
        openDrawerId={openSection?.startsWith('small-') ? openSection : null}
        onToggleDrawer={(drawerId) => {
          const sectionId = `small-${drawerId}`;
          setOpenSection(openSection === sectionId ? null : sectionId);
        }}
        isExpanded={openFreezers.has('small')}
        onToggle={() => handleToggleFreezer('small')}
      />

      <Freezer
        title={isMobile ? "❄️ Velký mraz." : "❄️ Velký mrazák"}
        drawerCount={DRAWER_COUNTS.large}
        freezerType="large"
        drawers={freezerData.large}
        allDrawersFromBothFreezers={{
          ...Object.fromEntries(Object.entries(freezerData.small).map(([id, items]) => [`small-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.large).map(([id, items]) => [`large-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.smallMama).map(([id, items]) => [`smallMama-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.cellar).map(([id, items]) => [`cellar-${id}`, items]))
        }}
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('large', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('large', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('large', drawerId, itemId)}
        onEditItem={handleEditItemName}
        onMoveItem={(sourceDrawerId, itemId, targetFreezer, targetDrawer) => 
          handleMoveItem('large', sourceDrawerId, itemId, targetFreezer, targetDrawer)
        }
        totalDrawers={DRAWER_COUNTS}
        openDrawerId={openSection?.startsWith('large-') ? openSection : null}
        onToggleDrawer={(drawerId) => {
          const sectionId = `large-${drawerId}`;
          setOpenSection(openSection === sectionId ? null : sectionId);
        }}
        isExpanded={openFreezers.has('large')}
        onToggle={() => handleToggleFreezer('large')}
      />

      <Freezer
        title="❄️ Malý mama"
        drawerCount={DRAWER_COUNTS.smallMama}
        freezerType="smallMama"
        drawers={freezerData.smallMama}
        allDrawersFromBothFreezers={{
          ...Object.fromEntries(Object.entries(freezerData.small).map(([id, items]) => [`small-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.large).map(([id, items]) => [`large-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.smallMama).map(([id, items]) => [`smallMama-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.cellar).map(([id, items]) => [`cellar-${id}`, items]))
        }}
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('smallMama', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('smallMama', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('smallMama', drawerId, itemId)}
        onEditItem={handleEditItemName}
        onMoveItem={(sourceDrawerId, itemId, targetFreezer, targetDrawer) => 
          handleMoveItem('smallMama', sourceDrawerId, itemId, targetFreezer, targetDrawer)
        }
        totalDrawers={DRAWER_COUNTS}
        openDrawerId={openSection?.startsWith('smallMama-') ? openSection : null}
        onToggleDrawer={(drawerId) => {
          const sectionId = `smallMama-${drawerId}`;
          setOpenSection(openSection === sectionId ? null : sectionId);
        }}
        isExpanded={openFreezers.has('smallMama')}
        onToggle={() => handleToggleFreezer('smallMama')}
      />

      <Freezer
        title="📦 Sklep"
        drawerCount={DRAWER_COUNTS.cellar}
        freezerType="cellar"
        drawers={freezerData.cellar}
        allDrawersFromBothFreezers={{
          ...Object.fromEntries(Object.entries(freezerData.small).map(([id, items]) => [`small-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.large).map(([id, items]) => [`large-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.smallMama).map(([id, items]) => [`smallMama-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.cellar).map(([id, items]) => [`cellar-${id}`, items]))
        }}
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('cellar', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('cellar', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('cellar', drawerId, itemId)}
        onEditItem={handleEditItemName}
        onMoveItem={(sourceDrawerId, itemId, targetFreezer, targetDrawer) => 
          handleMoveItem('cellar', sourceDrawerId, itemId, targetFreezer, targetDrawer)
        }
        totalDrawers={DRAWER_COUNTS}
        openDrawerId={openSection?.startsWith('cellar-') ? openSection : null}
        onToggleDrawer={(drawerId) => {
          const sectionId = `cellar-${drawerId}`;
          setOpenSection(openSection === sectionId ? null : sectionId);
        }}
        drawerLabel="Police"
        isExpanded={openFreezers.has('cellar')}
        onToggle={() => handleToggleFreezer('cellar')}
      />

      {/* Loading overlay při nahrávání dat */}
      {isUploading && <LoadingOverlay />}
    </div>
  );
}




export default App;
