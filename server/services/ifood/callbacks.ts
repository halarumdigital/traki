/**
 * Callbacks do iFood
 * Notifica a API do iFood sobre mudanças de status das entregas
 */

import { storage } from "../../storage";
import {
  assignDriver,
  arrivedAtOrigin,
  dispatch,
  arrivedAtDestination,
  confirmDelivery,
} from "./client";
import type { Request } from "@shared/schema";

/**
 * Verifica se a entrega é do iFood e retorna as credenciais
 */
async function getIfoodCredentialsForRequest(request: Request) {
  // Verificar se é uma entrega do iFood
  if (request.externalSource !== "ifood" || !request.externalOrderId) {
    return null;
  }

  // Buscar credenciais da empresa
  if (!request.companyId) {
    return null;
  }

  const credentials = await storage.getIfoodCredentialsByCompany(request.companyId);

  if (!credentials || !credentials.active) {
    return null;
  }

  return credentials;
}

/**
 * Notifica iFood quando um entregador aceita a entrega
 */
export async function onDeliveryAccepted(request: Request): Promise<void> {
  try {
    const credentials = await getIfoodCredentialsForRequest(request);
    if (!credentials) return;

    console.log(`[IFOOD CALLBACK] Notificando aceitação do pedido ${request.externalDisplayId}`);
    await assignDriver(credentials, request.externalOrderId!);
  } catch (error) {
    console.error("[IFOOD CALLBACK] Erro ao notificar aceitação:", error);
    // Não propaga o erro para não afetar o fluxo principal
  }
}

/**
 * Notifica iFood quando o entregador chega no restaurante
 */
export async function onArrivedAtPickup(request: Request): Promise<void> {
  try {
    const credentials = await getIfoodCredentialsForRequest(request);
    if (!credentials) return;

    console.log(`[IFOOD CALLBACK] Notificando chegada no restaurante - pedido ${request.externalDisplayId}`);
    await arrivedAtOrigin(credentials, request.externalOrderId!);
  } catch (error) {
    console.error("[IFOOD CALLBACK] Erro ao notificar chegada no restaurante:", error);
  }
}

/**
 * Notifica iFood quando o entregador coleta o pedido (saiu para entrega)
 */
export async function onPickedUp(request: Request): Promise<void> {
  try {
    const credentials = await getIfoodCredentialsForRequest(request);
    if (!credentials) return;

    console.log(`[IFOOD CALLBACK] Notificando coleta do pedido ${request.externalDisplayId}`);
    await dispatch(credentials, request.externalOrderId!);
  } catch (error) {
    console.error("[IFOOD CALLBACK] Erro ao notificar coleta:", error);
  }
}

/**
 * Notifica iFood quando o entregador chega no destino (cliente)
 */
export async function onArrivedAtDestination(request: Request): Promise<void> {
  try {
    const credentials = await getIfoodCredentialsForRequest(request);
    if (!credentials) return;

    console.log(`[IFOOD CALLBACK] Notificando chegada no cliente - pedido ${request.externalDisplayId}`);
    await arrivedAtDestination(credentials, request.externalOrderId!);
  } catch (error) {
    console.error("[IFOOD CALLBACK] Erro ao notificar chegada no destino:", error);
  }
}

/**
 * Notifica iFood quando a entrega é finalizada
 */
export async function onDeliveryCompleted(request: Request): Promise<void> {
  try {
    const credentials = await getIfoodCredentialsForRequest(request);
    if (!credentials) return;

    console.log(`[IFOOD CALLBACK] Notificando conclusão do pedido ${request.externalDisplayId}`);
    await confirmDelivery(credentials, request.externalOrderId!);
  } catch (error) {
    console.error("[IFOOD CALLBACK] Erro ao notificar conclusão:", error);
  }
}

/**
 * Helper para notificar iFood de forma genérica
 * Útil para chamar a partir dos endpoints existentes
 */
export async function notifyIfoodStatusChange(
  requestId: string,
  status: "accepted" | "arrived_pickup" | "picked_up" | "arrived_destination" | "completed"
): Promise<void> {
  try {
    const request = await storage.getRequest(requestId);
    if (!request) {
      console.error(`[IFOOD CALLBACK] Request ${requestId} não encontrada`);
      return;
    }

    switch (status) {
      case "accepted":
        await onDeliveryAccepted(request);
        break;
      case "arrived_pickup":
        await onArrivedAtPickup(request);
        break;
      case "picked_up":
        await onPickedUp(request);
        break;
      case "arrived_destination":
        await onArrivedAtDestination(request);
        break;
      case "completed":
        await onDeliveryCompleted(request);
        break;
    }
  } catch (error) {
    console.error(`[IFOOD CALLBACK] Erro ao notificar status ${status}:`, error);
  }
}
