/**
 * Job de Emissão de Notas Fiscais Mensais (NFS-e)
 * Executa no último dia de cada mês às 23:59
 * Gera notas fiscais consolidadas para todas as empresas ativas
 */

import cron from "node-cron";
import { processAllCompaniesMonthlyInvoices } from "./services/wallet/invoiceService";
import { storage } from "./storage";

let isJobRunning = false;

/**
 * Verifica se hoje é o último dia do mês
 */
function isLastDayOfMonth(): boolean {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getDate() === 1;
}

/**
 * Inicia o job de emissão de notas fiscais mensais
 */
export function startMonthlyInvoiceJob(): void {
  // Executa todos os dias 28-31 às 23:59, mas só processa se for último dia do mês
  // Formato: segundo minuto hora dia-do-mês mês dia-da-semana
  cron.schedule(
    "59 23 28-31 * *",
    async () => {
      // Verifica se é o último dia do mês
      if (!isLastDayOfMonth()) {
        console.log("📅 Não é o último dia do mês, pulando emissão de NFS-e");
        return;
      }

      // Verifica se NFS-e está habilitado
      const settings = await storage.getSettings();
      if (!settings?.nfseEnabled) {
        console.log("📄 Emissão de NFS-e desabilitada nas configurações");
        return;
      }

      if (!settings?.nfseAutoEmit) {
        console.log("📄 Emissão automática de NFS-e desabilitada nas configurações");
        return;
      }

      if (isJobRunning) {
        console.log("⚠️ Job de emissão de NFS-e já está em execução");
        return;
      }

      isJobRunning = true;
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📄 EMISSÃO DE NFS-e MENSAL - " + new Date().toLocaleString("pt-BR"));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      try {
        const results = await processAllCompaniesMonthlyInvoices();

        // Log dos resultados
        const successful = results.filter((r) => r.success && r.invoiceId);
        const skipped = results.filter((r) => r.success && !r.invoiceId);
        const failed = results.filter((r) => !r.success);

        console.log(`\n📊 RESUMO:`);
        console.log(`   Empresas processadas: ${results.length}`);
        console.log(`   NFS-e emitidas: ${successful.length}`);
        console.log(`   Sem faturamento: ${skipped.length}`);
        console.log(`   Falhas: ${failed.length}`);

        if (successful.length > 0) {
          const totalAmount = successful.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
          const totalCharges = successful.reduce((sum, r) => sum + (r.chargesCount || 0), 0);
          console.log(`   Total faturado: R$ ${totalAmount.toFixed(2)}`);
          console.log(`   Total cobranças: ${totalCharges}`);
        }

        if (failed.length > 0) {
          console.log(`\n❌ FALHAS:`);
          failed.forEach((r) => {
            console.log(`   - ${r.companyName}: ${r.error}`);
          });
        }
      } catch (error) {
        console.error("❌ Erro no job de emissão de NFS-e:", error);
      } finally {
        isJobRunning = false;
      }
    },
    {
      timezone: "America/Sao_Paulo",
    }
  );

  console.log("📄 Job de emissão de NFS-e agendado para último dia do mês às 23:59");
}

/**
 * Executa emissão de NFS-e manualmente (para testes ou execução sob demanda)
 * @param month Mês (1-12). Se não informado, usa o mês atual.
 * @param year Ano. Se não informado, usa o ano atual.
 */
export async function runMonthlyInvoiceManually(
  month?: number,
  year?: number
): Promise<void> {
  const settings = await storage.getSettings();
  if (!settings?.nfseEnabled) {
    console.log("❌ Emissão de NFS-e desabilitada nas configurações");
    return;
  }

  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  console.log(`🔄 Executando emissão de NFS-e manualmente para ${targetMonth}/${targetYear}...`);

  const results = await processAllCompaniesMonthlyInvoices(targetMonth, targetYear);

  const successful = results.filter((r) => r.success && r.invoiceId);
  console.log(`\n📊 Resultado: ${successful.length}/${results.length} NFS-e emitidas`);

  if (successful.length > 0) {
    const totalAmount = successful.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    console.log(`   Total faturado: R$ ${totalAmount.toFixed(2)}`);
  }
}

/**
 * Emite NFS-e para uma empresa específica (execução manual)
 */
export async function runInvoiceForCompany(
  companyId: string,
  month?: number,
  year?: number
): Promise<void> {
  const { emitMonthlyInvoice } = await import("./services/wallet/invoiceService");

  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  console.log(`🔄 Emitindo NFS-e para empresa ${companyId} - ${targetMonth}/${targetYear}...`);

  const result = await emitMonthlyInvoice(companyId, targetMonth, targetYear);

  if (result.success) {
    console.log(`✅ NFS-e emitida: ${result.invoice?.id}`);
  } else {
    console.log(`❌ Erro: ${result.error}`);
  }
}
