import { useState } from 'react';
import './DisconnectModal.css';

interface DisconnectModalProps {
  onClose: () => void;
  onConfirm: (password: string) => Promise<boolean>;
}

export function DisconnectModal({ onClose, onConfirm }: DisconnectModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    const success = await onConfirm(password);
    setIsProcessing(false);

    if (!success) {
      if (!password) {
        setError('Zadejte admin heslo');
      } else {
        setError('Nesprávné admin heslo!');
      }
    }
  };

  return (
    <div className="sync-modal-overlay" onClick={onClose}>
      <div className="sync-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🚫 Odpojit synchronizaci</h2>
        <p>
          Zadejte admin heslo pro potvrzení odpojení.<br/>
          Ostatní uživatelé budou také odpojeni a budou muset zadat nový sync kód.<br/>
          <br/>
          <strong>Po odpojení můžete vytvořit nový sync kód.</strong><br/>
          <em style={{ fontSize: '0.85em', color: '#888' }}>Pokud jste smazali hash z Firebase, pole hesla nechte prázdné.</em>
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
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
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
          <button onClick={onClose} disabled={isProcessing}>Zrušit</button>
          <button 
            onClick={handleConfirm}
            disabled={isProcessing}
            style={{ backgroundColor: '#f44336' }}
          >
            {isProcessing ? 'Odpojuji...' : 'Odpojit'}
          </button>
        </div>
      </div>
    </div>
  );
}
