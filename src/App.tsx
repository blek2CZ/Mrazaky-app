import { useState, useEffect, useRef } from 'react';
import Freezer from './Freezer';
import TemplatesManager from './TemplatesManager';
import SyncModal from './SyncModal';
import { FreezerData, Item, ItemTemplate } from './types';
import { loadFreezerData, saveFreezerData, loadItemTemplates, saveItemTemplates } from './storage';
import { exportData, importData } from './dataSync';
import { getSyncCode, saveSyncCode, clearSyncCode, syncDataToFirebase, subscribeToSync, isFirebaseConfigured } from './firebaseSync';
import './App.css';

function App() {
  const [freezerData, setFreezerData] = useState<FreezerData>(loadFreezerData);
  const [templates, setTemplates] = useState<ItemTemplate[]>(loadItemTemplates);
  const [syncCode, setSyncCode] = useState<string | null>(getSyncCode());
  const [showSyncModal, setShowSyncModal] = useState<'generate' | 'enter' | null>(null);
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
    const unsubscribe = subscribeToSync(syncCode, ({ freezerData: newFreezerData, templates: newTemplates }) => {
      setFreezerData(newFreezerData);
      setTemplates(newTemplates);
      saveFreezerData(newFreezerData);
      saveItemTemplates(newTemplates);
    });

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

  const handleGenerateSync = (code: string) => {
    saveSyncCode(code);
    setSyncCode(code);
    setShowSyncModal(null);
    if (firebaseConfigured) {
      syncDataToFirebase(code, freezerData, templates);
    }
  };

  const handleEnterSync = (code: string) => {
    saveSyncCode(code);
    setSyncCode(code);
    setShowSyncModal(null);
  };

  const handleDisconnectSync = () => {
    if (confirm('Opravdu chcete odpojit synchronizaci? Data zůstanou uložená lokálně.')) {
      clearSyncCode();
      setSyncCode(null);
      setIsSyncing(false);
    }
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
                <button onClick={handleDisconnectSync} title="Odpojit synchronizaci">🚫 Odpojit</button>
              </>
            ) : (
              <>
                <button onClick={() => setShowSyncModal('generate')} title="Vytvořit nový synchronizační kód">🔄 Nový sync kód</button>
                <button onClick={() => setShowSyncModal('enter')} title="Zadat existující kód">🔑 Zadat kód</button>
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

export default App;
