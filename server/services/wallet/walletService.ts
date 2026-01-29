/**
 * Serviço de Wallet
 * Gerencia operações de carteira: saldos, créditos, débitos
 */

import { storage } from "../../storage";
import { db } from "../../db";
import { wallets, walletTransactions } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Wallet, WalletTransaction, InsertWalletTransaction } from "@shared/schema";

// ID fixo da plataforma
export const PLATFORM_WALLET_OWNER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Busca ou cria wallet para um owner
 * Usa verificação dupla para evitar condição de corrida que cria duplicatas
 */
export async function getOrCreateWallet(
  ownerId: string,
  ownerType: "company" | "driver" | "platform"
): Promise<Wallet> {
  // Primeira verificação
  let wallet = await storage.getWalletByOwner(ownerId, ownerType);

  if (!wallet) {
    try {
      // Tenta criar a wallet
      wallet = await storage.createWallet({
        ownerId,
        ownerType,
        availableBalance: "0.00",
        blockedBalance: "0.00",
        status: "active",
      });
      console.log(`💰 Wallet criada para ${ownerType}: ${ownerId}`);
    } catch (error) {
      // Se falhou (provavelmente por unique constraint ou outra requisição criou),
      // busca novamente
      wallet = await storage.getWalletByOwner(ownerId, ownerType);
      if (!wallet) {
        // Se ainda não existe, propaga o erro
        throw error;
      }
      console.log(`💰 Wallet encontrada após conflito para ${ownerType}: ${ownerId}`);
    }
  }

  return wallet;
}

/**
 * Busca wallet da plataforma (singleton)
 */
export async function getPlatformWallet(): Promise<Wallet> {
  return getOrCreateWallet(PLATFORM_WALLET_OWNER_ID, "platform");
}

/**
 * Busca wallet de uma empresa
 */
export async function getCompanyWallet(companyId: string): Promise<Wallet> {
  return getOrCreateWallet(companyId, "company");
}

/**
 * Busca wallet de um motorista
 */
export async function getDriverWallet(driverId: string): Promise<Wallet> {
  return getOrCreateWallet(driverId, "driver");
}

/**
 * Credita valor na wallet (aumenta saldo disponível)
 * Usado para: recargas, créditos de entrega
 */
export async function creditWallet(
  walletId: string,
  amount: number,
  type: InsertWalletTransaction["type"],
  options: {
    requestId?: string;
    intermunicipalDeliveryId?: string;
    chargeId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
  // Busca wallet com lock para evitar race condition
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId));

  if (!wallet) {
    throw new Error("Wallet não encontrada");
  }

  if (wallet.status !== "active") {
    throw new Error("Wallet não está ativa");
  }

  const previousBalance = parseFloat(wallet.availableBalance);
  const newBalance = previousBalance + amount;

  // Atualiza saldo
  const [updatedWallet] = await db
    .update(wallets)
    .set({
      availableBalance: newBalance.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, walletId))
    .returning();

  // Registra transação
  const [transaction] = await db
    .insert(walletTransactions)
    .values({
      walletId,
      type,
      status: "completed",
      amount: amount.toFixed(2),
      previousBalance: previousBalance.toFixed(2),
      newBalance: newBalance.toFixed(2),
      requestId: options.requestId || null,
      intermunicipalDeliveryId: options.intermunicipalDeliveryId || null,
      chargeId: options.chargeId || null,
      description: options.description || null,
      metadata: options.metadata || {},
      processedAt: new Date(),
    })
    .returning();

  console.log(`💳 Crédito de R$ ${amount.toFixed(2)} na wallet ${walletId}. Novo saldo: R$ ${newBalance.toFixed(2)}`);

  return {
    wallet: updatedWallet,
    transaction,
  };
}

/**
 * Debita valor da wallet (diminui saldo disponível)
 * Usado para: pagamento de entregas, saques
 */
export async function debitWallet(
  walletId: string,
  amount: number,
  type: InsertWalletTransaction["type"],
  options: {
    requestId?: string;
    intermunicipalDeliveryId?: string;
    chargeId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    allowNegative?: boolean; // Para pós-pago que pode ter saldo negativo temporário
  } = {}
): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
  // Busca wallet
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId));

  if (!wallet) {
    throw new Error("Wallet não encontrada");
  }

  if (wallet.status !== "active") {
    throw new Error("Wallet não está ativa");
  }

  const previousBalance = parseFloat(wallet.availableBalance);

  // Verifica saldo suficiente (exceto se allowNegative)
  if (!options.allowNegative && previousBalance < amount) {
    throw new Error(`Saldo insuficiente. Disponível: R$ ${previousBalance.toFixed(2)}, Necessário: R$ ${amount.toFixed(2)}`);
  }

  const newBalance = previousBalance - amount;

  // Atualiza saldo
  const [updatedWallet] = await db
    .update(wallets)
    .set({
      availableBalance: newBalance.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, walletId))
    .returning();

  // Registra transação
  const [transaction] = await db
    .insert(walletTransactions)
    .values({
      walletId,
      type,
      status: "completed",
      amount: amount.toFixed(2),
      previousBalance: previousBalance.toFixed(2),
      newBalance: newBalance.toFixed(2),
      requestId: options.requestId || null,
      intermunicipalDeliveryId: options.intermunicipalDeliveryId || null,
      chargeId: options.chargeId || null,
      description: options.description || null,
      metadata: options.metadata || {},
      processedAt: new Date(),
    })
    .returning();

  console.log(`💳 Débito de R$ ${amount.toFixed(2)} na wallet ${walletId}. Novo saldo: R$ ${newBalance.toFixed(2)}`);

  return {
    wallet: updatedWallet,
    transaction,
  };
}

/**
 * Bloqueia parte do saldo (move de disponível para bloqueado)
 * Usado para: saques em processamento
 */
export async function blockBalance(walletId: string, amount: number): Promise<Wallet> {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId));

  if (!wallet) {
    throw new Error("Wallet não encontrada");
  }

  const availableBalance = parseFloat(wallet.availableBalance);
  const blockedBalance = parseFloat(wallet.blockedBalance);

  if (availableBalance < amount) {
    throw new Error("Saldo insuficiente para bloqueio");
  }

  const [updatedWallet] = await db
    .update(wallets)
    .set({
      availableBalance: (availableBalance - amount).toFixed(2),
      blockedBalance: (blockedBalance + amount).toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, walletId))
    .returning();

  console.log(`🔒 Bloqueado R$ ${amount.toFixed(2)} na wallet ${walletId}`);

  return updatedWallet;
}

/**
 * Desbloqueia saldo (move de bloqueado para disponível)
 * Usado para: cancelamento de saque
 */
export async function unblockBalance(walletId: string, amount: number): Promise<Wallet> {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId));

  if (!wallet) {
    throw new Error("Wallet não encontrada");
  }

  const availableBalance = parseFloat(wallet.availableBalance);
  const blockedBalance = parseFloat(wallet.blockedBalance);

  if (blockedBalance < amount) {
    throw new Error("Saldo bloqueado insuficiente");
  }

  const [updatedWallet] = await db
    .update(wallets)
    .set({
      availableBalance: (availableBalance + amount).toFixed(2),
      blockedBalance: (blockedBalance - amount).toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, walletId))
    .returning();

  console.log(`🔓 Desbloqueado R$ ${amount.toFixed(2)} na wallet ${walletId}`);

  return updatedWallet;
}

/**
 * Confirma débito de saldo bloqueado (remove do bloqueado)
 * Usado para: conclusão de saque
 */
export async function confirmBlockedDebit(
  walletId: string,
  amount: number,
  type: InsertWalletTransaction["type"],
  options: {
    description?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId));

  if (!wallet) {
    throw new Error("Wallet não encontrada");
  }

  const blockedBalance = parseFloat(wallet.blockedBalance);
  const availableBalance = parseFloat(wallet.availableBalance);

  if (blockedBalance < amount) {
    throw new Error("Saldo bloqueado insuficiente");
  }

  // Remove do saldo bloqueado
  const [updatedWallet] = await db
    .update(wallets)
    .set({
      blockedBalance: (blockedBalance - amount).toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, walletId))
    .returning();

  // Registra transação (saldo total = disponível + bloqueado)
  const totalBefore = availableBalance + blockedBalance;
  const totalAfter = availableBalance + (blockedBalance - amount);

  const [transaction] = await db
    .insert(walletTransactions)
    .values({
      walletId,
      type,
      status: "completed",
      amount: amount.toFixed(2),
      previousBalance: totalBefore.toFixed(2),
      newBalance: totalAfter.toFixed(2),
      description: options.description || null,
      metadata: options.metadata || {},
      processedAt: new Date(),
    })
    .returning();

  console.log(`✅ Confirmado débito de R$ ${amount.toFixed(2)} do saldo bloqueado na wallet ${walletId}`);

  return {
    wallet: updatedWallet,
    transaction,
  };
}

/**
 * Verifica se empresa tem saldo suficiente para entrega
 */
export async function hasEnoughBalance(companyId: string, amount: number): Promise<boolean> {
  const wallet = await getCompanyWallet(companyId);
  const availableBalance = parseFloat(wallet.availableBalance);
  return availableBalance >= amount;
}

/**
 * Busca extrato da wallet
 */
export async function getWalletStatement(
  walletId: string,
  options: {
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
    type?: string;
  } = {}
): Promise<WalletTransaction[]> {
  return storage.getWalletTransactions(walletId, options.limit || 50, options.offset || 0);
}
