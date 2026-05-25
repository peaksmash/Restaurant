import React, { useEffect, useState } from 'react';
import type { AdminPaymentDevice, CustomerFieldConfig, LocalConfig } from '../api';
import { createPaymentDevice, getPaymentDevices, saveConfig, updatePaymentDevice } from '../api';

interface Props {
  config: LocalConfig;
  onConfigChange: (c: LocalConfig) => void;
}

type KioskDraft = LocalConfig['kiosk'] & {
  payment: LocalConfig['kiosk']['payment'] & {
    cashdro: LocalConfig['kiosk']['payment']['cashdro'] & {
      password: string;
    };
  };
};

const DEFAULT_CASHDRO: LocalConfig['kiosk']['payment']['cashdro'] = {
  configured: false,
  baseUrl: '',
  username: '',
  passwordMasked: null,
  posId: 'Kiosk',
  posUser: 'Caja',
  allowInsecureTls: true,
};

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function toDraft(kiosk: LocalConfig['kiosk']): KioskDraft {
  const payment = kiosk.payment ?? {
    mode: 'simulated',
    preferredPaymentMethod: 'Cash',
    cashdro: DEFAULT_CASHDRO,
  };
  const cashdro = {
    ...DEFAULT_CASHDRO,
    ...(payment.cashdro ?? {}),
  };

  return {
    ...deepClone(kiosk),
    payment: {
      ...deepClone(payment),
      cashdro: {
        ...deepClone(cashdro),
        password: cashdro.passwordMasked ?? '',
      },
    },
  };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <div className="settings-control">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" />
    </label>
  );
}

function FieldToggleRow({
  label,
  field,
  onChange,
}: {
  label: string;
  field: CustomerFieldConfig;
  onChange: (patch: Partial<CustomerFieldConfig>) => void;
}) {
  function handleEnabled(v: boolean) {
    onChange({ enabled: v, required: v ? field.required : false });
  }

  function handleRequired(v: boolean) {
    onChange({ required: v, enabled: v ? true : field.enabled });
  }

  return (
    <div className="field-toggle-row">
      <span className="field-toggle-label">{label}</span>
      <div className="field-toggle-controls">
        <label className="chip-label">
          <input type="checkbox" checked={field.enabled} onChange={(e) => handleEnabled(e.target.checked)} />
          <span className={`chip ${field.enabled ? 'chip-blue' : ''}`}>Mostrar</span>
        </label>
        <label className={`chip-label${!field.enabled ? ' chip-label-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={field.required}
            disabled={!field.enabled}
            onChange={(e) => handleRequired(e.target.checked)}
          />
          <span className={`chip ${field.required ? 'chip-red' : ''}`}>Obligatorio</span>
        </label>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="settings-section-title">{children}</div>;
}

export function KioskSettingsTab({ config, onConfigChange }: Props) {
  const [draft, setDraft] = useState<KioskDraft>(() => toDraft(config.kiosk));
  const [paymentsSimulated, setPaymentsSimulated] = useState(config.paymentsSimulated);
  const [paymentDevices, setPaymentDevices] = useState<AdminPaymentDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(toDraft(config.kiosk));
    setPaymentsSimulated(config.paymentsSimulated);
  }, [config]);

  useEffect(() => {
    let cancelled = false;

    async function loadDevices() {
      if (!config.lastApp.locationId) {
        setPaymentDevices([]);
        return;
      }

      setDevicesLoading(true);
      try {
        const items = await getPaymentDevices(config.lastApp.locationId);
        if (!cancelled) {
          setPaymentDevices(items);
        }
      } catch {
        if (!cancelled) {
          setPaymentDevices([]);
        }
      } finally {
        if (!cancelled) {
          setDevicesLoading(false);
        }
      }
    }

    void loadDevices();
    return () => {
      cancelled = true;
    };
  }, [config.lastApp.locationId]);

  function patch<K extends keyof KioskDraft>(key: K, value: KioskDraft[K]) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function patchCustomerField(field: keyof KioskDraft['customerFields'], p: Partial<CustomerFieldConfig>) {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      customerFields: { ...prev.customerFields, [field]: { ...prev.customerFields[field], ...p } },
    }));
  }

  function patchNotes(p: Partial<KioskDraft['notes']>) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, notes: { ...prev.notes, ...p } }));
  }

  function patchFeatures(p: Partial<KioskDraft['features']>) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, features: { ...prev.features, ...p } }));
  }

  function patchPayment(p: Partial<KioskDraft['payment']>) {
    setSaved(false);
    setDraft((prev) => ({ ...prev, payment: { ...prev.payment, ...p } }));
  }

  function patchCashdro(p: Partial<KioskDraft['payment']['cashdro']>) {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      payment: {
        ...prev.payment,
        cashdro: { ...prev.payment.cashdro, ...p },
      },
    }));
  }

  async function handleSave() {
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      const body = {
        restaurantName: config.restaurantName,
        paymentsSimulated,
        lastApp: {
          organizationId: config.lastApp.organizationId,
          locationId: config.lastApp.locationId,
          brandId: config.lastApp.brandId,
          catalogId: config.lastApp.catalogId,
        },
        kiosk: draft,
        setupCompleted: config.setupCompleted,
      };
      const updated = await saveConfig(body);
      onConfigChange(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateDevice(provider: 'cashdro' | 'artemis') {
    if (!config.lastApp.locationId) return;
    setError('');
    try {
      const created = await createPaymentDevice({
        locationId: config.lastApp.locationId,
        provider,
        displayName: provider === 'cashdro' ? 'CashDro principal' : 'Artemis principal',
        mode: paymentsSimulated ? 'demo' : 'real_pending',
        configured: paymentsSimulated,
        isActive: true,
        configJson:
          provider === 'cashdro'
            ? {
                baseUrl: draft.payment.cashdro.baseUrl || null,
                username: draft.payment.cashdro.username || null,
                posId: draft.payment.cashdro.posId || null,
                posUser: draft.payment.cashdro.posUser || null,
                allowInsecureTls: draft.payment.cashdro.allowInsecureTls,
              }
            : {
                host: null,
                port: 2001,
                owner: 'kiosk',
              },
      });
      setPaymentDevices((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el dispositivo.');
    }
  }

  async function handlePatchDevice(deviceId: string, patch: Parameters<typeof updatePaymentDevice>[1]) {
    setError('');
    try {
      const updated = await updatePaymentDevice(deviceId, patch);
      setPaymentDevices((prev) => prev.map((item) => (item.id === deviceId ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el dispositivo.');
    }
  }

  const paymentMode = draft.payment.mode;
  const printTicket = draft.features.printTicket;
  const locationId = config.lastApp.locationId;

  return (
    <div className="tab-content">
      <div className="card">
        <SectionTitle>Apariencia</SectionTitle>

        <Row label="Tema">
          <select className="settings-select" value={draft.theme} onChange={(e) => patch('theme', e.target.value as KioskDraft['theme'])}>
            <option value="principal">Principal</option>
            <option value="moderno">Moderno</option>
            <option value="simple">Simple</option>
            <option value="morado">Morado</option>
          </select>
        </Row>

        <SectionTitle>Modo de pedido</SectionTitle>

        <Row label="Modo por defecto">
          <select
            className="settings-select"
            value={draft.defaultOrderMode}
            onChange={(e) => patch('defaultOrderMode', e.target.value as KioskDraft['defaultOrderMode'])}
          >
            <option value="eatIn">En local (Eat In)</option>
            <option value="takeAway">Para llevar (Take Away)</option>
            <option value="delivery">Delivery</option>
          </select>
        </Row>

        <Row label="Tipo de recogida">
          <select className="settings-select" value={draft.pickupType} onChange={(e) => patch('pickupType', e.target.value)}>
            <option value="takeAway">Para llevar</option>
            <option value="delivery">Delivery</option>
          </select>
        </Row>

        <SectionTitle>Datos del cliente</SectionTitle>

        <FieldToggleRow label="Nombre" field={draft.customerFields.name} onChange={(p) => patchCustomerField('name', p)} />
        <FieldToggleRow label="Teléfono" field={draft.customerFields.phoneNumber} onChange={(p) => patchCustomerField('phoneNumber', p)} />
        <FieldToggleRow label="Email" field={draft.customerFields.email} onChange={(p) => patchCustomerField('email', p)} />

        <SectionTitle>Notas</SectionTitle>

        <Row label="Notas generales">
          <Toggle checked={draft.notes.generalEnabled} onChange={(v) => patchNotes({ generalEnabled: v })} />
        </Row>
        <Row label="Comentarios por producto">
          <Toggle checked={draft.notes.productCommentsEnabled} onChange={(v) => patchNotes({ productCommentsEnabled: v })} />
        </Row>

        <SectionTitle>Funcionalidades</SectionTitle>

        <Row label="Modificadores de producto">
          <Toggle checked={draft.features.modifiers} onChange={(v) => patchFeatures({ modifiers: v })} />
        </Row>
        <Row label="Upselling">
          <Toggle checked={draft.features.upselling} onChange={(v) => patchFeatures({ upselling: v })} />
        </Row>
        <Row label="Imprimir ticket">
          <Toggle checked={draft.features.printTicket} onChange={(v) => patchFeatures({ printTicket: v })} />
        </Row>

        {printTicket ? <div className="infobox infobox-warn">Impresora pendiente de configurar.</div> : null}

        <SectionTitle>Pago</SectionTitle>

        <Row label="Modo de pago">
          <select className="settings-select" value={paymentMode} onChange={(e) => patchPayment({ mode: e.target.value })}>
            <option value="simulated">Sin hardware (temporal)</option>
            <option value="cash">Efectivo manual de emergencia</option>
            <option value="stripe">Tarjeta</option>
            <option value="cashdro">Efectivo automático</option>
          </select>
        </Row>

        <Row label="Pagos en modo demo">
          <Toggle checked={paymentsSimulated} onChange={setPaymentsSimulated} />
        </Row>

        <div className={`infobox ${paymentsSimulated ? 'infobox-warn' : 'infobox-ok'}`}>
          {paymentsSimulated
            ? 'Modo demo activo. Stripe, CashDro y Artemis no llamarán servicios reales.'
            : 'Modo demo desactivado. Los módulos reales siguen pendientes de validación final.'}
        </div>

        {paymentMode === 'stripe' ? <div className="infobox infobox-warn">Tarjeta real pendiente de configurar.</div> : null}
        {paymentMode === 'cashdro' ? (
          <div className="stack-gap-sm">
            <div className="infobox infobox-warn">
              Configura la URL/IP del CashDro y las credenciales del usuario TPV para preparar el efectivo automático.
            </div>
            <Row label="URL / IP CashDro">
              <input
                className="settings-input"
                type="text"
                value={draft.payment.cashdro.baseUrl}
                onChange={(e) => patchCashdro({ baseUrl: e.target.value })}
                placeholder="https://192.168.1.50"
              />
            </Row>
            <Row label="Usuario CashDro">
              <input
                className="settings-input"
                type="text"
                value={draft.payment.cashdro.username}
                onChange={(e) => patchCashdro({ username: e.target.value })}
                placeholder="admin"
              />
            </Row>
            <Row label="Contraseña CashDro">
              <input
                className="settings-input"
                type="password"
                value={draft.payment.cashdro.password}
                onChange={(e) => patchCashdro({ password: e.target.value })}
                placeholder="1234"
              />
            </Row>
            <Row label="POS ID">
              <input
                className="settings-input"
                type="text"
                value={draft.payment.cashdro.posId}
                onChange={(e) => patchCashdro({ posId: e.target.value })}
                placeholder="Kiosk"
              />
            </Row>
            <Row label="Usuario TPV">
              <input
                className="settings-input"
                type="text"
                value={draft.payment.cashdro.posUser}
                onChange={(e) => patchCashdro({ posUser: e.target.value })}
                placeholder="Caja"
              />
            </Row>
            <Row label="Permitir TLS local">
              <Toggle checked={draft.payment.cashdro.allowInsecureTls} onChange={(v) => patchCashdro({ allowInsecureTls: v })} />
            </Row>
            <div className={`infobox ${draft.payment.cashdro.configured ? 'infobox-ok' : 'infobox-warn'}`}>
              {draft.payment.cashdro.configured
                ? 'Efectivo automático configurado.'
                : 'Efectivo automático aún no tiene credenciales completas.'}
            </div>
          </div>
        ) : null}

        <Row label="Método preferido">
          <input
            className="settings-input"
            type="text"
            value={draft.payment.preferredPaymentMethod}
            onChange={(e) => patchPayment({ preferredPaymentMethod: e.target.value })}
            placeholder="Ej. Cash, Card..."
          />
        </Row>

        <SectionTitle>Dispositivos de pago</SectionTitle>

        {!locationId ? <div className="infobox infobox-warn">Primero completa el setup de Last para disponer de un locationId real.</div> : null}

        {locationId ? (
          <div className="stack-gap-sm">
            <div className="infobox infobox-ok">
              Local actual: <strong>{locationId}</strong>
            </div>

            <div className="settings-row">
              <span className="settings-label">Crear dispositivo</span>
              <div className="settings-control" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={() => { void handleCreateDevice('artemis'); }}>
                  Añadir ArtemisPay
                </button>
                <button type="button" className="btn" onClick={() => { void handleCreateDevice('cashdro'); }}>
                  Añadir CashDro
                </button>
              </div>
            </div>

            {devicesLoading ? <p className="msg">Cargando dispositivos…</p> : null}
            {!devicesLoading && paymentDevices.length === 0 ? (
              <div className="infobox infobox-warn">Todavía no hay dispositivos configurados para este local.</div>
            ) : null}

            {paymentDevices.map((device) => (
              <div key={device.id} className="card" style={{ padding: 16, marginTop: 8 }}>
                <div className="settings-section-title" style={{ marginTop: 0 }}>
                  {device.provider === 'cashdro' ? 'CashDro' : 'ArtemisPay'}
                </div>

                <Row label="Nombre visible">
                  <input
                    className="settings-input"
                    type="text"
                    value={device.displayName}
                    onChange={(e) => {
                      setPaymentDevices((prev) =>
                        prev.map((item) => (item.id === device.id ? { ...item, displayName: e.target.value } : item)),
                      );
                    }}
                    onBlur={() => {
                      void handlePatchDevice(device.id, { displayName: device.displayName });
                    }}
                  />
                </Row>

                <Row label="Modo">
                  <select
                    className="settings-select"
                    value={device.mode}
                    onChange={(e) => {
                      void handlePatchDevice(device.id, { mode: e.target.value as 'demo' | 'real_pending' | 'real' });
                    }}
                  >
                    <option value="demo">Demo</option>
                    <option value="real_pending">Real pendiente</option>
                    <option value="real">Real</option>
                  </select>
                </Row>

                <Row label="Activo">
                  <Toggle checked={device.isActive} onChange={(v) => { void handlePatchDevice(device.id, { isActive: v }); }} />
                </Row>

                <Row label="Configurado">
                  <Toggle checked={device.configured} onChange={(v) => { void handlePatchDevice(device.id, { configured: v }); }} />
                </Row>

                <div className="infobox infobox-ok">
                  Estado cola: {device.queueState.running ? 'Ocupado' : 'Libre'} · En espera: {device.queueState.queued}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="msg msg-error">{error}</p> : null}
        {saved ? <p className="msg msg-success">Configuración guardada.</p> : null}

        <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar configuración del kiosko'}
        </button>
      </div>
    </div>
  );
}
