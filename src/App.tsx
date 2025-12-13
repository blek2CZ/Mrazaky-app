import { useState, useEffect, useRef } from 'react';
import Freezer from './Freezer';
import TemplatesManager from './TemplatesManager';
import { FreezerData, Item, ItemTemplate } from './types';
import { loadFreezerData, saveFreezerData, loadItemTemplates, saveItemTemplates } from './storage';
import { exportData, importData } from './dataSync';

function App() {
  const [freezerData, setFreezerData] = useState<FreezerData>(loadFreezerData);
  const [templates, setTemplates] = useState<ItemTemplate[]>(loadItemTemplates);

  useEffect(() => {
    saveFreezerData(freezerData);
  }, [freezerData]);

  useEffect(() => {
    saveItemTemplates(templates);
  }, [templates]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>🧊 Evidence mrazáků</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExport} title="Stáhnout zálohu dat">📥 Exportovat data</button>
          <button onClick={handleImportClick} title="Nahrát data ze zálohy">📤 Importovat data</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </div>
      </div>
      
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
