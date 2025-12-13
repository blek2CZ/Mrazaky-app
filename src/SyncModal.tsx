import { useState } from 'react';
import { verifyAdminPassword, setAdminPassword, hasAdminPassword } from './adminAuth';
import './SyncModal.css';

interface SyncModalProps {
  mode: 'generate' | 'enter';
  onClose: () => void;
  onGenerate: (code: string) => void;
  onEnter: (code: string) => void;
}

export default function SyncModal({ mode, onClose, onGenerate, onEnter }: SyncModalProps) {
  const [generatedCode, setGeneratedCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [adminPassword, setAdminPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleGenerate = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedCode(code);
  };

  const handleConfirmGenerate = () => {
    if (!generatedCode) return;

    // Pokud nastavujeme heslo poprvé, zkontroluj shodu
    if (!hasAdminPassword()) {
      if (adminPassword !== confirmPassword) {
        setPasswordError('Hesla se neshodují!');
        return;
      }
      if (adminPassword.length < 4) {
        setPasswordError('Heslo musí mít alespoň 4 znaky!');
        return;
      }
      setAdminPassword(adminPassword);
    } else {
      // Ověření existującího admin hesla
      if (!verifyAdminPassword(adminPassword)) {
        setPasswordError('Nesprávné admin heslo!');
        return;
      }
    }

    onGenerate(generatedCode);
  };

  const handleConfirmEnter = () => {
    if (enteredCode.length >= 6) {
      onEnter(enteredCode.toUpperCase());
    }
  };

  return (
    <div className="sync-modal-overlay" onClick={onClose}>
      <div className="sync-modal" onClick={(e) => e.stopPropagation()}>
        {mode === 'generate' ? (
          <>
            <h2>🔄 Vytvořit synchronizační kód</h2>
            <p>
              Vygenerujte si unikátní 6místný kód, který použijete na všech svých zařízeních
              pro synchronizaci dat.
            </p>
            
            {!generatedCode ? (
              <button onClick={handleGenerate} style={{ width: '100%', padding: '1rem' }}>
                Vygenerovat kód
              </button>
            ) : (
              <>
                <div className="sync-code-display">
                  <div className="code">{generatedCode}</div>
                </div>
                <p style={{ fontSize: '0.9em', color: '#f44336' }}>
                  ⚠️ Uložte si tento kód! Budete ho potřebovat na ostatních zařízeních.
                </p>
                
                <div className="form-field" style={{ marginTop: '1rem' }}>
                  <label>
                    {hasAdminPassword() ? 'Admin heslo:' : 'Nastavte si admin heslo:'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPasswordInput(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder={hasAdminPassword() ? 'Zadejte heslo' : 'Vytvořte si heslo'}
                      autoFocus
                      style={{ paddingRight: '3rem' }}
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
                  
                  {!hasAdminPassword() && (
                    <>
                      <label style={{ marginTop: '0.75rem' }}>Potvrďte heslo:</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setPasswordError('');
                        }}
                        placeholder="Zadejte heslo znovu"
                      />
                    </>
                  )}
                  
                  {passwordError && (
                    <p style={{ color: '#f44336', fontSize: '0.9em', margin: '0.5rem 0 0 0' }}>
                      {passwordError}
                    </p>
                  )}
                  {!hasAdminPassword() && (
                    <p style={{ fontSize: '0.85em', color: '#ccc', margin: '0.5rem 0 0 0' }}>
                      Toto heslo budete potřebovat pro generování dalších sync kódů.
                    </p>
                  )}
                </div>

                <div className="sync-modal-actions">
                  <button onClick={handleGenerate}>Generovat nový</button>
                  <button 
                    onClick={handleConfirmGenerate} 
                    style={{ backgroundColor: '#4caf50' }}
                    disabled={!adminPassword || (!hasAdminPassword() && !confirmPassword)}
                  >
                    Použít tento kód
                  </button>
                </div>
              </>
            )}
            
            <div className="sync-modal-actions" style={{ marginTop: '1rem' }}>
              <button onClick={onClose}>Zrušit</button>
            </div>
          </>
        ) : (
          <>
            <h2>🔄 Zadat synchronizační kód</h2>
            <p>
              Zadejte 6místný synchronizační kód, který jste vygenerovali na jiném zařízení.
            </p>
            
            <input
              type="text"
              className="sync-code-input"
              placeholder="ABC123"
              maxLength={6}
              value={enteredCode}
              onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
              autoFocus
            />
            
            <div className="sync-modal-actions">
              <button onClick={onClose}>Zrušit</button>
              <button 
                onClick={handleConfirmEnter}
                disabled={enteredCode.length < 6}
                style={{ backgroundColor: enteredCode.length >= 6 ? '#4caf50' : undefined }}
              >
                Připojit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
