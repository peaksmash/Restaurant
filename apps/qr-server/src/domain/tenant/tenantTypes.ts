export interface TenantBranding {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface TenantFeatures {
  qrEnabled: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  tableQrEnabled: boolean;
}

export interface TenantOnlineConfig {
  enabled: boolean;
}

export interface TenantLastAppRef {
  organizationId: string;
}

export interface TenantDocument {
  tenantId: string;
  tenantSlug: string;
  displayName: string;
  orderWeb: {
    hostname: string;
  };
  lastApp: TenantLastAppRef;
  online: TenantOnlineConfig;
  branding: TenantBranding;
  features: TenantFeatures;
}

export interface LocationCatalogRef {
  catalogId: string | null;
}

export interface LocationCatalogsByChannel {
  kiosk: LocationCatalogRef;
  qr_table: LocationCatalogRef;
  qr_pickup: LocationCatalogRef;
  qr_delivery: LocationCatalogRef;
}

export interface TenantLocationDocument {
  locationKey: string;
  slug: string;
  displayName: string;
  lastApp: {
    organizationId: string;
    locationId: string;
    brandId: string;
  };
  geo: {
    lat: number | null;
    lng: number | null;
  };
  catalogsByChannel: LocationCatalogsByChannel;
  online: {
    enabled: boolean;
    deliveryEnabled: boolean;
    pickupEnabled: boolean;
    tableQrEnabled: boolean;
  };
  timezone: string | null;
}

export interface TenantConfigResponse {
  mode: 'resolved';
  tenant: {
    tenantId: string;
    tenantSlug: string;
    displayName: string;
    hostname: string;
  };
  branding: TenantBranding;
  lastApp: TenantLastAppRef;
  locations: TenantLocationDocument[];
}
