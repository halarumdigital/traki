/**
 * Financial Service
 *
 * Gerencia operações financeiras, subcontas Woovi e transações
 */

import { db } from '../db';
import {
  wooviSubaccounts,
  wooviCharges,
  financialTransactions,
  companyBalanceBlocks,
  type InsertWooviSubaccount,
  type InsertWooviCharge,
  type InsertFinancialTransaction,
  type InsertCompanyBalanceBlock,
  type WooviSubaccount,
  type WooviCharge,
  type FinancialTransaction,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import wooviService from './woovi.service';

class FinancialService {
  /**
   * Cria uma subconta Woovi para uma empresa
   */
  async createCompanySubaccount(
    companyId: string,
    pixKey: string,
    pixKeyType: 'EMAIL' | 'CPF' | 'CNPJ' | 'PHONE' | 'EVP',
    companyName: string
  ): Promise<WooviSubaccount> {
    try {
      // Criar subconta na Woovi
      const wooviResponse = await wooviService.createSubaccount({
        name: `Empresa: ${companyName}`,
        pixKey,
      });

      // Salvar subconta no banco de dados
      const [subaccount] = await db.insert(wooviSubaccounts).values({
        accountType: 'company',
        companyId,
        pixKey,
        pixKeyType,
        name: `Empresa: ${companyName}`,
        wooviSubaccountId: wooviResponse.subAccount.pixKey, // Woovi usa pixKey como ID
        balanceCache: '0',
        active: true,
      }).returning();

      // Registrar log da transação
      await this.logTransaction({
        type: 'charge_created',
        companyId,
        amount: '0',
        status: 'completed',
        description: `Subconta criada para empresa: ${companyName}`,
        metadata: JSON.parse(JSON.stringify({ wooviResponse })),
      });

      return subaccount;
    } catch (error) {
      console.error('Erro ao criar subconta da empresa:', error);
      throw new Error(`Falha ao criar subconta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Cria uma subconta Woovi para um entregador
   */
  async createDriverSubaccount(
    driverId: string,
    pixKey: string,
    pixKeyType: 'EMAIL' | 'CPF' | 'CNPJ' | 'PHONE' | 'EVP',
    driverName: string
  ): Promise<WooviSubaccount> {
    try {
      // Criar subconta na Woovi
      const wooviResponse = await wooviService.createSubaccount({
        name: `Entregador: ${driverName}`,
        pixKey,
      });

      // Salvar subconta no banco de dados
      const [subaccount] = await db.insert(wooviSubaccounts).values({
        accountType: 'driver',
        driverId,
        pixKey,
        pixKeyType,
        wooviSubaccountId: wooviResponse.subAccount.pixKey,
        balanceCache: '0',
        active: true,
      }).returning();

      // Registrar log da transação
      await this.logTransaction({
        type: 'charge_created',
        driverId,
        amount: '0',
        status: 'completed',
        description: `Subconta criada para entregador: ${driverName}`,
        metadata: JSON.parse(JSON.stringify({ wooviResponse })),
      });

      return subaccount;
    } catch (error) {
      console.error('Erro ao criar subconta do entregador:', error);
      throw new Error(`Falha ao criar subconta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Busca a subconta de uma empresa
   */
  async getCompanySubaccount(companyId: string): Promise<WooviSubaccount | null> {
    const [subaccount] = await db
      .select()
      .from(wooviSubaccounts)
      .where(and(
        eq(wooviSubaccounts.companyId, companyId),
        eq(wooviSubaccounts.accountType, 'company'),
        eq(wooviSubaccounts.active, true)
      ))
      .limit(1);

    return subaccount || null;
  }

  /**
   * Busca a subconta de um entregador
   */
  async getDriverSubaccount(driverId: string): Promise<WooviSubaccount | null> {
    const [subaccount] = await db
      .select()
      .from(wooviSubaccounts)
      .where(and(
        eq(wooviSubaccounts.driverId, driverId),
        eq(wooviSubaccounts.accountType, 'driver'),
        eq(wooviSubaccounts.active, true)
      ))
      .limit(1);

    return subaccount || null;
  }

  /**
   * Atualiza o saldo em cache de uma subconta consultando a Woovi
   */
  async updateSubaccountBalance(subaccountId: string): Promise<number> {
    try {
      // Buscar subconta no banco
      const [subaccount] = await db
        .select()
        .from(wooviSubaccounts)
        .where(eq(wooviSubaccounts.id, subaccountId))
        .limit(1);

      if (!subaccount) {
        throw new Error('Subconta não encontrada');
      }

      // Consultar saldo na Woovi
      const balanceResponse = await wooviService.getSubaccountBalance(subaccount.pixKey);

      // Verificar se a resposta é válida
      if (!balanceResponse || !balanceResponse.SubAccount) {
        console.warn(`Resposta inválida da Woovi para subconta ${subaccount.pixKey}`);
        // Retornar o saldo em cache se não conseguir atualizar
        return parseInt(subaccount.balanceCache || '0');
      }

      const balance = balanceResponse.SubAccount.balance || 0;

      // Atualizar cache no banco
      await db
        .update(wooviSubaccounts)
        .set({
          balanceCache: balance.toString(),
          lastBalanceUpdate: new Date(),
        })
        .where(eq(wooviSubaccounts.id, subaccountId));

      return balance;
    } catch (error) {
      console.error('Erro ao atualizar saldo da subconta:', error);
      throw error;
    }
  }

  /**
   * Cria uma cobrança PIX para recarga da empresa
   */
  async createRecharge(
    companyId: string,
    amount: number
  ): Promise<WooviCharge> {
    try {
      // Buscar subconta da empresa
      const subaccount = await this.getCompanySubaccount(companyId);

      if (!subaccount) {
        throw new Error('Empresa não possui subconta criada');
      }

      // Gerar correlationID único
      const correlationID = wooviService.generateCorrelationId('RECARGA');

      // Criar cobrança na Woovi (valor em centavos)
      const valueInCents = wooviService.toCents(amount);
      const chargeResponse = await wooviService.createCharge({
        value: valueInCents,
        correlationID,
        comment: `Recarga de saldo - Empresa`,
        expiresIn: 3600, // 1 hora para expirar
      });

      // Salvar cobrança no banco de dados
      const [charge] = await db.insert(wooviCharges).values({
        companyId,
        subaccountId: subaccount.id,
        wooviChargeId: chargeResponse.charge.correlationID,
        correlationId: correlationID,
        value: amount.toString(),
        qrCode: chargeResponse.charge.qrCodeImage, // URL da imagem do QR Code
        brCode: chargeResponse.brCode,
        status: 'pending',
      }).returning();

      // Registrar log da transação
      await this.logTransaction({
        type: 'charge_created',
        companyId,
        chargeId: charge.id,
        amount: amount.toString(),
        status: 'pending',
        description: `Cobrança PIX criada - Recarga de R$ ${amount.toFixed(2)}`,
        metadata: JSON.parse(JSON.stringify({ chargeResponse })),
      });

      return charge;
    } catch (error) {
      console.error('Erro ao criar recarga:', error);
      throw new Error(`Falha ao criar recarga: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Cria uma recarga com split direto para a subconta da empresa
   * Conforme documentação: https://developers.woovi.com/docs/subaccount/how-to-create-charge-with-split-to-subbaccount-using-api
   */
  async createRechargeWithSplit(companyId: string, amount: number): Promise<any> {
    try {
      console.log(`🔍 createRechargeWithSplit - Company ID: ${companyId}, Amount: R$ ${amount}`);

      // Buscar subconta da empresa
      const subaccount = await this.getCompanySubaccount(companyId);

      if (!subaccount) {
        console.error(`❌ Subconta não encontrada para empresa ${companyId}`);
        throw new Error('Empresa não possui subconta. Configure sua chave PIX para receber pagamentos.');
      }

      console.log(`✅ Subconta encontrada:`);
      console.log(`   ID: ${subaccount.id}`);
      console.log(`   PIX Key: ${subaccount.pixKey}`);
      console.log(`   PIX Type: ${subaccount.pixKeyType}`);

      const correlationID = `recharge_${companyId}_${Date.now()}`;

      // Criar cobrança na Woovi com split para subconta (valor em centavos)
      const valueInCents = wooviService.toCents(amount);

      // Taxa da plataforma: R$ 0,85 (85 centavos)
      const platformFeeInCents = 85;

      // Valor que vai para a subconta da empresa (total - taxa)
      const subaccountValueInCents = valueInCents - platformFeeInCents;

      // Validar que o valor é suficiente para cobrir a taxa
      if (valueInCents <= platformFeeInCents) {
        throw new Error(`Valor mínimo para recarga é R$ ${(platformFeeInCents / 100 + 0.01).toFixed(2)}`);
      }

      // De acordo com a documentação, para fazer split para subconta:
      // A taxa fica na conta principal, o resto vai para a subconta
      const chargeResponse = await wooviService.createCharge({
        value: valueInCents,
        correlationID,
        comment: `Recarga de saldo - Empresa`,
        expiresIn: 3600, // 1 hora para expirar
        splits: [
          {
            pixKey: subaccount.pixKey, // Chave PIX da subconta
            value: subaccountValueInCents, // Valor menos a taxa vai para a subconta (valor - 85 centavos)
            splitType: 'SPLIT_SUB_ACCOUNT' // Tipo de split para subconta virtual (valor correto da API)
          }
        ]
      });

      // Salvar cobrança no banco de dados
      const [charge] = await db.insert(wooviCharges).values({
        companyId,
        subaccountId: subaccount.id,
        wooviChargeId: chargeResponse.charge.correlationID,
        correlationId: correlationID,
        value: amount.toString(),
        qrCode: chargeResponse.charge.qrCodeImage, // URL da imagem do QR Code
        brCode: chargeResponse.brCode,
        status: 'pending',
      }).returning();

      // Registrar log da transação
      await this.logTransaction({
        type: 'charge_created',
        companyId,
        chargeId: charge.id,
        amount: amount.toString(),
        status: 'pending',
        description: `Cobrança PIX criada com split para subconta - Recarga de R$ ${amount.toFixed(2)} (Taxa: R$ 0,85)`,
        metadata: JSON.parse(JSON.stringify({
          chargeResponse,
          split: {
            pixKey: subaccount.pixKey,
            valueToSubaccount: subaccountValueInCents,
            platformFee: platformFeeInCents,
            totalValue: valueInCents
          }
        })),
      });

      return charge;
    } catch (error) {
      console.error('Erro ao criar recarga com split:', error);
      throw new Error(`Falha ao criar recarga: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Marca uma cobrança como paga (chamado via webhook ou polling)
   */
  async markChargeAsPaid(correlationId: string): Promise<void> {
    try {
      // Buscar cobrança no banco
      const [charge] = await db
        .select()
        .from(wooviCharges)
        .where(eq(wooviCharges.correlationId, correlationId))
        .limit(1);

      if (!charge) {
        throw new Error('Cobrança não encontrada');
      }

      if (charge.status === 'paid') {
        return; // Já foi processada
      }

      // Atualizar status da cobrança
      await db
        .update(wooviCharges)
        .set({
          status: 'paid',
          paidAt: new Date(),
        })
        .where(eq(wooviCharges.id, charge.id));

      // Atualizar saldo em cache
      await this.updateSubaccountBalance(charge.subaccountId);

      // Registrar log da transação
      await this.logTransaction({
        type: 'charge_paid',
        companyId: charge.companyId,
        chargeId: charge.id,
        amount: charge.value,
        status: 'completed',
        description: `Recarga confirmada - R$ ${parseFloat(charge.value).toFixed(2)}`,
      });
    } catch (error) {
      console.error('Erro ao marcar cobrança como paga:', error);
      throw error;
    }
  }

  /**
   * Bloqueia saldo virtualmente para uma entrega
   */
  async blockBalance(
    companyId: string,
    entregaId: string,
    amount: number
  ): Promise<void> {
    try {
      const subaccount = await this.getCompanySubaccount(companyId);

      if (!subaccount) {
        throw new Error('Empresa não possui subconta');
      }

      // Criar bloqueio no banco
      await db.insert(companyBalanceBlocks).values({
        companyId,
        subaccountId: subaccount.id,
        entregaId,
        blockedAmount: amount.toString(),
        status: 'active',
      });

      // Registrar log
      await this.logTransaction({
        type: 'balance_block',
        companyId,
        entregaId,
        fromSubaccountId: subaccount.id,
        amount: amount.toString(),
        status: 'completed',
        description: `Saldo bloqueado para entrega - R$ ${amount.toFixed(2)}`,
      });
    } catch (error) {
      console.error('Erro ao bloquear saldo:', error);
      throw error;
    }
  }

  /**
   * Libera saldo bloqueado de uma entrega (por conclusão ou cancelamento)
   */
  async releaseBalance(
    entregaId: string,
    reason: 'released' | 'cancelled'
  ): Promise<void> {
    try {
      await db
        .update(companyBalanceBlocks)
        .set({
          status: reason,
          releasedAt: new Date(),
        })
        .where(and(
          eq(companyBalanceBlocks.entregaId, entregaId),
          eq(companyBalanceBlocks.status, 'active')
        ));

      // Registrar log
      await this.logTransaction({
        type: 'balance_unblock',
        entregaId,
        amount: '0', // Buscar o valor bloqueado se necessário
        status: 'completed',
        description: `Saldo desbloqueado - Motivo: ${reason}`,
      });
    } catch (error) {
      console.error('Erro ao liberar saldo:', error);
      throw error;
    }
  }

  /**
   * Registra uma transação no log
   */
  private async logTransaction(params: Omit<InsertFinancialTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      await db.insert(financialTransactions).values(params as any);
    } catch (error) {
      console.error('Erro ao registrar log de transação:', error);
      // Não lançar erro para não interromper o fluxo principal
    }
  }
}

// Exportar instância única (singleton)
export const financialService = new FinancialService();
export default financialService;
