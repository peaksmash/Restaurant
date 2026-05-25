import React from 'react';
import { AlertTriangleIcon } from '../Icons';

interface Props {
  message: string;
  onRetry: () => void;
}

export function ErrorScreen({ message, onRetry }: Props) {
  return (
    <div className="fullscreen-center">
      <div className="error-icon"><AlertTriangleIcon size={48} /></div>
      <h2 className="error-title">Algo ha fallado</h2>
      <p className="error-message">{message}</p>
      <button className="btn-primary" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}
