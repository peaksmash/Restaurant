import React from 'react';
import { CheckIcon } from '../Icons';

interface Props {
  message: string;
  onDone: () => void;
}

export function RecoveryConfirmedScreen({ message, onDone }: Props) {
  return (
    <div className="fullscreen-center confirmation">
      <div className="confirm-checkmark">
        <CheckIcon size={48} />
      </div>
      <h1 className="confirm-title">Pago confirmado</h1>
      <p className="confirm-hint">{message}</p>
      <button className="btn-primary confirm-btn" onClick={onDone}>
        Volver al inicio
      </button>
    </div>
  );
}
