/**
 * Serviço de Fechamento Semanal
 * Gera boletos para empresas pós-pagas e processa pagamentos
 */

import { storage } from "../../storage";
import { db } from "../../db";
import { charges, deliveryFinancials, companies, allocations } from "@shared/schema";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { createOrUpdateCustomer } from "../asaas/customers";
import { createBoletoPayment, createPixPayment } from "../asaas/payments";
import {
  getCompanyWallet,
  getDriverWallet,
  getPlatformWallet,
  creditWallet,
} from "./walletService";
import type { Charge, DeliveryFinancial, Company } from "@shared/schema";

interface WeeklyClosingResult {
  companyId: string;
  companyName: string;
  success: boolean;
  chargeId?: string;
  totalAmount?: number;
  deliveriesCount?: number;
  allocationsCount?: number;
  error?: string;
}

interface DateFilter {
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Processa fechamento semanal de uma empresa pós-pago
 */
export async function processCompanyWeeklyClosing(
  companyId: string,
  dateFilter?: DateFilter
): Promise<WeeklyClosingResult> {
  try {
    // Busca empresa
    const company = await storage.getCompany(companyId);
    if (!company) {
      throw new Error("Empresa não encontrada");
    }

    if (company.paymentType !== "BOLETO") {
      throw new Error("Empresa não está em modalidade pós-pago");
    }

    // Import additional operators for date filtering
    const { gte, lte } = await import("drizzle-orm");

    // Build conditions array
    const conditions: any[] = [
      eq(deliveryFinancials.companyId, companyId),
      eq(deliveryFinancials.processed, false),
      isNull(deliveryFinancials.chargeId),
    ];

    // Add date filters if provided
    if (dateFilter?.dateFrom) {
      conditions.push(gte(deliveryFinancials.createdAt, dateFilter.dateFrom));
    }
    if (dateFilter?.dateTo) {
      const dateTo = new Date(dateFilter.dateTo);
      dateTo.setHours(23, 59, 59, 999);
      conditions.push(lte(deliveryFinancials.createdAt, dateTo));
    }

    // Busca entregas não processadas (sem cobrança vinculada)
    const unprocessedDeliveries = await db
      .select()
      .from(deliveryFinancials)
      .where(and(...conditions));

    // Busca alocações não processadas (completed ou released_early, sem chargeId)
    const allocationConditions: any[] = [
      eq(allocations.companyId, companyId),
      isNull(allocations.chargeId),
      inArray(allocations.status, ["completed", "released_early"]),
    ];

    // Filtrar alocações pelo período (usando allocationDate)
    if (dateFilter?.dateFrom) {
      const dateFromStr = dateFilter.dateFrom.toISOString().split('T')[0];
      allocationConditions.push(gte(allocations.allocationDate, dateFromStr));
    }
    if (dateFilter?.dateTo) {
      const dateToStr = dateFilter.dateTo.toISOString().split('T')[0];
      allocationConditions.push(lte(allocations.allocationDate, dateToStr));
    }

    const unprocessedAllocations = await db
      .select()
      .from(allocations)
      .where(and(...allocationConditions));

    if (unprocessedDeliveries.length === 0 && unprocessedAllocations.length === 0) {
      console.log(`ℹ️ Empresa ${company.name}: nenhuma entrega ou alocação para cobrar`);
      return {
        companyId,
        companyName: company.name,
        success: true,
        deliveriesCount: 0,
        allocationsCount: 0,
      };
    }

    // Calcula total de entregas
    const deliveriesTotal = unprocessedDeliveries.reduce(
      (sum, d) => sum + parseFloat(d.totalAmount),
      0
    );

    // Calcula total de alocações
    const allocationsTotal = unprocessedAllocations.reduce(
      (sum, a) => sum + parseFloat(a.totalAmount),
      0
    );

    // Total geral
    const totalAmount = deliveriesTotal + allocationsTotal;

    // Define período (usa filtro de data se fornecido, senão usa as datas das entregas/alocações)
    const allDates: number[] = [];
    unprocessedDeliveries.forEach((d) => allDates.push(new Date(d.createdAt!).getTime()));
    unprocessedAllocations.forEach((a) => allDates.push(new Date(a.allocationDate).getTime()));

    const periodStart = dateFilter?.dateFrom || new Date(Math.min(...allDates));
    const periodEnd = dateFilter?.dateTo || new Date(Math.max(...allDates));

    console.log(`📊 Fechamento empresa ${company.name}:`);
    console.log(`   Entregas: ${unprocessedDeliveries.length} (R$ ${deliveriesTotal.toFixed(2)})`);
    console.log(`   Alocações: ${unprocessedAllocations.length} (R$ ${allocationsTotal.toFixed(2)})`);
    console.log(`   Total: R$ ${totalAmount.toFixed(2)}`);
    console.log(`   Período: ${periodStart.toLocaleDateString("pt-BR")} a ${periodEnd.toLocaleDateString("pt-BR")}`);

    // Busca ou cria wallet
    const wallet = await getCompanyWallet(companyId);

    // Cria cliente no Asaas
    const asaasCustomer = await createOrUpdateCustomer(company);

    // Data de vencimento (2 dias após fechamento)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);

    // Monta descrição do boleto
    const descriptionParts: string[] = [];
    if (unprocessedDeliveries.length > 0) {
      descriptionParts.push(`${unprocessedDeliveries.length} entrega(s)`);
    }
    if (unprocessedAllocations.length > 0) {
      descriptionParts.push(`${unprocessedAllocations.length} alocação(ões)`);
    }
    const description = `${descriptionParts.join(" + ")} - ${periodStart.toLocaleDateString("pt-BR")} a ${periodEnd.toLocaleDateString("pt-BR")}`;

    // Cria cobrança (boleto com QR Code PIX)
    const { payment, boleto } = await createBoletoPayment({
      customerId: asaasCustomer.id,
      value: totalAmount,
      description,
      externalReference: `weekly_${companyId}_${Date.now()}`,
      dueDate,
    });

    // Também gera QR Code PIX para pagamento rápido
    let pixData = null;
    try {
      const { pix } = await createPixPayment({
        customerId: asaasCustomer.id,
        value: totalAmount,
        description,
        externalReference: `weekly_pix_${companyId}_${Date.now()}`,
        dueDate,
      });
      pixData = pix;
    } catch (e) {
      console.log("⚠️ Não foi possível gerar PIX adicional");
    }

    // Salva cobrança
    const [charge] = await db
      .insert(charges)
      .values({
        companyId,
        walletId: wallet.id,
        asaasId: payment.id,
        asaasCustomerId: asaasCustomer.id,
        chargeType: "weekly",
        paymentMethod: "boleto",
        amount: totalAmount.toFixed(2),
        dueDate,
        status: "waiting_payment",
        boletoUrl: payment.bankSlipUrl || null,
        boletoBarcode: boleto.barCode,
        boletoDigitableLine: boleto.identificationField,
        pixCopyPaste: pixData?.payload || null,
        pixQrCodeUrl: pixData?.encodedImage || null,
        periodStart,
        periodEnd,
        metadata: {
          deliveriesIds: unprocessedDeliveries.map((d) => d.id),
          deliveriesCount: unprocessedDeliveries.length,
          allocationsIds: unprocessedAllocations.map((a) => a.id),
          allocationsCount: unprocessedAllocations.length,
          deliveriesTotal: deliveriesTotal.toFixed(2),
          allocationsTotal: allocationsTotal.toFixed(2),
          pixAsaasId: pixData?.id || null,
        },
      })
      .returning();

    // Vincula entregas à cobrança
    if (unprocessedDeliveries.length > 0) {
      await db
        .update(deliveryFinancials)
        .set({ chargeId: charge.id })
        .where(
          sql`${deliveryFinancials.id} IN (${sql.join(
            unprocessedDeliveries.map((d) => sql`${d.id}`),
            sql`, `
          )})`
        );
    }

    // Vincula alocações à cobrança
    if (unprocessedAllocations.length > 0) {
      await db
        .update(allocations)
        .set({ chargeId: charge.id })
        .where(
          sql`${allocations.id} IN (${sql.join(
            unprocessedAllocations.map((a) => sql`${a.id}`),
            sql`, `
          )})`
        );
    }

    console.log(`✅ Cobrança semanal criada: ${charge.id}`);

    return {
      companyId,
      companyName: company.name,
      success: true,
      chargeId: charge.id,
      totalAmount,
      deliveriesCount: unprocessedDeliveries.length,
      allocationsCount: unprocessedAllocations.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`❌ Erro no fechamento da empresa ${companyId}:`, errorMessage);

    return {
      companyId,
      companyName: "",
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Confirma pagamento de cobrança semanal
 * Credita entregadores e comissão da plataforma
 */
export async function confirmWeeklyPayment(
  chargeId: string,
  paymentData: {
    paidAt?: Date;
    netValue?: number;
    asaasData?: Record<string, unknown>;
  }
): Promise<{ charge: Charge; deliveriesProcessed: number; allocationsProcessed: number }> {
  // Busca cobrança
  const charge = await storage.getCharge(chargeId);
  if (!charge) {
    throw new Error("Cobrança não encontrada");
  }

  // Verifica se já foi processada
  if (charge.status === "confirmed") {
    console.log(`⚠️ Cobrança semanal ${chargeId} já foi processada`);
    return { charge, deliveriesProcessed: 0, allocationsProcessed: 0 };
  }

  // Atualiza status da cobrança
  const updatedCharge = await storage.updateCharge(chargeId, {
    status: "confirmed",
    paidAt: paymentData.paidAt || new Date(),
    netAmount: paymentData.netValue?.toFixed(2) || charge.amount,
    metadata: {
      ...(charge.metadata as Record<string, unknown> || {}),
      ...paymentData.asaasData,
    },
  });

  if (!updatedCharge) {
    throw new Error("Erro ao atualizar cobrança");
  }

  // Busca entregas vinculadas não processadas
  const deliveries = await db
    .select()
    .from(deliveryFinancials)
    .where(
      and(
        eq(deliveryFinancials.chargeId, chargeId),
        eq(deliveryFinancials.processed, false)
      )
    );

  console.log(`💰 Processando ${deliveries.length} entregas do fechamento semanal`);

  // Wallet da plataforma
  const platformWallet = await getPlatformWallet();

  // Processa cada entrega
  for (const delivery of deliveries) {
    try {
      // Busca wallet do entregador
      const driverWallet = await getDriverWallet(delivery.driverId);

      // Credita entregador
      const driverCredit = await creditWallet(
        driverWallet.id,
        parseFloat(delivery.driverAmount),
        "delivery_credit",
        {
          requestId: delivery.requestId || undefined,
          chargeId: charge.id,
          description: "Entrega (pós-pago)",
        }
      );

      // Credita comissão
      const commissionCredit = await creditWallet(
        platformWallet.id,
        parseFloat(delivery.commissionAmount),
        "commission",
        {
          requestId: delivery.requestId || undefined,
          chargeId: charge.id,
          description: "Comissão entrega (pós-pago)",
        }
      );

      // Marca como processada
      await db
        .update(deliveryFinancials)
        .set({
          processed: true,
          processedAt: new Date(),
          driverCreditTransactionId: driverCredit.transaction.id,
          commissionTransactionId: commissionCredit.transaction.id,
        })
        .where(eq(deliveryFinancials.id, delivery.id));

      console.log(`  ✅ Entrega ${delivery.id} processada`);
    } catch (error) {
      console.error(`  ❌ Erro na entrega ${delivery.id}:`, error);
    }
  }

  // Busca alocações vinculadas não processadas
  const allocationsToPay = await db
    .select()
    .from(allocations)
    .where(eq(allocations.chargeId, chargeId));

  console.log(`💰 Processando ${allocationsToPay.length} alocações do fechamento semanal`);

  // Processa cada alocação
  for (const allocation of allocationsToPay) {
    try {
      // Se tem motorista alocado, credita
      if (allocation.driverId && allocation.driverAmount) {
        // Busca wallet do entregador
        const driverWallet = await getDriverWallet(allocation.driverId);

        // Credita entregador
        await creditWallet(
          driverWallet.id,
          parseFloat(allocation.driverAmount),
          "allocation_credit",
          {
            allocationId: allocation.id,
            chargeId: charge.id,
            description: "Alocação (pós-pago)",
          }
        );
      }

      // Credita comissão da plataforma
      if (allocation.commissionAmount) {
        await creditWallet(
          platformWallet.id,
          parseFloat(allocation.commissionAmount),
          "allocation_commission",
          {
            allocationId: allocation.id,
            chargeId: charge.id,
            description: "Comissão alocação (pós-pago)",
          }
        );
      }

      console.log(`  ✅ Alocação ${allocation.id} processada`);
    } catch (error) {
      console.error(`  ❌ Erro na alocação ${allocation.id}:`, error);
    }
  }

  console.log(`✅ Pagamento semanal confirmado: ${chargeId}`);

  return {
    charge: updatedCharge,
    deliveriesProcessed: deliveries.length,
    allocationsProcessed: allocationsToPay.length,
  };
}

/**
 * Executa fechamento de todas as empresas pós-pago
 * Deve ser agendado para rodar todo domingo às 00:00
 */
export async function executeWeeklyClosingJob(): Promise<WeeklyClosingResult[]> {
  console.log("🔄 Iniciando fechamento semanal...");

  // Busca empresas pós-pago com entregas pendentes
  const companiesWithPendingDeliveries = await db
    .selectDistinct({ companyId: deliveryFinancials.companyId })
    .from(deliveryFinancials)
    .innerJoin(companies, eq(companies.id, deliveryFinancials.companyId))
    .where(
      and(
        eq(deliveryFinancials.processed, false),
        isNull(deliveryFinancials.chargeId),
        eq(companies.paymentType, "BOLETO")
      )
    );

  console.log(`📋 Empresas para processar: ${companiesWithPendingDeliveries.length}`);

  const results: WeeklyClosingResult[] = [];

  for (const { companyId } of companiesWithPendingDeliveries) {
    const result = await processCompanyWeeklyClosing(companyId);
    results.push(result);
  }

  // Resumo
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Resumo do fechamento semanal:");
  console.log(`   Total: ${results.length} empresas`);
  console.log(`   Sucesso: ${successful.length}`);
  console.log(`   Falhas: ${failed.length}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (failed.length > 0) {
    console.log("❌ Empresas com falha:");
    failed.forEach((r) => console.log(`   - ${r.companyId}: ${r.error}`));
  }

  return results;
}

/**
 * Bloqueia empresa por inadimplência
 */
export async function blockCompanyForOverdue(companyId: string): Promise<void> {
  await storage.updateCompany(companyId, { active: false });
  console.log(`🚫 Empresa ${companyId} bloqueada por inadimplência`);
}

/**
 * Verifica e bloqueia empresas com boletos vencidos
 */
export async function checkOverdueCharges(): Promise<void> {
  console.log("🔍 Verificando cobranças vencidas...");

  // Busca cobranças vencidas ainda aguardando pagamento
  const overdueCharges = await db
    .select()
    .from(charges)
    .where(
      and(
        eq(charges.status, "waiting_payment"),
        eq(charges.chargeType, "weekly"),
        sql`${charges.dueDate} < CURRENT_DATE`
      )
    );

  console.log(`📋 Cobranças vencidas: ${overdueCharges.length}`);

  for (const charge of overdueCharges) {
    // Atualiza status
    await storage.updateCharge(charge.id, { status: "overdue" });

    // Bloqueia empresa
    await blockCompanyForOverdue(charge.companyId);
  }
}
