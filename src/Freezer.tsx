import { useState, useEffect, useRef } from 'react';
import { Item, ItemTemplate } from './types';
import './Freezer.css';

interface DrawerProps {
  drawerId: number;
  items: Item[];
  templates: ItemTemplate[];
  allDrawers: { [drawerId: number]: Item[] };
  onAddItem: (drawerId: number, item: Item) => void;
  onUpdateItem: (drawerId: number, itemId: string, quantity: number) => void;
  onDeleteItem: (drawerId: number, itemId: string) => void;
  onEditItem: (oldName: string, newName: string) => void;
  onMoveItem: (itemId: string, targetFreezer: 'small' | 'large' | 'smallMama' | 'cellar', targetDrawer: number) => void;
  freezerType: string;
  totalDrawers: { small: number; large: number; smallMama: number; cellar: number };
  isExpanded: boolean;
  onToggle: () => void;
  drawerLabel?: string; // "Šuplík" nebo "Police"
}

function Drawer({ drawerId, items, templates, allDrawers, onAddItem, onUpdateItem, onDeleteItem, onEditItem, onMoveItem, freezerType, totalDrawers, isExpanded, onToggle, drawerLabel = 'Šuplík' }: DrawerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'quantity'>('name');
  const [sortDescending, setSortDescending] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Resetuj showAddForm při zavření šuplíku
  useEffect(() => {
    if (!isExpanded) {
      setShowAddForm(false);
    }
  }, [isExpanded]);

  const handleAdd = () => {
    const name = selectedTemplate === 'custom' ? customName : templates.find(t => t.id === selectedTemplate)?.name;
    const qty = typeof quantity === 'number' ? quantity : parseInt(quantity) || 0;
    if (!name || qty <= 0) return;

    const duplicate = items.find(i => i.name.toLocaleLowerCase('cs') === name.toLocaleLowerCase('cs'));
    if (duplicate) {
      setDuplicateWarning(`Položka "${duplicate.name}" už v tomto ${drawerLabel.toLowerCase()} je!`);
      return;
    }

    setDuplicateWarning(null);
    const newItem: Item = {
      id: Date.now().toString(),
      name,
      quantity: qty,
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
      <div className="drawer-header" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-title" onClick={onToggle}>
          <h3>{drawerLabel} {drawerId}</h3>
          <button type="button" className="toggle-drawer-button" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="item-count">Položek: {itemCount}</span>
        </div>
        <button onClick={() => { 
          if (!showAddForm && !isExpanded) {
            onToggle();
          }
          setShowAddForm(!showAddForm);
        }}>
          {showAddForm ? 'Zrušit' : '+ Přidat'}
        </button>
      </div>

      {isExpanded && (
        <>
          {showAddForm && (
        <div className="add-item-form" onClick={(e) => e.stopPropagation()}>
          <div className="form-field">
            <label>Vyberte položku:</label>
            <select value={selectedTemplate} onChange={(e) => { setSelectedTemplate(e.target.value); setDuplicateWarning(null); }}>
              <option value="">-- Vyberte --</option>
              <option value="custom">+ Nová položka</option>
              {[...templates]
                .filter(template => !items.some(item => item.name === template.name))
                .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
                .map(template => {
                  // Zkontroluj zda je položka v jiném šuplíku
                  const currentDrawerKey = `${freezerType}-${drawerId}`;
                  const isInOtherDrawer = Object.entries(allDrawers)
                    .filter(([id]) => id !== currentDrawerKey)
                    .some(([_, drawerItems]) => drawerItems.some(item => item.name === template.name));
                  
                  return (
                    <option 
                      key={template.id} 
                      value={template.id}
                      className={isInOtherDrawer ? 'item-in-other-drawer' : ''}
                      style={isInOtherDrawer ? { color: '#856404' } : {}}
                    >
                      {template.name}{isInOtherDrawer ? ' •' : ''}
                    </option>
                  );
                })}
            </select>
          </div>

          {selectedTemplate === 'custom' && (
            <div className="form-field">
              <label>Název:</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => { setCustomName(e.target.value); setDuplicateWarning(null); }}
                placeholder="Zadejte název"
                autoFocus
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
                onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value))}
                min="1"
              />
            </div>
            <div className="form-field">
              <label>&nbsp;</label>
              <button onClick={handleAdd} disabled={!selectedTemplate || (selectedTemplate === 'custom' && !customName) || quantity === '' || quantity < 1}>
                Přidat
              </button>
            </div>
          </div>
          {duplicateWarning && (
            <div className="duplicate-warning">⚠️ {duplicateWarning}</div>
          )}
        </div>
          )}

          {items.length > 0 && (
            <>
              <div className="drawer-sort" onClick={(e) => e.stopPropagation()}>
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
              <div className="items-list" onClick={(e) => e.stopPropagation()}>
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
                      {editingItemId === item.id ? (
                        <input
                          type="text"
                          className="edit-item-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editingName.trim()) {
                              onEditItem(item.name, editingName.trim());
                              setEditingItemId(null);
                              setEditingName('');
                            } else if (e.key === 'Escape') {
                              setEditingItemId(null);
                              setEditingName('');
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className="item-name">{item.name}</span>
                      )}
                      <span className="item-quantity">{item.quantity} ks</span>
                    </div>
                    <div className="item-actions">
                      {movingItemId === item.id ? (
                        <>
                          <select
                            className="move-select"
                            onChange={(e) => {
                              const [targetFreezer, targetDrawer] = e.target.value.split('-');
                              if (targetFreezer && targetDrawer) {
                                onMoveItem(item.id, targetFreezer as 'small' | 'large' | 'smallMama' | 'cellar', parseInt(targetDrawer));
                                setMovingItemId(null);
                              }
                            }}
                            defaultValue=""
                            autoFocus
                          >
                            <option value="">-- Přesunout do --</option>
                            <optgroup label="Malý mrazák">
                              {Array.from({ length: totalDrawers.small }, (_, i) => i + 1).map(d => (
                                <option 
                                  key={`small-${d}`} 
                                  value={`small-${d}`}
                                  disabled={freezerType === 'small' && d === drawerId}
                                >
                                  Šuplík {d}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Velký mrazák">
                              {Array.from({ length: totalDrawers.large }, (_, i) => i + 1).map(d => (
                                <option 
                                  key={`large-${d}`} 
                                  value={`large-${d}`}
                                  disabled={freezerType === 'large' && d === drawerId}
                                >
                                  Šuplík {d}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Malý mama">
                              {Array.from({ length: totalDrawers.smallMama }, (_, i) => i + 1).map(d => (
                                <option 
                                  key={`smallMama-${d}`} 
                                  value={`smallMama-${d}`}
                                  disabled={freezerType === 'smallMama' && d === drawerId}
                                >
                                  Šuplík {d}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Sklep">
                              {Array.from({ length: totalDrawers.cellar }, (_, i) => i + 1).map(d => (
                                <option 
                                  key={`cellar-${d}`} 
                                  value={`cellar-${d}`}
                                  disabled={freezerType === 'cellar' && d === drawerId}
                                >
                                  Police {d}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          <button
                            onClick={() => setMovingItemId(null)}
                            title="Zrušit"
                          >
                            ❌
                          </button>
                        </>
                      ) : editingItemId === item.id ? (
                        <>
                          <button
                            onClick={() => {
                              if (editingName.trim()) {
                                onEditItem(item.name, editingName.trim());
                                setEditingItemId(null);
                                setEditingName('');
                              }
                            }}
                            title="Uložit"
                          >
                            ✔️
                          </button>
                          <button
                            onClick={() => {
                              setEditingItemId(null);
                              setEditingName('');
                            }}
                            title="Zrušit"
                          >
                            ❌
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => onUpdateItem(drawerId, item.id, item.quantity - 1)}>−</button>
                          <button onClick={() => onUpdateItem(drawerId, item.id, item.quantity + 1)}>+</button>
                          <button
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditingName(item.name);
                            }}
                            title="Editovat název"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setMovingItemId(item.id)}
                            title="Přesunout do jiného šuplíku"
                          >
                            ↕️
                          </button>
                          <button onClick={() => onDeleteItem(drawerId, item.id)}>🗑️</button>
                        </>
                      )}
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
  freezerType: string;
  drawers: { [drawerId: number]: Item[] };
  allDrawersFromBothFreezers: { [drawerId: number]: Item[] };
  templates: ItemTemplate[];
  onAddItem: (drawerId: number, item: Item) => void;
  onUpdateItem: (drawerId: number, itemId: string, quantity: number) => void;
  onDeleteItem: (drawerId: number, itemId: string) => void;
  onEditItem: (oldName: string, newName: string) => void;
  onMoveItem: (sourceDrawerId: number, itemId: string, targetFreezer: 'small' | 'large' | 'smallMama' | 'cellar', targetDrawer: number) => void;
  totalDrawers: { small: number; large: number; smallMama: number; cellar: number };
  openDrawerId: string | null;
  onToggleDrawer: (drawerId: number) => void;
  isExpanded: boolean;
  onToggle: () => void;
  drawerLabel?: string;
}

export default function Freezer({ title, drawerCount, freezerType, drawers, allDrawersFromBothFreezers, templates, onAddItem, onUpdateItem, onDeleteItem, onEditItem, onMoveItem, totalDrawers, openDrawerId, onToggleDrawer, isExpanded, onToggle, drawerLabel = 'Šuplík' }: FreezerProps) {
  const freezerRef = useRef<HTMLDivElement>(null);

  // Click outside handler - zavře mrazák když klikneš mimo
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Ignoruj kliky na toast dialogy, modaly a jejich potomky
      if (target.closest('.sync-toast') || 
          target.closest('.modal') || 
          target.closest('[class*="toast"]') ||
          target.closest('[class*="modal"]')) {
        return;
      }

      if (freezerRef.current && !freezerRef.current.contains(target)) {
        onToggle(); // Zavře mrazák
      }
    };

    // Přidej listener s malým zpožděním aby se nespustil okamžitě po otevření
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded, onToggle]);

  return (
    <div className="freezer" ref={freezerRef}>
      <div className="freezer-header" onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
        <h2 style={{ margin: 0 }}>{title} ({drawerCount} {drawerLabel === 'Police' ? 'polic' : 'šuplíků'})</h2>
        <button type="button" style={{ 
          padding: '0.5em',
          minWidth: '40px',
          backgroundColor: 'transparent',
          border: '1px solid #646cff',
          color: '#646cff',
          fontSize: '0.9em',
          cursor: 'pointer'
        }}>
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      {isExpanded && (
        <div className="drawers">
          {Array.from({ length: drawerCount }, (_, i) => i + 1).map(drawerId => (
            <Drawer
              key={drawerId}
              drawerId={drawerId}
              items={drawers[drawerId] || []}
              templates={templates}
              allDrawers={allDrawersFromBothFreezers}
              onAddItem={onAddItem}
              onUpdateItem={onUpdateItem}
              onDeleteItem={onDeleteItem}
              onEditItem={onEditItem}
              onMoveItem={(itemId, targetFreezer, targetDrawer) => onMoveItem(drawerId, itemId, targetFreezer, targetDrawer)}
              freezerType={freezerType}
              totalDrawers={totalDrawers}
              drawerLabel={drawerLabel}
              isExpanded={openDrawerId === `${freezerType}-${drawerId}`}
              onToggle={() => onToggleDrawer(drawerId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
