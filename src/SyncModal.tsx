import { useState } from 'react';
import { hashPassword, verifyPasswordHash } from './adminAuth';
import { getAdminPasswordHash } from './firebaseSync';
import './SyncModal.css';

interface SyncModalProps {
  mode: 'generate' | 'enter';
  onClose: () => void;
  onGenerate: (code: string, passwordHash: string) => void;
  onEnter: (code: string) => void;
  existingSyncCode?: string | null;
}

export default function SyncModal({ mode, onClose, onGenerate, onEnter, existingSyncCode }: SyncModalProps) {
  const [generatedCode, setGeneratedCode] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [adminPassword, setAdminPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGenerate = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedCode(code);
  };

  const handleConfirmGenerate = async () => {
    if (!generatedCode || isProcessing) return;

    setIsProcessing(true);
    setPasswordError('');

    try {
      // Pokud už máme sync kód, musíme ověřit admin heslo z Firebase
      if (existingSyncCode) {
        const storedHash = await getAdminPasswordHash(existingSyncCode);
        if (!storedHash) {
          setPasswordError('Chyba: Admin heslo nebylo nalezeno v databázi!');
          setIsProcessing(false);
          return;
        }
        
        const isValid = await verifyPasswordHash(adminPassword, storedHash);
        if (!isValid) {
          setPasswordError('Nesprávné admin heslo!');
          setIsProcessing(false);
          return;
        }
      } else {
        // Vytváříme první sync kód - zkontroluj shodu hesel
        if (adminPassword !== confirmPassword) {
          setPasswordError('Hesla se neshodují!');
          setIsProcessing(false);
          return;
        }
        if (adminPassword.length < 4) {
          setPasswordError('Heslo musí mít alespoň 4 znaky!');
          setIsProcessing(false);
          return;
        }
      }

      // Vytvoř hash hesla
      const passwordHash = await hashPassword(adminPassword);
      onGenerate(generatedCode, passwordHash);
    } catch (error) {
      setPasswordError('Chyba při ověřování hesla!');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
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
                    {existingSyncCode ? 'Admin heslo:' : 'Nastavte si admin heslo:'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPasswordInput(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder={existingSyncCode ? 'Zadejte heslo' : 'Vytvořte si heslo'}
                      autoFocus
                      style={{ paddingRight: '3rem' }}
                      disabled={isProcessing}
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
                  
                  {!existingSyncCode && (
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
                        disabled={isProcessing}
                      />
                    </>
                  )}
                  
                  {passwordError && (
                    <p style={{ color: '#f44336', fontSize: '0.9em', margin: '0.5rem 0 0 0' }}>
                      {passwordError}
                    </p>
                  )}
                  {!existingSyncCode && (
                    <p style={{ fontSize: '0.85em', color: '#ccc', margin: '0.5rem 0 0 0' }}>
                      Toto heslo budete potřebovat pro generování dalších sync kódů.
                    </p>
                  )}
                </div>

                <div className="sync-modal-actions">
                  <button onClick={handleGenerate} disabled={isProcessing}>Generovat nový</button>
                  <button 
                    onClick={handleConfirmGenerate} 
                    style={{ backgroundColor: '#4caf50' }}
                    disabled={!adminPassword || (!existingSyncCode && !confirmPassword) || isProcessing}
                  >
                    {isProcessing ? 'Zpracovávám...' : 'Použít tento kód'}
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
