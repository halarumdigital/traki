import { db } from "./db";
import { requests, settings } from "../shared/schema";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

/**
 * Cancela automaticamente entregas que foram criadas há mais de X minutos
 * (configurável nas configurações) e ainda não foram aceitas por nenhum motorista
 */
export async function autoCancelPendingDeliveries() {
  try {
    // Buscar tempo de cancelamento configurado
    const settingsData = await db.select().from(settings).limit(1);
    const autoCancelTimeout = parseInt(String(settingsData[0]?.autoCancelTimeout || 30)); // Default 30 minutos

    // Buscar entregas pendentes criadas há mais de X minutos (configurável)
    // Usar SQL com NOW() e INTERVAL para garantir que a comparação seja feita em UTC no PostgreSQL
    const pendingDeliveries = await db
      .select({
        id: requests.id,
        requestNumber: requests.requestNumber,
        createdAt: requests.createdAt,
      })
      .from(requests)
      .where(
        and(
          // Não foi aceita (sem motorista)
          isNull(requests.driverId),
          // Não foi cancelada ainda
          eq(requests.isCancelled, false),
          // Não foi completada
          eq(requests.isCompleted, false),
          // Criada há mais de X minutos - usar SQL direto para comparação em UTC
          sql`${requests.createdAt} < NOW() - INTERVAL '${sql.raw(autoCancelTimeout.toString())} minutes'`
        )
      );

    if (pendingDeliveries.length > 0) {
      console.log(`⏰ Encontradas ${pendingDeliveries.length} entregas para cancelar automaticamente (timeout: ${autoCancelTimeout} minutos)`);

      // Cancelar cada entrega
      for (const delivery of pendingDeliveries) {
        await db
          .update(requests)
          .set({
            isCancelled: true,
            cancelledAt: new Date(),
          })
          .where(eq(requests.id, delivery.id));

        console.log(
          `✓ Entrega #${delivery.requestNumber} cancelada automaticamente após ${autoCancelTimeout} minutos`
        );
      }

      console.log(`✓ ${pendingDeliveries.length} entregas canceladas automaticamente`);
    }
  } catch (error) {
    console.error("❌ Erro ao cancelar entregas pendentes:", error);
  }
}

/**
 * Inicia o job de auto-cancelamento que executa a cada 1 minuto
 */
export function startAutoCancelJob() {
  // Executar imediatamente ao iniciar
  autoCancelPendingDeliveries();

  // Executar a cada 1 minuto (60000ms)
  const interval = setInterval(() => {
    autoCancelPendingDeliveries();
  }, 60000);

  console.log("✓ Job de auto-cancelamento de entregas iniciado (verifica a cada 1 minuto)");

  return interval;
}
