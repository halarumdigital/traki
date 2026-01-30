/**
 * Cliente HTTP para integração com API do iFood
 * Documentação: https://developer.ifood.com.br
 */

import {
  IFoodAuthResponse,
  IFoodEvent,
  IFoodOrder,
  IFoodAuthError,
  IFoodApiRequestError,
} from "./types";
import type { IfoodCredentials } from "@shared/schema";

const IFOOD_BASE_URL = "https://merchant-api.ifood.com.br";

// Cache de tokens por credencial
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();

/**
 * Autentica na API do iFood e retorna o token de acesso
 */
export async function authenticate(credentials: IfoodCredentials): Promise<IFoodAuthResponse> {
  console.log(`[IFOOD] Autenticando para merchant ${credentials.merchantId}...`);

  const response = await fetch(`${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grantType: "client_credentials",
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro de autenticação (${response.status}):`, errorText);
    throw new IFoodAuthError(`Falha na autenticação: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as IFoodAuthResponse;

  // Armazena no cache
  const expiresAt = new Date(Date.now() + (data.expiresIn - 60) * 1000); // 1 min antes de expirar
  tokenCache.set(credentials.id, { token: data.accessToken, expiresAt });

  console.log(`[IFOOD] Autenticado com sucesso. Token expira em ${data.expiresIn}s`);

  return data;
}

/**
 * Obtém token válido (do cache ou faz nova autenticação)
 */
export async function getValidToken(credentials: IfoodCredentials): Promise<string> {
  const cached = tokenCache.get(credentials.id);

  if (cached && cached.expiresAt > new Date()) {
    return cached.token;
  }

  // Token expirou ou não existe, faz nova autenticação
  const authResponse = await authenticate(credentials);
  return authResponse.accessToken;
}

/**
 * Faz polling de eventos do iFood
 */
export async function pollEvents(
  credentials: IfoodCredentials,
  options?: {
    types?: string[]; // Ex: ['RTP', 'DSP']
    groups?: string[]; // Ex: ['ORDER_STATUS']
  }
): Promise<IFoodEvent[]> {
  const token = await getValidToken(credentials);

  const params = new URLSearchParams();
  if (options?.types?.length) {
    params.set("types", options.types.join(","));
  }
  if (options?.groups?.length) {
    params.set("groups", options.groups.join(","));
  }
  // Obrigatório para integradoras logísticas
  params.set("excludeHeartbeat", "true");

  const queryString = params.toString();
  const url = `${IFOOD_BASE_URL}/events/v1.0/events:polling${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-polling-merchants": credentials.merchantId,
    },
  });

  // 204 = sem eventos
  if (response.status === 204) {
    return [];
  }

  if (response.status === 401) {
    // Token expirou, limpa cache e tenta novamente
    tokenCache.delete(credentials.id);
    throw new IFoodAuthError("Token expirado, reautenticar");
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro no polling (${response.status}):`, errorText);
    throw new IFoodApiRequestError(`Erro no polling: ${response.status}`, response.status);
  }

  const events = await response.json() as IFoodEvent[];
  return events;
}

/**
 * Obtém detalhes completos de um pedido
 */
export async function getOrderDetails(
  credentials: IfoodCredentials,
  orderId: string
): Promise<IFoodOrder> {
  const token = await getValidToken(credentials);

  const response = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    tokenCache.delete(credentials.id);
    throw new IFoodAuthError("Token expirado, reautenticar");
  }

  if (response.status === 404) {
    throw new IFoodApiRequestError(`Pedido ${orderId} não encontrado`, 404);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro ao buscar pedido (${response.status}):`, errorText);
    throw new IFoodApiRequestError(`Erro ao buscar pedido: ${response.status}`, response.status);
  }

  const order = await response.json() as IFoodOrder;
  return order;
}

/**
 * Envia acknowledgment dos eventos processados
 */
export async function acknowledgeEvents(
  credentials: IfoodCredentials,
  eventIds: string[]
): Promise<void> {
  if (eventIds.length === 0) return;

  const token = await getValidToken(credentials);

  const body = eventIds.map((id) => ({ id }));

  const response = await fetch(`${IFOOD_BASE_URL}/events/v1.0/events/acknowledgment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    tokenCache.delete(credentials.id);
    throw new IFoodAuthError("Token expirado, reautenticar");
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro no acknowledgment (${response.status}):`, errorText);
    // Não lança erro para não interromper o fluxo
  }

  console.log(`[IFOOD] Acknowledgment enviado para ${eventIds.length} evento(s)`);
}

// ========================================
// LOGISTICS - ATUALIZAÇÕES DE STATUS
// ========================================

/**
 * Notifica iFood que um entregador foi atribuído ao pedido
 */
export async function assignDriver(
  credentials: IfoodCredentials,
  orderId: string
): Promise<void> {
  const token = await getValidToken(credentials);

  const response = await fetch(`${IFOOD_BASE_URL}/logistics/v1.0/orders/${orderId}/assign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro ao atribuir entregador (${response.status}):`, errorText);
    // Não lança erro para não interromper o fluxo principal
  } else {
    console.log(`[IFOOD] Entregador atribuído ao pedido ${orderId}`);
  }
}

/**
 * Notifica iFood que o entregador está a caminho do restaurante
 */
export async function goingToOrigin(
  credentials: IfoodCredentials,
  orderId: string
): Promise<void> {
  const token = await getValidToken(credentials);

  const response = await fetch(`${IFOOD_BASE_URL}/logistics/v1.0/orders/${orderId}/requestDriver`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro ao notificar ida ao restaurante (${response.status}):`, errorText);
  } else {
    console.log(`[IFOOD] Notificado: entregador a caminho do restaurante - pedido ${orderId}`);
  }
}

/**
 * Notifica iFood que o entregador chegou no restaurante
 */
export async function arrivedAtOrigin(
  credentials: IfoodCredentials,
  orderId: string
): Promise<void> {
  const token = await getValidToken(credentials);

  const response = await fetch(`${IFOOD_BASE_URL}/logistics/v1.0/orders/${orderId}/arrivedAtOrigin`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro ao notificar chegada no restaurante (${response.status}):`, errorText);
  } else {
    console.log(`[IFOOD] Notificado: entregador chegou no restaurante - pedido ${orderId}`);
  }
}

/**
 * Notifica iFood que o entregador coletou o pedido e está a caminho do cliente
 */
export async function dispatch(
  credentials: IfoodCredentials,
  orderId: string
): Promise<void> {
  const token = await getValidToken(credentials);

  const response = await fetch(`${IFOOD_BASE_URL}/logistics/v1.0/orders/${orderId}/dispatch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro ao notificar dispatch (${response.status}):`, errorText);
  } else {
    console.log(`[IFOOD] Notificado: pedido coletado, a caminho do cliente - pedido ${orderId}`);
  }
}

/**
 * Notifica iFood que o entregador chegou no destino (cliente)
 */
export async function arrivedAtDestination(
  credentials: IfoodCredentials,
  orderId: string
): Promise<void> {
  const token = await getValidToken(credentials);

  const response = await fetch(`${IFOOD_BASE_URL}/logistics/v1.0/orders/${orderId}/arrivedAtDestination`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro ao notificar chegada no destino (${response.status}):`, errorText);
  } else {
    console.log(`[IFOOD] Notificado: entregador chegou no cliente - pedido ${orderId}`);
  }
}

/**
 * Confirma entrega com código de verificação
 */
export async function verifyDeliveryCode(
  credentials: IfoodCredentials,
  orderId: string,
  code: string
): Promise<boolean> {
  const token = await getValidToken(credentials);

  const response = await fetch(`${IFOOD_BASE_URL}/logistics/v1.0/orders/${orderId}/verifyDeliveryCode`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro ao verificar código de entrega (${response.status}):`, errorText);
    return false;
  }

  console.log(`[IFOOD] Código de entrega verificado com sucesso - pedido ${orderId}`);
  return true;
}

/**
 * Confirma entrega sem código (quando não há código)
 */
export async function confirmDelivery(
  credentials: IfoodCredentials,
  orderId: string
): Promise<void> {
  const token = await getValidToken(credentials);

  const response = await fetch(`${IFOOD_BASE_URL}/logistics/v1.0/orders/${orderId}/delivery`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    console.error(`[IFOOD] Erro ao confirmar entrega (${response.status}):`, errorText);
  } else {
    console.log(`[IFOOD] Entrega confirmada - pedido ${orderId}`);
  }
}

/**
 * Limpa cache de token para uma credencial específica
 */
export function clearTokenCache(credentialId: string): void {
  tokenCache.delete(credentialId);
}

/**
 * Limpa todo o cache de tokens
 */
export function clearAllTokenCache(): void {
  tokenCache.clear();
}
