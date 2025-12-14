import { FreezerData, ItemTemplate } from './types';

export const exportData = (freezerData: FreezerData, templates: ItemTemplate[]) => {
  const dataToExport = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    freezerData,
    templates,
  };

  const dataStr = JSON.stringify(dataToExport, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `mrazaky-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const importData = (file: File): Promise<{ freezerData: FreezerData; templates: ItemTemplate[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (!data.freezerData || !data.templates) {
          throw new Error('Neplatný formát souboru');
        }
        
        // Migrace starých dat - přidej smallMama, pokud neexistuje
        if (!data.freezerData.smallMama) {
          data.freezerData.smallMama = { 1: [] };
        }
        
        resolve({
          freezerData: data.freezerData,
          templates: data.templates,
        });
      } catch (error) {
        reject(new Error('Chyba při načítání souboru'));
      }
    };
    
    reader.onerror = () => reject(new Error('Chyba při čtení souboru'));
    reader.readAsText(file);
  });
};
