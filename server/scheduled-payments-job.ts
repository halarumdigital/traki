import { db } from "./db";
import { wooviCharges, wooviSubaccounts } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import wooviService from "./services/woovi.service";
import financialService from "./services/financial.service";
import { io } from "./index";

/**
 * Sincroniza o status das cobranças pendentes com a Woovi
 * Atualiza o saldo das subcontas quando pagamentos são confirmados
 */
export async function syncPendingPayments() {
  try {
    console.log("💳 [Payment Sync] Verificando cobranças pendentes...");

    // Buscar cobranças pendentes
    const pendingCharges = await db
      .select()
      .from(wooviCharges)
      .where(eq(wooviCharges.status, 'pending'));

    if (pendingCharges.length === 0) {
      return;
    }

    console.log(`📊 [Payment Sync] ${pendingCharges.length} cobrança(s) pendente(s)`);

    let updatedCount = 0;

    for (const charge of pendingCharges) {
      try {
        // Consultar status na Woovi
        const chargeData = await wooviService.getCharge(charge.correlationId);
        const wooviStatus = chargeData?.charge?.status;

        if (!wooviStatus) continue;

        if (wooviStatus === 'COMPLETED' && charge.status !== 'completed') {
          // Atualizar para completed
          await db
            .update(wooviCharges)
            .set({
              status: 'completed',
              updatedAt: new Date(),
            })
            .where(eq(wooviCharges.id, charge.id));

          console.log(`✅ [Payment Sync] Cobrança ${charge.correlationId.slice(-20)} → COMPLETED`);

          // Atualizar saldo da subconta
          let newBalance = 0;
          if (charge.subaccountId) {
            try {
              const balanceInCents = await financialService.updateSubaccountBalance(charge.subaccountId);
              newBalance = balanceInCents / 100; // Converter para reais
              console.log(`💰 [Payment Sync] Saldo da subconta atualizado: R$ ${newBalance.toFixed(2)}`);
            } catch (balanceError) {
              console.error(`⚠️ [Payment Sync] Erro ao atualizar saldo:`, balanceError);
            }
          }

          // Emitir evento real-time para a empresa
          if (charge.companyId) {
            io.emit(`payment:confirmed:${charge.companyId}`, {
              chargeId: charge.id,
              correlationId: charge.correlationId,
              value: parseFloat(charge.value),
              status: 'completed',
              newBalance,
            });
            console.log(`📡 [Payment Sync] Evento emitido para empresa ${charge.companyId}`);
          }

          // Registrar log da transação
          try {
            await financialService.logTransaction({
              type: 'pagamento_confirmado',
              companyId: charge.companyId,
              chargeId: charge.id,
              amount: charge.value,
              status: 'completed',
              description: `Pagamento PIX confirmado - Recarga de R$ ${parseFloat(charge.value).toFixed(2)}`,
              metadata: { source: 'sync_job', wooviStatus },
            });
          } catch (logError) {
            console.error(`⚠️ [Payment Sync] Erro ao registrar log:`, logError);
          }

          updatedCount++;

        } else if (wooviStatus === 'EXPIRED') {
          await db
            .update(wooviCharges)
            .set({
              status: 'expired',
              updatedAt: new Date(),
            })
            .where(eq(wooviCharges.id, charge.id));

          console.log(`⏰ [Payment Sync] Cobrança ${charge.correlationId.slice(-20)} → EXPIRED`);
          updatedCount++;
        }

      } catch (error) {
        // Silenciar erros individuais para não parar o loop
        console.error(`⚠️ [Payment Sync] Erro ao verificar ${charge.correlationId.slice(-20)}:`, error);
      }
    }

    if (updatedCount > 0) {
      console.log(`✅ [Payment Sync] ${updatedCount} cobrança(s) atualizada(s)`);
    }

  } catch (error) {
    console.error("❌ [Payment Sync] Erro na sincronização:", error);
  }
}

/**
 * Inicia o job de sincronização de pagamentos
 * Executa a cada 30 segundos
 */
export function startPaymentSyncJob() {
  // Executar após 5 segundos do início (para não sobrecarregar no boot)
  setTimeout(() => {
    syncPendingPayments();
  }, 5000);

  // Executar a cada 30 segundos
  const interval = setInterval(() => {
    syncPendingPayments();
  }, 30000);

  console.log("✓ Job de sincronização de pagamentos iniciado (verifica a cada 30 segundos)");

  return interval;
}
