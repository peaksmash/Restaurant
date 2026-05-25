import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LastminuteItem, SuggestedProduct } from '../suggestions';

interface LastMinuteScreenProps {
  items: LastminuteItem[];
  timeSlot: string;
  onAdd: (ruleId: string, productId: string) => void;
  onContinue: () => void;
  autoCloseSecs?: number;
}

function formatPrice(price: number) {
  return `${(price / 100).toFixed(2)} €`;
}

function LastMinuteImage({ product }: { product: SuggestedProduct }) {
  const [failed, setFailed] = useState(false);

  if (product.imageUrl && !failed) {
    return (
      <img
        className="lastminute-card-img"
        src={product.imageUrl}
        alt={product.name}
        onError={() => setFailed(true)}
      />
    );
  }

  return <div className="lastminute-card-img lastminute-card-img-placeholder" aria-hidden="true" />;
}

function getTitle(timeSlot: string) {
  switch (timeSlot) {
    case 'breakfast':
      return 'Para el camino ☕';
    case 'lunch':
      return 'Remata el menú 🥤';
    case 'snack':
      return 'Un capricho más 🍰';
    case 'dinner':
      return 'Para acabar bien 🍮';
    default:
      return '¿Algo más? 🛍️';
  }
}

export function LastMinuteScreen({
  items,
  timeSlot,
  onAdd,
  onContinue,
  autoCloseSecs = 8,
}: LastMinuteScreenProps) {
  const safeDuration = Math.max(autoCloseSecs, 1);
  const [secondsLeft, setSecondsLeft] = useState(safeDuration);
  const continuedRef = useRef(false);

  useEffect(() => {
    continuedRef.current = false;
    setSecondsLeft(safeDuration);

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(safeDuration - elapsed, 0);
      setSecondsLeft(remaining);

      if (remaining === 0 && !continuedRef.current) {
        continuedRef.current = true;
        window.clearInterval(intervalId);
        onContinue();
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [onContinue, safeDuration]);

  const title = useMemo(() => getTitle(timeSlot), [timeSlot]);

  function handleContinue() {
    if (continuedRef.current) {
      return;
    }
    continuedRef.current = true;
    onContinue();
  }

  return (
    <section className="lastminute-screen">
      <div className="lastminute-countdown">({secondsLeft}s)</div>

      <h1 className="lastminute-title">{title}</h1>
      <p className="lastminute-sub">Antes de pagar...</p>

      <div className="lastminute-grid">
        {items.slice(0, 3).map((item) => (
          <div
            key={item.ruleId}
            className="lastminute-card"
            onClick={() => onAdd(item.ruleId, item.product.id)}
          >
            <LastMinuteImage product={item.product} />
            <h2 className="lastminute-card-name">{item.product.name}</h2>
            <p className="lastminute-card-price">{formatPrice(item.product.price)}</p>
            <button
              className="lastminute-card-btn"
              onClick={(event) => {
                event.stopPropagation();
                onAdd(item.ruleId, item.product.id);
              }}
            >
              Añadir
            </button>
          </div>
        ))}
      </div>

      <button className="lastminute-skip" onClick={handleContinue}>
        Continuar sin añadir →
      </button>
    </section>
  );
}
