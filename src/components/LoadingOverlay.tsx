import './LoadingOverlay.css';

interface LoadingOverlayProps {
  message?: string;
  submessage?: string;
}

export default function LoadingOverlay({ 
  message = 'Nahrávám data do cloudu...',
  submessage = 'Prosím čekejte, aplikace bude brzy dostupná.'
}: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner">⏳</div>
        <h2>{message}</h2>
        <p>{submessage}</p>
      </div>
    </div>
  );
}
