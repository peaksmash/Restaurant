import { useEffect, useRef } from 'react';
import type { OrdersDataSourceMode, OrdersSessionRecord } from '../types';

function playTone() {
  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return false;
  }

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  gainNode.gain.setValueAtTime(0.001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.38);
  void context.close().catch(() => undefined);
  return true;
}

export function useNewOrderSound(
  orders: OrdersSessionRecord[],
  mode: OrdersDataSourceMode,
  onMarkPlayed: (ticketId: string) => Promise<unknown>,
) {
  const playedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (mode !== 'real') {
      return;
    }

    const next = orders.find(
      (order) =>
        order.recordType === 'operational_ticket' &&
        order.ticketId &&
        order.soundPolicy === 'sound' &&
        !order.soundPlayedAt &&
        !playedRef.current.has(order.ticketId),
    );

    if (!next?.ticketId) {
      return;
    }

    playedRef.current.add(next.ticketId);
    playTone();
    void onMarkPlayed(next.ticketId);
  }, [mode, onMarkPlayed, orders]);
}
