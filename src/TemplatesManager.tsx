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
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  
  const isMobile = () => window.innerWidth <= 768;

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
    <div className="templates-manager">
      <div className="templates-header" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        <h2>Správa položek</h2>
        <button type="button" className="toggle-button" onClick={(e) => { e.stopPropagation(); onToggle(); }}>{isExpanded ? '▼' : '▶'}</button>
      </div>
      
      {isExpanded && (
        <>
          <div className="templates-list" onClick={(e) => e.stopPropagation()}>
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
                    onClick={() => {
                      if (isTemplateUsed(template.name) && isMobile()) {
                        setShowMobileWarning(true);
                        setTimeout(() => setShowMobileWarning(false), 3000);
                      } else if (!isTemplateUsed(template.name)) {
                        onDeleteTemplate(template.id);
                      }
                    }}
                    disabled={!isMobile() && isTemplateUsed(template.name)}
                    title={isTemplateUsed(template.name) ? 'Položka je použita v mrazácích' : 'Smazat'}
                    style={isMobile() && isTemplateUsed(template.name) ? { 
                      color: '#ff5252',
                      opacity: '1',
                      cursor: 'pointer'
                    } : undefined}
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
            <button onClick={(e) => { e.stopPropagation(); setShowAddForm(true); }}>+ Přidat novou položku</button>
          ) : (
            <div className="add-template-form" onClick={(e) => e.stopPropagation()}>
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
          
          {showMobileWarning && (
            <div style={{
              position: 'fixed',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#ff5252',
              color: 'white',
              padding: '15px 25px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 10000,
              fontSize: '14px',
              fontWeight: '500',
              maxWidth: '90vw',
              textAlign: 'center'
            }}>
              ⚠️ Položka je použita v mrazácích
            </div>
          )}
        </>
      )}
    </div>
  );
}
