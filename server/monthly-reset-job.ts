import { storage } from "./storage";
import cron from "node-cron";

/**
 * Job que reseta os contadores mensais de entregas dos motoristas
 * Roda todos os dias à meia-noite e verifica se é o último dia do mês
 */
export function startMonthlyResetJob() {
  // Roda todos os dias à meia-noite (00:00)
  cron.schedule("0 0 * * *", async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Verifica se amanhã é dia 1 (ou seja, hoje é o último dia do mês)
      if (tomorrow.getDate() === 1) {
        console.log(`\n🗓️  Último dia do mês (${today.toLocaleDateString('pt-BR')}) - Resetando contadores mensais...`);
        await storage.resetMonthlyDeliveryCounters();
      }
    } catch (error) {
      console.error("❌ Erro no job de reset mensal:", error);
    }
  });

  console.log("✓ Job de reset mensal de entregas iniciado (verifica diariamente à meia-noite)");
}
