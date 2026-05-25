import React from 'react';
import type { OrderMode } from '../api';
import { EatInIcon, TakeAwayIcon } from '../Icons';

interface Props {
  restaurantName: string;
  onSelect: (mode: OrderMode) => void;
  onOpenRecovery: () => void;
}

export function WelcomeScreen({ restaurantName, onSelect, onOpenRecovery }: Props) {
  return (
    <div className="welcome-screen">
      <div className="welcome-top">
        <h1 className="welcome-title">{restaurantName || 'Bienvenido'}</h1>
        <p className="welcome-subtitle">Como quieres tu pedido?</p>
      </div>

      <div className="welcome-choices">
        <button className="welcome-choice" onClick={() => onSelect('eatIn')}>
          <span className="welcome-choice-icon">
            <EatInIcon size={96} />
          </span>
          <span className="welcome-choice-label">Comer aqui</span>
        </button>

        <button className="welcome-choice" onClick={() => onSelect('takeAway')}>
          <span className="welcome-choice-icon">
            <TakeAwayIcon size={96} />
          </span>
          <span className="welcome-choice-label">Para llevar</span>
        </button>
      </div>

      <button type="button" className="welcome-recovery-btn" onClick={onOpenRecovery}>
        <strong>Paga aqui tu pedido</strong>
        <span>Introduce el codigo que recibiste al hacer tu pedido.</span>
      </button>

      <p className="welcome-hint">Toca para empezar</p>
    </div>
  );
}
