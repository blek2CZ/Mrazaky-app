import { useState } from 'react';
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

  const handleGenerate = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedCode(code);
  };

  const handleConfirmGenerate = () => {
    if (generatedCode) {
      onGenerate(generatedCode);
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
                <div className="sync-modal-actions">
                  <button onClick={handleGenerate}>Generovat nový</button>
                  <button onClick={handleConfirmGenerate} style={{ backgroundColor: '#4caf50' }}>
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
