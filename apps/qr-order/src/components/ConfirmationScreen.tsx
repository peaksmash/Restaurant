import React from 'react';
import type { OrderTotals, QrPaymentMode } from '../api';
import { CheckIcon } from '../Icons';
import { buildQrDataUrl } from '../lib/qrCode';

interface Props {
  orderCode: string;
  customerName?: string;
  contextLabel: string;
  totals?: OrderTotals;
  estimatedReadyAt?: string;
  paymentMode: QrPaymentMode;
  paymentStatus: 'unpaid' | 'payment_pending' | 'paid' | 'payment_failed' | 'refunded';
  lastSyncStatus: 'not_sent' | 'sent' | 'sync_failed';
  pin4?: string | null;
  rescueToken?: string | null;
  expiresAt?: string | null;
  onNewOrder: () => void;
}

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

async function downloadCashierCodePng(input: {
  pin4: string;
  rescueToken: string;
  tableName: string;
  total?: number;
}) {
  const qrDataUrl = await buildQrDataUrl(input.rescueToken, 280);
  const qrImage = new Image();
  qrImage.src = qrDataUrl;

  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = () => reject(new Error('No se pudo generar el QR.'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 820;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px Arial';
  ctx.fillText('Pago en efectivo: solo en barra.', 80, 100);

  ctx.fillStyle = '#f5f5f5';
  ctx.font = '600 28px Arial';
  ctx.fillText(`Mesa: ${input.tableName}`, 80, 160);

  if (typeof input.total === 'number') {
    ctx.fillText(`Total: ${money(input.total)}`, 80, 206);
  }

  ctx.fillStyle = '#ffbc0d';
  ctx.fillRect(80, 260, 420, 240);

  ctx.fillStyle = '#111111';
  ctx.font = '700 30px Arial';
  ctx.fillText('PIN de pago', 120, 320);
  ctx.font = '900 120px Arial';
  ctx.fillText(input.pin4, 120, 432);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px Arial';
  ctx.fillText('Código de rescate', 80, 578);
  ctx.font = '600 24px monospace';
  ctx.fillText(input.rescueToken, 80, 624);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(760, 230, 300, 300);
  ctx.drawImage(qrImage, 770, 240, 280, 280);
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '600 24px Arial';
  ctx.fillText('Escanéalo o enséñalo en barra', 715, 580);

  const link = document.createElement('a');
  link.download = `codigo-pago-${input.pin4}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function ConfirmationScreen({
  orderCode,
  customerName,
  contextLabel,
  totals,
  estimatedReadyAt,
  paymentMode,
  paymentStatus,
  lastSyncStatus,
  pin4,
  rescueToken,
  expiresAt,
  onNewOrder,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

  const showCashierCode =
    paymentMode === 'cashier' &&
    paymentStatus === 'unpaid' &&
    lastSyncStatus === 'not_sent' &&
    Boolean(pin4) &&
    Boolean(rescueToken);

  const isOnlineUnavailable =
    paymentMode === 'online' &&
    paymentStatus === 'unpaid' &&
    lastSyncStatus === 'not_sent';

  React.useEffect(() => {
    let active = true;

    async function run() {
      if (!showCashierCode || !rescueToken) {
        setQrDataUrl(null);
        return;
      }

      try {
        const dataUrl = await buildQrDataUrl(rescueToken, 260);
        if (active) {
          setQrDataUrl(dataUrl);
        }
      } catch {
        if (active) {
          setQrDataUrl(null);
        }
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [rescueToken, showCashierCode]);

  return (
    <div className="fullscreen-center confirmation">
      <div className="confirm-checkmark">
        <CheckIcon size={48} />
      </div>

      {customerName ? (
        <>
          <h1 className="confirm-title">Gracias, {customerName}</h1>
          <p className="confirm-subtitle">Hemos guardado tu sesión de pedido</p>
        </>
      ) : (
        <p className="confirm-subtitle">Hemos guardado tu sesión de pedido</p>
      )}

      <div className="confirm-code">{orderCode}</div>
      <p className="confirm-mode">{contextLabel}</p>

      {totals?.total != null ? (
        <div className="confirm-totals">
          <div className="confirm-totals-row">
            <span>Total</span>
            <span>{money(totals.total)}</span>
          </div>
          {totals.discountTotal != null && totals.discountTotal > 0 ? (
            <div className="confirm-totals-row confirm-totals-discount">
              <span>Descuento</span>
              <span>-{money(totals.discountTotal)}</span>
            </div>
          ) : null}
          {totals.tax != null && totals.tax > 0 ? (
            <div className="confirm-totals-row confirm-totals-tax">
              <span>Impuestos</span>
              <span>{money(totals.tax)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {showCashierCode ? (
        <div className="confirm-rescue-card">
          <p className="confirm-rescue-kicker">Pendiente de pago</p>
          <div className="confirm-rescue-pin">{pin4}</div>
          <p className="confirm-rescue-code">{rescueToken}</p>
          {qrDataUrl ? (
            <div className="confirm-rescue-qr-wrap">
              <img className="confirm-rescue-qr" src={qrDataUrl} alt="QR de rescate del pedido" />
            </div>
          ) : null}
          <p className="confirm-hint">Pago en efectivo: solo en barra.</p>
          <p className="confirm-hint">Tu pedido aún no está enviado a cocina. Se activará al confirmar el pago en barra, orders o kiosko.</p>
          {expiresAt ? (
            <p className="confirm-hint">
              Válido hasta{' '}
              {new Date(expiresAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
          ) : null}
          <button
            className="btn-primary confirm-secondary-btn"
            onClick={() =>
              pin4 && rescueToken
                ? void downloadCashierCodePng({
                    pin4,
                    rescueToken,
                    tableName: contextLabel,
                    total: totals?.total,
                  })
                : undefined
            }
          >
            Descargar código
          </button>
        </div>
      ) : null}

      {isOnlineUnavailable ? (
        <>
          <p className="confirm-hint">Pago online todavía no disponible.</p>
          <p className="confirm-hint">La sesión está creada, pero no se ha cobrado ni enviado a cocina.</p>
        </>
      ) : null}

      {!showCashierCode && !isOnlineUnavailable && estimatedReadyAt ? (
        <p className="confirm-hint">
          Estimado:{' '}
          {new Date(estimatedReadyAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        </p>
      ) : null}

      <button className="btn-primary confirm-btn" onClick={onNewOrder}>
        Nuevo pedido
      </button>
    </div>
  );
}
