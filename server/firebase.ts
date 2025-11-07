import admin from "firebase-admin";
import { storage } from "./storage";

let firebaseApp: admin.app.App | null = null;

export async function initializeFirebase() {
  try {
    const settings = await storage.getSettings();

    if (!settings || !settings.firebaseProjectId || !settings.firebasePrivateKey || !settings.firebaseClientEmail) {
      console.warn("Firebase não configurado. Notificações push desabilitadas.");
      return null;
    }

    // Decodifica a chave privada (pode estar em base64 ou com \n escapado)
    let privateKey = settings.firebasePrivateKey;

    // Primeiro, tenta substituir \n por quebras de linha reais
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    // Se não começar com BEGIN, tenta decodificar de base64
    else if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      try {
        const decoded = Buffer.from(privateKey, 'base64').toString('utf8');
        if (decoded.includes('BEGIN PRIVATE KEY')) {
          privateKey = decoded;
        }
      } catch {
        // Se falhar, usa a chave original
      }
    }

    if (!firebaseApp) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: settings.firebaseProjectId,
          clientEmail: settings.firebaseClientEmail,
          privateKey: privateKey,
        }),
        databaseURL: settings.firebaseDatabaseUrl || undefined,
      });

      console.log("✓ Firebase Admin SDK inicializado com sucesso");
    }

    return firebaseApp;
  } catch (error) {
    console.error("Erro ao inicializar Firebase:", error);
    return null;
  }
}

export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    if (!firebaseApp) {
      await initializeFirebase();
      if (!firebaseApp) {
        console.warn("Firebase não inicializado. Notificação não enviada.");
        return null;
      }
    }

    const message: admin.messaging.Message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      token: fcmToken,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "delivery_channel",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log("✓ Notificação push enviada:", response);
    return response;
  } catch (error) {
    console.error("Erro ao enviar notificação push:", error);
    return null;
  }
}

export async function sendPushToMultipleDevices(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    if (!firebaseApp) {
      await initializeFirebase();
      if (!firebaseApp) {
        console.warn("Firebase não inicializado. Notificações não enviadas.");
        return null;
      }
    }

    const message: admin.messaging.MulticastMessage = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens: fcmTokens,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "delivery_channel",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✓ ${response.successCount} notificações enviadas de ${fcmTokens.length}`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Erro ao enviar para token ${idx}:`, resp.error);
        }
      });
    }

    return response;
  } catch (error) {
    console.error("Erro ao enviar notificações push:", error);
    return null;
  }
}

export function getFirebaseApp() {
  return firebaseApp;
}
