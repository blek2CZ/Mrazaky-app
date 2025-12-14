import { useState } from 'react';
import { FreezerData, ItemTemplate } from '../types';
import { getSyncCode, getAdminPasswordHash } from '../firebaseSync';
import { verifyPasswordHash } from '../adminAuth';
import './ConflictResolutionModal.css';

interface ConflictResolutionModalProps {
  localData: { 
    freezerData: FreezerData; 
    templates: ItemTemplate[]; 
    lastModified: number 
  };
  serverData: { 
    freezerData: FreezerData; 
    templates: ItemTemplate[]; 
    lastModified: number 
  };
  onUseLocal: () => void;
  onUseServer: () => void;
  onCancel: () => void;
}

export function ConflictResolutionModal({
  localData,
  serverData,
  onUseLocal,
  onUseServer,
  onCancel
}: ConflictResolutionModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const countItems = (data: FreezerData) => {
    let total = 0;
    ['small', 'large', 'smallMama'].forEach(freezerType => {
      Object.values(data[freezerType as keyof FreezerData]).forEach((drawer) => {
        total += drawer.length;
      });
    });
    return total;
  };

  const handleVerifyPassword = async () => {
    if (!password) {
      setError('Zadejte admin heslo');
      return;
    }

    const syncCode = getSyncCode();
    if (!syncCode) {
      setError('Synchronizační kód není k dispozici');
      return;
    }

    const storedHash = await getAdminPasswordHash(syncCode);
    if (!storedHash) {
      setError('Admin heslo není nastaveno');
      return;
    }

    const isValid = await verifyPasswordHash(password, storedHash);
    if (isValid) {
      setIsVerified(true);
      setError('');
    } else {
      setError('Nesprávné admin heslo!');
    }
  };

  const localItemCount = countItems(localData.freezerData);
  const serverItemCount = countItems(serverData.freezerData);

  return (
    <div className="sync-modal-overlay" onClick={onCancel}>
      <div className="sync-modal conflict-modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ color: '#ff9800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ⚠️ Konflikt verzí dat
        </h2>

        {!isVerified ? (
          <>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Někdo jiný upravil data v cloudu. Pro rozhodnutí o verzi dat zadejte admin heslo.
            </p>

            <div className="form-field">
              <label>Admin heslo:</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Zadejte heslo"
                  autoFocus
                  style={{ paddingRight: '3rem' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2em',
                    padding: '0.25rem 0.5rem'
                  }}
                  title={showPassword ? 'Skrýt heslo' : 'Zobrazit heslo'}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {error && (
                <p style={{ color: '#f44336', fontSize: '0.9em', margin: '0.5rem 0 0 0' }}>
                  {error}
                </p>
              )}
            </div>

            <div className="sync-modal-actions">
              <button onClick={onCancel}>Zrušit</button>
              <button 
                onClick={handleVerifyPassword}
                disabled={!password}
                style={{ backgroundColor: '#2196F3' }}
              >
                Ověřit heslo
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: '#666', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Vyberte, kterou verzi dat chcete použít:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ 
                border: '2px solid #2196F3', 
                borderRadius: '8px', 
                padding: '1rem',
                backgroundColor: '#e3f2fd'
              }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#2196F3' }}>📱 Moje data (lokální)</h3>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9em' }}>
                  Položek: <strong>{localItemCount}</strong>
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9em' }}>
                  Šablon: <strong>{localData.templates.length}</strong>
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.85em', color: '#666' }}>
                  Změněno: {new Date(localData.lastModified).toLocaleString('cs-CZ')}
                </p>
              </div>

              <div style={{ 
                border: '2px solid #4CAF50', 
                borderRadius: '8px', 
                padding: '1rem',
                backgroundColor: '#e8f5e9'
              }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#4CAF50' }}>☁️ Data z cloudu</h3>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9em' }}>
                  Položek: <strong>{serverItemCount}</strong>
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9em' }}>
                  Šablon: <strong>{serverData.templates.length}</strong>
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.85em', color: '#666' }}>
                  Změněno: {new Date(serverData.lastModified).toLocaleString('cs-CZ')}
                </p>
              </div>
            </div>

            <div style={{ 
              backgroundColor: '#fff3cd', 
              border: '1px solid #ffc107', 
              borderRadius: '8px', 
              padding: '0.75rem', 
              marginBottom: '1.5rem',
              fontSize: '0.9em',
              color: '#856404'
            }}>
              <strong>⚠️ Upozornění:</strong> Při použití vlastních dat přepíšete data v cloudu. 
              Změny od druhého uživatele budou ztraceny!
            </div>

            <div className="sync-modal-actions">
              <button onClick={onCancel}>Zrušit</button>
              <button 
                onClick={onUseServer}
                style={{ backgroundColor: '#4CAF50' }}
              >
                ☁️ Použít data z cloudu
              </button>
              <button 
                onClick={onUseLocal}
                style={{ backgroundColor: '#ff9800' }}
              >
                📱 Použít moje data
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
