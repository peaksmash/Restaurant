import React from 'react';

export type KeyboardLayout = 'text' | 'numeric' | 'email';

interface Props {
  layout: KeyboardLayout;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

const TEXT_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
] as const;

const EMAIL_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '@'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '-', '_'],
] as const;

const NUMERIC_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['+', '0'],
] as const;

export function VirtualKeyboard({ layout, value, onChange, onClose }: Props) {
  function tap(char: string) { onChange(value + char); }
  function backspace() { onChange(value.slice(0, -1)); }
  function clear() { onChange(''); }

  const actionRow = (
    <div className="vkbd-row">
      {layout === 'text' && (
        <button className="vkbd-key vkbd-key--space" onMouseDown={(e) => { e.preventDefault(); tap(' '); }}>
          Espacio
        </button>
      )}
      <button className="vkbd-key vkbd-key--secondary" onMouseDown={(e) => { e.preventDefault(); clear(); }}>
        Limpiar
      </button>
      <button className="vkbd-key vkbd-key--secondary" onMouseDown={(e) => { e.preventDefault(); backspace(); }}>
        Borrar
      </button>
      <button className="vkbd-key vkbd-key--confirm" onMouseDown={(e) => { e.preventDefault(); onClose(); }}>
        Listo
      </button>
    </div>
  );

  if (layout === 'numeric') {
    return (
      <div className="vkbd" onMouseDown={(e) => e.preventDefault()}>
        <div className="vkbd-numeric">
          {NUMERIC_ROWS.map((row, ri) => (
            <div key={ri} className="vkbd-row">
              {row.map((k) => (
                <button
                  key={k}
                  className="vkbd-key vkbd-key--num"
                  onMouseDown={(e) => { e.preventDefault(); tap(k); }}
                >
                  {k}
                </button>
              ))}
            </div>
          ))}
          <div className="vkbd-row">
            <button className="vkbd-key vkbd-key--secondary" onMouseDown={(e) => { e.preventDefault(); clear(); }}>
              Limpiar
            </button>
            <button className="vkbd-key vkbd-key--secondary" onMouseDown={(e) => { e.preventDefault(); backspace(); }}>
              Borrar
            </button>
            <button className="vkbd-key vkbd-key--confirm" onMouseDown={(e) => { e.preventDefault(); onClose(); }}>
              Listo
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rows = layout === 'email' ? EMAIL_ROWS : TEXT_ROWS;

  return (
    <div className="vkbd" onMouseDown={(e) => e.preventDefault()}>
      {rows.map((row, ri) => (
        <div key={ri} className="vkbd-row">
          {row.map((k) => (
            <button
              key={k}
              className="vkbd-key"
              onMouseDown={(e) => { e.preventDefault(); tap(k); }}
            >
              {k}
            </button>
          ))}
        </div>
      ))}
      {actionRow}
    </div>
  );
}
