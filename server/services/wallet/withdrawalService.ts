/**
 * Serviço de Saques
 * Gerencia saques dos entregadores via PIX
 */

import { storage } from "../../storage";
import { db } from "../../db";
import { withdrawals } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { createPixTransfer, getBalance } from "../asaas/transfers";
import {
  getDriverWallet,
  blockBalance,
  unblockBalance,
  confirmBlockedDebit,
} from "./walletService";
import type { Withdrawal, Driver } from "@shared/schema";

// Configurações
const MIN_WITHDRAWAL_AMOUNT = 10.0; // R$ 10,00 mínimo
const WITHDRAWAL_FEE = 0.0; // Taxa de saque (0 = sem taxa)
const MAX_WITHDRAWALS_PER_DAY = 1; // Máximo de saques por dia

/**
 * Verifica se entregador pode fazer saque hoje
 * Considera apenas saques "completed" - saques "processing" antigos são ignorados
 */
export async function canWithdrawToday(driverId: string): Promise<{
  allowed: boolean;
  reason?: string;
  lastWithdrawal?: Date;
}> {
  console.log(`🔍 Checking if driver ${driverId} can withdraw today...`);

  // Primeiro, limpa saques "stuck" em processing há mais de 10 minutos (provavelmente falharam)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const { lt } = await import("drizzle-orm");

  const stuckWithdrawals = await db
    .select()
    .from(withdrawals)
    .where(
      and(
        eq(withdrawals.driverId, driverId),
        eq(withdrawals.status, "processing"),
        lt(withdrawals.createdAt, tenMinutesAgo)
      )
    );

  if (stuckWithdrawals.length > 0) {
    console.log(`   🧹 Found ${stuckWithdrawals.length} stuck withdrawals, marking as failed`);
    for (const stuck of stuckWithdrawals) {
      await db
        .update(withdrawals)
        .set({
          status: "failed",
          failureReason: "Timeout - transferência não confirmada",
        })
        .where(eq(withdrawals.id, stuck.id));
      console.log(`     - Marked ${stuck.id} as failed`);
    }
  }

  // Busca último saque completado (ignora failed e processing antigos)
  const lastWithdrawal = await storage.getDriverLastWithdrawal(driverId);
  console.log(`   Last withdrawal (non-failed): ${lastWithdrawal ? lastWithdrawal.id : "none"}`);

  if (!lastWithdrawal) {
    console.log(`   ✅ No previous withdrawal, allowing`);
    return { allowed: true };
  }

  // Verifica se foi hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastWithdrawalDate = new Date(lastWithdrawal.createdAt!);
  lastWithdrawalDate.setHours(0, 0, 0, 0);

  console.log(`   Today: ${today.toISOString()}`);
  console.log(`   Last withdrawal date: ${lastWithdrawalDate.toISOString()}`);
  console.log(`   Same day: ${lastWithdrawalDate.getTime() === today.getTime()}`);

  if (lastWithdrawalDate.getTime() === today.getTime()) {
    // Verifica quantidade de saques COMPLETADOS hoje (não conta failed nem processing)
    const { ne } = await import("drizzle-orm");
    const todayWithdrawals = await db
      .select()
      .from(withdrawals)
      .where(
        and(
          eq(withdrawals.driverId, driverId),
          gte(withdrawals.createdAt, today),
          eq(withdrawals.status, "completed") // Apenas saques completados contam
        )
      );

    console.log(`   Today's completed withdrawals: ${todayWithdrawals.length}`);
    todayWithdrawals.forEach(w => console.log(`     - ${w.id} status=${w.status}`));

    if (todayWithdrawals.length >= MAX_WITHDRAWALS_PER_DAY) {
      console.log(`   ❌ Limit reached, blocking`);
      return {
        allowed: false,
        reason: `Você já realizou ${MAX_WITHDRAWALS_PER_DAY} saque(s) hoje. Tente novamente amanhã.`,
        lastWithdrawal: lastWithdrawal.createdAt!,
      };
    }
  }

  console.log(`   ✅ Can withdraw`);
  return { allowed: true, lastWithdrawal: lastWithdrawal.createdAt! };
}

/**
 * Solicita saque para entregador
 */
export async function requestWithdrawal(
  driverId: string,
  amount: number,
  pixData?: { key: string; keyType: string }
): Promise<Withdrawal> {
  // Validação de valor mínimo
  if (amount < MIN_WITHDRAWAL_AMOUNT) {
    throw new Error(`Valor mínimo para saque é R$ ${MIN_WITHDRAWAL_AMOUNT.toFixed(2)}`);
  }

  // Verifica se pode sacar hoje
  const canWithdraw = await canWithdrawToday(driverId);
  if (!canWithdraw.allowed) {
    throw new Error(canWithdraw.reason!);
  }

  // Busca motorista
  const driver = await storage.getDriver(driverId);
  if (!driver) {
    throw new Error("Entregador não encontrado");
  }

  // Determina chave PIX (usa parâmetro ou chave cadastrada)
  const pixKey = pixData?.key || driver.pixKey;
  const pixKeyType = pixData?.keyType || driver.pixKeyType;

  if (!pixKey || !pixKeyType) {
    throw new Error("Chave PIX não configurada. Atualize seu cadastro com uma chave PIX válida.");
  }

  // Busca wallet
  const wallet = await getDriverWallet(driverId);

  if (wallet.status !== "active") {
    throw new Error("Sua carteira não está ativa. Entre em contato com o suporte.");
  }

  const availableBalance = parseFloat(wallet.availableBalance);
  if (availableBalance < amount) {
    throw new Error(`Saldo insuficiente. Disponível: R$ ${availableBalance.toFixed(2)}`);
  }

  // Verifica saldo no Asaas
  const asaasBalance = await getBalance();
  if (asaasBalance.balance < amount) {
    throw new Error("Saldo da plataforma insuficiente para saque. Tente novamente mais tarde.");
  }

  // Calcula valores
  const fee = WITHDRAWAL_FEE;
  const netAmount = amount - fee;

  console.log(`💸 Saque solicitado por ${driver.name}:`);
  console.log(`   Valor: R$ ${amount.toFixed(2)}`);
  console.log(`   Taxa: R$ ${fee.toFixed(2)}`);
  console.log(`   Líquido: R$ ${netAmount.toFixed(2)}`);
  console.log(`   PIX: ${pixKeyType} - ${pixKey}`);

  // Bloqueia saldo
  await blockBalance(wallet.id, amount);

  // Variável para rastrear o ID do saque criado (para limpeza em caso de erro)
  let withdrawalId: string | null = null;

  try {
    // Cria registro do saque
    const [withdrawal] = await db
      .insert(withdrawals)
      .values({
        driverId,
        walletId: wallet.id,
        amount: amount.toFixed(2),
        fee: fee.toFixed(2),
        netAmount: netAmount.toFixed(2),
        pixKeyType: pixKeyType.toLowerCase() as "cpf" | "cnpj" | "email" | "phone" | "evp",
        pixKey,
        status: "processing",
      })
      .returning();

    withdrawalId = withdrawal.id;

    // Realiza transferência no Asaas
    const transfer = await createPixTransfer({
      value: netAmount,
      pixKey,
      pixKeyType: pixKeyType.toUpperCase() as any,
      description: "Saque - App Entregas",
      externalReference: withdrawal.id,
    });

    // Atualiza saque com ID da transferência
    await db
      .update(withdrawals)
      .set({ asaasTransferId: transfer.id })
      .where(eq(withdrawals.id, withdrawal.id));

    // Se transferência foi autorizada, finaliza o saque
    if (transfer.status === "DONE" || transfer.authorized) {
      await finalizeWithdrawal(withdrawal.id, transfer);
    }

    console.log(`✅ Saque criado: ${withdrawal.id} - Transferência: ${transfer.id}`);

    return {
      ...withdrawal,
      asaasTransferId: transfer.id,
    };
  } catch (error) {
    // Em caso de erro, desbloqueia o saldo
    await unblockBalance(wallet.id, amount);

    // Se o registro de saque foi criado, marca como falho
    if (withdrawalId) {
      try {
        const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
        await db
          .update(withdrawals)
          .set({
            status: "failed",
            failureReason: errorMsg,
          })
          .where(eq(withdrawals.id, withdrawalId));
        console.log(`🗑️ Saque ${withdrawalId} marcado como falho`);
      } catch (cleanupError) {
        console.error(`⚠️ Erro ao marcar saque como falho:`, cleanupError);
      }
    }

    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`❌ Erro no saque: ${errorMessage}`);

    throw new Error(`Erro ao processar saque: ${errorMessage}`);
  }
}

/**
 * Finaliza saque após confirmação
 */
export async function finalizeWithdrawal(
  withdrawalId: string,
  transferData?: Record<string, unknown>
): Promise<Withdrawal> {
  // Busca saque
  const withdrawal = await storage.getWithdrawal(withdrawalId);
  if (!withdrawal) {
    throw new Error("Saque não encontrado");
  }

  // Verifica se já foi processado
  if (withdrawal.status === "completed") {
    console.log(`⚠️ Saque ${withdrawalId} já foi processado`);
    return withdrawal;
  }

  // Confirma débito do saldo bloqueado
  const { transaction } = await confirmBlockedDebit(
    withdrawal.walletId,
    parseFloat(withdrawal.amount),
    "withdrawal",
    {
      description: "Saque PIX",
      metadata: transferData,
    }
  );

  // Atualiza saque
  const [updatedWithdrawal] = await db
    .update(withdrawals)
    .set({
      status: "completed",
      processedAt: new Date(),
      transactionId: transaction.id,
    })
    .where(eq(withdrawals.id, withdrawalId))
    .returning();

  console.log(`✅ Saque finalizado: ${withdrawalId}`);

  return updatedWithdrawal;
}

/**
 * Processa falha de saque
 */
export async function processWithdrawalFailure(
  withdrawalId: string,
  reason: string
): Promise<Withdrawal> {
  const withdrawal = await storage.getWithdrawal(withdrawalId);
  if (!withdrawal) {
    throw new Error("Saque não encontrado");
  }

  // Desbloqueia saldo
  await unblockBalance(withdrawal.walletId, parseFloat(withdrawal.amount));

  // Atualiza saque
  const [updatedWithdrawal] = await db
    .update(withdrawals)
    .set({
      status: "failed",
      failureReason: reason,
      processedAt: new Date(),
    })
    .where(eq(withdrawals.id, withdrawalId))
    .returning();

  console.log(`❌ Saque falhou: ${withdrawalId} - ${reason}`);

  return updatedWithdrawal;
}

/**
 * Lista saques de um entregador
 */
export async function getDriverWithdrawals(
  driverId: string,
  options: { limit?: number } = {}
): Promise<Withdrawal[]> {
  return storage.getWithdrawalsByDriver(driverId, options.limit || 50);
}

/**
 * Busca saque por ID da transferência Asaas
 */
export async function getWithdrawalByTransferId(
  asaasTransferId: string
): Promise<Withdrawal | undefined> {
  const [withdrawal] = await db
    .select()
    .from(withdrawals)
    .where(eq(withdrawals.asaasTransferId, asaasTransferId));

  return withdrawal || undefined;
}
