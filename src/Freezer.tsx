import { useState } from 'react';
import { Item, ItemTemplate } from './types';
import './Freezer.css';

interface DrawerProps {
  drawerId: number;
  items: Item[];
  templates: ItemTemplate[];
  onAddItem: (drawerId: number, item: Item) => void;
  onUpdateItem: (drawerId: number, itemId: string, quantity: number) => void;
  onDeleteItem: (drawerId: number, itemId: string) => void;
}

function Drawer({ drawerId, items, templates, onAddItem, onUpdateItem, onDeleteItem }: DrawerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'quantity'>('name');
  const [sortDescending, setSortDescending] = useState(false);

  const handleAdd = () => {
    const name = selectedTemplate === 'custom' ? customName : templates.find(t => t.id === selectedTemplate)?.name;
    if (!name || quantity <= 0) return;

    const newItem: Item = {
      id: Date.now().toString(),
      name,
      quantity,
    };

    onAddItem(drawerId, newItem);
    setSelectedTemplate('');
    setCustomName('');
    setQuantity(1);
    setShowAddForm(false);
  };

  const itemCount = items.length;

  return (
    <div className="drawer">
      <div className="drawer-header">
        <div className="drawer-title" onClick={() => setIsExpanded(!isExpanded)}>
          <h3>Šuplík {drawerId}</h3>
          <button type="button" className="toggle-drawer-button" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="item-count">Položek: {itemCount}</span>
        </div>
        <button onClick={() => { 
          if (!showAddForm) {
            setIsExpanded(true);
          }
          setShowAddForm(!showAddForm);
        }}>
          {showAddForm ? 'Zrušit' : '+ Přidat'}
        </button>
      </div>

      {isExpanded && (
        <>
          {showAddForm && (
        <div className="add-item-form">
          <div className="form-field">
            <label>Vyberte položku:</label>
            <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
              <option value="">-- Vyberte --</option>
              <option value="custom">+ Nová položka</option>
              {[...templates]
                .filter(template => !items.some(item => item.name === template.name))
                .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
                .map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
            </select>
          </div>

          {selectedTemplate === 'custom' && (
            <div className="form-field">
              <label>Název:</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Zadejte název"
              />
            </div>
          )}

          <div className="form-row">
            <div className="form-field">
              <label>Množství:</label>
              <input
                type="number"
                className="quantity-input"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                min="1"
              />
            </div>
            <button onClick={handleAdd} disabled={!selectedTemplate || (selectedTemplate === 'custom' && !customName)}>
              Přidat
            </button>
          </div>
        </div>
          )}

          {items.length > 0 && (
            <>
              <div className="drawer-sort">
                <label>Řadit:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'quantity')}>
                  <option value="name">Abecedně</option>
                  <option value="quantity">Podle množství</option>
                </select>
                <button 
                  onClick={() => setSortDescending(!sortDescending)}
                  title={sortDescending ? 'Sestupně' : 'Vzestupně'}
                >
                  {sortDescending ? '↓' : '↑'}
                </button>
              </div>
              <div className="items-list">
                {[...items].sort((a, b) => {
                  let result;
                  if (sortBy === 'name') {
                    result = a.name.localeCompare(b.name, 'cs');
                  } else {
                    result = b.quantity - a.quantity;
                  }
                  return sortDescending ? -result : result;
                }).map(item => (
                  <div key={item.id} className="item">
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-quantity">{item.quantity} ks</span>
                    </div>
                    <div className="item-actions">
                      <button onClick={() => onUpdateItem(drawerId, item.id, item.quantity - 1)}>−</button>
                      <button onClick={() => onUpdateItem(drawerId, item.id, item.quantity + 1)}>+</button>
                      <button onClick={() => onDeleteItem(drawerId, item.id)}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface FreezerProps {
  title: string;
  drawerCount: number;
  drawers: { [drawerId: number]: Item[] };
  templates: ItemTemplate[];
  onAddItem: (drawerId: number, item: Item) => void;
  onUpdateItem: (drawerId: number, itemId: string, quantity: number) => void;
  onDeleteItem: (drawerId: number, itemId: string) => void;
}

export default function Freezer({ title, drawerCount, drawers, templates, onAddItem, onUpdateItem, onDeleteItem }: FreezerProps) {
  return (
    <div className="freezer">
      <h2>{title} ({drawerCount} šuplíků)</h2>
      <div className="drawers">
        {Array.from({ length: drawerCount }, (_, i) => i + 1).map(drawerId => (
          <Drawer
            key={drawerId}
            drawerId={drawerId}
            items={drawers[drawerId] || []}
            templates={templates}
            onAddItem={onAddItem}
            onUpdateItem={onUpdateItem}
            onDeleteItem={onDeleteItem}
          />
        ))}
      </div>
    </div>
  );
}
