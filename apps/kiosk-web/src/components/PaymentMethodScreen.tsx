import React from 'react';
import { CashIcon, CreditCardIcon } from '../Icons';

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

interface Props {
  cartTotal: number;
  paymentsSimulated: boolean;
  artemisEnabled: boolean;
  cashdroEnabled: boolean;
  sending: boolean;
  errorMessage?: string;
  onBack: () => void;
  onSelectArtemis: () => void;
  onSelectCashdro: () => void;
}

export function PaymentMethodScreen({
  cartTotal,
  paymentsSimulated,
  artemisEnabled,
  cashdroEnabled,
  sending,
  errorMessage,
  onBack,
  onSelectArtemis,
  onSelectCashdro,
}: Props) {
  return (
    <div className="recovery-screen">
      <header className="customer-header">
        <button type="button" className="detail-back" onClick={onBack} aria-label="Volver">
          Volver
        </button>
        <div className="customer-title">Como quieres pagar</div>
      </header>

      <div className="recovery-body">
        <div className="recovery-card payment-method-card">
          <div className="payment-method-hero">
            <span className="payment-method-kicker">Pago del pedido</span>
            <h1 className="recovery-title payment-method-title">Elige tu forma de pago</h1>
            <p className="recovery-copy payment-method-copy">
              Selecciona el metodo que prefieras para terminar el pedido de forma segura.
            </p>
          </div>

          <div className="recovery-total-row payment-method-total">
            <span>Total</span>
            <strong>{money(cartTotal)}</strong>
          </div>

          {paymentsSimulated ? (
            <p className="recovery-copy payment-method-banner">Modo demo activo. No se cobrara dinero real.</p>
          ) : null}

          {errorMessage ? <p className="recovery-error">{errorMessage}</p> : null}

          {!artemisEnabled && !cashdroEnabled && !paymentsSimulated ? (
            <p className="recovery-copy">
              No hay dispositivos de pago configurados. Contacta con el administrador.
            </p>
          ) : null}

          <div className="payment-method-grid">
            {artemisEnabled || paymentsSimulated ? (
              <button
                type="button"
                className="payment-choice-card payment-choice-card--card"
                disabled={sending}
                onClick={onSelectArtemis}
              >
                <span className="payment-choice-icon">
                  <CreditCardIcon size={52} />
                </span>
                <span className="payment-choice-body">
                  <strong>Tarjeta</strong>
                  <span>Cobro con datáfono del local.</span>
                </span>
                <span className="payment-choice-action">
                  {sending ? 'Conectando...' : 'Continuar'}
                </span>
              </button>
            ) : null}

            {cashdroEnabled || paymentsSimulated ? (
              <button
                type="button"
                className="payment-choice-card payment-choice-card--cash"
                disabled={sending}
                onClick={onSelectCashdro}
              >
                <span className="payment-choice-icon">
                  <CashIcon size={52} />
                </span>
                <span className="payment-choice-body">
                  <strong>Efectivo</strong>
                  <span>Introduce el dinero en el dispositivo automatico.</span>
                </span>
                <span className="payment-choice-action">
                  {sending ? 'Conectando...' : 'Continuar'}
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
