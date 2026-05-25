import React from 'react';

interface FullPageHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

export function FullPageHeader({ title, subtitle, onClose }: FullPageHeaderProps) {
  return (
    <header className="fullpage-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <button type="button" className="fullpage-close-btn" onClick={onClose} aria-label="Cerrar">
        ×
      </button>
    </header>
  );
}
