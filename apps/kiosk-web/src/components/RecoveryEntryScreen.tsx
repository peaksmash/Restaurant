import React from 'react';

interface Props {
  value: string;
  searching: boolean;
  errorMessage?: string;
  onChangeValue: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

export function RecoveryEntryScreen({
  value,
  searching,
  errorMessage,
  onChangeValue,
  onSubmit,
  onBack,
}: Props) {
  function append(next: string) {
    onChangeValue(`${value}${next}`.slice(0, 64));
  }

  return (
    <div className="recovery-screen">
      <header className="customer-header">
        <button type="button" className="detail-back" onClick={onBack} aria-label="Volver">
          Volver
        </button>
        <div className="customer-title">Paga aqui tu pedido</div>
      </header>

      <div className="recovery-body">
        <div className="recovery-card">
          <h1 className="recovery-title">Introduce tu codigo</h1>
          <p className="recovery-copy">
            Puedes escribir tu PIN4 o el codigo de rescate completo que recibiste al hacer tu pedido.
          </p>

          <div className="recovery-display">{value || '--'}</div>
          {errorMessage ? <p className="recovery-error">{errorMessage}</p> : null}

          <div className="recovery-keypad">
            {KEYS.map((key) => {
              if (key === 'clear') {
                return (
                  <button
                    key={key}
                    type="button"
                    className="recovery-key secondary"
                    onClick={() => onChangeValue('')}
                  >
                    Limpiar
                  </button>
                );
              }

              if (key === 'back') {
                return (
                  <button
                    key={key}
                    type="button"
                    className="recovery-key secondary"
                    onClick={() => onChangeValue(value.slice(0, -1))}
                  >
                    Borrar
                  </button>
                );
              }

              return (
                <button key={key} type="button" className="recovery-key" onClick={() => append(key)}>
                  {key}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="btn-primary recovery-submit-btn"
            disabled={searching || value.trim().length === 0}
            onClick={onSubmit}
          >
            {searching ? 'Buscando...' : 'Recuperar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
