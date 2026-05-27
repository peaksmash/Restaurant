import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { QrServerEnv } from './env.js';

function normalizePrivateKey(value: string) {
  return value.replace(/\\n/g, '\n');
}

export function hasFirebaseAdminConfig(env: QrServerEnv) {
  return Boolean(env.firebase.projectId && env.firebase.clientEmail && env.firebase.privateKey);
}

export function getFirebaseAdminApp(env: QrServerEnv): App {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  if (!hasFirebaseAdminConfig(env)) {
    const error = new Error(
      'Firebase Admin no está configurado. Rellena FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.',
    ) as Error & { statusCode?: number };
    error.statusCode = 503;
    throw error;
  }

  return initializeApp({
    credential: cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: normalizePrivateKey(env.firebase.privateKey),
    }),
    projectId: env.firebase.projectId,
  });
}

export function getFirestoreDb(env: QrServerEnv): Firestore {
  const app = getFirebaseAdminApp(env);
  return getFirestore(app);
}

export async function runFirebaseAdminDiagnostic(env: QrServerEnv) {
  const app = getFirebaseAdminApp(env);
  const firestore = getFirestoreDb(env);
  const checkedAt = new Date().toISOString();
  const debugCollection = '_debug';
  const debugDocument = 'firebase-admin-check';

  await firestore.collection(debugCollection).doc(debugDocument).set(
    {
      checkedAt,
      source: 'qr-server',
      status: 'ok',
    },
    { merge: true },
  );

  const snapshot = await firestore.collection(debugCollection).doc(debugDocument).get();
  if (!snapshot.exists) {
    const error = new Error('Firestore respondió pero no devolvió el documento de comprobación.') as Error & {
      statusCode?: number;
    };
    error.statusCode = 502;
    throw error;
  }

  return {
    firebaseAdmin: 'ok' as const,
    projectId: app.options.projectId ?? env.firebase.projectId,
    firestore: 'ok' as const,
  };
}
