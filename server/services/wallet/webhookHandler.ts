/**
 * Handler de Webhooks do Asaas
 * Processa eventos de pagamento e transferência
 */

import { storage } from "../../storage";
import { db } from "../../db";
import { webhooksLog } from "@shared/schema";
import { eq } from "drizzle-orm";
import { confirmRechargePayment, getChargeByAsaasId } from "./rechargeService";
import { confirmWeeklyPayment } from "./weeklyClosingService";
import {
  finalizeWithdrawal,
  processWithdrawalFailure,
  getWithdrawalByTransferId,
} from "./withdrawalService";

/**
 * Eventos do Asaas que nos interessam:
 * - PAYMENT_CONFIRMED: Pagamento confirmado (PIX/Boleto)
 * - PAYMENT_RECEIVED: Pagamento recebido
 * - PAYMENT_OVERDUE: Pagamento vencido
 * - PAYMENT_DELETED: Pagamento deletado/cancelado
 * - PAYMENT_REFUNDED: Pagamento estornado
 * - TRANSFER_CONFIRMED: Transferência confirmada (saques)
 * - TRANSFER_FAILED: Transferência falhou
 */

interface AsaasWebhookPayload {
  event: string;
  payment?: {
    id: string;
    customer: string;
    value: number;
    netValue: number;
    status: string;
    billingType: string;
    confirmedDate?: string;
    paymentDate?: string;
  };
  transfer?: {
    id: string;
    value: number;
    netValue?: number;
    status: string;
    failReason?: string;
  };
}

interface WebhookResult {
  processed: boolean;
  event: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Processa webhook do Asaas
 */
export async function handleAsaasWebhook(
  payload: AsaasWebhookPayload,
  headers?: Record<string, unknown>
): Promise<WebhookResult> {
  const { event, payment, transfer } = payload;

  console.log(`📨 Webhook recebido: ${event}`);

  // Log do webhook
  const [webhookLog] = await db
    .insert(webhooksLog)
    .values({
      provider: "asaas",
      eventType: event,
      payload: payload as Record<string, unknown>,
      headers: headers || {},
    })
    .returning();

  try {
    let result: WebhookResult;

    switch (event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED":
        result = await handlePaymentConfirmed(payment!);
        break;

      case "PAYMENT_OVERDUE":
        result = await handlePaymentOverdue(payment!);
        break;

      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED":
        result = await handlePaymentCancelled(payment!, event);
        break;

      case "TRANSFER_CONFIRMED":
        result = await handleTransferConfirmed(transfer!);
        break;

      case "TRANSFER_FAILED":
        result = await handleTransferFailed(transfer!);
        break;

      default:
        result = {
          processed: false,
          event,
          message: `Evento não tratado: ${event}`,
        };
    }

    // Atualiza log como processado
    await db
      .update(webhooksLog)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(eq(webhooksLog.id, webhookLog.id));

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";

    // Atualiza log com erro
    await db
      .update(webhooksLog)
      .set({
        processed: false,
        errorMessage,
      })
      .where(eq(webhooksLog.id, webhookLog.id));

    console.error(`❌ Erro no webhook ${event}:`, errorMessage);

    return {
      processed: false,
      event,
      message: errorMessage,
    };
  }
}

/**
 * Processa pagamento confirmado
 */
async function handlePaymentConfirmed(
  payment: AsaasWebhookPayload["payment"]
): Promise<WebhookResult> {
  if (!payment) {
    return { processed: false, event: "PAYMENT_CONFIRMED", message: "Payment data missing" };
  }

  // Busca cobrança pelo ID do Asaas
  const charge = await getChargeByAsaasId(payment.id);

  if (!charge) {
    console.log(`⚠️ Cobrança não encontrada: ${payment.id}`);
    return {
      processed: false,
      event: "PAYMENT_CONFIRMED",
      message: "Cobrança não encontrada no sistema",
    };
  }

  const paymentData = {
    paidAt: payment.confirmedDate ? new Date(payment.confirmedDate) : new Date(),
    netValue: payment.netValue,
    asaasData: payment as unknown as Record<string, unknown>,
  };

  if (charge.chargeType === "recharge") {
    // Recarga de wallet
    const result = await confirmRechargePayment(charge.id, paymentData);
    return {
      processed: true,
      event: "PAYMENT_CONFIRMED",
      message: result.credited ? "Recarga creditada" : "Recarga já processada",
      data: { chargeId: charge.id, credited: result.credited },
    };
  } else if (charge.chargeType === "weekly") {
    // Fechamento semanal
    const result = await confirmWeeklyPayment(charge.id, paymentData);
    return {
      processed: true,
      event: "PAYMENT_CONFIRMED",
      message: `Fechamento semanal processado: ${result.deliveriesProcessed} entregas`,
      data: { chargeId: charge.id, deliveriesProcessed: result.deliveriesProcessed },
    };
  }

  return {
    processed: false,
    event: "PAYMENT_CONFIRMED",
    message: `Tipo de cobrança desconhecido: ${charge.chargeType}`,
  };
}

/**
 * Processa pagamento vencido
 */
async function handlePaymentOverdue(
  payment: AsaasWebhookPayload["payment"]
): Promise<WebhookResult> {
  if (!payment) {
    return { processed: false, event: "PAYMENT_OVERDUE", message: "Payment data missing" };
  }

  const charge = await getChargeByAsaasId(payment.id);

  if (!charge) {
    return {
      processed: false,
      event: "PAYMENT_OVERDUE",
      message: "Cobrança não encontrada",
    };
  }

  await storage.updateCharge(charge.id, { status: "overdue" });

  console.log(`⚠️ Cobrança vencida: ${charge.id}`);

  return {
    processed: true,
    event: "PAYMENT_OVERDUE",
    message: "Cobrança marcada como vencida",
    data: { chargeId: charge.id },
  };
}

/**
 * Processa pagamento cancelado/estornado
 */
async function handlePaymentCancelled(
  payment: AsaasWebhookPayload["payment"],
  event: string
): Promise<WebhookResult> {
  if (!payment) {
    return { processed: false, event, message: "Payment data missing" };
  }

  const charge = await getChargeByAsaasId(payment.id);

  if (!charge) {
    return {
      processed: false,
      event,
      message: "Cobrança não encontrada",
    };
  }

  const status = event === "PAYMENT_REFUNDED" ? "refunded" : "cancelled";
  await storage.updateCharge(charge.id, { status });

  console.log(`🚫 Cobrança ${status}: ${charge.id}`);

  // TODO: Se necessário, reverter créditos já processados

  return {
    processed: true,
    event,
    message: `Cobrança ${status}`,
    data: { chargeId: charge.id, status },
  };
}

/**
 * Processa transferência confirmada (saque)
 */
async function handleTransferConfirmed(
  transfer: AsaasWebhookPayload["transfer"]
): Promise<WebhookResult> {
  if (!transfer) {
    return { processed: false, event: "TRANSFER_CONFIRMED", message: "Transfer data missing" };
  }

  const withdrawal = await getWithdrawalByTransferId(transfer.id);

  if (!withdrawal) {
    console.log(`⚠️ Saque não encontrado para transferência: ${transfer.id}`);
    return {
      processed: false,
      event: "TRANSFER_CONFIRMED",
      message: "Saque não encontrado",
    };
  }

  // Finaliza saque
  await finalizeWithdrawal(withdrawal.id, transfer as unknown as Record<string, unknown>);

  return {
    processed: true,
    event: "TRANSFER_CONFIRMED",
    message: "Saque finalizado com sucesso",
    data: { withdrawalId: withdrawal.id },
  };
}

/**
 * Processa transferência falhou
 */
async function handleTransferFailed(
  transfer: AsaasWebhookPayload["transfer"]
): Promise<WebhookResult> {
  if (!transfer) {
    return { processed: false, event: "TRANSFER_FAILED", message: "Transfer data missing" };
  }

  const withdrawal = await getWithdrawalByTransferId(transfer.id);

  if (!withdrawal) {
    return {
      processed: false,
      event: "TRANSFER_FAILED",
      message: "Saque não encontrado",
    };
  }

  // Processa falha
  await processWithdrawalFailure(
    withdrawal.id,
    transfer.failReason || "Falha na transferência"
  );

  return {
    processed: true,
    event: "TRANSFER_FAILED",
    message: "Saque marcado como falho, saldo desbloqueado",
    data: { withdrawalId: withdrawal.id, reason: transfer.failReason },
  };
}
