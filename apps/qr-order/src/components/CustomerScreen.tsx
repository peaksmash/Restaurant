import React, { useState } from 'react';
import type { Customer, KioskConfig, QrPaymentMode } from '../api';
import { ArrowLeftIcon } from '../Icons';
import { VirtualKeyboard, type KeyboardLayout } from './VirtualKeyboard';

interface Props {
  config: KioskConfig;
  sending: boolean;
  initialCustomer?: Customer;
  initialNotes?: string;
  initialPaymentMode?: QrPaymentMode;
  checkoutEnabled: boolean;
  checkoutDemoMode: boolean;
  checkoutDisabledMessage: string;
  onConfirm: (customer: Customer, notes: string, paymentMode: QrPaymentMode) => void;
  onBack: () => void;
}

type ActiveField = 'name' | 'phone' | 'email' | 'notes' | null;

const MAX_NOTES = 200;
const KEYBOARD_BODY_PAD = 320;

export function CustomerScreen({
  config,
  sending,
  initialCustomer,
  initialNotes = '',
  initialPaymentMode = 'online',
  checkoutEnabled,
  checkoutDemoMode,
  checkoutDisabledMessage,
  onConfirm,
  onBack,
}: Props) {
  const fields = config.kiosk.customerFields;
  const generalNotesEnabled = config.kiosk.notes.generalEnabled;

  const nameEnabled = fields.name.enabled;
  const nameRequired = fields.name.required;
  const phoneEnabled = fields.phoneNumber.enabled;
  const phoneRequired = fields.phoneNumber.required;
  const emailEnabled = fields.email.enabled;
  const emailRequired = fields.email.required;

  const [name, setName] = useState(initialCustomer?.name ?? '');
  const [phone, setPhone] = useState(initialCustomer?.phoneNumber ?? '');
  const [email, setEmail] = useState(initialCustomer?.email ?? '');
  const [notes, setNotes] = useState(initialNotes);
  const [paymentMode, setPaymentMode] = useState<QrPaymentMode>(initialPaymentMode);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState<ActiveField>(null);

  function keyboardLayout(): KeyboardLayout {
    if (activeField === 'phone') return 'numeric';
    if (activeField === 'email') return 'email';
    return 'text';
  }

  function keyboardValue(): string {
    switch (activeField) {
      case 'name':
        return name;
      case 'phone':
        return phone;
      case 'email':
        return email;
      case 'notes':
        return notes;
      default:
        return '';
    }
  }

  function handleKeyboardChange(value: string) {
    switch (activeField) {
      case 'name':
        setName(value);
        break;
      case 'phone':
        setPhone(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'notes':
        if (value.length <= MAX_NOTES) setNotes(value);
        break;
      default:
        break;
    }
  }

  function openKeyboard(field: ActiveField) {
    if (!sending) setActiveField(field);
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (nameEnabled && nameRequired && !name.trim()) nextErrors.name = 'El nombre es obligatorio';
    if (phoneEnabled && phoneRequired && !phone.trim()) nextErrors.phone = 'El teléfono es obligatorio';
    if (emailEnabled && emailRequired && !email.trim()) nextErrors.email = 'El email es obligatorio';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit() {
    setActiveField(null);
    if (!validate()) return;

    const customer: Customer = {};
    if (nameEnabled && name.trim()) customer.name = name.trim();
    if (phoneEnabled && phone.trim()) customer.phoneNumber = phone.trim();
    if (emailEnabled && email.trim()) customer.email = email.trim();
    onConfirm(customer, generalNotesEnabled ? notes.trim() : '', paymentMode);
  }

  const keyboardOpen = activeField !== null && !sending;

  return (
    <div className={`customer-screen${keyboardOpen ? ' customer-screen--kbd' : ''}`}>
      <header className="customer-header">
        <button className="detail-back" onClick={onBack} aria-label="Volver" disabled={sending}>
          <ArrowLeftIcon size={24} />
        </button>
        <h2 className="customer-title">Tus datos</h2>
      </header>

      <div
        className="customer-body"
        style={keyboardOpen ? { paddingBottom: KEYBOARD_BODY_PAD } : undefined}
      >
        {nameEnabled ? (
          <div className="form-field">
            <label className="form-label" htmlFor="cust-name">
              Nombre{nameRequired && <span className="required">*</span>}
            </label>
            <input
              id="cust-name"
              className={`form-input${errors.name ? ' input-error' : ''}${activeField === 'name' ? ' field-active' : ''}`}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onFocus={() => openKeyboard('name')}
              placeholder="Tu nombre"
              disabled={sending}
              autoComplete="off"
            />
            {errors.name ? <p className="field-error">{errors.name}</p> : null}
          </div>
        ) : null}

        {phoneEnabled ? (
          <div className="form-field">
            <label className="form-label" htmlFor="cust-phone">
              Teléfono{phoneRequired && <span className="required">*</span>}
            </label>
            <input
              id="cust-phone"
              className={`form-input${errors.phone ? ' input-error' : ''}${activeField === 'phone' ? ' field-active' : ''}`}
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onFocus={() => openKeyboard('phone')}
              placeholder="600 000 000"
              disabled={sending}
              autoComplete="off"
            />
            {errors.phone ? <p className="field-error">{errors.phone}</p> : null}
          </div>
        ) : null}

        {emailEnabled ? (
          <div className="form-field">
            <label className="form-label" htmlFor="cust-email">
              Email{emailRequired && <span className="required">*</span>}
            </label>
            <input
              id="cust-email"
              className={`form-input${errors.email ? ' input-error' : ''}${activeField === 'email' ? ' field-active' : ''}`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onFocus={() => openKeyboard('email')}
              placeholder="tu@email.com"
              disabled={sending}
              autoComplete="off"
            />
            {errors.email ? <p className="field-error">{errors.email}</p> : null}
          </div>
        ) : null}

        {generalNotesEnabled ? (
          <div className="form-field">
            <label className="form-label" htmlFor="cust-notes">
              Nota general (opcional)
            </label>
            <textarea
              id="cust-notes"
              className={`form-textarea${activeField === 'notes' ? ' field-active' : ''}`}
              rows={3}
              maxLength={MAX_NOTES}
              placeholder="Alergias, instrucciones especiales..."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              onFocus={() => openKeyboard('notes')}
              disabled={sending}
            />
            <p className="char-count">
              {notes.length}
              /
              {MAX_NOTES}
            </p>
          </div>
        ) : null}

        <div className="form-field">
          <label className="form-label">Forma de pago</label>
          <div className="payment-mode-group">
            <button
              className={`payment-mode-btn${paymentMode === 'online' ? ' active' : ''}`}
              onClick={() => setPaymentMode('online')}
              type="button"
            >
              Pago online
            </button>
            <button
              className={`payment-mode-btn${paymentMode === 'cashier' ? ' active' : ''}`}
              onClick={() => setPaymentMode('cashier')}
              type="button"
            >
              Efectivo
            </button>
          </div>
          {paymentMode === 'cashier' ? (
            <p className="cashier-hint">Pago en efectivo: solo en barra. Te daremos un PIN y un código de rescate.</p>
          ) : (
            <p className="cashier-hint">Pago online todavía no disponible. Se guardará una sesión pendiente, sin cobro.</p>
          )}
        </div>

        {checkoutDemoMode ? (
          <p className="cashier-hint">Modo demo de pagos activo. No se llamará a pasarelas reales hasta la validación final.</p>
        ) : null}

        {!checkoutEnabled ? <p className="field-error">{checkoutDisabledMessage}</p> : null}
      </div>

      {!keyboardOpen ? (
        <div className="customer-footer">
          <button
            className="btn-primary customer-submit-btn"
            onClick={handleSubmit}
            disabled={sending || !checkoutEnabled}
          >
            {sending
              ? 'Creando sesión...'
              : checkoutDemoMode
                ? 'Crear pedido (modo demo)'
                : paymentMode === 'cashier'
                  ? 'Generar código de pago'
                  : 'Crear sesión online'}
          </button>
        </div>
      ) : null}

      {keyboardOpen ? (
        <VirtualKeyboard
          layout={keyboardLayout()}
          value={keyboardValue()}
          onChange={handleKeyboardChange}
          onClose={() => setActiveField(null)}
        />
      ) : null}
    </div>
  );
}
