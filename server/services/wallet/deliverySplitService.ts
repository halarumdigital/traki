/**
 * Serviço de Split de Entregas
 * Gerencia o split de pagamentos: empresa -> entregador + plataforma
 */

import { storage } from "../../storage";
import { db } from "../../db";
import { deliveryFinancials, companies, requestBills } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  getCompanyWallet,
  getDriverWallet,
  getPlatformWallet,
  debitWallet,
  creditWallet,
  hasEnoughBalance,
} from "./walletService";
import type { DeliveryFinancial, Request } from "@shared/schema";

interface SplitResult {
  totalAmount: number;
  driverAmount: number;
  commissionAmount: number;
  commissionPercentage: number;
  companyDebitTransactionId: string;
  driverCreditTransactionId: string;
  commissionTransactionId: string;
}

/**
 * Calcula a comissão baseada no commissionTiers do motorista
 */
async function calculateCommission(driverId: string): Promise<number> {
  const commissionPercentage = await storage.getDriverCommissionPercentage(driverId);
  return commissionPercentage;
}

/**
 * Processa split de entrega para empresa PRÉ-PAGA
 * Debita empresa imediatamente e credita entregador + plataforma
 */
export async function processPrePaidDeliverySplit(
  request: Request,
  deliveryAmount: number
): Promise<SplitResult> {
  const companyId = request.companyId;
  const driverId = request.driverId;

  if (!companyId || !driverId) {
    throw new Error("Entrega deve ter empresa e motorista associados");
  }

  // Verifica se empresa é pré-pago
  const company = await storage.getCompany(companyId);
  if (!company) {
    throw new Error("Empresa não encontrada");
  }

  if (company.paymentType !== "PRE_PAGO") {
    throw new Error("Esta função é apenas para empresas pré-pagas");
  }

  // Verifica saldo
  const hasBalance = await hasEnoughBalance(companyId, deliveryAmount);
  if (!hasBalance) {
    throw new Error("Empresa não tem saldo suficiente para esta entrega");
  }

  // Calcula comissão
  const commissionPercentage = await calculateCommission(driverId);
  const commissionAmount = Math.round(deliveryAmount * (commissionPercentage / 100) * 100) / 100;
  const driverAmount = deliveryAmount - commissionAmount;

  console.log(`📊 Split da entrega ${request.id}:`);
  console.log(`   Total: R$ ${deliveryAmount.toFixed(2)}`);
  console.log(`   Entregador: R$ ${driverAmount.toFixed(2)}`);
  console.log(`   Comissão (${commissionPercentage}%): R$ ${commissionAmount.toFixed(2)}`);

  // Busca wallets
  const companyWallet = await getCompanyWallet(companyId);
  const driverWallet = await getDriverWallet(driverId);
  const platformWallet = await getPlatformWallet();

  // 1. Debita empresa
  const companyDebit = await debitWallet(
    companyWallet.id,
    deliveryAmount,
    "delivery_debit",
    {
      requestId: request.id,
      description: `Entrega #${request.requestNumber}`,
      metadata: { driverId, commissionPercentage },
    }
  );

  // 2. Credita entregador
  const driverCredit = await creditWallet(
    driverWallet.id,
    driverAmount,
    "delivery_credit",
    {
      requestId: request.id,
      description: `Entrega #${request.requestNumber}`,
      metadata: { companyId, commissionPercentage },
    }
  );

  // 3. Credita comissão para plataforma
  const commissionCredit = await creditWallet(
    platformWallet.id,
    commissionAmount,
    "commission",
    {
      requestId: request.id,
      description: `Comissão entrega #${request.requestNumber}`,
      metadata: { companyId, driverId, commissionPercentage },
    }
  );

  // Registra o split na tabela de controle
  await db.insert(deliveryFinancials).values({
    requestId: request.id,
    companyId,
    driverId,
    totalAmount: deliveryAmount.toFixed(2),
    driverAmount: driverAmount.toFixed(2),
    commissionAmount: commissionAmount.toFixed(2),
    commissionPercentage: commissionPercentage.toFixed(2),
    companyDebitTransactionId: companyDebit.transaction.id,
    driverCreditTransactionId: driverCredit.transaction.id,
    commissionTransactionId: commissionCredit.transaction.id,
    processed: true,
    processedAt: new Date(),
  });

  // Incrementa contador de entregas do motorista (para comissão progressiva)
  await storage.incrementDriverMonthlyDeliveries(driverId);

  console.log(`✅ Split processado com sucesso para entrega ${request.id}`);

  return {
    totalAmount: deliveryAmount,
    driverAmount,
    commissionAmount,
    commissionPercentage,
    companyDebitTransactionId: companyDebit.transaction.id,
    driverCreditTransactionId: driverCredit.transaction.id,
    commissionTransactionId: commissionCredit.transaction.id,
  };
}

/**
 * Registra entrega para cobrança posterior (PÓS-PAGO)
 * Não movimenta dinheiro, apenas registra para o fechamento semanal
 */
export async function registerPostPaidDelivery(
  request: Request,
  deliveryAmount: number
): Promise<DeliveryFinancial> {
  const companyId = request.companyId;
  const driverId = request.driverId;

  if (!companyId || !driverId) {
    throw new Error("Entrega deve ter empresa e motorista associados");
  }

  // Verifica se empresa é pós-pago
  const company = await storage.getCompany(companyId);
  if (!company) {
    throw new Error("Empresa não encontrada");
  }

  if (company.paymentType !== "BOLETO") {
    throw new Error("Esta função é apenas para empresas pós-pagas (boleto)");
  }

  // Calcula comissão
  const commissionPercentage = await calculateCommission(driverId);
  const commissionAmount = Math.round(deliveryAmount * (commissionPercentage / 100) * 100) / 100;
  const driverAmount = deliveryAmount - commissionAmount;

  console.log(`📝 Registrando entrega pós-pago ${request.id}:`);
  console.log(`   Total: R$ ${deliveryAmount.toFixed(2)}`);
  console.log(`   Entregador receberá: R$ ${driverAmount.toFixed(2)}`);
  console.log(`   Comissão (${commissionPercentage}%): R$ ${commissionAmount.toFixed(2)}`);

  // Registra entrega pendente de cobrança (sem transações ainda)
  const [deliveryFinancial] = await db
    .insert(deliveryFinancials)
    .values({
      requestId: request.id,
      companyId,
      driverId,
      totalAmount: deliveryAmount.toFixed(2),
      driverAmount: driverAmount.toFixed(2),
      commissionAmount: commissionAmount.toFixed(2),
      commissionPercentage: commissionPercentage.toFixed(2),
      processed: false, // Será processado quando empresa pagar o boleto
    })
    .returning();

  // Incrementa contador de entregas do motorista
  await storage.incrementDriverMonthlyDeliveries(driverId);

  console.log(`✅ Entrega pós-pago registrada: ${deliveryFinancial.id}`);

  return deliveryFinancial;
}

/**
 * Processa split de entrega com base no tipo de pagamento da empresa
 * Pode receber Request + amount ou apenas o deliveryId (busca os dados)
 */
export async function processDeliverySplit(
  requestOrId: Request | string,
  deliveryAmount?: number
): Promise<SplitResult | DeliveryFinancial | null> {
  let request: Request;
  let amount: number;

  // Se for string, busca a request e o valor
  if (typeof requestOrId === "string") {
    const fetchedRequest = await storage.getRequest(requestOrId);
    if (!fetchedRequest) {
      console.log(`⚠️ Entrega ${requestOrId} não encontrada para split`);
      return null;
    }
    request = fetchedRequest;

    // Busca o valor da entrega (request_bills)
    const [bill] = await db
      .select()
      .from(requestBills)
      .where(eq(requestBills.requestId, requestOrId))
      .limit(1);

    if (!bill || !bill.totalAmount) {
      console.log(`⚠️ Valor da entrega ${requestOrId} não encontrado`);
      return null;
    }
    amount = parseFloat(bill.totalAmount);
  } else {
    request = requestOrId;
    if (deliveryAmount === undefined) {
      throw new Error("deliveryAmount é obrigatório quando passando Request");
    }
    amount = deliveryAmount;
  }

  const companyId = request.companyId;
  if (!companyId) {
    console.log(`⚠️ Entrega ${request.id} não tem empresa associada (pode ser individual)`);
    return null;
  }

  const company = await storage.getCompany(companyId);
  if (!company) {
    throw new Error("Empresa não encontrada");
  }

  if (company.paymentType === "PRE_PAGO") {
    return processPrePaidDeliverySplit(request, amount);
  } else {
    return registerPostPaidDelivery(request, amount);
  }
}

/**
 * Verifica se empresa pode fazer entrega (tem saldo para pré-pago)
 */
export async function canCompanyRequestDelivery(
  companyId: string,
  estimatedAmount: number
): Promise<{ allowed: boolean; reason?: string }> {
  const company = await storage.getCompany(companyId);
  if (!company) {
    return { allowed: false, reason: "Empresa não encontrada" };
  }

  console.log(`🔍 Verificando se empresa ${companyId} pode fazer entrega de R$ ${estimatedAmount.toFixed(2)}`);
  console.log(`   paymentType: ${company.paymentType}`);

  // Pós-pago (BOLETO) sempre pode - não tem verificação de saldo
  if (company.paymentType === "BOLETO") {
    console.log(`   ✅ Empresa é pós-pago (BOLETO), permitido`);
    return { allowed: true };
  }

  // PRE_PAGO ou qualquer outro tipo (inclui null/undefined) precisa ter saldo
  // Tratamos como PRE_PAGO para garantir que empresas sem tipo definido sejam verificadas
  const wallet = await getCompanyWallet(companyId);
  const availableBalance = parseFloat(wallet.availableBalance);

  console.log(`   Saldo disponível: R$ ${availableBalance.toFixed(2)}`);
  console.log(`   Valor necessário: R$ ${estimatedAmount.toFixed(2)}`);

  if (availableBalance < estimatedAmount) {
    console.log(`   ❌ Saldo insuficiente`);
    return {
      allowed: false,
      reason: `Saldo insuficiente. Disponível: R$ ${availableBalance.toFixed(2)}. Necessário: R$ ${estimatedAmount.toFixed(2)}. Faça uma recarga para continuar.`,
    };
  }

  console.log(`   ✅ Saldo suficiente, permitido`);
  return { allowed: true };
}
