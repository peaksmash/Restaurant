import type { AdminPaymentDevice, AdminPaymentJob, AdminTableQrMapping, LocalConfig } from '../api';

export interface LocationGroup {
  id: string;
  label: string;
  devices: AdminPaymentDevice[];
  jobs: AdminPaymentJob[];
}

export interface DevicePresentation {
  device: AdminPaymentDevice | null;
  provider: 'artemis' | 'cashdro';
  title: string;
  subtitle: string;
  setupStatus: string;
  setupTone: 'green' | 'amber' | 'gray';
  availabilityLabel: string;
  availabilityTone: 'green' | 'amber' | 'gray' | 'red';
  queueLabel: string;
  latestFailure: string | null;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

export function resolveExternalAppUrl(envKey: string, devPort: number) {
  const configured = (import.meta.env[envKey] as string | undefined)?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${devPort}`;
  }

  return '';
}

export function getKioskAppUrl() {
  return resolveExternalAppUrl('VITE_KIOSK_URL', 3000);
}

export function getOrdersAppUrl() {
  return resolveExternalAppUrl('VITE_ORDERS_URL', 3004);
}

export function getLocationGroups(
  config: LocalConfig,
  paymentDevices: AdminPaymentDevice[],
  paymentJobs: AdminPaymentJob[]
) {
  const ids = new Set<string>();
  if (config.lastApp.locationId) {
    ids.add(config.lastApp.locationId);
  }
  paymentDevices.forEach((device) => ids.add(device.locationId));
  paymentJobs.forEach((job) => ids.add(job.locationId));

  const ordered = Array.from(ids);
  return ordered.map((id, index): LocationGroup => ({
    id,
    label: getLocationLabel(id, config.lastApp.locationId, index),
    devices: paymentDevices.filter((device) => device.locationId === id),
    jobs: paymentJobs.filter((job) => job.locationId === id),
  }));
}

export function getLocationLabel(locationId: string, currentLocationId: string, index: number) {
  if (locationId === currentLocationId) {
    return 'Local actual';
  }

  return `Local ${index + 1}`;
}

export function getActiveQrCount(mappings: AdminTableQrMapping[]) {
  return mappings.filter((mapping) => mapping.enabled).length;
}

export function getPaymentsHeadline(config: LocalConfig, paymentDevices: AdminPaymentDevice[]) {
  const activeRealDevices = paymentDevices.filter(
    (device) => device.isActive && device.configured && device.mode === 'real'
  );

  if (activeRealDevices.length > 0) {
    return {
      title: 'Pagos reales activos',
      description: 'El sistema puede cobrar con dispositivos reales.',
      tone: 'green' as const,
    };
  }

  if (config.paymentsSimulated) {
    return {
      title: 'Modo demo activado',
      description: 'Este modo es de prueba. No cobra dinero real.',
      tone: 'amber' as const,
    };
  }

  return {
    title: 'Pagos reales pendientes',
    description: 'Todavía no hay cobro real activado.',
    tone: 'gray' as const,
  };
}

export function getGeneralReadiness(
  config: LocalConfig,
  mappings: AdminTableQrMapping[],
  paymentDevices: AdminPaymentDevice[]
) {
  const lastReady =
    config.lastApp.tokenConfigured &&
    Boolean(config.lastApp.organizationId) &&
    Boolean(config.lastApp.locationId) &&
    Boolean(config.lastApp.brandId) &&
    Boolean(config.lastApp.catalogId);
  const qrReady = getActiveQrCount(mappings) > 0;
  const paymentsDefined =
    config.paymentsSimulated ||
    paymentDevices.some((device) => device.isActive && (device.configured || device.mode !== 'real'));

  if (!lastReady) {
    return {
      title: 'Revisar configuración',
      description: 'Falta completar la conexión con Last.',
      tone: 'red' as const,
      checks: { lastReady, qrReady, paymentsDefined },
    };
  }

  if (qrReady && paymentsDefined) {
    return {
      title: config.paymentsSimulated ? 'Sistema listo para probar' : 'Sistema listo para operar',
      description: config.paymentsSimulated
        ? 'Puedes hacer pruebas completas sin cobrar dinero real.'
        : 'La base del sistema está lista para trabajar con pedidos reales.',
      tone: 'green' as const,
      checks: { lastReady, qrReady, paymentsDefined },
    };
  }

  return {
    title: 'Faltan ajustes',
    description: 'Aún quedan pasos por completar antes de usar el sistema con normalidad.',
    tone: 'amber' as const,
    checks: { lastReady, qrReady, paymentsDefined },
  };
}

export function getNextRecommendedStep(
  config: LocalConfig,
  mappings: AdminTableQrMapping[],
  paymentDevices: AdminPaymentDevice[]
) {
  const activeQrCount = getActiveQrCount(mappings);

  if (!config.paymentsSimulated && paymentDevices.length === 0) {
    return 'Activa el modo demo para probar pedidos sin cobrar dinero real.';
  }

  if (activeQrCount === 0) {
    return 'Crea los QR de mesa para empezar a recibir pedidos.';
  }

  if (!config.kiosk.features.printTicket) {
    return 'Configura la impresión o déjala pendiente hasta la siguiente fase.';
  }

  if (!config.paymentsSimulated && paymentDevices.every((device) => device.mode !== 'real')) {
    return 'Configura un dispositivo de pago para cobrar desde kiosko.';
  }

  return 'Haz una prueba completa: QR → pedido → cobro → Last.';
}

export function getDevicePresentation(
  provider: 'artemis' | 'cashdro',
  devices: AdminPaymentDevice[],
  jobs: AdminPaymentJob[]
): DevicePresentation {
  const device =
    devices.find((entry) => entry.provider === provider && entry.isActive) ??
    devices.find((entry) => entry.provider === provider) ??
    null;
  const title = provider === 'artemis' ? 'Tarjeta presencial' : 'Efectivo automático';
  const subtitle =
    provider === 'artemis'
      ? 'Para cobrar con terminal ArtemisPay.'
      : 'Para cobrar con CashDro.';

  if (!device) {
    return {
      device: null,
      provider,
      title,
      subtitle,
      setupStatus: 'No configurado',
      setupTone: 'gray',
      availabilityLabel: 'No disponible',
      availabilityTone: 'gray',
      queueLabel: 'Libre',
      latestFailure: null,
    };
  }

  const deviceJobs = jobs
    .filter((job) => job.deviceId === device.id)
    .sort((a, b) => (b.finishedAt ?? b.createdAt).localeCompare(a.finishedAt ?? a.createdAt));
  const latestFailure = deviceJobs.find((job) => job.status === 'failed')?.errorMessage ?? null;

  let setupStatus = 'Activo';
  let setupTone: DevicePresentation['setupTone'] = 'green';
  if (!device.configured) {
    setupStatus = 'No configurado';
    setupTone = 'gray';
  } else if (device.mode === 'demo') {
    setupStatus = 'En demo';
    setupTone = 'amber';
  } else if (device.mode === 'real_pending') {
    setupStatus = 'Real pendiente';
    setupTone = 'amber';
  } else if (!device.isActive) {
    setupStatus = 'Desactivado';
    setupTone = 'gray';
  }

  let availabilityLabel = 'Libre';
  let availabilityTone: DevicePresentation['availabilityTone'] = 'green';
  if (!device.isActive) {
    availabilityLabel = 'Inactivo';
    availabilityTone = 'gray';
  } else if (latestFailure) {
    availabilityLabel = 'Error en el último cobro';
    availabilityTone = 'red';
  } else if (device.queueState.running) {
    availabilityLabel = 'Ocupado';
    availabilityTone = 'amber';
  }

  const queueLabel = device.queueState.running
    ? device.queueState.queued > 0
      ? `${device.queueState.queued} cobros esperando`
      : 'Procesando un cobro'
    : device.queueState.queued > 0
      ? `${device.queueState.queued} cobros esperando`
      : 'Libre';

  return {
    device,
    provider,
    title,
    subtitle,
    setupStatus,
    setupTone,
    availabilityLabel,
    availabilityTone,
    queueLabel,
    latestFailure,
  };
}

export function getPrintingStatus(config: LocalConfig) {
  if (config.kiosk.features.printTicket) {
    return {
      title: 'Impresión temporal desde navegador',
      description: 'Puedes hacer pruebas con impresión básica mientras llega la impresora real.',
      tone: 'amber' as const,
    };
  }

  return {
    title: 'Impresión no configurada',
    description: 'Puedes configurarla más tarde si primero quieres validar el flujo de pedidos.',
    tone: 'gray' as const,
  };
}
