import { useState, useEffect, useRef } from 'react';
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
  const [changeCount, setChangeCount] = useState(0);
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  const [conflictServerData, setConflictServerData] = useState<{ freezerData: FreezerData; templates: ItemTemplate[]; lastModified: number } | null>(null);
  const [lastModified, setLastModified] = useState<number>(() => {
    const stored = localStorage.getItem('mrazaky-lastModified');
    return stored ? parseInt(stored) : 0; // 0 = ještě nebyly načteny data z Firebase
  });
  const [showSyncActions, setShowSyncActions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const initialSyncDone = useRef<boolean>(false);
  const firebaseConfigured = isFirebaseConfigured();
  const lastSavedFreezerData = useRef<FreezerData>(freezerData);
  const lastSavedTemplates = useRef<ItemTemplate[]>(templates);

  // Ukládání do localStorage pouze při potvrzení změn nebo načtení z Firebase
  const saveToLocalStorage = (data: FreezerData, temps: ItemTemplate[]) => {
    saveFreezerData(data);
    saveItemTemplates(temps);
    lastSavedFreezerData.current = data;
    lastSavedTemplates.current = temps;
  };

  useEffect(() => {
    localStorage.setItem('mrazaky-lastModified', lastModified.toString());
  }, [lastModified]);

  // Funkce pro kontrolu a načtení dat z Firebase
  const checkForUpdates = async (showSuccessMessage: boolean = false) => {
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
          setHasUnsavedChanges(false);
          setChangeCount(0);
        }

        setFreezerData(data.freezerData);
        setTemplates(data.templates);
        setLastModified(data.lastModified);
        saveToLocalStorage(data.freezerData, data.templates);
        console.log('✅ Data úspěšně načtena z cloudu');
        if (showSuccessMessage) {
          setSuccessMessage('Nová data byla načtena z cloudu');
          setTimeout(() => setSuccessMessage(null), 5000);
        }
      } else {
        console.log('✅ Lokální data jsou aktuální nebo novější než server');
        if (showSuccessMessage) {
          if (data.lastModified === lastModified) {
            setSuccessMessage('Data jsou aktuální - stejná verze jako v cloudu');
            setTimeout(() => setSuccessMessage(null), 5000);
          } else {
            // Lokální data jsou novější - nastavit jako neuložené změny
            console.log('⚠️ Lokální data jsou novější - nastavuji hasUnsavedChanges');
            setHasUnsavedChanges(true);
            if (changeCount === 0) {
              setChangeCount(1); // Nastavit alespoň 1 změnu aby se zobrazilo tlačítko
            }
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
      checkForUpdates(false); // false = nezobrazovat success hlášku při startu
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
    
    // Uložit změny do localStorage před odesláním do Firebase
    saveToLocalStorage(freezerData, templates);
    
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
        setHasUnsavedChanges(false);
        setChangeCount(0);
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
        setHasUnsavedChanges(false);
        setChangeCount(0);
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
    setHasUnsavedChanges(false);
    setChangeCount(0);
    setShowConflictResolution(false);
    setConflictServerData(null);
    setSuccessMessage('✅ Data z cloudu byla načtena');
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleAddItem = async (freezerType: 'small' | 'large' | 'smallMama', drawerId: number, item: Item) => {
    const newFreezerData = {
      ...freezerData,
      [freezerType]: {
        ...freezerData[freezerType],
        [drawerId]: [...(freezerData[freezerType][drawerId] || []), item],
      },
    };
    setFreezerData(newFreezerData);
    setHasUnsavedChanges(true);
    setChangeCount(prev => prev + 1);

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

  const handleUpdateItem = async (freezerType: 'small' | 'large' | 'smallMama', drawerId: number, itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await handleDeleteItem(freezerType, drawerId, itemId);
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
    setHasUnsavedChanges(true);
    setChangeCount(prev => prev + 1);
  };

  const handleDeleteItem = async (freezerType: 'small' | 'large' | 'smallMama', drawerId: number, itemId: string) => {

    const newFreezerData = {
      ...freezerData,
      [freezerType]: {
        ...freezerData[freezerType],
        [drawerId]: freezerData[freezerType][drawerId].filter(item => item.id !== itemId),
      },
    };
    
    setFreezerData(newFreezerData);
    setHasUnsavedChanges(true);
    setChangeCount(prev => prev + 1);
  };

  const handleAddTemplate = (name: string) => {
    const newTemplate: ItemTemplate = {
      id: Date.now().toString(),
      name,
    };
    setTemplates(prev => [...prev, newTemplate]);
  };

  const handleEditTemplate = (id: string, newName: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
  };

  const handleEditItemName = (oldName: string, newName: string) => {
    if (oldName === newName) return;
    
    // Aktualizuj všechny položky se starým názvem ve všech šuplících
    const newFreezerData: FreezerData = {
      small: Object.fromEntries(
        Object.entries(freezerData.small).map(([drawerId, items]) => [
          drawerId,
          items.map((item: Item) => item.name === oldName ? { ...item, name: newName } : item)
        ])
      ) as { [drawerId: number]: Item[] },
      large: Object.fromEntries(
        Object.entries(freezerData.large).map(([drawerId, items]) => [
          drawerId,
          items.map((item: Item) => item.name === oldName ? { ...item, name: newName } : item)
        ])
      ) as { [drawerId: number]: Item[] },
      smallMama: Object.fromEntries(
        Object.entries(freezerData.smallMama).map(([drawerId, items]) => [
          drawerId,
          items.map((item: Item) => item.name === oldName ? { ...item, name: newName } : item)
        ])
      ) as { [drawerId: number]: Item[] }
    };
    
    setFreezerData(newFreezerData);
    setHasUnsavedChanges(true);
    setChangeCount(prev => prev + 1);
    
    // Aktualizuj template se stejným názvem
    setTemplates(prev => prev.map(t => t.name === oldName ? { ...t, name: newName } : t));
  };

  const handleMoveItem = async (
    sourceFreezerType: 'small' | 'large' | 'smallMama',
    sourceDrawerId: number, 
    itemId: string, 
    targetFreezer: 'small' | 'large' | 'smallMama', 
    targetDrawer: number
  ) => {
    console.log('=== PŘESUN POLOŽKY - START ===');
    console.log('Zdroj:', sourceFreezerType, 'šuplík', sourceDrawerId);
    console.log('Cíl:', targetFreezer, 'šuplík', targetDrawer);
    
    // KROK 1: Najdi položku ve zdrojovém šuplíku
    const sourceItem = freezerData[sourceFreezerType][sourceDrawerId]?.find(item => item.id === itemId);
    if (!sourceItem) {
      console.error('❌ Položka nenalezena!');
      alert('Chyba: Položka nebyla nalezena!');
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
      ) as { [drawerId: number]: Item[] }
    };
    console.log('✓ Kopie vytvořena');
    
    // KROK 4: Kontrola - počet položek před změnou
    const totalItemsBefore = 
      Object.values(newFreezerData.small).flat().length + 
      Object.values(newFreezerData.large).flat().length +
      Object.values(newFreezerData.smallMama).flat().length;
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
      alert('Chyba při přesunu: Položka se nepřidala do cílového šuplíku!');
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
      alert('Chyba při přesunu: Položka se neodebrala ze zdrojového šuplíku!');
      return;
    }
    console.log('✓ Kontrola: Položka není ve zdroji');
    
    // KROK 9: Kontrola - celkový počet položek (musí zůstat stejný)
    const totalItemsAfter = 
      Object.values(newFreezerData.small).flat().length + 
      Object.values(newFreezerData.large).flat().length +
      Object.values(newFreezerData.smallMama).flat().length;
    console.log('📊 Celkem položek po změně:', totalItemsAfter);
    
    if (totalItemsBefore !== totalItemsAfter) {
      console.error('❌ KRITICKÁ CHYBA: Počet položek se změnil!', {
        před: totalItemsBefore,
        po: totalItemsAfter,
        rozdíl: totalItemsAfter - totalItemsBefore
      });
      alert('KRITICKÁ CHYBA: Počet položek se změnil! Přesun zrušen.');
      return;
    }
    console.log('✓ Kontrola: Celkový počet položek zachován');

    // KROK 10: Nastav nová data (uloží se až při potvrzení)
    console.log('✓ Nastavuji nová data...');
    setFreezerData(newFreezerData);
    setHasUnsavedChanges(true);
    setChangeCount(prev => prev + 1);
    console.log('=== PŘESUN POLOŽKY - DOKONČENO ✓ ===');
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const isTemplateUsed = (name: string): boolean => {
    const allItems = [
      ...Object.values(freezerData.small).flat(),
      ...Object.values(freezerData.large).flat(),
      ...Object.values(freezerData.smallMama).flat(),
    ];
    return allItems.some(item => item.name === name);
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
        <div className="sync-toast" style={{
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
            📊 Máte <strong>{changeCount}</strong> {changeCount === 1 ? 'neuloženou změnu' : changeCount >= 2 && changeCount <= 4 ? 'neuložené změny' : 'neuložených změn'}
          </div>
          <div className="sync-toast-message" style={{ marginBottom: '20px', color: '#666' }}>
            Chcete je odeslat do cloudu?
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              className="sync-toast-cancel"
              onClick={() => {
                // Vrátit neuložené změny
                setFreezerData(lastSavedFreezerData.current);
                setTemplates(lastSavedTemplates.current);
                setShowSyncConfirm(false);
                setHasUnsavedChanges(false);
                setChangeCount(0);
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span>Odeslat změny do cloudu</span>
                <span style={{ fontSize: '12px', opacity: 0.9 }}>({changeCount} {changeCount === 1 ? 'změna' : changeCount >= 2 && changeCount <= 4 ? 'změny' : 'změn'})</span>
              </div>
            </button>
          )}
          <button
            onClick={() => checkForUpdates(true)}
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
              ) : (() => {
                const results: { item: Item; freezerType: string; freezerName: string; drawerNum: number }[] = [];
                
                const freezers = [
                  { type: 'small' as const, name: 'Malý', data: freezerData.small },
                  { type: 'large' as const, name: 'Velký', data: freezerData.large },
                  { type: 'smallMama' as const, name: 'Malý mama', data: freezerData.smallMama }
                ];
                
                freezers.forEach(freezer => {
                  Object.entries(freezer.data).forEach(([drawerKey, items]) => {
                    const drawerNum = parseInt(drawerKey.replace('drawer', ''));
                    items.forEach((item: Item) => {
                      if (item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                        results.push({
                          item,
                          freezerType: freezer.type,
                          freezerName: freezer.name,
                          drawerNum
                        });
                      }
                    });
                  });
                });
                
                return results.length > 0 ? (
                  <>
                    <p style={{ color: '#646cff', fontWeight: '600', marginBottom: '0.75rem', padding: '0 1rem' }}>
                      Nalezeno {results.length} {results.length === 1 ? 'položka' : results.length < 5 ? 'položky' : 'položek'}:
                    </p>
                    <div className="items-list">
                      {results.map((result, index) => (
                        <div key={index} className="item">
                          <div className="item-info">
                            <span className="item-name">{result.item.name}</span>
                            <span className="item-quantity">{result.item.quantity} ks</span>
                          </div>
                          <div className="item-location">
                            {result.freezerName} → Šuplík {result.drawerNum}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ textAlign: 'center', padding: '2rem', color: '#999', fontSize: '1.1rem' }}>
                    ❌ Nenalezeno
                  </p>
                );
              })()}
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
        title="Malý mrazák"
        drawerCount={3}
        freezerType="small"
        drawers={freezerData.small}
        allDrawersFromBothFreezers={{
          ...Object.fromEntries(Object.entries(freezerData.small).map(([id, items]) => [`small-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.large).map(([id, items]) => [`large-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.smallMama).map(([id, items]) => [`smallMama-${id}`, items]))
        }}
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('small', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('small', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('small', drawerId, itemId)}
        onEditItem={handleEditItemName}
        onMoveItem={(sourceDrawerId, itemId, targetFreezer, targetDrawer) => 
          handleMoveItem('small', sourceDrawerId, itemId, targetFreezer, targetDrawer)
        }
        totalDrawers={{ small: 3, large: 7, smallMama: 1 }}
        openDrawerId={openSection?.startsWith('small-') ? openSection : null}
        onToggleDrawer={(drawerId) => {
          const sectionId = `small-${drawerId}`;
          setOpenSection(openSection === sectionId ? null : sectionId);
        }}
      />

      <Freezer
        title="Velký mrazák"
        drawerCount={7}
        freezerType="large"
        drawers={freezerData.large}
        allDrawersFromBothFreezers={{
          ...Object.fromEntries(Object.entries(freezerData.small).map(([id, items]) => [`small-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.large).map(([id, items]) => [`large-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.smallMama).map(([id, items]) => [`smallMama-${id}`, items]))
        }}
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('large', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('large', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('large', drawerId, itemId)}
        onEditItem={handleEditItemName}
        onMoveItem={(sourceDrawerId, itemId, targetFreezer, targetDrawer) => 
          handleMoveItem('large', sourceDrawerId, itemId, targetFreezer, targetDrawer)
        }
        totalDrawers={{ small: 3, large: 7, smallMama: 1 }}
        openDrawerId={openSection?.startsWith('large-') ? openSection : null}
        onToggleDrawer={(drawerId) => {
          const sectionId = `large-${drawerId}`;
          setOpenSection(openSection === sectionId ? null : sectionId);
        }}
      />

      <Freezer
        title="Malý mama"
        drawerCount={1}
        freezerType="smallMama"
        drawers={freezerData.smallMama}
        allDrawersFromBothFreezers={{
          ...Object.fromEntries(Object.entries(freezerData.small).map(([id, items]) => [`small-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.large).map(([id, items]) => [`large-${id}`, items])),
          ...Object.fromEntries(Object.entries(freezerData.smallMama).map(([id, items]) => [`smallMama-${id}`, items]))
        }}
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('smallMama', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('smallMama', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('smallMama', drawerId, itemId)}
        onEditItem={handleEditItemName}
        onMoveItem={(sourceDrawerId, itemId, targetFreezer, targetDrawer) => 
          handleMoveItem('smallMama', sourceDrawerId, itemId, targetFreezer, targetDrawer)
        }
        totalDrawers={{ small: 3, large: 7, smallMama: 1 }}
        openDrawerId={openSection?.startsWith('smallMama-') ? openSection : null}
        onToggleDrawer={(drawerId) => {
          const sectionId = `smallMama-${drawerId}`;
          setOpenSection(openSection === sectionId ? null : sectionId);
        }}
      />

      {/* Loading overlay při nahrávání dat */}
      {isUploading && <LoadingOverlay />}
    </div>
  );
}




export default App;
