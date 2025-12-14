import { useState, useEffect, useRef } from 'react';
import Freezer from './Freezer';
import TemplatesManager from './TemplatesManager';
import SyncModal from './SyncModal';
import { FreezerData, Item, ItemTemplate } from './types';
import { loadFreezerData, saveFreezerData, loadItemTemplates, saveItemTemplates } from './storage';
import { exportData, importData } from './dataSync';
import { getSyncCode, saveSyncCode, clearSyncCode, syncDataToFirebase, subscribeToSync, isFirebaseConfigured, invalidateSyncCode, getAdminPasswordHash } from './firebaseSync';
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
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firebaseConfigured = isFirebaseConfigured();

  useEffect(() => {
    saveFreezerData(freezerData);
  }, [freezerData]);

  useEffect(() => {
    saveItemTemplates(templates);
  }, [templates]);

  // Firebase synchronizace
  useEffect(() => {
    if (!syncCode || !firebaseConfigured) return;

    setIsSyncing(true);
    
    const setupListener = () => {
      const unsubscribe = subscribeToSync(
        syncCode, 
        ({ freezerData: newFreezerData, templates: newTemplates }) => {
          setFreezerData(newFreezerData);
          setTemplates(newTemplates);
          saveFreezerData(newFreezerData);
          saveItemTemplates(newTemplates);
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
    if (syncCode && isSyncing && firebaseConfigured) {
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
          await syncDataToFirebase(syncCode, freezerData, templates);
          
          // Po úspěšném uložení znovu připoj listener
          const newUnsubscribe = subscribeToSync(
            syncCode,
            ({ freezerData: newFreezerData, templates: newTemplates }) => {
              setFreezerData(newFreezerData);
              setTemplates(newTemplates);
              saveFreezerData(newFreezerData);
              saveItemTemplates(newTemplates);
            },
            () => {
              alert('⚠️ Synchronizační kód již není platný!\n\nAdmin změnil synchronizační kód. Budete odpojeni a můžete zadat nový kód.');
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
            ({ freezerData: newFreezerData, templates: newTemplates }) => {
              setFreezerData(newFreezerData);
              setTemplates(newTemplates);
              saveFreezerData(newFreezerData);
              saveItemTemplates(newTemplates);
            },
            () => {
              alert('⚠️ Synchronizační kód již není platný!');
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

  const handleAddItem = async (freezerType: 'small' | 'large', drawerId: number, item: Item) => {
    // Odpoj listener před změnou aby nedošlo k race condition
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    // Zruš případný pending timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    // Ihned aktualizuj localStorage jako zálohu
    const newFreezerData = {
      ...freezerData,
      [freezerType]: {
        ...freezerData[freezerType],
        [drawerId]: [...(freezerData[freezerType][drawerId] || []), item],
      },
    };
    saveFreezerData(newFreezerData);
    
    setFreezerData(newFreezerData);

    // Pokud je to nová položka (custom), přidej do templates
    let newTemplates = templates;
    if (!templates.find(t => t.name === item.name)) {
      const newTemplate: ItemTemplate = {
        id: Date.now().toString(),
        name: item.name,
      };
      newTemplates = [...templates, newTemplate];
      saveItemTemplates(newTemplates);
      setTemplates(newTemplates);
    }
    
    // Hned uložíme do Firebase a počkáme na potvrzení
    if (syncCode && firebaseConfigured) {
      try {
        await syncDataToFirebase(syncCode, newFreezerData, newTemplates);
      } catch (error) {
        console.error('Chyba při ukládání do Firebase:', error);
      }
    }
    
    // Znovu připoj listener po úspěšném uložení
    if (syncCode && firebaseConfigured) {
      setTimeout(() => {
        if (!unsubscribeRef.current) {
          const newUnsubscribe = subscribeToSync(
            syncCode,
            ({ freezerData: newFreezerData, templates: newTemplates }) => {
              setFreezerData(newFreezerData);
              setTemplates(newTemplates);
              saveFreezerData(newFreezerData);
              saveItemTemplates(newTemplates);
            },
            () => {
              alert('⚠️ Synchronizační kód již není platný!\n\nAdmin změnil synchronizační kód. Budete odpojeni a můžete zadat nový kód.');
              clearSyncCode();
              setSyncCode(null);
              setIsSyncing(false);
              setShowSyncModal('enter');
            }
          );
          unsubscribeRef.current = newUnsubscribe;
        }
      }, 100);
    }
  };

  const handleUpdateItem = async (freezerType: 'small' | 'large', drawerId: number, itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await handleDeleteItem(freezerType, drawerId, itemId);
      return;
    }

    // Odpoj listener před změnou
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
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
    
    // Uložíme do Firebase a počkáme na potvrzení
    if (syncCode && firebaseConfigured) {
      try {
        await syncDataToFirebase(syncCode, newFreezerData, templates);
      } catch (error) {
        console.error('Chyba při ukládání do Firebase:', error);
      }
    }
    
    // Znovu připoj listener
    if (syncCode && firebaseConfigured) {
      setTimeout(() => {
        if (!unsubscribeRef.current) {
          const newUnsubscribe = subscribeToSync(
            syncCode,
            ({ freezerData: newFreezerData, templates: newTemplates }) => {
              setFreezerData(newFreezerData);
              setTemplates(newTemplates);
              saveFreezerData(newFreezerData);
              saveItemTemplates(newTemplates);
            },
            () => {
              alert('⚠️ Synchronizační kód již není platný!\n\nAdmin změnil synchronizační kód. Budete odpojeni a můžete zadat nový kód.');
              clearSyncCode();
              setSyncCode(null);
              setIsSyncing(false);
              setShowSyncModal('enter');
            }
          );
          unsubscribeRef.current = newUnsubscribe;
        }
      }, 100);
    }
  };

  const handleDeleteItem = async (freezerType: 'small' | 'large', drawerId: number, itemId: string) => {
    // Odpoj listener před změnou
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    const newFreezerData = {
      ...freezerData,
      [freezerType]: {
        ...freezerData[freezerType],
        [drawerId]: freezerData[freezerType][drawerId].filter(item => item.id !== itemId),
      },
    };
    
    saveFreezerData(newFreezerData);
    setFreezerData(newFreezerData);
    
    // Uložíme do Firebase a počkáme na potvrzení
    if (syncCode && firebaseConfigured) {
      try {
        await syncDataToFirebase(syncCode, newFreezerData, templates);
      } catch (error) {
        console.error('Chyba při ukládání do Firebase:', error);
      }
    }
    
    // Znovu připoj listener
    if (syncCode && firebaseConfigured) {
      setTimeout(() => {
        if (!unsubscribeRef.current) {
          const newUnsubscribe = subscribeToSync(
            syncCode,
            ({ freezerData: newFreezerData, templates: newTemplates }) => {
              setFreezerData(newFreezerData);
              setTemplates(newTemplates);
              saveFreezerData(newFreezerData);
              saveItemTemplates(newTemplates);
            },
            () => {
              alert('⚠️ Synchronizační kód již není platný!\n\nAdmin změnil synchronizační kód. Budete odpojeni a můžete zadat nový kód.');
              clearSyncCode();
              setSyncCode(null);
              setIsSyncing(false);
              setShowSyncModal('enter');
            }
          );
          unsubscribeRef.current = newUnsubscribe;
        }
      }, 100);
    }
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
      ) as { [drawerId: number]: Item[] }
    };
    
    setFreezerData(newFreezerData);
    
    // Aktualizuj template se stejným názvem
    setTemplates(prev => prev.map(t => t.name === oldName ? { ...t, name: newName } : t));
  };

  const handleMoveItem = async (
    sourceFreezerType: 'small' | 'large',
    sourceDrawerId: number, 
    itemId: string, 
    targetFreezer: 'small' | 'large', 
    targetDrawer: number
  ) => {
    // Najdi položku ve zdrojovém šuplíku
    const sourceItem = freezerData[sourceFreezerType][sourceDrawerId]?.find(item => item.id === itemId);
    if (!sourceItem) return;

    // Odpoj listener před změnou
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Odeber ze zdroje
    const newFreezerData: FreezerData = {
      small: { ...freezerData.small },
      large: { ...freezerData.large }
    };
    
    newFreezerData[sourceFreezerType] = {
      ...newFreezerData[sourceFreezerType],
      [sourceDrawerId]: newFreezerData[sourceFreezerType][sourceDrawerId].filter(item => item.id !== itemId)
    };

    // Přidej do cíle
    newFreezerData[targetFreezer] = {
      ...newFreezerData[targetFreezer],
      [targetDrawer]: [...(newFreezerData[targetFreezer][targetDrawer] || []), sourceItem]
    };

    saveFreezerData(newFreezerData);
    setFreezerData(newFreezerData);
    
    // Ulož do Firebase a počkej na potvrzení
    if (syncCode && firebaseConfigured) {
      try {
        await syncDataToFirebase(syncCode, newFreezerData, templates);
      } catch (error) {
        console.error('Chyba při ukládání do Firebase:', error);
      }
    }
    
    // Znovu připoj listener
    if (syncCode && firebaseConfigured) {
      setTimeout(() => {
        if (!unsubscribeRef.current) {
          const newUnsubscribe = subscribeToSync(
            syncCode,
            ({ freezerData: newFreezerData, templates: newTemplates }) => {
              setFreezerData(newFreezerData);
              setTemplates(newTemplates);
              saveFreezerData(newFreezerData);
              saveItemTemplates(newTemplates);
            },
            () => {
              alert('⚠️ Synchronizační kód již není platný!\n\nAdmin změnil synchronizační kód. Budete odpojeni a můžete zadat nový kód.');
              clearSyncCode();
              setSyncCode(null);
              setIsSyncing(false);
              setShowSyncModal('enter');
            }
          );
          unsubscribeRef.current = newUnsubscribe;
        }
      }, 100);
    }
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const isTemplateUsed = (name: string): boolean => {
    const allItems = [
      ...Object.values(freezerData.small).flat(),
      ...Object.values(freezerData.large).flat(),
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
      await syncDataToFirebase(code, freezerData, templates, passwordHash);
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
      setFreezerData(importedFreezerData);
      setTemplates(importedTemplates);
      saveFreezerData(importedFreezerData);
      saveItemTemplates(importedTemplates);
      alert('Data úspěšně importována!');
    } catch (error) {
      alert('Chyba při importu dat: ' + (error as Error).message);
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="app-header">
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
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('small', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('small', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('small', drawerId, itemId)}
        onEditItem={handleEditItemName}
        onMoveItem={(sourceDrawerId, itemId, targetFreezer, targetDrawer) => 
          handleMoveItem('small', sourceDrawerId, itemId, targetFreezer, targetDrawer)
        }
        totalDrawers={{ small: 3, large: 7 }}
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
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('large', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('large', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('large', drawerId, itemId)}
        onEditItem={handleEditItemName}
        onMoveItem={(sourceDrawerId, itemId, targetFreezer, targetDrawer) => 
          handleMoveItem('large', sourceDrawerId, itemId, targetFreezer, targetDrawer)
        }
        totalDrawers={{ small: 3, large: 7 }}
        openDrawerId={openSection?.startsWith('large-') ? openSection : null}
        onToggleDrawer={(drawerId) => {
          const sectionId = `large-${drawerId}`;
          setOpenSection(openSection === sectionId ? null : sectionId);
        }}
      />
    </>
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
