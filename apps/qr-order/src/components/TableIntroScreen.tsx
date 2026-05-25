import React, { useEffect, useMemo, useState } from 'react';

interface Props {
  logoUrl?: string;
  restaurantName: string;
  tableName: string;
  loading?: boolean;
  onContinue: () => void;
}

const INTRO_SECONDS = 6;

export function TableIntroScreen({ logoUrl, restaurantName, tableName, loading = false, onContinue }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(INTRO_SECONDS);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (secondsLeft <= 0) {
      onContinue();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [loading, onContinue, secondsLeft]);

  useEffect(() => {
    if (!loading) {
      setSecondsLeft(INTRO_SECONDS);
    }
  }, [loading]);

  const safeTableName = useMemo(() => tableName.trim() || 'Tu mesa', [tableName]);
  const safeRestaurantName = useMemo(() => restaurantName.trim() || 'Restaurante', [restaurantName]);

  return (
    <div className="table-intro-screen">
      <div className="table-intro-glow table-intro-glow-a" aria-hidden="true" />
      <div className="table-intro-glow table-intro-glow-b" aria-hidden="true" />
      <div className="table-intro-card">
        <div className="table-intro-topline">
          <span className="table-intro-topline-dot" />
          <span>Servicio en mesa</span>
        </div>

        <div className="table-intro-logo-wrap">
          {logoUrl ? (
            <img className="table-intro-logo" src={logoUrl} alt={safeRestaurantName} />
          ) : (
            <div className="table-intro-name-fallback">{safeRestaurantName}</div>
          )}
        </div>

        <p className="table-intro-label">{loading ? 'Estamos preparando tu entrada' : 'Tu pedido llegará a'}</p>
        <h1 className="table-intro-table">{loading ? 'Preparando tu mesa' : safeTableName}</h1>

        <div className="table-intro-notice">
          <span className="table-intro-notice-kicker">Aviso</span>
          <span>Pago en efectivo: solo en barra.</span>
        </div>

        <div className="table-intro-actions">
          {loading ? (
            <div className="table-intro-loading">
              <div className="table-intro-loading-ring" aria-hidden="true" />
              <p>Conectando con tu mesa y cargando el menú…</p>
            </div>
          ) : (
            <>
              <button className="btn-primary table-intro-btn" onClick={onContinue} type="button">
                Ver menú
              </button>

              <div className="table-intro-countdown" aria-live="polite">
                <div className="table-intro-countdown-ring">
                  <span>{secondsLeft}</span>
                </div>
                <p>Entrando automáticamente en {secondsLeft}s</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
