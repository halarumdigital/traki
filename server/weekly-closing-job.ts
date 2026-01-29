/**
 * Job de Fechamento Semanal
 * Executa todo domingo às 00:00
 * Gera cobranças para todas as empresas pós-pago
 */

import cron from "node-cron";
import { executeWeeklyClosingJob, checkOverdueCharges } from "./services/wallet/weeklyClosingService";

let isJobRunning = false;

/**
 * Inicia o job de fechamento semanal
 */
export function startWeeklyClosingJob(): void {
  // Executa todo domingo às 00:00
  // Formato: segundo minuto hora dia-do-mês mês dia-da-semana
  cron.schedule(
    "0 0 0 * * 0",
    async () => {
      if (isJobRunning) {
        console.log("⚠️ Job de fechamento semanal já está em execução");
        return;
      }

      isJobRunning = true;
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🗓️  FECHAMENTO SEMANAL - " + new Date().toLocaleString("pt-BR"));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      try {
        const results = await executeWeeklyClosingJob();

        // Log dos resultados
        const successful = results.filter((r) => r.success);
        const failed = results.filter((r) => !r.success);

        console.log(`\n📊 RESUMO:`);
        console.log(`   Empresas processadas: ${results.length}`);
        console.log(`   Sucessos: ${successful.length}`);
        console.log(`   Falhas: ${failed.length}`);

        if (successful.length > 0) {
          const totalAmount = successful.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
          const totalDeliveries = successful.reduce((sum, r) => sum + (r.deliveriesCount || 0), 0);
          console.log(`   Total cobrado: R$ ${totalAmount.toFixed(2)}`);
          console.log(`   Total entregas: ${totalDeliveries}`);
        }
      } catch (error) {
        console.error("❌ Erro no job de fechamento semanal:", error);
      } finally {
        isJobRunning = false;
      }
    },
    {
      timezone: "America/Sao_Paulo",
    }
  );

  console.log("📅 Job de fechamento semanal agendado para domingos às 00:00");
}

/**
 * Inicia o job de verificação de cobranças vencidas
 * Executa todo dia às 08:00
 */
export function startOverdueCheckJob(): void {
  cron.schedule(
    "0 0 8 * * *",
    async () => {
      console.log("🔍 Verificando cobranças vencidas...");

      try {
        await checkOverdueCharges();
      } catch (error) {
        console.error("❌ Erro na verificação de cobranças vencidas:", error);
      }
    },
    {
      timezone: "America/Sao_Paulo",
    }
  );

  console.log("📅 Job de verificação de vencidas agendado para 08:00 diariamente");
}

/**
 * Executa fechamento manualmente (para testes)
 */
export async function runWeeklyClosingManually(): Promise<void> {
  console.log("🔄 Executando fechamento semanal manualmente...");
  const results = await executeWeeklyClosingJob();
  console.log(`Resultado: ${results.length} empresas processadas`);
}
