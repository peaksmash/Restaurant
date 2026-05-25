import React, { useState } from 'react';
import type { KioskConfig } from '../api';
import { getRestaurantLogo, getRestaurantName } from '../api';

interface Props {
  config: KioskConfig;
  onStart: () => void;
}

function LogoDisplay({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim()[0]?.toUpperCase() ?? 'K';

  if (logoUrl && !failed) {
    return (
      <img
        className="brand-logo-img"
        src={logoUrl}
        alt={name}
        onError={() => setFailed(true)}
      />
    );
  }
  return <div className="brand-logo-placeholder">{initial}</div>;
}

export function WelcomeBrandScreen({ config, onStart }: Props) {
  const name = getRestaurantName(config);
  const logoUrl = getRestaurantLogo(config);

  return (
    <div className="brand-welcome-screen" onClick={onStart}>
      <div className="brand-welcome-content">
        <LogoDisplay logoUrl={logoUrl} name={name} />
        <div className="brand-welcome-text">
          <h1 className="brand-welcome-name">{name}</h1>
          <p className="brand-welcome-subtitle">Bienvenido</p>
        </div>
        <button
          className="brand-welcome-btn"
          onClick={(e) => { e.stopPropagation(); onStart(); }}
        >
          Toca para empezar
        </button>
      </div>
    </div>
  );
}
