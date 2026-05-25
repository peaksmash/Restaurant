import React, { useEffect, useState } from 'react';
import type { OrderSession, PaymentJob } from '@kiosk/types';
import { CashIcon, ContactlessIcon, CreditCardIcon } from '../Icons';

interface Props {
  session: OrderSession;
  job: PaymentJob | null;
  polling: boolean;
  errorMessage?: string;
  onCancel: () => void;
}

function getTitle(job: PaymentJob | null) {
  if (!job) return 'Preparando cobro';
  if (job.status === 'queued') return 'Esperando turno de cobro';
  if (job.status === 'running') return 'Procesando cobro';
  if (job.status === 'completed') return 'Pago efectuado';
  if (job.status === 'cancelled') return 'Cobro cancelado';
  return 'Incidencia en el cobro';
}

function getCopy(job: PaymentJob | null) {
  if (!job) return 'Estamos preparando el dispositivo de pago del local.';
  if (job.status === 'queued') {
    return 'Hay otro cobro en curso. Tu pedido entrara automaticamente cuando el dispositivo quede libre.';
  }
  if (job.status === 'running') {
    return 'El dispositivo del local esta procesando este cobro ahora mismo.';
  }
  if (job.status === 'completed') {
    return 'Pago completado. Estamos actualizando tu pedido.';
  }
  if (job.status === 'cancelled') {
    return 'El cobro fue cancelado.';
  }
  return job.errorMessage || 'No se pudo completar el cobro.';
}

function getHumanStatus(job: PaymentJob | null) {
  if (!job) return 'Preparando';
  if (job.status === 'queued') return 'En espera';
  if (job.status === 'running') return 'En curso';
  if (job.status === 'completed') return 'Completado';
  if (job.status === 'cancelled') return 'Cancelado';
  return 'Error';
}

function getVisibleOrderCode(session: OrderSession, job: PaymentJob | null) {
  if (job?.responsePayloadJson) {
    try {
      const parsed = JSON.parse(job.responsePayloadJson) as { lastCode?: string | null };
      if (typeof parsed.lastCode === 'string' && parsed.lastCode.trim()) {
        return parsed.lastCode.trim();
      }
    } catch {
      // noop
    }
  }

  if (!session.externalId.startsWith('kiosk-')) {
    return session.externalId;
  }

  return null;
}

export function PaymentJobScreen({ session, job, polling, errorMessage, onCancel }: Props) {
  const providerName = job?.provider === 'cashdro' ? 'CashDro' : 'ArtemisPay';
  const visibleOrderCode = getVisibleOrderCode(session, job);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (job?.status !== 'queued') return;
    const start = job.createdAt ? new Date(job.createdAt).getTime() : Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [job?.status, job?.createdAt]);

  return (
    <div className="recovery-screen payment-job-screen">
      <header className="customer-header">
        <button type="button" className="detail-back" onClick={onCancel} aria-label="Volver">
          Volver
        </button>
        <div className="customer-title">Cobro presencial</div>
      </header>

      <div className="recovery-body payment-job-body">
        <div className="recovery-card payment-job-card">
          {job?.status === 'queued' ? (
            <div className="payment-job-queued">
              <span className="payment-job-queued-icon">⏱</span>
              <h1 className="cashdro-title payment-job-title">Datáfono en uso</h1>
              <p className="cashdro-copy payment-job-copy">
                Otro cliente está pagando, espera un momento...
              </p>
              <p className="payment-job-queued-counter">Esperando {elapsed} segundos</p>
              <div className="spinner" />
            </div>
          ) : (
            <>
              <div className="payment-job-hero">
                <span className="payment-job-icon">
                  {job?.provider === 'cashdro' ? <CashIcon size={38} /> : <ContactlessIcon size={38} />}
                </span>
                <div className="payment-job-hero-copy">
                  <span className="payment-job-kicker">Estado del cobro</span>
                  <h1 className="cashdro-title payment-job-title">{getTitle(job)}</h1>
                  <p className="cashdro-copy payment-job-copy">{getCopy(job)}</p>
                </div>
              </div>

              <div className="payment-job-order-card">
                <span className="recovery-label">Pedido</span>
                {visibleOrderCode ? (
                  <strong className="payment-job-order-code">{visibleOrderCode}</strong>
                ) : (
                  <>
                    <strong className="payment-job-order-code payment-job-order-code--pending">Asignando codigo</strong>
                    <p className="payment-job-order-note">El numero del pedido aparecera al confirmar el pago.</p>
                  </>
                )}
              </div>
            </>
          )}

          <div className="payment-job-provider-row">
            <div className="payment-job-provider">
              <span className="payment-job-provider-icon">
                {job?.provider === 'cashdro' ? <CashIcon size={20} /> : <CreditCardIcon size={20} />}
              </span>
              <span>{providerName}</span>
            </div>
            <span className={`payment-job-status-pill payment-job-status-pill--${job?.status ?? 'preparing'}`}>
              {getHumanStatus(job)}
            </span>
          </div>

          {errorMessage ? <p className="recovery-error">{errorMessage}</p> : null}

          <div className="cashdro-footer payment-job-footer">
            <span className={`cashdro-status ${polling ? 'is-live' : ''}`}>
              {polling ? 'Actualizando estado...' : 'Esperando actualizacion'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
