import { db } from "./db";
import { requests, companies, settings, drivers } from "../shared/schema";
import { and, eq, lte, isNotNull, isNull } from "drizzle-orm";
import { pool } from "./db";
import { sendPushToMultipleDevices } from "./firebase";

/**
 * Processa entregas agendadas que chegaram na data/hora programada
 * Envia notificações para motoristas disponíveis
 */
export async function processScheduledDeliveries() {
  try {
    // Obter hora atual em São Paulo (formato: YYYY-MM-DD HH:MM:SS)
    const nowBrazil = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace('T', ' ');
    const now = new Date();

    // Debug: mostrar hora atual
    console.log(`🕐 [Scheduled Job] Verificando entregas agendadas... Hora atual Brasil: ${nowBrazil} | UTC: ${now.toISOString()}`);

    // Primeiro, buscar TODAS as entregas agendadas para debug
    const allScheduledDeliveries = await db
      .select({
        id: requests.id,
        requestNumber: requests.requestNumber,
        scheduledAt: requests.scheduledAt,
        isLater: requests.isLater,
        driverId: requests.driverId,
        isCancelled: requests.isCancelled,
        isCompleted: requests.isCompleted,
      })
      .from(requests)
      .where(
        and(
          eq(requests.isLater, true),
          isNotNull(requests.scheduledAt)
        )
      );

    if (allScheduledDeliveries.length > 0) {
      console.log(`📋 [Scheduled Job] Total de entregas agendadas no sistema: ${allScheduledDeliveries.length}`);
      for (const d of allScheduledDeliveries) {
        // scheduledAt está em hora local (São Paulo), comparar com hora local atual
        const scheduledTimeStr = d.scheduledAt ? d.scheduledAt.toISOString().replace('T', ' ').substring(0, 19) : null;
        const isPast = scheduledTimeStr && scheduledTimeStr <= nowBrazil;
        console.log(`   - ${d.requestNumber}: Agendada para ${scheduledTimeStr} (BR) | Hora atual: ${nowBrazil} | Passou da hora? ${isPast} | Driver: ${d.driverId || 'nenhum'} | Cancelada: ${d.isCancelled} | Completa: ${d.isCompleted}`);
      }
    }

    // Buscar entregas agendadas que já chegaram no horário
    // Usar SQL direto para comparar com hora local (o banco armazena hora de São Paulo)
    const scheduledDeliveriesResult = await pool.query(`
      SELECT
        id,
        request_number AS "requestNumber",
        scheduled_at AS "scheduledAt",
        company_id AS "companyId",
        zone_type_id AS "zoneTypeId",
        total_distance AS "totalDistance",
        total_time AS "totalTime",
        customer_name AS "customerName",
        needs_return AS "needsReturn",
        request_eta_amount AS "requestEtaAmount"
      FROM requests
      WHERE is_later = true
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= $1::timestamp
        AND driver_id IS NULL
        AND is_cancelled = false
        AND is_completed = false
    `, [nowBrazil]);

    const scheduledDeliveries = scheduledDeliveriesResult.rows;

    if (scheduledDeliveries.length === 0) {
      console.log(`📅 [Scheduled Job] Nenhuma entrega agendada para processar no momento`);
      return;
    }

    console.log(`📅 Processando ${scheduledDeliveries.length} entregas agendadas que chegaram na hora`);

    // Buscar configurações
    const [systemSettings] = await db.select().from(settings).limit(1);
    const searchRadius = systemSettings?.driverSearchRadius
      ? parseFloat(systemSettings.driverSearchRadius.toString())
      : 10;
    const driverAcceptanceTimeout = systemSettings?.driverAcceptanceTimeout || 60;

    for (const delivery of scheduledDeliveries) {
      try {
        // Buscar dados da empresa
        const [company] = delivery.companyId
          ? await db
              .select({ name: companies.name })
              .from(companies)
              .where(eq(companies.id, delivery.companyId))
              .limit(1)
          : [{ name: "Cliente" }];

        // Buscar endereços da entrega
        const placesResult = await pool.query(
          `SELECT pick_address, drop_address, pick_lat, pick_lng
           FROM request_places WHERE request_id = $1 LIMIT 1`,
          [delivery.id]
        );

        if (placesResult.rows.length === 0) {
          console.log(`⚠️ Entrega ${delivery.requestNumber} não tem endereços cadastrados`);
          continue;
        }

        const places = placesResult.rows[0];
        const pickupLat = parseFloat(places.pick_lat);
        const pickupLng = parseFloat(places.pick_lng);

        if (isNaN(pickupLat) || isNaN(pickupLng)) {
          console.log(`⚠️ Entrega ${delivery.requestNumber} não tem coordenadas válidas`);
          continue;
        }

        // Buscar motoristas disponíveis
        const availableDrivers = await pool.query(
          `SELECT id, name, mobile, latitude, longitude, fcm_token
           FROM drivers
           WHERE active = true
             AND available = true
             AND approve = true
             AND (deliveries_blocked = false OR deliveries_blocked IS NULL)
             AND latitude IS NOT NULL
             AND longitude IS NOT NULL
             AND fcm_token IS NOT NULL`
        );

        // Filtrar motoristas dentro do raio
        const driversWithinRadius = availableDrivers.rows.filter(driver => {
          const driverLat = parseFloat(driver.latitude);
          const driverLng = parseFloat(driver.longitude);

          if (isNaN(driverLat) || isNaN(driverLng)) {
            return false;
          }

          const distanceToPickup = calculateDistance(
            pickupLat,
            pickupLng,
            driverLat,
            driverLng
          );

          return distanceToPickup <= searchRadius;
        });

        console.log(`📍 Entrega ${delivery.requestNumber}: ${driversWithinRadius.length} motoristas dentro do raio de ${searchRadius} km`);

        if (driversWithinRadius.length > 0) {
          const fcmTokens = driversWithinRadius
            .map(driver => driver.fcm_token)
            .filter(token => token);

          if (fcmTokens.length > 0) {
            const notificationTitle = "Nova Entrega Disponível!";
            const notificationBody = `${company?.name || 'Cliente'} solicitou uma entrega. ${places.pick_address} → ${places.drop_address}`;

            const timeFromGoogleMaps = delivery.totalTime ? parseInt(delivery.totalTime.toString()) : 0;
            const estimatedTimeWithMargin = timeFromGoogleMaps + 5;

            const totalAmountStr = delivery.requestEtaAmount?.toString() || "0";
            const distanceInKm = delivery.totalDistance
              ? (parseFloat(delivery.totalDistance.toString()) / 1000).toString()
              : "0";

            const notificationData = {
              type: "new_delivery",
              deliveryId: delivery.id,
              requestNumber: delivery.requestNumber,
              pickupAddress: places.pick_address,
              dropoffAddress: places.drop_address,
              estimatedAmount: totalAmountStr,
              totalAmount: totalAmountStr,
              driverAmount: totalAmountStr,
              distance: distanceInKm,
              estimatedTime: estimatedTimeWithMargin.toString(),
              companyName: company?.name || "",
              customerName: delivery.customerName || "",
              acceptanceTimeout: driverAcceptanceTimeout.toString(),
              searchTimeout: "60",
              needs_return: (delivery.needsReturn || false).toString(),
            };

            // Enviar notificação
            await sendPushToMultipleDevices(
              fcmTokens,
              notificationTitle,
              notificationBody,
              notificationData
            );

            // Salvar notificações na tabela driver_notifications
            const expiresAt = new Date(Date.now() + driverAcceptanceTimeout * 1000);
            for (const driver of driversWithinRadius) {
              await pool.query(
                `INSERT INTO driver_notifications (id, request_id, driver_id, status, notified_at, expires_at)
                 VALUES (gen_random_uuid(), $1, $2, 'notified', NOW(), $3)`,
                [delivery.id, driver.id, expiresAt]
              );
            }

            console.log(`✅ Entrega ${delivery.requestNumber} agendada: Notificação enviada para ${fcmTokens.length} motoristas`);
          }
        } else {
          console.log(`⚠️ Entrega ${delivery.requestNumber} agendada: Nenhum motorista disponível dentro do raio`);
        }

        // Marcar a entrega como "não mais agendada" (agora é pendente normal)
        await db
          .update(requests)
          .set({
            isLater: false,
            updatedAt: new Date(),
          })
          .where(eq(requests.id, delivery.id));

        console.log(`✅ Entrega ${delivery.requestNumber} processada - status atualizado para pendente`);
      } catch (error) {
        console.error(`❌ Erro ao processar entrega agendada ${delivery.requestNumber}:`, error);
      }
    }
  } catch (error) {
    console.error("❌ Erro ao processar entregas agendadas:", error);
  }
}

/**
 * Calcula a distância entre dois pontos usando a fórmula de Haversine
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Inicia o job de processamento de entregas agendadas que executa a cada 1 minuto
 */
export function startScheduledDeliveriesJob() {
  // Executar imediatamente ao iniciar
  processScheduledDeliveries();

  // Executar a cada 1 minuto (60000ms)
  const interval = setInterval(() => {
    processScheduledDeliveries();
  }, 60000);

  console.log("✓ Job de entregas agendadas iniciado (verifica a cada 1 minuto)");

  return interval;
}
