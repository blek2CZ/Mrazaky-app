import { useState } from 'react';
import { ItemTemplate } from './types';
import './TemplatesManager.css';

interface TemplatesManagerProps {
  templates: ItemTemplate[];
  onAddTemplate: (name: string) => void;
  onEditTemplate: (id: string, newName: string) => void;
  onDeleteTemplate: (id: string) => void;
  isTemplateUsed: (name: string) => boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function TemplatesManager({ templates, onAddTemplate, onEditTemplate, onDeleteTemplate, isTemplateUsed, isExpanded, onToggle }: TemplatesManagerProps) {
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = () => {
    const trimmedName = newTemplateName.trim();
    if (!trimmedName) return;
    
    // Kontrola duplicit
    if (templates.some(t => t.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert(`Položka "${trimmedName}" již existuje!`);
      return;
    }
    
    onAddTemplate(trimmedName);
    setNewTemplateName('');
    setShowAddForm(false);
  };

  return (
    <div className="templates-manager" onClick={(e) => e.stopPropagation()}>
      <div className="templates-header" onClick={onToggle}>
        <h2>Správa položek</h2>
        <button type="button" className="toggle-button" onClick={(e) => { e.stopPropagation(); onToggle(); }}>{isExpanded ? '▼' : '▶'}</button>
      </div>
      
      {isExpanded && (
        <>
          <div className="templates-list">
        {[...templates].sort((a, b) => a.name.localeCompare(b.name, 'cs')).map(template => (
          <div key={template.id} className={`template-item ${isTemplateUsed(template.name) ? 'template-used' : ''}`}>
            {editingId === template.id ? (
              <input
                type="text"
                className="edit-template-input"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editingName.trim()) {
                    const trimmedName = editingName.trim();
                    // Kontrola duplicit (kromě aktuální položky)
                    if (templates.some(t => t.id !== template.id && t.name.toLowerCase() === trimmedName.toLowerCase())) {
                      alert(`Položka "${trimmedName}" již existuje!`);
                      return;
                    }
                    onEditTemplate(template.id, trimmedName);
                    setEditingId(null);
                    setEditingName('');
                  } else if (e.key === 'Escape') {
                    setEditingId(null);
                    setEditingName('');
                  }
                }}
                autoFocus
              />
            ) : (
              <span className="template-name">{template.name}</span>
            )}
            <div className="template-actions">
              {editingId === template.id ? (
                <>
                  <button
                    onClick={() => {
                      const trimmedName = editingName.trim();
                      if (!trimmedName) return;
                      
                      // Kontrola duplicit (kromě aktuální položky)
                      if (templates.some(t => t.id !== template.id && t.name.toLowerCase() === trimmedName.toLowerCase())) {
                        alert(`Položka "${trimmedName}" již existuje!`);
                        return;
                      }
                      
                      onEditTemplate(template.id, trimmedName);
                      setEditingId(null);
                      setEditingName('');
                    }}
                    title="Uložit"
                  >
                    ✔️
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditingName('');
                    }}
                    title="Zrušit"
                  >
                    ❌
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditingId(template.id);
                      setEditingName(template.name);
                    }}
                    title="Editovat"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDeleteTemplate(template.id)}
                    disabled={isTemplateUsed(template.name)}
                    title={isTemplateUsed(template.name) ? 'Položka je použita v mrazácích' : 'Smazat'}
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

          {!showAddForm ? (
            <button onClick={() => setShowAddForm(true)}>+ Přidat novou položku</button>
          ) : (
            <div className="add-template-form">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Název nové položky"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
              <button onClick={handleAdd}>Přidat</button>
              <button onClick={() => { setShowAddForm(false); setNewTemplateName(''); }}>Zrušit</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
