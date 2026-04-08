import React from 'react';
import './ConfirmDialog.css';

export interface ConfirmDialogButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'secondary';
}

interface ConfirmDialogProps {
  title: string;
  message?: React.ReactNode;
  buttons: ConfirmDialogButton[];
  position?: 'bottom' | 'center';
}

export function ConfirmDialog({ title, message, buttons, position = 'bottom' }: ConfirmDialogProps) {
  return (
    <div
      className={`confirm-dialog confirm-dialog--${position}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="confirm-dialog__title">{title}</div>
      {message && <div className="confirm-dialog__message">{message}</div>}
      <div className="confirm-dialog__actions">
        {buttons.map((btn, i) => (
          <button
            key={i}
            className={`confirm-dialog__btn confirm-dialog__btn--${btn.variant ?? 'secondary'}`}
            onClick={btn.onClick}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
