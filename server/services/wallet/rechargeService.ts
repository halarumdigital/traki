/**
 * Serviço de Recarga
 * Gerencia recargas de wallet via PIX e Boleto
 */

import { storage } from "../../storage";
import { db } from "../../db";
import { charges, companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createOrUpdateCustomer } from "../asaas/customers";
import { createPixPayment, createBoletoPayment } from "../asaas/payments";
import { getCompanyWallet, creditWallet } from "./walletService";
import type { Charge, Company } from "@shared/schema";

const MIN_RECHARGE_AMOUNT = 10.0; // R$ 10,00 mínimo

/**
 * Gera recarga via PIX
 */
export async function createPixRecharge(
  companyId: string,
  amount: number
): Promise<{
  charge: Charge;
  pix: {
    copyPaste: string;
    qrCodeBase64: string;
    expiresAt: string;
  };
}> {
  // Validação
  if (amount < MIN_RECHARGE_AMOUNT) {
    throw new Error(`Valor mínimo de recarga é R$ ${MIN_RECHARGE_AMOUNT.toFixed(2)}`);
  }

  // Busca empresa
  const company = await storage.getCompany(companyId);
  if (!company) {
    throw new Error("Empresa não encontrada");
  }

  // Busca ou cria wallet
  const wallet = await getCompanyWallet(companyId);

  // Cria ou busca cliente no Asaas
  const asaasCustomer = await createOrUpdateCustomer(company);

  // Data de vencimento (amanhã)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  // Cria cobrança no Asaas
  const { payment, pix } = await createPixPayment({
    customerId: asaasCustomer.id,
    value: amount,
    description: "Recarga de créditos - App Entregas",
    externalReference: `recharge_${companyId}_${Date.now()}`,
    dueDate,
  });

  // Salva cobrança no banco
  const [charge] = await db
    .insert(charges)
    .values({
      companyId,
      walletId: wallet.id,
      asaasId: payment.id,
      asaasCustomerId: asaasCustomer.id,
      chargeType: "recharge",
      paymentMethod: "pix",
      amount: amount.toFixed(2),
      dueDate,
      status: "waiting_payment",
      pixCopyPaste: pix.payload,
      pixQrCodeUrl: pix.encodedImage,
      metadata: {
        asaasPaymentStatus: payment.status,
      },
    })
    .returning();

  console.log(`✅ Recarga PIX criada: ${charge.id} - R$ ${amount.toFixed(2)}`);

  return {
    charge,
    pix: {
      copyPaste: pix.payload,
      qrCodeBase64: pix.encodedImage,
      expiresAt: pix.expirationDate,
    },
  };
}

/**
 * Gera recarga via Boleto
 */
export async function createBoletoRecharge(
  companyId: string,
  amount: number
): Promise<{
  charge: Charge;
  boleto: {
    url: string;
    barcode: string;
    digitableLine: string;
    dueDate: Date;
  };
}> {
  // Validação
  if (amount < MIN_RECHARGE_AMOUNT) {
    throw new Error(`Valor mínimo de recarga é R$ ${MIN_RECHARGE_AMOUNT.toFixed(2)}`);
  }

  // Busca empresa
  const company = await storage.getCompany(companyId);
  if (!company) {
    throw new Error("Empresa não encontrada");
  }

  // Busca ou cria wallet
  const wallet = await getCompanyWallet(companyId);

  // Cria ou busca cliente no Asaas
  const asaasCustomer = await createOrUpdateCustomer(company);

  // Data de vencimento (3 dias)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  // Cria cobrança no Asaas
  const { payment, boleto } = await createBoletoPayment({
    customerId: asaasCustomer.id,
    value: amount,
    description: "Recarga de créditos - App Entregas",
    externalReference: `recharge_${companyId}_${Date.now()}`,
    dueDate,
  });

  // Salva cobrança no banco
  const [charge] = await db
    .insert(charges)
    .values({
      companyId,
      walletId: wallet.id,
      asaasId: payment.id,
      asaasCustomerId: asaasCustomer.id,
      chargeType: "recharge",
      paymentMethod: "boleto",
      amount: amount.toFixed(2),
      dueDate,
      status: "waiting_payment",
      boletoUrl: payment.bankSlipUrl || null,
      boletoBarcode: boleto.barCode,
      boletoDigitableLine: boleto.identificationField,
      metadata: {
        asaasPaymentStatus: payment.status,
      },
    })
    .returning();

  console.log(`✅ Recarga Boleto criada: ${charge.id} - R$ ${amount.toFixed(2)}`);

  return {
    charge,
    boleto: {
      url: payment.bankSlipUrl || "",
      barcode: boleto.barCode,
      digitableLine: boleto.identificationField,
      dueDate,
    },
  };
}

/**
 * Confirma pagamento de recarga (chamado pelo webhook)
 */
export async function confirmRechargePayment(
  chargeId: string,
  paymentData: {
    paidAt?: Date;
    netValue?: number;
    asaasData?: Record<string, unknown>;
  }
): Promise<{ charge: Charge; credited: boolean }> {
  // Busca cobrança
  const charge = await storage.getCharge(chargeId);
  if (!charge) {
    throw new Error("Cobrança não encontrada");
  }

  // Verifica se já foi processada (idempotência)
  if (charge.status === "confirmed") {
    console.log(`⚠️ Cobrança ${chargeId} já foi processada anteriormente`);
    return { charge, credited: false };
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

  // Credita na wallet
  const amount = parseFloat(charge.amount);
  await creditWallet(charge.walletId, amount, "recharge", {
    chargeId: charge.id,
    description: `Recarga via ${charge.paymentMethod.toUpperCase()}`,
    metadata: paymentData.asaasData,
  });

  console.log(`✅ Recarga confirmada: ${chargeId} - R$ ${amount.toFixed(2)} creditado`);

  return { charge: updatedCharge, credited: true };
}

/**
 * Lista cobranças de uma empresa
 */
export async function getCompanyCharges(
  companyId: string,
  options: {
    limit?: number;
    status?: string;
    chargeType?: string;
  } = {}
): Promise<Charge[]> {
  return storage.getChargesByCompany(companyId, options.limit || 50);
}

/**
 * Busca cobrança por ID do Asaas
 */
export async function getChargeByAsaasId(asaasId: string): Promise<Charge | undefined> {
  return storage.getChargeByAsaasId(asaasId);
}
