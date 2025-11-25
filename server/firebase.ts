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

    // MENSAGEM COM NOTIFICATION E DATA: Permite notificações na tela bloqueada
    // O campo "notification" faz o Firebase mostrar a notificação automaticamente
    // O campo "data" permite enviar informações customizadas para o app
    const message: admin.messaging.Message = {
      notification: {
        title,
        body,
      },
      data: {
        title,
        body,
        ...(data || {}),
      },
      token: fcmToken,
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            sound: "default",
          },
        },
        headers: {
          "apns-priority": "10",
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log("✓ Notificação push enviada com notification + data:", response);
    return response;
  } catch (error: any) {
    // Tratar token inválido - limpar do banco de dados
    if (error?.errorInfo?.code === 'messaging/registration-token-not-registered' ||
        error?.errorInfo?.code === 'messaging/invalid-registration-token') {
      console.warn(`⚠️ Token FCM inválido, removendo do banco: ${fcmToken.substring(0, 20)}...`);
      try {
        // Limpar token de motoristas
        await storage.clearInvalidFcmToken(fcmToken);
      } catch (clearError) {
        console.error("Erro ao limpar token inválido:", clearError);
      }
    } else {
      console.error("Erro ao enviar notificação push:", error);
    }
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

    // MENSAGEM COM NOTIFICATION E DATA: Permite notificações na tela bloqueada
    // O campo "notification" faz o Firebase mostrar a notificação automaticamente
    // O campo "data" permite enviar informações customizadas para o app
    const message: admin.messaging.MulticastMessage = {
      notification: {
        title,
        body,
      },
      data: {
        title,
        body,
        ...(data || {}),
      },
      tokens: fcmTokens,
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            sound: "default",
          },
        },
        headers: {
          "apns-priority": "10",
        },
      },
    };

    console.log("📤 Enviando mensagem FCM:");
    console.log("  - Número de tokens:", fcmTokens.length);
    console.log("  - Dados:", message.data);
    console.log("  - Android priority:", message.android?.priority);

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log("📨 Resposta do Firebase:");
    console.log(`  - Sucesso: ${response.successCount}/${fcmTokens.length}`);
    console.log(`  - Falhas: ${response.failureCount}`);

    if (response.failureCount > 0) {
      console.error("❌ ERROS NO ENVIO:");
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`  Token ${idx} (${fcmTokens[idx].substring(0, 20)}...):`);
          console.error(`    - Código: ${resp.error?.code}`);
          console.error(`    - Mensagem: ${resp.error?.message}`);
        }
      });
    } else {
      console.log("✅ Todas as notificações foram enviadas com sucesso!");
      fcmTokens.forEach((token, idx) => {
        console.log(`  ✓ Token ${idx}: ${token.substring(0, 30)}...`);
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
