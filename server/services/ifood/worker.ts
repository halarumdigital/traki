/**
 * Worker de Polling do iFood
 * Executa a cada 30 segundos para buscar novos pedidos
 */

import { storage } from "../../storage";
import { db } from "../../db";
import {
  requests,
  requestPlaces,
  requestBills,
  driverNotifications,
  drivers,
  companies,
} from "@shared/schema";
import type { IfoodCredentials } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  pollEvents,
  getOrderDetails,
  acknowledgeEvents,
  assignDriver,
} from "./client";
import { IFoodEvent, IFoodOrder, IFoodAuthError } from "./types";
import { sendPushToMultipleDevices } from "../../firebase";

const POLLING_INTERVAL = 30000; // 30 segundos
let isRunning = false;
let pollingInterval: NodeJS.Timeout | null = null;

/**
 * Calcula distância entre duas coordenadas usando Haversine (em km)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Processa um evento do iFood e cria a entrega no sistema
 */
async function processIFoodEvent(
  credentials: IfoodCredentials,
  event: IFoodEvent,
  order: IFoodOrder
): Promise<string | null> {
  console.log(`[IFOOD WORKER] Processando pedido ${order.displayId} (${event.fullCode})`);

  try {
    // Verificar se temos endereço de coleta configurado
    if (!credentials.pickupAddress || !credentials.pickupLat || !credentials.pickupLng) {
      console.error(`[IFOOD WORKER] Empresa ${credentials.companyId} não tem endereço de coleta configurado`);
      throw new Error("Endereço de coleta não configurado na integração iFood");
    }

    // Verificar se temos tipo de veículo configurado
    if (!credentials.defaultVehicleTypeId) {
      console.error(`[IFOOD WORKER] Empresa ${credentials.companyId} não tem tipo de veículo configurado`);
      throw new Error("Tipo de veículo não configurado na integração iFood");
    }

    // Buscar configurações do sistema
    const settings = await storage.getSettings();
    const driverSearchRadius = settings?.driverSearchRadius || 10; // km
    const driverAcceptanceTimeout = settings?.driverAcceptanceTimeout || 30; // segundos
    const adminCommissionPercentage = settings?.adminCommissionPercentage || 20; // %

    // Extrair dados do cliente
    const customerName = order.customer.name || "Cliente iFood";
    const customerPhone = order.customer.phone?.number || "";

    // Extrair endereço de entrega
    const deliveryAddress = order.delivery.deliveryAddress;
    const dropAddress = deliveryAddress.formattedAddress ||
      `${deliveryAddress.streetName}, ${deliveryAddress.streetNumber} - ${deliveryAddress.neighborhood}, ${deliveryAddress.city}/${deliveryAddress.state}`;
    const dropLat = deliveryAddress.coordinates.latitude;
    const dropLng = deliveryAddress.coordinates.longitude;

    // Endereço de coleta (restaurante)
    const pickupLat = parseFloat(credentials.pickupLat);
    const pickupLng = parseFloat(credentials.pickupLng);

    // Calcular distância e tempo estimado
    const distance = calculateDistance(pickupLat, pickupLng, dropLat, dropLng);
    const estimatedTime = Math.ceil((distance / 40) * 60); // Assumindo 40 km/h

    console.log(`[IFOOD WORKER] Distância: ${distance.toFixed(2)}km, Tempo estimado: ${estimatedTime}min`);

    // Calcular valores
    const basePrice = 10.00;
    const pricePerKm = 3.00;
    const totalAmount = basePrice + (distance * pricePerKm);
    const adminCommission = totalAmount * (adminCommissionPercentage / 100);
    const driverAmount = totalAmount - adminCommission;

    // Buscar motoristas disponíveis no raio
    const driversQuery = await db.execute(sql`
      SELECT
        d.id,
        d.name,
        d.email,
        d.fcm_token,
        d.latitude,
        d.longitude,
        (6371 * acos(
          cos(radians(${pickupLat})) *
          cos(radians(d.latitude)) *
          cos(radians(d.longitude) - radians(${pickupLng})) +
          sin(radians(${pickupLat})) *
          sin(radians(d.latitude))
        )) AS distance
      FROM drivers d
      WHERE d.active = true
        AND d.approve = true
        AND d.available = true
        AND (d.deliveries_blocked = false OR d.deliveries_blocked IS NULL)
        AND d.fcm_token IS NOT NULL
        AND d.latitude IS NOT NULL
        AND d.longitude IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM requests r
          WHERE r.driver_id = d.id
            AND r.is_completed = false
            AND r.is_cancelled = false
            AND r.is_trip_start = false
        )
      HAVING distance <= ${driverSearchRadius}
      ORDER BY distance ASC
    `);

    const availableDrivers = driversQuery.rows as any[];

    if (availableDrivers.length === 0) {
      console.log(`[IFOOD WORKER] Nenhum motorista disponível no raio de ${driverSearchRadius}km`);
      // Ainda criar a entrega para aparecer no painel
    }

    // Filtrar por alocação (mesma lógica do endpoint normal)
    const companyActiveAllocations = await storage.getActiveAllocationsForCompany(credentials.companyId);
    const allocatedDriverIds = companyActiveAllocations.map(a => a.driverId).filter(id => id !== null);

    let filteredDrivers: typeof availableDrivers = [];

    if (allocatedDriverIds.length > 0) {
      // Empresa TEM entregadores alocados - APENAS eles recebem
      console.log(`[IFOOD WORKER] Empresa tem ${allocatedDriverIds.length} entregador(es) alocado(s)`);
      filteredDrivers = availableDrivers.filter(d => allocatedDriverIds.includes(d.id));
    } else {
      // Empresa NÃO tem alocações - TODOS os disponíveis no raio recebem (exceto alocados para outras empresas)
      console.log(`[IFOOD WORKER] Empresa não tem entregadores alocados - notificando todos disponíveis`);
      for (const driver of availableDrivers) {
        const activeAllocation = await storage.getActiveAllocationForDriver(driver.id);
        if (!activeAllocation) {
          filteredDrivers.push(driver);
        }
      }
    }

    console.log(`[IFOOD WORKER] ${filteredDrivers.length} motorista(s) serão notificados`);

    // Gerar número da solicitação
    const requestNumber = `IFOOD-${order.displayId}-${Date.now()}`;

    // Buscar dados da empresa
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, credentials.companyId))
      .limit(1);

    // Criar registro de solicitação
    const [newRequest] = await db
      .insert(requests)
      .values({
        requestNumber,
        companyId: credentials.companyId,
        customerName,
        customerWhatsapp: customerPhone,
        deliveryReference: deliveryAddress.reference || deliveryAddress.complement || "",
        zoneTypeId: credentials.defaultVehicleTypeId,
        notes: `Pedido iFood #${order.displayId}`,
        requestEtaAmount: driverAmount.toFixed(2),
        totalDistance: distance.toFixed(2),
        estimatedTime: estimatedTime.toFixed(0),
        // Campos de integração externa
        externalSource: "ifood",
        externalOrderId: order.id,
        externalDisplayId: order.displayId,
      })
      .returning();

    console.log(`[IFOOD WORKER] Entrega criada: ${newRequest.id}`);

    // Criar registro de localização
    await db
      .insert(requestPlaces)
      .values({
        requestId: newRequest.id,
        pickLat: pickupLat.toString(),
        pickLng: pickupLng.toString(),
        pickAddress: credentials.pickupAddress,
        dropLat: dropLat.toString(),
        dropLng: dropLng.toString(),
        dropAddress,
      });

    // Criar registro de cobrança
    await db
      .insert(requestBills)
      .values({
        requestId: newRequest.id,
        basePrice: basePrice.toFixed(2),
        baseDistance: "0",
        pricePerDistance: pricePerKm.toFixed(2),
        distancePrice: (distance * pricePerKm).toFixed(2),
        pricePerTime: "0",
        timePrice: "0",
        totalAmount: totalAmount.toFixed(2),
        adminCommision: adminCommission.toFixed(2),
      });

    // Notificar motoristas
    if (filteredDrivers.length > 0) {
      const expiresAt = new Date(Date.now() + driverAcceptanceTimeout * 1000);
      const fcmTokens: string[] = [];

      const notificationPromises = filteredDrivers.map(async (driver) => {
        await db
          .insert(driverNotifications)
          .values({
            requestId: newRequest.id,
            driverId: driver.id,
            status: "notified",
            expiresAt,
          });

        if (driver.fcm_token) {
          fcmTokens.push(driver.fcm_token);
        }
      });

      await Promise.all(notificationPromises);

      // Enviar push notifications
      if (fcmTokens.length > 0) {
        const notificationData = {
          type: "new_delivery_request",
          deliveryId: newRequest.id,
          requestId: newRequest.id,
          requestNumber: newRequest.requestNumber,
          customerName: company?.name || "Empresa",
          companyLogoUrl: company?.logoUrl || "",
          pickupAddress: credentials.pickupAddress,
          dropoffAddress: dropAddress,
          totalDistance: distance.toFixed(1),
          totalTime: Math.ceil(estimatedTime).toString(),
          estimatedAmount: totalAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          driverAmount: driverAmount.toFixed(2),
          defaultCommissionPercentage: adminCommissionPercentage.toString(),
          acceptanceTimeout: driverAcceptanceTimeout.toString(),
          expiresAt: expiresAt.toISOString(),
          requiresRecalculation: "true",
          source: "ifood",
          ifoodOrderId: order.displayId,
        };

        await sendPushToMultipleDevices(
          fcmTokens,
          "🚚 Novo Pedido iFood!",
          `${company?.name || "Empresa"} - ${distance.toFixed(1)}km`,
          notificationData
        );

        console.log(`[IFOOD WORKER] Push enviado para ${fcmTokens.length} motorista(s)`);
      }
    }

    // Atualizar estatísticas da credencial
    await storage.updateIfoodCredentials(credentials.id, {
      lastSyncAt: new Date(),
      lastSyncStatus: "success",
      totalDeliveriesCreated: (credentials.totalDeliveriesCreated || 0) + 1,
    });

    return newRequest.id;

  } catch (error) {
    console.error(`[IFOOD WORKER] Erro ao processar pedido:`, error);

    // Atualizar status de erro
    await storage.updateIfoodCredentials(credentials.id, {
      lastSyncAt: new Date(),
      lastSyncStatus: "error",
      lastSyncError: error instanceof Error ? error.message : "Erro desconhecido",
    });

    throw error;
  }
}

/**
 * Processa eventos de uma credencial específica
 */
async function processCredential(credentials: IfoodCredentials): Promise<void> {
  console.log(`[IFOOD WORKER] Processando merchant ${credentials.merchantId}...`);

  try {
    // Definir quais eventos queremos filtrar
    const eventTypes: string[] = [];
    if (credentials.triggerOnReadyToPickup) eventTypes.push("RTP");
    if (credentials.triggerOnDispatched) eventTypes.push("DSP");

    if (eventTypes.length === 0) {
      console.log(`[IFOOD WORKER] Nenhum gatilho configurado para merchant ${credentials.merchantId}`);
      return;
    }

    // Fazer polling dos eventos
    const events = await pollEvents(credentials, { types: eventTypes });

    if (events.length === 0) {
      // Atualizar último sync mesmo sem eventos
      await storage.updateIfoodCredentials(credentials.id, {
        lastSyncAt: new Date(),
        lastSyncStatus: "no_events",
      });
      return;
    }

    console.log(`[IFOOD WORKER] ${events.length} evento(s) recebido(s)`);

    const eventsToAck: string[] = [];

    for (const event of events) {
      eventsToAck.push(event.id);

      // Verificar se o evento já foi processado (idempotência)
      const existingEvent = await storage.getIfoodProcessedEvent(event.id);
      if (existingEvent) {
        console.log(`[IFOOD WORKER] Evento ${event.id} já foi processado, pulando...`);
        continue;
      }

      // Verificar se é um evento que queremos processar
      if (
        (event.fullCode === "READY_TO_PICKUP" && credentials.triggerOnReadyToPickup) ||
        (event.fullCode === "DISPATCHED" && credentials.triggerOnDispatched)
      ) {
        try {
          // Buscar detalhes do pedido
          const order = await getOrderDetails(credentials, event.orderId);

          // Criar a entrega no sistema
          const requestId = await processIFoodEvent(credentials, event, order);

          // Registrar evento processado
          await storage.createIfoodProcessedEvent({
            eventId: event.id,
            orderId: event.orderId,
            ifoodOrderDisplayId: order.displayId,
            ifoodCredentialId: credentials.id,
            requestId,
            eventCode: event.code,
            eventFullCode: event.fullCode,
            status: "processed",
          });

          console.log(`[IFOOD WORKER] Evento ${event.id} processado com sucesso`);

        } catch (error) {
          console.error(`[IFOOD WORKER] Erro ao processar evento ${event.id}:`, error);

          // Registrar evento com erro
          await storage.createIfoodProcessedEvent({
            eventId: event.id,
            orderId: event.orderId,
            ifoodCredentialId: credentials.id,
            eventCode: event.code,
            eventFullCode: event.fullCode,
            status: "error",
            errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
          });
        }
      } else {
        // Evento não é do tipo que queremos, marca como pulado
        await storage.createIfoodProcessedEvent({
          eventId: event.id,
          orderId: event.orderId,
          ifoodCredentialId: credentials.id,
          eventCode: event.code,
          eventFullCode: event.fullCode,
          status: "skipped",
        });
      }
    }

    // Enviar acknowledgment para todos os eventos
    if (eventsToAck.length > 0) {
      await acknowledgeEvents(credentials, eventsToAck);
    }

  } catch (error) {
    if (error instanceof IFoodAuthError) {
      console.error(`[IFOOD WORKER] Erro de autenticação para merchant ${credentials.merchantId}:`, error.message);
    } else {
      console.error(`[IFOOD WORKER] Erro ao processar merchant ${credentials.merchantId}:`, error);
    }

    // Atualizar status de erro
    await storage.updateIfoodCredentials(credentials.id, {
      lastSyncAt: new Date(),
      lastSyncStatus: "error",
      lastSyncError: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}

/**
 * Executa uma iteração do polling
 */
async function poll(): Promise<void> {
  if (isRunning) {
    console.log("[IFOOD WORKER] Polling anterior ainda em execução, pulando...");
    return;
  }

  isRunning = true;

  try {
    // Buscar todas as credenciais ativas
    const activeCredentials = await storage.getAllActiveIfoodCredentials();

    if (activeCredentials.length === 0) {
      // console.log("[IFOOD WORKER] Nenhuma integração iFood ativa");
      return;
    }

    console.log(`[IFOOD WORKER] Processando ${activeCredentials.length} integração(ões) ativa(s)...`);

    // Processar cada credencial em sequência para evitar rate limit
    for (const credentials of activeCredentials) {
      await processCredential(credentials);
    }

  } catch (error) {
    console.error("[IFOOD WORKER] Erro geral no polling:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o worker de polling do iFood
 */
export function startIFoodWorker(): void {
  if (pollingInterval) {
    console.log("[IFOOD WORKER] Worker já está rodando");
    return;
  }

  console.log(`[IFOOD WORKER] Iniciando worker (intervalo: ${POLLING_INTERVAL / 1000}s)...`);

  // Executar imediatamente
  poll();

  // Agendar execução periódica
  pollingInterval = setInterval(poll, POLLING_INTERVAL);

  console.log("[IFOOD WORKER] Worker iniciado com sucesso");
}

/**
 * Para o worker de polling do iFood
 */
export function stopIFoodWorker(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[IFOOD WORKER] Worker parado");
  }
}

/**
 * Verifica se o worker está rodando
 */
export function isIFoodWorkerRunning(): boolean {
  return pollingInterval !== null;
}

/**
 * Executa polling manualmente (para testes)
 */
export async function manualPoll(): Promise<void> {
  await poll();
}
