import 'dotenv/config';

function readEnv(name: string, fallback = '') {
  return process.env[name]?.trim() ?? fallback;
}

function parseOrigins(value: string) {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export interface QrServerEnv {
  port: number;
  allowedOrigins: string[];
  firebase: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
  lastApp: {
    token: string;
    baseUrl: string;
  };
}

export function loadEnv(): QrServerEnv {
  const portValue = Number.parseInt(readEnv('PORT', '3010'), 10);

  return {
    port: Number.isFinite(portValue) ? portValue : 3010,
    allowedOrigins: parseOrigins(
      readEnv('ALLOWED_ORIGINS', 'http://localhost:3003,http://127.0.0.1:3003'),
    ),
    firebase: {
      projectId: readEnv('FIREBASE_PROJECT_ID'),
      clientEmail: readEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: readEnv('FIREBASE_PRIVATE_KEY'),
    },
    lastApp: {
      token: readEnv('LAST_TOKEN'),
      baseUrl: readEnv('LAST_BASE_URL', 'https://api.last.app/v2'),
    },
  };
}
