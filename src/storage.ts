import { FreezerData, ItemTemplate } from './types';

const STORAGE_KEY_FREEZERS = 'mrazaky-data';
const STORAGE_KEY_TEMPLATES = 'mrazaky-templates';

export const loadFreezerData = (): FreezerData => {
  const stored = localStorage.getItem(STORAGE_KEY_FREEZERS);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      // Migrace starých dat - přidej smallMama, pokud neexistuje
      if (!data.smallMama) {
        data.smallMama = { 1: [] };
      }
      // Migrace starých dat - přidej cellar (sklep), pokud neexistuje
      if (!data.cellar) {
        data.cellar = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] };
      }
      return data;
    } catch {
      console.error('Nepodařilo se načíst data z localStorage – poškozená data, načítám výchozí stav.');
    }
  }
  return {
    small: { 1: [], 2: [], 3: [] },
    large: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
    smallMama: { 1: [] },
    cellar: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] },
  };
};

export const saveFreezerData = (data: FreezerData): void => {
  localStorage.setItem(STORAGE_KEY_FREEZERS, JSON.stringify(data));
};

export const loadItemTemplates = (): ItemTemplate[] => {
  const stored = localStorage.getItem(STORAGE_KEY_TEMPLATES);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      console.error('Nepodařilo se načíst šablony z localStorage – poškozená data, načítám výchozí šablony.');
    }
  }
  return [
    { id: '1', name: 'Kuřecí prsa' },
    { id: '2', name: 'Hovězí maso' },
    { id: '3', name: 'Vepřové maso' },
    { id: '4', name: 'Ryba' },
    { id: '5', name: 'Zmrzlina' },
    { id: '6', name: 'Hrášek' },
    { id: '7', name: 'Kukuřice' },
    { id: '8', name: 'Jahody' },
    { id: '9', name: 'Brambory' },
  ];
};

export const saveItemTemplates = (templates: ItemTemplate[]): void => {
  localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
};
