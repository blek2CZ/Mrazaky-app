import { useState, useEffect, useRef } from 'react';
import Freezer from './Freezer';
import TemplatesManager from './TemplatesManager';
import SyncModal from './SyncModal';
import { FreezerData, Item, ItemTemplate } from './types';
import { loadFreezerData, saveFreezerData, loadItemTemplates, saveItemTemplates } from './storage';
import { exportData, importData } from './dataSync';
import { getSyncCode, saveSyncCode, clearSyncCode, syncDataToFirebase, syncDataToFirebaseForce, subscribeToSync, isFirebaseConfigured, invalidateSyncCode, getAdminPasswordHash } from './firebaseSync';
import { verifyPasswordHash } from './adminAuth';
import './App.css';

function App() {
  const [freezerData, setFreezerData] = useState<FreezerData>(loadFreezerData);
  const [templates, setTemplates] = useState<ItemTemplate[]>(loadItemTemplates);
  const [syncCode, setSyncCode] = useState<string | null>(getSyncCode());
  const [showSyncModal, setShowSyncModal] = useState<'generate' | 'enter' | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastModified, setLastModified] = useState<number>(() => {
    const stored = localStorage.getItem('mrazaky-lastModified');
    return stored ? parseInt(stored) : Date.now();
  });
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialSyncDone = useRef<boolean>(false);
  const firebaseConfigured = isFirebaseConfigured();

  useEffect(() => {
    saveFreezerData(freezerData);
  }, [freezerData]);

  useEffect(() => {
    saveItemTemplates(templates);
  }, [templates]);

  useEffect(() => {
    localStorage.setItem('mrazaky-lastModified', lastModified.toString());
  }, [lastModified]);

  // Firebase synchronizace
  useEffect(() => {
    if (!syncCode || !firebaseConfigured) return;

    setIsSyncing(true);
    
    const setupListener = () => {
      const unsubscribe = subscribeToSync(
        syncCode, 
        ({ freezerData: newFreezerData, templates: newTemplates, lastModified: serverTimestamp }) => {
          console.log('☁️ Přijata data z Firebase, timestamp:', new Date(serverTimestamp).toISOString());
          // Migrace dat - přidej smallMama, pokud neexistuje
          if (!newFreezerData.smallMama) {
            newFreezerData.smallMama = { 1: [] };
          }
          
          // Upozorni uživatele, pokud má neuložené změny
          if (hasUnsavedChanges && initialSyncDone.current) {
            const confirm = window.confirm(
              '⚠️ Někdo jiný změnil data v cloudu!\n\n' +
              'Máte neuložené lokální změny. Co chcete udělat?\n\n' +
              'OK = Načíst data z cloudu (ztratíte lokální změny)\n' +
              'Zrušit = Ponechat lokální data'
            );
            if (!confirm) {
              return; // Ponechat lokální data
            }
            setHasUnsavedChanges(false);
          }
          
          setFreezerData(newFreezerData);
          setTemplates(newTemplates);
          setLastModified(serverTimestamp);
          saveFreezerData(newFreezerData);
          saveItemTemplates(newTemplates);
          // Označ, že první sync proběhl
          if (!initialSyncDone.current) {
            initialSyncDone.current = true;
            console.log('✅ První synchronizace dokončena');
          }
        },
        () => {
          // Callback když je kód invalidován
          alert('⚠️ Synchronizační kód již není platný!\n\nAdmin změnil synchronizační kód. Budete odpojeni a můžete zadat nový kód.');
          clearSyncCode();
          setSyncCode(null);
          setIsSyncing(false);
          setShowSyncModal('enter');
        }
      );
      unsubscribeRef.current = unsubscribe;
    };
    
    setupListener();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [syncCode, firebaseConfigured]);

  // Auto-sync when data changes
  useEffect(() => {
    // Neposílej data do Firebase dokud neproběhne první načtení dat z Firebase
    if (syncCode && isSyncing && firebaseConfigured && initialSyncDone.current) {
      // Zruš předchozí timeout pokud existuje
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(async () => {
        // Odpoj listener před zápisem
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        
        try {
          // Ulož data do Firebase a počkej na potvrzení
          const result = await syncDataToFirebase(syncCode, freezerData, templates, lastModified);
          
          // Pokud byl zápis odmítnut kvůli starším datům, načti aktuální verzi
          if (!result.success) {
            console.warn('⚠️ Auto-sync odmítnut:', result.reason);
            // Listener automaticky načte aktuální data, nemusíme dělat nic
            return;
          }
          
          // Aktualizuj lokální timestamp po úspěšném zápisu
          if (result.serverTimestamp) {
            setLastModified(result.serverTimestamp);
          }
          
          // Po úspěšném uložení znovu připoj listener
          const newUnsubscribe = subscribeToSync(
            syncCode,
            ({ freezerData: newFreezerData, templates: newTemplates, lastModified: serverTimestamp }) => {
              console.log('☁️ Přijata data z Firebase, timestamp:', new Date(serverTimestamp).toISOString());
              // Migrace dat - přidej smallMama, pokud neexistuje
              if (!newFreezerData.smallMama) {
                newFreezerData.smallMama = { 1: [] };
              }
              setFreezerData(newFreezerData);
              setTemplates(newTemplates);
              setLastModified(serverTimestamp);
              saveFreezerData(newFreezerData);
              saveItemTemplates(newTemplates);
            },
            () => {
              alert('⚠️ Synchronizační kód již není platný!\n\nAdmin změnil synchronizační kód. Budete odpojeni a můžete zadat nový kód.');
              initialSyncDone.current = false;
              clearSyncCode();
              setSyncCode(null);
              setIsSyncing(false);
              setShowSyncModal('enter');
            }
          );
          unsubscribeRef.current = newUnsubscribe;
        } catch (error) {
          console.error('Chyba při synchronizaci:', error);
          // Při chybě znovu připoj listener
          const newUnsubscribe = subscribeToSync(
            syncCode,
            ({ freezerData: newFreezerData, templates: newTemplates, lastModified: serverTimestamp }) => {
              console.log('☁️ Přijata data z Firebase, timestamp:', new Date(serverTimestamp).toISOString());
              // Migrace dat - přidej smallMama, pokud neexistuje
              if (!newFreezerData.smallMama) {
                newFreezerData.smallMama = { 1: [] };
              }
              setFreezerData(newFreezerData);
              setTemplates(newTemplates);
              setLastModified(serverTimestamp);
              saveFreezerData(newFreezerData);
              saveItemTemplates(newTemplates);
            },
            () => {
              alert('⚠️ Synchronizační kód již není platný!');
              initialSyncDone.current = false;
              clearSyncCode();
              setSyncCode(null);
              setIsSyncing(false);
              setShowSyncModal('enter');
            }
          );
          unsubscribeRef.current = newUnsubscribe;
        }
      }, 800); // Debounce 800 ms
      
      return () => {
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
      };
    }
  }, [freezerData, templates, syncCode, isSyncing, firebaseConfigured]);

  // Manuální sync funkce
  const handleManualSync = async () => {
    if (!syncCode || !firebaseConfigured || !hasUnsavedChanges) return;
    
    try {
      const newTimestamp = Date.now();
      const result = await syncDataToFirebase(syncCode, freezerData, templates, newTimestamp);
      
      if (result.success && result.serverTimestamp) {
        setLastModified(result.serverTimestamp);
        setHasUnsavedChanges(false);
        console.log('✅ Data úspěšně odeslána do cloudu');
      } else if (!result.success) {
        alert(`❌ Nepodařilo se odeslat data:\n\n${result.reason}\n\nNačtou se aktuální data z cloudu.`);
      }
    } catch (error) {
      console.error('Chyba při odesílání do Firebase:', error);
      alert('❌ Chyba při odesílání dat do cloudu!');
    }
  };

  const handleAddItem = async (freezerType: 'small' | 'large' | 'smallMama', drawerId: number, item: Item) => {
    const newFreezerData = {
      ...freezerData,
      [freezerType]: {
        ...freezerData[freezerType],
        [drawerId]: [...(freezerData[freezerType][drawerId] || []), item],
      },
    };
    saveFreezerData(newFreezerData);
    setFreezerData(newFreezerData);
    setHasUnsavedChanges(true);

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
    
    saveFreezerData(newFreezerData);
    setFreezerData(newFreezerData);
    setHasUnsavedChanges(true);
  };

  const handleDeleteItem = async (freezerType: 'small' | 'large' | 'smallMama', drawerId: number, itemId: string) => {

    const newFreezerData = {
      ...freezerData,
      [freezerType]: {
        ...freezerData[freezerType],
        [drawerId]: freezerData[freezerType][drawerId].filter(item => item.id !== itemId),
      },
    };
    
    saveFreezerData(newFreezerData);
    setFreezerData(newFreezerData);
    setHasUnsavedChanges(true);
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

    // KROK 10: Ulož do localStorage
    console.log('💾 Ukládání do localStorage...');
    saveFreezerData(newFreezerData);
    setFreezerData(newFreezerData);
    setHasUnsavedChanges(true);
    console.log('✓ Uloženo do localStorage');
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
        
        // Heslo OK - odpoj listener před zápisem
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
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
          
          // Znovu připoj listener
          setTimeout(() => {
            if (!unsubscribeRef.current) {
              const newUnsubscribe = subscribeToSync(
                syncCode,
                ({ freezerData: newFreezerData, templates: newTemplates, lastModified: serverTimestamp }) => {
                  console.log('☁️ Přijata data z Firebase, timestamp:', new Date(serverTimestamp).toISOString());
                  // Migrace dat - přidej smallMama, pokud neexistuje
                  if (!newFreezerData.smallMama) {
                    newFreezerData.smallMama = { 1: [] };
                  }
                  setFreezerData(newFreezerData);
                  setTemplates(newTemplates);
                  setLastModified(serverTimestamp);
                  saveFreezerData(newFreezerData);
                  saveItemTemplates(newTemplates);
                },
                () => {
                  alert('⚠️ Synchronizační kód již není platný!');
                  initialSyncDone.current = false;
                  clearSyncCode();
                  setSyncCode(null);
                  setIsSyncing(false);
                  setShowSyncModal('enter');
                }
              );
              unsubscribeRef.current = newUnsubscribe;
            }
          }, 100);
          
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

      {isSyncing && hasUnsavedChanges && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000
        }}>
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
        </div>
      )}
      
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
    </div>
  );
}

function DisconnectModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (password: string) => Promise<boolean> }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!password) {
      setError('Zadejte admin heslo');
      return;
    }

    setIsProcessing(true);
    const success = await onConfirm(password);
    setIsProcessing(false);

    if (!success) {
      setError('Nesprávné admin heslo!');
    }
  };

  return (
    <div className="sync-modal-overlay" onClick={onClose}>
      <div className="sync-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🚫 Odpojit synchronizaci</h2>
        <p>
          Zadejte admin heslo pro potvrzení odpojení.<br/>
          Ostatní uživatelé budou také odpojeni a budou muset zadat nový sync kód.<br/>
          <br/>
          <strong>Po odpojení můžete vytvořit nový sync kód.</strong>
        </p>
        
        <div className="form-field">
          <label>Admin heslo:</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Zadejte heslo"
              autoFocus
              style={{ paddingRight: '3rem' }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2em',
                padding: '0.25rem 0.5rem'
              }}
              title={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {error && (
            <p style={{ color: '#f44336', fontSize: '0.9em', margin: '0.5rem 0 0 0' }}>
              {error}
            </p>
          )}
        </div>

        <div className="sync-modal-actions">
          <button onClick={onClose} disabled={isProcessing}>Zrušit</button>
          <button 
            onClick={handleConfirm}
            disabled={!password || isProcessing}
            style={{ backgroundColor: '#f44336' }}
          >
            {isProcessing ? 'Odpojuji...' : 'Odpojit'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
