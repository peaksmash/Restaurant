import React, { useState } from 'react';
import type { AdminPaymentDevice, AdminPaymentJob, LocalConfig } from '../api';
import { getKioskAppUrl, getLocationGroups } from '../lib/adminDashboard';

interface Props {
  config: LocalConfig;
  paymentDevices: AdminPaymentDevice[];
  paymentJobs: AdminPaymentJob[];
}

export function AdminKiosksTab({ config, paymentDevices, paymentJobs }: Props) {
  const kioskUrl = getKioskAppUrl();
  const [message, setMessage] = useState('');
  const locationGroups = getLocationGroups(config, paymentDevices, paymentJobs);
  const currentLocation = locationGroups[0];

  async function copyKioskUrl() {
    if (!kioskUrl) {
      setMessage('Configura la URL del kiosko para poder copiarla.');
      return;
    }

    try {
      await navigator.clipboard.writeText(kioskUrl);
      setMessage('Enlace del kiosko copiado.');
    } catch {
      setMessage('No se pudo copiar el enlace del kiosko.');
    }
  }

  function openKiosk() {
    if (!kioskUrl) {
      setMessage('Configura la URL del kiosko para abrirlo desde aquí.');
      return;
    }

    window.open(kioskUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="tab-content">
      <div className="page-hero">
        <div>
          <h1>Kioskos</h1>
          <p>Los kioskos usan los dispositivos de pago del local.</p>
        </div>
      </div>

      <section className="card">
        <div className="infobox infobox-info">
          Los kioskos de este local comparten los dispositivos de pago del local.
          Si un dispositivo está ocupado, el siguiente cobro espera turno.
        </div>

        <div className="status-list">
          <div className="status-row">
            <span className="status-row-label">Local mostrado</span>
            <span className="badge badge-gray">{currentLocation?.label ?? 'Local actual'}</span>
          </div>
          <div className="status-row">
            <span className="status-row-label">Dispositivos compartidos</span>
            <span className="badge badge-gray">
              {currentLocation?.devices.length ?? 0} disponibles
            </span>
          </div>
        </div>

        <div className="btn-row">
          <button className="btn btn-primary" onClick={openKiosk}>
            Abrir kiosko
          </button>
          <button className="btn btn-secondary" onClick={() => void copyKioskUrl()}>
            Copiar enlace del kiosko
          </button>
          <button className="btn btn-secondary" onClick={openKiosk}>
            Probar flujo de pago
          </button>
        </div>

        <div className="infobox infobox-warn">
          Alta real de kioskos pendiente. En esta fase usamos el kiosko actual y los dispositivos compartidos del local.
        </div>

        {message ? <p className="hint">{message}</p> : null}
      </section>
    </div>
  );
}
