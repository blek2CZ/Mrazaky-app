import './NotificationSnackbar.css';

export type NotificationType = 'error' | 'success';

interface NotificationSnackbarProps {
  type: NotificationType;
  message: string;
  onClose: () => void;
}

export function NotificationSnackbar({ type, message, onClose }: NotificationSnackbarProps) {
  const isError = type === 'error';
  
  return (
    <div 
      className={`notification-snackbar ${type}`}
      role="alert"
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className="notification-icon">
        {isError ? '⚠️' : '✅'}
      </span>
      <div className="notification-message">
        {message}
      </div>
      <button
        onClick={onClose}
        className="notification-close"
        aria-label="Zavřít notifikaci"
      >
        ×
      </button>
    </div>
  );
}
