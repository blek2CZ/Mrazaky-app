import { useState, useEffect } from 'react';
import Freezer from './Freezer';
import TemplatesManager from './TemplatesManager';
import { FreezerData, Item, ItemTemplate } from './types';
import { loadFreezerData, saveFreezerData, loadItemTemplates, saveItemTemplates } from './storage';

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

  return (
    <>
      <h1>🧊 Evidence mrazáků</h1>
      
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
