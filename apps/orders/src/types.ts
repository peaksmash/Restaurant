import type { OrderSession, OrderSessionEvent, PrintStatus, SoundPolicy } from '@kiosk/types';

export type OrdersPageDetailMode = 'orders' | 'kitchen' | 'incidents' | 'pending';
export type OrdersDataSourceMode = 'real' | 'demo';
export type OrdersRecordType = 'order_session' | 'last_live' | 'operational_ticket';
export type OrdersBoardView = 'active' | 'kitchen' | 'incidents' | 'history';
export type OrdersHistoryChannelFilter = 'all' | 'kiosk' | 'qr_order' | 'uber' | 'glovo' | 'just_eat' | 'deliveroo' | 'manual';

export interface OrdersSessionRecord extends OrderSession {
  recordType: OrdersRecordType;
  ticketId?: string | null;
  linkedOrderSessionId?: string | null;
  liveTabId?: string | null;
  tableName?: string | null;
  acceptedAt?: string | null;
  readyAt?: string | null;
  sourceLabel?: string | null;
  pickupTypeLabel?: string | null;
  printStatus?: PrintStatus | null;
  soundPolicy?: SoundPolicy | null;
  soundPlayedAt?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  rawSourceHash?: string | null;
  previewSvg?: string | null;
}

export interface OrdersEventTimelineState {
  loading: boolean;
  error: string | null;
  events: OrderSessionEvent[];
}
