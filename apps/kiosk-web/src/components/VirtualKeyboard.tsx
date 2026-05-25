import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type KeyboardLayout = 'text' | 'numeric' | 'email';

interface Props {
  layout: KeyboardLayout;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onNext?: () => void; // kept for API compatibility, not used internally
  inputRef?: React.RefObject<Element | null>;
}

const QWERTY_ROWS = [
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
] as const;

function BackspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22" aria-hidden="true">
      <path d="M21 6H8l-7 6 7 6h13a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" />
      <line x1="18" y1="9" x2="12" y2="15" />
      <line x1="12" y1="9" x2="18" y2="15" />
    </svg>
  );
}

interface KbdPos {
  top?: number;
  bottom?: number;
  borderRadius?: string;
}

export function VirtualKeyboard({ layout, value, onChange, onClose, inputRef }: Props) {
  const [userCaps, setUserCaps] = useState(false);
  const [kbdPos, setKbdPos] = useState<KbdPos>({ bottom: 0, borderRadius: '24px' });

  // Auto-caps: first character of a text field is always uppercase
  const autoCaps = value.length === 0 && layout === 'text';
  const caps = autoCaps || userCaps;

  // Position keyboard relative to the active input element
  useLayoutEffect(() => {
    const el = inputRef?.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const wh = window.innerHeight;
    const kbdHeight = layout === 'numeric' ? 380 : 310;
    const spaceBelow = wh - rect.bottom - 16;
    const spaceAbove = rect.top - 16;

    if (spaceBelow >= kbdHeight || spaceBelow >= spaceAbove) {
      setKbdPos({ top: rect.bottom + 8, borderRadius: '24px' });
    } else {
      setKbdPos({ bottom: wh - rect.top + 8, borderRadius: '24px' });
    }
  }, [inputRef, layout]);

  function tap(char: string) {
    const next = caps ? char.toUpperCase() : char.toLowerCase();
    onChange(value + next);
    if (userCaps) setUserCaps(false); // single-shift: reset after typing one key
  }

  function backspace() {
    onChange(value.slice(0, -1));
  }

  // Static container styles live in .vkeyboard-container CSS; only dynamic positioning here
  const containerStyle: React.CSSProperties = { ...kbdPos };

  const overlay = (
    <div
      className="vkeyboard-overlay"
      onMouseDown={(e) => { e.preventDefault(); onClose(); }}
      onTouchEnd={(e) => { e.preventDefault(); onClose(); }}
    />
  );

  // ── Numeric keyboard ──────────────────────────────────────────────────────────
  if (layout === 'numeric') {
    return createPortal(
      <>
        {overlay}
        <div
          className="vkeyboard-container"
          style={containerStyle}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div>
            {NUMERIC_ROWS.map((row, ri) => (
              <div key={ri} className="vkeyboard-row">
                {row.map((k) => (
                  <button
                    key={k}
                    className="vkey vkey-num"
                    onMouseDown={(e) => { e.preventDefault(); tap(k); }}
                    type="button"
                  >
                    {k}
                  </button>
                ))}
              </div>
            ))}
            {/* Last row: backspace · 0 · Listo */}
            <div className="vkeyboard-row">
              <button
                className="vkey vkey-num vkey-delete"
                onMouseDown={(e) => { e.preventDefault(); backspace(); }}
                type="button"
                aria-label="Borrar"
              >
                <BackspaceIcon />
              </button>
              <button
                className="vkey vkey-num"
                onMouseDown={(e) => { e.preventDefault(); tap('0'); }}
                type="button"
              >
                0
              </button>
              <button
                className="vkey vkey-num vkey-num-done"
                onMouseDown={(e) => { e.preventDefault(); onClose(); }}
                type="button"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ── Text / Email keyboard ─────────────────────────────────────────────────────
  const rows = layout === 'email' ? EMAIL_ROWS : QWERTY_ROWS;

  return createPortal(
    <>
      {overlay}
      <div
        className="vkeyboard-container"
        style={containerStyle}
        onMouseDown={(e) => e.preventDefault()}
      >
        {rows.map((row, ri) => (
          <div key={ri} className="vkeyboard-row">
            {ri === 2 && (
              <button
                className={`vkey vkey-shift${userCaps ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); setUserCaps((c) => !c); }}
                type="button"
                aria-label="Mayúsculas"
              >
                ⇧
              </button>
            )}
            {row.map((k) => (
              <button
                key={k}
                className="vkey"
                onMouseDown={(e) => { e.preventDefault(); tap(k); }}
                type="button"
              >
                {caps ? k.toUpperCase() : k.toLowerCase()}
              </button>
            ))}
            {ri === 2 && (
              <button
                className="vkey vkey-delete"
                onMouseDown={(e) => { e.preventDefault(); backspace(); }}
                type="button"
                aria-label="Borrar"
              >
                <BackspaceIcon />
              </button>
            )}
          </div>
        ))}

        {/* Bottom row: space / done */}
        <div className="vkeyboard-row">
          {layout === 'text' && (
            <button
              className="vkey vkey-space"
              onMouseDown={(e) => { e.preventDefault(); tap(' '); }}
              type="button"
            >
              espacio
            </button>
          )}
          {layout === 'email' && (
            <>
              <button
                className="vkey"
                onMouseDown={(e) => { e.preventDefault(); onChange(value + '.'); }}
                type="button"
              >
                .
              </button>
              <button
                className="vkey"
                onMouseDown={(e) => { e.preventDefault(); onChange(value + '@'); }}
                type="button"
              >
                @
              </button>
            </>
          )}
          <button
            className="vkey vkey-done"
            onMouseDown={(e) => { e.preventDefault(); onClose(); }}
            type="button"
          >
            Listo
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
