/**
 * Serviço de Cobranças do Asaas
 * Gerencia cobranças via PIX e Boleto
 */

import { asaasGet, asaasPost, asaasDelete } from "./client";

interface AsaasPayment {
  id: string;
  customer: string;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";
  value: number;
  netValue?: number;
  status: "PENDING" | "RECEIVED" | "CONFIRMED" | "OVERDUE" | "REFUNDED" | "RECEIVED_IN_CASH" | "REFUND_REQUESTED" | "REFUND_IN_PROGRESS" | "CHARGEBACK_REQUESTED" | "CHARGEBACK_DISPUTE" | "AWAITING_CHARGEBACK_REVERSAL" | "DUNNING_REQUESTED" | "DUNNING_RECEIVED" | "AWAITING_RISK_ANALYSIS";
  dueDate: string;
  originalDueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  invoiceNumber?: string;
  dateCreated: string;
}

interface AsaasPixQrCode {
  encodedImage: string; // Base64 do QR Code
  payload: string; // Código copia e cola
  expirationDate: string;
}

interface AsaasBoletoIdentification {
  identificationField: string; // Linha digitável
  nossoNumero: string;
  barCode: string;
}

interface CreatePaymentParams {
  customerId: string;
  value: number;
  description: string;
  externalReference?: string;
  dueDate: Date;
}

/**
 * Formata data para o formato esperado pelo Asaas (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Cria cobrança via PIX
 */
export async function createPixPayment(params: CreatePaymentParams): Promise<{
  payment: AsaasPayment;
  pix: AsaasPixQrCode;
}> {
  const paymentData = {
    customer: params.customerId,
    billingType: "PIX",
    value: params.value,
    dueDate: formatDate(params.dueDate),
    description: params.description,
    externalReference: params.externalReference,
  };

  console.log(`[ASAAS] Criando cobrança PIX: R$ ${params.value}`);

  const payment = await asaasPost<AsaasPayment>("/payments", paymentData);

  // Busca QR Code do PIX
  const pixData = await getPixQrCode(payment.id);

  console.log(`[ASAAS] Cobrança PIX criada: ${payment.id}`);

  return {
    payment,
    pix: pixData,
  };
}

/**
 * Cria cobrança via Boleto
 */
export async function createBoletoPayment(params: CreatePaymentParams): Promise<{
  payment: AsaasPayment;
  boleto: AsaasBoletoIdentification;
}> {
  const paymentData = {
    customer: params.customerId,
    billingType: "BOLETO",
    value: params.value,
    dueDate: formatDate(params.dueDate),
    description: params.description,
    externalReference: params.externalReference,
    // Configurações de multa e juros
    fine: {
      value: 2, // 2% de multa
      type: "PERCENTAGE",
    },
    interest: {
      value: 1, // 1% de juros ao mês
      type: "PERCENTAGE",
    },
    postalService: false, // Não enviar boleto físico
  };

  console.log(`[ASAAS] Criando cobrança Boleto: R$ ${params.value}`);

  const payment = await asaasPost<AsaasPayment>("/payments", paymentData);

  // Busca linha digitável do boleto
  const boletoData = await getBoletoIdentification(payment.id);

  console.log(`[ASAAS] Cobrança Boleto criada: ${payment.id}`);

  return {
    payment,
    boleto: boletoData,
  };
}

/**
 * Busca QR Code do PIX
 */
export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasGet<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

/**
 * Busca linha digitável do boleto
 */
export async function getBoletoIdentification(paymentId: string): Promise<AsaasBoletoIdentification> {
  return asaasGet<AsaasBoletoIdentification>(`/payments/${paymentId}/identificationField`);
}

/**
 * Busca cobrança por ID
 */
export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasGet<AsaasPayment>(`/payments/${paymentId}`);
}

/**
 * Cancela cobrança
 */
export async function cancelPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasDelete<AsaasPayment>(`/payments/${paymentId}`);
}

/**
 * Lista cobranças de um cliente
 */
export async function listCustomerPayments(
  customerId: string,
  params?: {
    status?: string;
    offset?: number;
    limit?: number;
  }
): Promise<{
  data: AsaasPayment[];
  hasMore: boolean;
  totalCount: number;
}> {
  const queryParams: Record<string, string> = {
    customer: customerId,
  };

  if (params?.status) queryParams.status = params.status;
  if (params?.offset !== undefined) queryParams.offset = String(params.offset);
  if (params?.limit !== undefined) queryParams.limit = String(params.limit);

  return asaasGet(`/payments`, queryParams);
}

export type { AsaasPayment, AsaasPixQrCode, AsaasBoletoIdentification };
