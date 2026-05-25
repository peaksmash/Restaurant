import React from 'react';

export function LoadingScreen() {
  return (
    <div className="fullscreen-center">
      <div className="spinner" />
      <p className="loading-text">Cargando carta…</p>
    </div>
  );
}
