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

    return () => unsubscribe();
  }, [syncCode, firebaseConfigured]);

  // Auto-sync when data changes
  useEffect(() => {
    if (syncCode && isSyncing && firebaseConfigured) {
      const timeoutId = setTimeout(() => {
        syncDataToFirebase(syncCode, freezerData, templates).catch(console.error);
      }, 1000); // Debounce 1 sekunda
      
      return () => clearTimeout(timeoutId);
    }
  }, [freezerData, templates, syncCode, isSyncing, firebaseConfigured]);

  const handleAddItem = (freezerType: 'small' | 'large', drawerId: number, item: Item) => {
    setFreezerData(prev => ({
      ...prev,
      [freezerType]: {
        ...prev[freezerType],
        [drawerId]: [...(prev[freezerType][drawerId] || []), item],
      },
    }));

    // Pokud je to nová položka (custom), přidej do templates
    if (!templates.find(t => t.name === item.name)) {
      const newTemplate: ItemTemplate = {
        id: Date.now().toString(),
        name: item.name,
      };
      setTemplates(prev => [...prev, newTemplate]);
    }
  };

  const handleUpdateItem = (freezerType: 'small' | 'large', drawerId: number, itemId: string, quantity: number) => {
    if (quantity <= 0) {
      handleDeleteItem(freezerType, drawerId, itemId);
      return;
    }

    setFreezerData(prev => ({
      ...prev,
      [freezerType]: {
        ...prev[freezerType],
        [drawerId]: prev[freezerType][drawerId].map(item =>
          item.id === itemId ? { ...item, quantity } : item
        ),
      },
    }));
  };

  const handleDeleteItem = (freezerType: 'small' | 'large', drawerId: number, itemId: string) => {
    setFreezerData(prev => ({
      ...prev,
      [freezerType]: {
        ...prev[freezerType],
        [drawerId]: prev[freezerType][drawerId].filter(item => item.id !== itemId),
      },
    }));
  };

  const handleAddTemplate = (name: string) => {
    const newTemplate: ItemTemplate = {
      id: Date.now().toString(),
      name,
    };
    setTemplates(prev => [...prev, newTemplate]);
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
        onDeleteTemplate={handleDeleteTemplate}
        isTemplateUsed={isTemplateUsed}
      />

      <Freezer
        title="Malý mrazák"
        drawerCount={3}
        drawers={freezerData.small}
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('small', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('small', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('small', drawerId, itemId)}
      />

      <Freezer
        title="Velký mrazák"
        drawerCount={7}
        drawers={freezerData.large}
        templates={templates}
        onAddItem={(drawerId, item) => handleAddItem('large', drawerId, item)}
        onUpdateItem={(drawerId, itemId, quantity) => handleUpdateItem('large', drawerId, itemId, quantity)}
        onDeleteItem={(drawerId, itemId) => handleDeleteItem('large', drawerId, itemId)}
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
