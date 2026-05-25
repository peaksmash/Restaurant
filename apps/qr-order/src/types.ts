import type { CustomerInfo, OrderSession, TableResolveResponse } from '@kiosk/types';
import type { QrCartItem, QrPaymentMode } from './api';

export type VisualTheme = 'principal' | 'moderno' | 'simple' | 'morado';

export interface QrCartState {
  cart: QrCartItem[];
  customer: CustomerInfo;
  generalNotes: string;
  paymentMode: QrPaymentMode;
}

export type QrResolvedTable = TableResolveResponse;

export type QrOrderConfirmation = OrderSession & {
  tableName: string;
};
