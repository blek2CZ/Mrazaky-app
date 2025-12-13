import { useState } from 'react';
import { ItemTemplate } from './types';
import './TemplatesManager.css';

interface TemplatesManagerProps {
  templates: ItemTemplate[];
  onAddTemplate: (name: string) => void;
  onDeleteTemplate: (id: string) => void;
  isTemplateUsed: (name: string) => boolean;
}

export default function TemplatesManager({ templates, onAddTemplate, onDeleteTemplate, isTemplateUsed }: TemplatesManagerProps) {
  const [newTemplateName, setNewTemplateName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAdd = () => {
    if (newTemplateName.trim()) {
      onAddTemplate(newTemplateName.trim());
      setNewTemplateName('');
      setShowAddForm(false);
    }
  };

  return (
    <div className="templates-manager">
      <div className="templates-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h2>Správa položek</h2>
        <button type="button" className="toggle-button" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>{isExpanded ? '▼' : '▶'}</button>
      </div>
      
      {isExpanded && (
        <>
          <div className="templates-list">
        {templates.map(template => (
          <div key={template.id} className="template-item">
            <span className="template-name">{template.name}</span>
            <div className="template-actions">
              <button
                onClick={() => onDeleteTemplate(template.id)}
                disabled={isTemplateUsed(template.name)}
                title={isTemplateUsed(template.name) ? 'Položka je použita v mrazácích' : 'Smazat'}
              >
                🗑️
              </button>
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
