/**
 * Serviço de Notas Fiscais
 * Gerencia emissão e controle de NFS-e
 */

import { storage } from "../../storage";
import { db } from "../../db";
import { invoices, charges, companies } from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import {
  scheduleInvoice,
  getInvoice as getAsaasInvoice,
  cancelInvoice as cancelAsaasInvoice,
  getMunicipalServices,
  getMunicipalOptions,
} from "../asaas/invoices";
import { createOrUpdateCustomer } from "../asaas/customers";
import type { Invoice, Company, Settings } from "@shared/schema";

// ========== INTERFACES ==========

interface EmitInvoiceResult {
  success: boolean;
  invoice?: Invoice;
  error?: string;
}

interface MonthlyInvoiceResult {
  companyId: string;
  companyName: string;
  success: boolean;
  invoiceId?: string;
  totalAmount?: number;
  chargesCount?: number;
  error?: string;
}

interface AsaasInvoiceWebhookData {
  id: string;
  status: string;
  number?: string;
  validationCode?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  statusDescription?: string;
  payment?: string;
}

// ========== FUNÇÕES AUXILIARES ==========

/**
 * Mapeia status do Asaas para status interno
 */
function mapAsaasStatus(asaasStatus: string): string {
  const statusMap: Record<string, string> = {
    SCHEDULED: "scheduled",
    SYNCHRONIZED: "synchronized",
    AUTHORIZED: "authorized",
    ERROR: "error",
    PROCESSING_CANCELLATION: "processing_cancellation",
    CANCELED: "cancelled",
    CANCELLATION_DENIED: "cancellation_denied",
  };

  return statusMap[asaasStatus] || "scheduled";
}

/**
 * Obtém primeiro e último dia do mês
 */
function getMonthDateRange(month: number, year: number): { startDate: Date; endDate: Date } {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999); // Último dia do mês
  return { startDate, endDate };
}

// ========== FUNÇÕES PRINCIPAIS ==========

/**
 * Calcula total de cobranças pagas de uma empresa no mês
 */
export async function calculateMonthlyTotal(
  companyId: string,
  month: number,
  year: number
): Promise<{ total: number; chargesCount: number; chargeIds: string[] }> {
  const { startDate, endDate } = getMonthDateRange(month, year);

  const paidCharges = await db
    .select()
    .from(charges)
    .where(
      and(
        eq(charges.companyId, companyId),
        eq(charges.status, "confirmed"),
        gte(charges.paidAt, startDate),
        lte(charges.paidAt, endDate)
      )
    );

  const total = paidCharges.reduce((sum, charge) => sum + parseFloat(charge.amount), 0);
  const chargeIds = paidCharges.map(c => c.id);

  return {
    total,
    chargesCount: paidCharges.length,
    chargeIds,
  };
}

/**
 * Verifica se já existe nota fiscal para o mês/ano da empresa
 */
export async function getExistingMonthlyInvoice(
  companyId: string,
  month: number,
  year: number
): Promise<Invoice | null> {
  const [existing] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.companyId, companyId),
        eq(invoices.competenceMonth, month),
        eq(invoices.competenceYear, year)
      )
    );

  return existing || null;
}

/**
 * Emite nota fiscal mensal consolidada para uma empresa
 */
export async function emitMonthlyInvoice(
  companyId: string,
  month: number,
  year: number
): Promise<EmitInvoiceResult> {
  try {
    // Busca empresa
    const company = await storage.getCompany(companyId);
    if (!company) {
      return { success: false, error: "Empresa não encontrada" };
    }

    if (!company.active) {
      return { success: false, error: "Empresa está inativa" };
    }

    // Busca configurações fiscais
    const settings = await storage.getSettings();
    if (!settings?.nfseEnabled) {
      return { success: false, error: "Emissão de NFS-e não está habilitada" };
    }

    // Verifica se já existe nota para este mês
    const existingInvoice = await getExistingMonthlyInvoice(companyId, month, year);
    if (existingInvoice) {
      console.log(`NFS-e já existe para empresa ${companyId} - ${month}/${year}`);
      return { success: true, invoice: existingInvoice };
    }

    // Calcula total do mês
    const { total, chargesCount, chargeIds } = await calculateMonthlyTotal(companyId, month, year);

    if (total <= 0) {
      console.log(`Nenhum valor para faturar para empresa ${companyId} - ${month}/${year}`);
      return { success: false, error: "Nenhum valor para faturar no período" };
    }

    // Garante que o cliente existe no Asaas
    let asaasCustomerId = company.asaasCustomerId;
    if (!asaasCustomerId) {
      const asaasCustomer = await createOrUpdateCustomer(company);
      asaasCustomerId = asaasCustomer.id;
      // Atualiza empresa com ID do Asaas
      await storage.updateCompany(companyId, { asaasCustomerId });
    }

    // Determina data de competência (último dia do mês)
    const { endDate } = getMonthDateRange(month, year);

    // Monta descrição do serviço
    const monthName = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long" });
    const serviceDescription = settings.nfseDefaultDescription ||
      `Serviços de entrega - Competência ${monthName} de ${year}`;

    // Prepara dados de impostos
    const taxes = {
      retainIss: settings.nfseIssRetained ?? false,
      iss: parseFloat(settings.nfseIssRate || "0"),
      cofins: parseFloat(settings.nfseCofinsRate || "0"),
      csll: parseFloat(settings.nfseCsllRate || "0"),
      inss: parseFloat(settings.nfseInssRate || "0"),
      ir: parseFloat(settings.nfseIrRate || "0"),
      pis: parseFloat(settings.nfsePisRate || "0"),
    };

    // Agenda nota fiscal no Asaas
    const asaasInvoice = await scheduleInvoice({
      customer: asaasCustomerId,
      serviceDescription,
      value: total,
      effectiveDate: endDate,
      municipalServiceCode: settings.nfseMunicipalServiceCode || undefined,
      municipalServiceName: settings.nfseMunicipalServiceName || undefined,
      observations: `Referente a ${chargesCount} cobrança(s) do período`,
      externalReference: `${companyId}-${year}-${month.toString().padStart(2, "0")}`,
      taxes,
    });

    // Salva no banco
    const [invoice] = await db
      .insert(invoices)
      .values({
        companyId,
        asaasId: asaasInvoice.id,
        asaasCustomerId,
        serviceDescription,
        municipalServiceCode: settings.nfseMunicipalServiceCode,
        municipalServiceName: settings.nfseMunicipalServiceName,
        value: total.toFixed(2),
        effectiveDate: endDate,
        competenceMonth: month,
        competenceYear: year,
        status: mapAsaasStatus(asaasInvoice.status),
        issRate: taxes.iss.toFixed(2),
        issRetained: taxes.retainIss,
        cofinsRate: taxes.cofins.toFixed(2),
        csllRate: taxes.csll.toFixed(2),
        inssRate: taxes.inss.toFixed(2),
        irRate: taxes.ir.toFixed(2),
        pisRate: taxes.pis.toFixed(2),
        observations: `Referente a ${chargesCount} cobrança(s): ${chargeIds.join(", ")}`,
        metadata: {
          asaasResponse: asaasInvoice,
          chargeIds,
          chargesCount,
        },
      })
      .returning();

    console.log(`NFS-e criada: ${invoice.id} para empresa ${companyId} - ${month}/${year} - R$ ${total}`);

    return { success: true, invoice };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`Erro ao emitir NFS-e para empresa ${companyId}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Processa emissão de notas fiscais mensais para todas as empresas ativas
 * Chamado pelo cron job no último dia do mês
 */
export async function processAllCompaniesMonthlyInvoices(
  month?: number,
  year?: number
): Promise<MonthlyInvoiceResult[]> {
  const settings = await storage.getSettings();
  if (!settings?.nfseEnabled) {
    console.log("Emissão de NFS-e desabilitada. Pulando processamento.");
    return [];
  }

  // Se não informado, usa o mês atual
  const now = new Date();
  const targetMonth = month ?? now.getMonth() + 1;
  const targetYear = year ?? now.getFullYear();

  console.log(`Iniciando emissão de NFS-e para ${targetMonth}/${targetYear}`);

  // Busca todas as empresas ativas
  const activeCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.active, true));

  const results: MonthlyInvoiceResult[] = [];

  for (const company of activeCompanies) {
    try {
      // Calcula total primeiro para verificar se há algo para faturar
      const { total, chargesCount } = await calculateMonthlyTotal(company.id, targetMonth, targetYear);

      if (total <= 0) {
        results.push({
          companyId: company.id,
          companyName: company.name,
          success: true,
          totalAmount: 0,
          chargesCount: 0,
        });
        continue;
      }

      // Emite nota fiscal
      const result = await emitMonthlyInvoice(company.id, targetMonth, targetYear);

      results.push({
        companyId: company.id,
        companyName: company.name,
        success: result.success,
        invoiceId: result.invoice?.id,
        totalAmount: total,
        chargesCount,
        error: result.error,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      results.push({
        companyId: company.id,
        companyName: company.name,
        success: false,
        error: errorMessage,
      });
    }
  }

  const successful = results.filter(r => r.success && r.invoiceId).length;
  const total = results.length;
  console.log(`Emissão de NFS-e concluída: ${successful}/${total} empresas processadas`);

  return results;
}

/**
 * Processa webhook de nota fiscal do Asaas
 */
export async function handleInvoiceWebhook(
  webhookData: AsaasInvoiceWebhookData
): Promise<Invoice | null> {
  // Busca invoice pelo asaasId
  const invoice = await getInvoiceByAsaasId(webhookData.id);
  if (!invoice) {
    console.log(`Invoice não encontrada para asaasId: ${webhookData.id}`);
    return null;
  }

  // Monta dados para atualização
  const updateData: Partial<Invoice> = {
    status: mapAsaasStatus(webhookData.status),
    statusDescription: webhookData.statusDescription || null,
    invoiceNumber: webhookData.number || invoice.invoiceNumber,
    verificationCode: webhookData.validationCode || invoice.verificationCode,
    pdfUrl: webhookData.pdfUrl || invoice.pdfUrl,
    xmlUrl: webhookData.xmlUrl || invoice.xmlUrl,
    updatedAt: new Date(),
  };

  // Se autorizada, marca data de emissão
  if (webhookData.status === "AUTHORIZED") {
    updateData.issuedAt = new Date();
  }

  // Se cancelada, marca data de cancelamento
  if (webhookData.status === "CANCELED" || webhookData.status === "CANCELLATION_DENIED") {
    updateData.cancelledAt = new Date();
  }

  // Se erro, guarda mensagem
  if (webhookData.status === "ERROR" && webhookData.statusDescription) {
    updateData.errorMessage = webhookData.statusDescription;
  }

  const [updatedInvoice] = await db
    .update(invoices)
    .set(updateData)
    .where(eq(invoices.id, invoice.id))
    .returning();

  console.log(`Invoice ${invoice.id} atualizada: ${updateData.status}`);

  return updatedInvoice;
}

/**
 * Lista notas fiscais de uma empresa
 */
export async function getCompanyInvoices(
  companyId: string,
  options?: { year?: number; status?: string; limit?: number }
): Promise<Invoice[]> {
  let query = db.select().from(invoices).where(eq(invoices.companyId, companyId));

  if (options?.year) {
    query = query.where(eq(invoices.competenceYear, options.year)) as typeof query;
  }

  if (options?.status) {
    query = query.where(eq(invoices.status, options.status)) as typeof query;
  }

  const result = await query
    .orderBy(desc(invoices.competenceYear), desc(invoices.competenceMonth))
    .limit(options?.limit || 100);

  return result;
}

/**
 * Busca nota fiscal por ID
 */
export async function getInvoiceById(id: string): Promise<Invoice | undefined> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
  return invoice || undefined;
}

/**
 * Busca nota fiscal por asaasId
 */
export async function getInvoiceByAsaasId(asaasId: string): Promise<Invoice | undefined> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.asaasId, asaasId));
  return invoice || undefined;
}

/**
 * Busca nota fiscal por chargeId
 */
export async function getInvoiceByChargeId(chargeId: string): Promise<Invoice | undefined> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.chargeId, chargeId));
  return invoice || undefined;
}

/**
 * Cancela nota fiscal
 */
export async function cancelInvoiceById(invoiceId: string): Promise<Invoice> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error("Nota fiscal não encontrada");
  }

  if (!invoice.asaasId) {
    throw new Error("Nota fiscal sem ID do Asaas");
  }

  if (invoice.status === "cancelled") {
    throw new Error("Nota fiscal já está cancelada");
  }

  if (invoice.status !== "scheduled" && invoice.status !== "authorized") {
    throw new Error(`Não é possível cancelar nota fiscal com status: ${invoice.status}`);
  }

  // Cancela no Asaas
  await cancelAsaasInvoice(invoice.asaasId);

  // Atualiza status local
  const [updatedInvoice] = await db
    .update(invoices)
    .set({
      status: "processing_cancellation",
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  console.log(`Solicitação de cancelamento enviada para NFS-e: ${invoiceId}`);

  return updatedInvoice;
}

/**
 * Atualiza nota fiscal consultando status no Asaas
 */
export async function syncInvoiceStatus(invoiceId: string): Promise<Invoice | null> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice || !invoice.asaasId) {
    return null;
  }

  try {
    const asaasInvoice = await getAsaasInvoice(invoice.asaasId);

    const [updatedInvoice] = await db
      .update(invoices)
      .set({
        status: mapAsaasStatus(asaasInvoice.status),
        invoiceNumber: asaasInvoice.number || invoice.invoiceNumber,
        verificationCode: asaasInvoice.validationCode || invoice.verificationCode,
        pdfUrl: asaasInvoice.pdfUrl || invoice.pdfUrl,
        xmlUrl: asaasInvoice.xmlUrl || invoice.xmlUrl,
        issuedAt: asaasInvoice.status === "AUTHORIZED" && !invoice.issuedAt ? new Date() : invoice.issuedAt,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    return updatedInvoice;
  } catch (error) {
    console.error(`Erro ao sincronizar status da NFS-e ${invoiceId}:`, error);
    return null;
  }
}

/**
 * Lista serviços municipais disponíveis
 */
export async function listMunicipalServices() {
  return getMunicipalServices();
}

/**
 * Obtém lista de empresas com valores pendentes de faturamento para um mês
 * Retorna empresas que têm cobranças pagas no mês mas ainda não têm NFS-e emitida
 */
export async function getCompaniesWithPendingInvoices(
  month: number,
  year: number
): Promise<Array<{
  companyId: string;
  companyName: string;
  cnpj: string | null;
  pendingAmount: number;
  chargesCount: number;
  hasInvoice: boolean;
  invoiceStatus?: string;
  invoiceId?: string;
}>> {
  // Busca todas as empresas ativas
  const activeCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.active, true));

  const results = [];

  for (const company of activeCompanies) {
    // Calcula total do mês
    const { total, chargesCount } = await calculateMonthlyTotal(company.id, month, year);

    // Verifica se já existe nota para este mês
    const existingInvoice = await getExistingMonthlyInvoice(company.id, month, year);

    // Só inclui se tiver valor para faturar
    if (total > 0 || existingInvoice) {
      results.push({
        companyId: company.id,
        companyName: company.name,
        cnpj: company.cnpj || null,
        pendingAmount: total,
        chargesCount,
        hasInvoice: !!existingInvoice,
        invoiceStatus: existingInvoice?.status,
        invoiceId: existingInvoice?.id,
      });
    }
  }

  // Ordena por valor pendente (maior primeiro), depois por nome
  return results.sort((a, b) => {
    // Primeiro, empresas sem nota fiscal
    if (a.hasInvoice !== b.hasInvoice) {
      return a.hasInvoice ? 1 : -1;
    }
    // Depois, por valor decrescente
    if (a.pendingAmount !== b.pendingAmount) {
      return b.pendingAmount - a.pendingAmount;
    }
    // Por fim, por nome
    return a.companyName.localeCompare(b.companyName);
  });
}

/**
 * Obtém opções de configuração municipal
 */
export async function getMunicipalOptionsConfig() {
  return getMunicipalOptions();
}
