/**
 * Serviço de Transferências do Asaas
 * Gerencia transferências PIX para entregadores (saques)
 */

import { asaasGet, asaasPost, isSandboxEnvironment } from "./client";

interface AsaasTransfer {
  id: string;
  value: number;
  netValue?: number;
  status: "PENDING" | "BANK_PROCESSING" | "DONE" | "CANCELLED" | "FAILED";
  transferFee?: number;
  effectiveDate?: string;
  endToEndIdentifier?: string;
  transactionReceiptUrl?: string;
  scheduleDate?: string;
  authorized: boolean;
  failReason?: string;
  dateCreated: string;
  pixAddressKey?: string;
  pixAddressKeyType?: string;
  description?: string;
  externalReference?: string;
}

interface AsaasBalance {
  balance: number;
}

type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

interface CreateTransferParams {
  value: number;
  pixKey: string;
  pixKeyType: PixKeyType;
  description?: string;
  externalReference?: string;
}

/**
 * Converte tipo de chave PIX do nosso formato para o formato Asaas
 */
function normalizePixKeyType(type: string): PixKeyType {
  const normalized = type.toUpperCase();
  const validTypes: PixKeyType[] = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"];

  if (validTypes.includes(normalized as PixKeyType)) {
    return normalized as PixKeyType;
  }

  // Mapeamentos alternativos
  if (normalized === "TELEFONE") return "PHONE";
  if (normalized === "ALEATORIA" || normalized === "RANDOM") return "EVP";

  throw new Error(`Tipo de chave PIX inválido: ${type}`);
}

/**
 * Realiza transferência PIX para entregador (saque)
 */
export async function createPixTransfer(params: CreateTransferParams): Promise<AsaasTransfer> {
  const transferData = {
    value: params.value,
    pixAddressKey: params.pixKey,
    pixAddressKeyType: normalizePixKeyType(params.pixKeyType),
    description: params.description || "Saque - App Entregas",
    externalReference: params.externalReference,
  };

  console.log(`[ASAAS] Criando transferência PIX: R$ ${params.value} para ${params.pixKey}`);

  try {
    const transfer = await asaasPost<AsaasTransfer>("/transfers", transferData);

    console.log(`[ASAAS] Transferência criada: ${transfer.id} - Status: ${transfer.status}`);

    return transfer;
  } catch (error: any) {
    // Melhora mensagem de erro para chave não encontrada
    const errorMsg = error?.message || String(error);

    if (errorMsg.includes("não foi encontrada") || errorMsg.includes("not found")) {
      // Verifica se está em sandbox
      const isSandbox = await isSandboxEnvironment();

      if (isSandbox) {
        // No sandbox, simula uma transferência bem-sucedida para permitir testes
        console.log(`[ASAAS SANDBOX] Chave PIX não validada no sandbox. Simulando transferência...`);

        const simulatedTransfer: AsaasTransfer = {
          id: `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          value: params.value,
          netValue: params.value,
          status: "DONE",
          transferFee: 0,
          authorized: true,
          dateCreated: new Date().toISOString(),
          pixAddressKey: params.pixKey,
          pixAddressKeyType: normalizePixKeyType(params.pixKeyType),
          description: params.description,
          externalReference: params.externalReference,
        };

        console.log(`[ASAAS SANDBOX] Transferência simulada: ${simulatedTransfer.id}`);

        return simulatedTransfer;
      } else {
        throw new Error(
          "Chave PIX não encontrada. Verifique se a chave está correta e cadastrada no banco."
        );
      }
    }

    throw error;
  }
}

/**
 * Busca transferência por ID
 */
export async function getTransfer(transferId: string): Promise<AsaasTransfer> {
  return asaasGet<AsaasTransfer>(`/transfers/${transferId}`);
}

/**
 * Lista transferências
 */
export async function listTransfers(params?: {
  status?: string;
  offset?: number;
  limit?: number;
}): Promise<{
  data: AsaasTransfer[];
  hasMore: boolean;
  totalCount: number;
}> {
  const queryParams: Record<string, string> = {};

  if (params?.status) queryParams.status = params.status;
  if (params?.offset !== undefined) queryParams.offset = String(params.offset);
  if (params?.limit !== undefined) queryParams.limit = String(params.limit);

  return asaasGet("/transfers", queryParams);
}

/**
 * Consulta saldo disponível na conta Asaas
 */
export async function getBalance(): Promise<AsaasBalance> {
  return asaasGet<AsaasBalance>("/finance/balance");
}

/**
 * Verifica se há saldo suficiente para transferência
 */
export async function hasEnoughBalance(amount: number): Promise<boolean> {
  const balance = await getBalance();
  return balance.balance >= amount;
}

export type { AsaasTransfer, AsaasBalance, PixKeyType };
