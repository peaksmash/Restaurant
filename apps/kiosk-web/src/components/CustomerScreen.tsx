import React, { useEffect, useRef, useState } from 'react';
import type { Customer, KioskConfig } from '../api';
import { ArrowLeftIcon } from '../Icons';
import { VirtualKeyboard, type KeyboardLayout } from './VirtualKeyboard';

interface Props {
  config: KioskConfig;
  sending: boolean;
  onConfirm: (customer: Customer, notes: string) => void;
  onBack: () => void;
}

type ActiveField = 'name' | 'phone' | 'email' | 'notes' | null;

const MAX_NOTES = 200;

export function CustomerScreen({ config, sending, onConfirm, onBack }: Props) {
  const fields = config.kiosk.customerFields;
  const generalNotesEnabled = config.kiosk.notes.generalEnabled;

  const nameEnabled = fields.name.enabled;
  const nameRequired = fields.name.required;
  const phoneEnabled = fields.phoneNumber.enabled;
  const phoneRequired = fields.phoneNumber.required;
  const emailEnabled = fields.email.enabled;
  const emailRequired = fields.email.required;

  const hasAnyField = nameEnabled || phoneEnabled || emailEnabled || generalNotesEnabled;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState<ActiveField>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!hasAnyField) onConfirm({}, '');
  }, [hasAnyField]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasAnyField) return null;

  // ── Keyboard helpers ────────────────────────────────────────────────────────

  function getActiveRef(): React.RefObject<Element | null> | undefined {
    switch (activeField) {
      case 'name':  return nameRef as React.RefObject<Element | null>;
      case 'phone': return phoneRef as React.RefObject<Element | null>;
      case 'email': return emailRef as React.RefObject<Element | null>;
      case 'notes': return notesRef as React.RefObject<Element | null>;
      default: return undefined;
    }
  }

  function keyboardLayout(): KeyboardLayout {
    if (activeField === 'phone') return 'numeric';
    if (activeField === 'email') return 'email';
    return 'text';
  }

  function keyboardValue(): string {
    switch (activeField) {
      case 'name':  return name;
      case 'phone': return phone;
      case 'email': return email;
      case 'notes': return notes;
      default:      return '';
    }
  }

  function handleKeyboardChange(v: string) {
    switch (activeField) {
      case 'name':  setName(v);  break;
      case 'phone': setPhone(v); break;
      case 'email': setEmail(v); break;
      case 'notes': if (v.length <= MAX_NOTES) setNotes(v); break;
    }
  }

  // Advance to next field on "Listo", or close keyboard on last field
  function handleDone() {
    if (activeField === 'name' && phoneEnabled) { setActiveField('phone'); return; }
    if (activeField === 'name' && emailEnabled)  { setActiveField('email'); return; }
    if (activeField === 'name' && generalNotesEnabled) { setActiveField('notes'); return; }
    if (activeField === 'phone' && emailEnabled)  { setActiveField('email'); return; }
    if (activeField === 'phone' && generalNotesEnabled) { setActiveField('notes'); return; }
    if (activeField === 'email' && generalNotesEnabled) { setActiveField('notes'); return; }
    setActiveField(null);
  }

  function openKeyboard(field: ActiveField) {
    if (!sending) setActiveField(field);
  }

  // ── Validation / submit ─────────────────────────────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (nameEnabled  && nameRequired  && !name.trim())  errs.name  = 'El nombre es obligatorio';
    if (phoneEnabled && phoneRequired && !phone.trim())  errs.phone = 'El teléfono es obligatorio';
    if (emailEnabled && emailRequired && !email.trim())  errs.email = 'El email es obligatorio';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    setActiveField(null);
    if (!validate()) return;
    const customer: Customer = {};
    if (nameEnabled  && name.trim())  customer.name        = name.trim();
    if (phoneEnabled && phone.trim()) customer.phoneNumber = phone.trim();
    if (emailEnabled && email.trim()) customer.email       = email.trim();
    onConfirm(customer, generalNotesEnabled ? notes.trim() : '');
  }

  const kbdOpen = activeField !== null && !sending;

  return (
    <div className="customer-screen">
      <header className="customer-header">
        <button className="detail-back" onClick={onBack} aria-label="Volver" disabled={sending}>
          <ArrowLeftIcon size={24} />
        </button>
      </header>

      <div className="customer-body">
        <div className="customer-emoji" aria-hidden="true">👋</div>
        <h1 className="customer-title">¡Casi listo!</h1>
        <p className="customer-subtitle">¿Cómo te llamamos?</p>

        {nameEnabled && (
          <div className="customer-field">
            <input
              ref={nameRef}
              className={`customer-input${activeField === 'name' ? ' active' : ''}${errors.name ? ' error' : ''}`}
              type="text"
              inputMode="none"
              readOnly
              value={name}
              placeholder={`Tu nombre${nameRequired ? '' : ' (opcional)'}`}
              onClick={() => openKeyboard('name')}
            />
            {errors.name && <p className="customer-field-error">{errors.name}</p>}
          </div>
        )}

        {phoneEnabled && (
          <div className="customer-field">
            <input
              ref={phoneRef}
              className={`customer-input${activeField === 'phone' ? ' active' : ''}${errors.phone ? ' error' : ''}`}
              type="text"
              inputMode="none"
              readOnly
              value={phone}
              placeholder={`Teléfono${phoneRequired ? '' : ' (opcional)'}`}
              onClick={() => openKeyboard('phone')}
            />
            {!phoneRequired && (
              <p className="customer-hint">Solo si hay algún problema con tu pedido</p>
            )}
            {errors.phone && <p className="customer-field-error">{errors.phone}</p>}
          </div>
        )}

        {emailEnabled && (
          <div className="customer-field">
            <input
              ref={emailRef}
              className={`customer-input${activeField === 'email' ? ' active' : ''}${errors.email ? ' error' : ''}`}
              type="text"
              inputMode="none"
              readOnly
              value={email}
              placeholder={`Email${emailRequired ? '' : ' (opcional)'}`}
              onClick={() => openKeyboard('email')}
            />
            {errors.email && <p className="customer-field-error">{errors.email}</p>}
          </div>
        )}

        {generalNotesEnabled && (
          <div className="customer-field">
            <textarea
              ref={notesRef}
              className={`customer-input${activeField === 'notes' ? ' active' : ''}`}
              inputMode="none"
              readOnly
              rows={3}
              value={notes}
              placeholder="Alergias, instrucciones especiales…"
              onClick={() => openKeyboard('notes')}
              style={{ resize: 'none' }}
            />
            <p className="customer-hint">{notes.length}/{MAX_NOTES} caracteres</p>
          </div>
        )}

        <button
          className="customer-btn"
          onClick={handleSubmit}
          disabled={sending}
        >
          {sending ? 'Preparando pago…' : 'Continuar al pago →'}
        </button>
      </div>

      {kbdOpen && (
        <VirtualKeyboard
          layout={keyboardLayout()}
          value={keyboardValue()}
          onChange={handleKeyboardChange}
          onClose={() => setActiveField(null)}
          onNext={handleDone}
          inputRef={getActiveRef()}
        />
      )}
    </div>
  );
}
