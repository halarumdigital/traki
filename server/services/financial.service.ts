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
import { eq, and, desc, sql, gte } from 'drizzle-orm';
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
        wooviSubaccountId: wooviResponse.subAccount.pixKey, // Woovi usa pixKey como ID
        balanceCache: '0',
        active: true,
      }).returning();

      // Registrar log da transação
      await this.logTransaction({
        type: 'recarga_criada',
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
        type: 'recarga_criada',
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

      // Verificar se a resposta é válida (API pode retornar "SubAccount" ou "subAccount")
      const subAccountData = balanceResponse?.SubAccount || balanceResponse?.subAccount;
      if (!balanceResponse || !subAccountData) {
        console.warn(`Resposta inválida da Woovi para subconta ${subaccount.pixKey}`);
        // Retornar o saldo em cache se não conseguir atualizar
        return parseInt(subaccount.balanceCache || '0');
      }

      const balance = subAccountData.balance || 0;

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
        type: 'recarga_criada',
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
        type: 'recarga_criada',
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

  /**
   * Processa o pagamento de uma entrega
   *
   * Este método executa duas operações:
   * 1. Transferência entre subcontas (empresa → entregador): valor total da entrega
   * 2. Débito da subconta do entregador: comissão do app + R$1 taxa de saque
   *
   * @param companyId - ID da empresa que paga
   * @param driverId - ID do entregador que recebe
   * @param deliveryAmount - Valor total da entrega em reais
   * @param commissionPercentage - Percentual de comissão do app (baseado nas entregas do motorista)
   * @param deliveryId - ID da entrega (opcional, para referência)
   * @param deliveryType - Tipo de entrega: 'intermunicipal' ou 'request' (entregas rápidas)
   * @returns Objeto com detalhes das transações realizadas
   */
  async processDeliveryPayment(
    companyId: string,
    driverId: string,
    deliveryAmount: number,
    commissionPercentage: number,
    deliveryId?: string,
    deliveryType: 'intermunicipal' | 'request' = 'intermunicipal'
  ): Promise<{
    success: boolean;
    transferResult?: any;
    debitResult?: any;
    driverReceives: number;
    appCommission: number;
    totalDeducted: number;
    error?: string;
  }> {
    try {
      console.log(`💰 Processando pagamento de entrega:`);
      console.log(`   Empresa: ${companyId}`);
      console.log(`   Entregador: ${driverId}`);
      console.log(`   Valor da entrega: R$ ${deliveryAmount.toFixed(2)}`);
      console.log(`   Comissão do app: ${commissionPercentage}%`);

      // Buscar subcontas
      const companySubaccount = await this.getCompanySubaccount(companyId);
      const driverSubaccount = await this.getDriverSubaccount(driverId);

      if (!companySubaccount) {
        throw new Error('Empresa não possui subconta configurada');
      }

      if (!driverSubaccount) {
        throw new Error('Entregador não possui subconta configurada');
      }

      // Calcular valores - apenas comissão do app (taxa de saque é cobrada no momento do saque)
      const appCommission = (deliveryAmount * commissionPercentage) / 100;
      const totalDeducted = appCommission;
      const driverReceives = deliveryAmount - totalDeducted;

      console.log(`   📊 Cálculos:`);
      console.log(`      Comissão do app (${commissionPercentage}%): R$ ${appCommission.toFixed(2)}`);
      console.log(`      Total deduzido: R$ ${totalDeducted.toFixed(2)}`);
      console.log(`      Entregador recebe na carteira: R$ ${driverReceives.toFixed(2)}`);

      // ==========================================
      // OPERAÇÃO 1: Transferência entre subcontas
      // Empresa → Entregador (valor total da entrega)
      // ==========================================
      console.log(`\n🔄 [1/2] Transferindo R$ ${deliveryAmount.toFixed(2)} da empresa para o entregador...`);

      const transferCorrelationId = wooviService.generateCorrelationId('TRANSFER');
      const transferResult = await wooviService.transferBetweenSubaccounts({
        value: wooviService.toCents(deliveryAmount),
        fromPixKey: companySubaccount.pixKey,
        fromPixKeyType: (companySubaccount.pixKeyType || 'EMAIL') as 'EMAIL' | 'CPF' | 'CNPJ' | 'PHONE' | 'EVP',
        toPixKey: driverSubaccount.pixKey,
        toPixKeyType: (driverSubaccount.pixKeyType || 'EMAIL') as 'EMAIL' | 'CPF' | 'CNPJ' | 'PHONE' | 'EVP',
        correlationID: transferCorrelationId,
      });

      console.log(`   ✅ Transferência realizada com sucesso`);

      // Registrar log da transferência - usar o campo correto baseado no tipo de entrega
      await this.logTransaction({
        type: 'transfer_delivery',
        companyId,
        driverId,
        ...(deliveryType === 'request' ? { requestId: deliveryId } : { entregaId: deliveryId }),
        fromSubaccountId: companySubaccount.id,
        toSubaccountId: driverSubaccount.id,
        amount: deliveryAmount.toString(),
        status: 'completed',
        description: `Pagamento de entrega - Transferência de R$ ${deliveryAmount.toFixed(2)} da empresa para entregador`,
        wooviTransactionId: transferCorrelationId,
        wooviResponse: JSON.parse(JSON.stringify(transferResult)),
        metadata: JSON.parse(JSON.stringify({
          correlationId: transferCorrelationId,
          fromPixKey: companySubaccount.pixKey,
          toPixKey: driverSubaccount.pixKey,
          deliveryType,
        })),
      });

      // ==========================================
      // OPERAÇÃO 2: Débito da subconta do entregador
      // Cobra apenas a comissão do app
      // (Taxa de saque é cobrada no momento do saque)
      // ==========================================
      console.log(`\n💸 [2/2] Debitando R$ ${appCommission.toFixed(2)} de comissão da subconta do entregador...`);

      const debitResult = await wooviService.debitFromSubaccount(driverSubaccount.pixKey, {
        value: wooviService.toCents(appCommission),
        description: `Comissão Fretus (${commissionPercentage}%): R$ ${appCommission.toFixed(2)}`,
      });

      console.log(`   ✅ Débito realizado com sucesso`);

      // Registrar log do débito de comissão - usar o campo correto baseado no tipo de entrega
      await this.logTransaction({
        type: 'commission_debit',
        driverId,
        ...(deliveryType === 'request' ? { requestId: deliveryId } : { entregaId: deliveryId }),
        fromSubaccountId: driverSubaccount.id,
        amount: appCommission.toString(),
        status: 'completed',
        description: `Comissão do app (${commissionPercentage}%): R$ ${appCommission.toFixed(2)}`,
        wooviResponse: JSON.parse(JSON.stringify(debitResult)),
        metadata: JSON.parse(JSON.stringify({
          commissionPercentage,
          deliveryAmount,
          deliveryType,
        })),
      });

      // Atualizar saldos em cache
      await Promise.all([
        this.updateSubaccountBalance(companySubaccount.id),
        this.updateSubaccountBalance(driverSubaccount.id),
      ]);

      console.log(`\n✅ Pagamento processado com sucesso!`);
      console.log(`   Entregador recebeu na carteira: R$ ${driverReceives.toFixed(2)}`);

      return {
        success: true,
        transferResult,
        debitResult,
        driverReceives,
        appCommission,
        totalDeducted,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro ao processar pagamento de entrega:', errorMessage);

      // Registrar erro no log - usar o campo correto baseado no tipo de entrega
      await this.logTransaction({
        type: 'transfer_delivery',
        companyId,
        driverId,
        ...(deliveryType === 'request' ? { requestId: deliveryId } : { entregaId: deliveryId }),
        amount: deliveryAmount.toString(),
        status: 'failed',
        description: `Falha no pagamento de entrega`,
        errorMessage,
      });

      return {
        success: false,
        driverReceives: 0,
        appCommission: 0,
        totalDeducted: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Calcula os valores de uma entrega antes de processar o pagamento
   * Útil para mostrar ao entregador quanto ele vai receber na carteira
   * NOTA: A taxa de saque (R$1,50) é cobrada apenas no momento do saque
   *
   * @param deliveryAmount - Valor total da entrega em reais
   * @param commissionPercentage - Percentual de comissão do app
   * @returns Objeto com os valores calculados
   */
  calculateDeliveryPayment(
    deliveryAmount: number,
    commissionPercentage: number
  ): {
    deliveryAmount: number;
    appCommission: number;
    totalDeducted: number;
    driverReceivesInWallet: number;
  } {
    const appCommission = (deliveryAmount * commissionPercentage) / 100;
    const totalDeducted = appCommission;
    const driverReceivesInWallet = deliveryAmount - totalDeducted;

    return {
      deliveryAmount,
      appCommission,
      totalDeducted,
      driverReceivesInWallet,
    };
  }

  /**
   * Obtém o saldo disponível para saque de um entregador
   * @param driverId - ID do entregador
   * @returns Saldo disponível em reais e informações da subconta
   */
  async getDriverBalance(driverId: string): Promise<{
    success: boolean;
    balance: number;
    balanceInCents: number;
    subaccountPixKey: string | null;
    lastUpdate: Date | null;
    error?: string;
  }> {
    try {
      const driverSubaccount = await this.getDriverSubaccount(driverId);

      if (!driverSubaccount) {
        return {
          success: false,
          balance: 0,
          balanceInCents: 0,
          subaccountPixKey: null,
          lastUpdate: null,
          error: 'Entregador não possui subconta configurada. Configure sua chave PIX para receber pagamentos.',
        };
      }

      // Atualizar saldo consultando a Woovi
      const balanceInCents = await this.updateSubaccountBalance(driverSubaccount.id);
      const balance = wooviService.toReais(balanceInCents);

      return {
        success: true,
        balance,
        balanceInCents,
        subaccountPixKey: driverSubaccount.pixKey,
        lastUpdate: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Erro ao obter saldo do entregador:', errorMessage);

      return {
        success: false,
        balance: 0,
        balanceInCents: 0,
        subaccountPixKey: null,
        lastUpdate: null,
        error: errorMessage,
      };
    }
  }

  /**
   * Verifica se o entregador já realizou saque hoje
   * @param driverId - ID do entregador
   * @returns true se já sacou hoje, false caso contrário
   */
  async hasWithdrawnToday(driverId: string): Promise<boolean> {
    // Início do dia atual (meia-noite)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const withdrawalsToday = await db
      .select()
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.driverId, driverId),
        eq(financialTransactions.type, 'withdrawal'),
        eq(financialTransactions.status, 'completed'),
        gte(financialTransactions.createdAt, today)
      ))
      .limit(1);

    return withdrawalsToday.length > 0;
  }

  /**
   * Obtém informações do último saque do entregador
   * @param driverId - ID do entregador
   * @returns Data do último saque ou null
   */
  async getLastWithdrawal(driverId: string): Promise<Date | null> {
    const lastWithdrawal = await db
      .select()
      .from(financialTransactions)
      .where(and(
        eq(financialTransactions.driverId, driverId),
        eq(financialTransactions.type, 'withdrawal'),
        eq(financialTransactions.status, 'completed')
      ))
      .orderBy(desc(financialTransactions.createdAt))
      .limit(1);

    return lastWithdrawal.length > 0 ? lastWithdrawal[0].createdAt : null;
  }

  /**
   * Realiza saque do saldo do entregador para uma chave PIX
   * LIMITE: 1 saque por dia
   * TAXA: R$1,50 cobrada via débito da subconta para a conta principal
   * @param driverId - ID do entregador
   * @param amount - Valor do saque em reais (se não informado, saca todo o saldo menos a taxa)
   * @param destinationPixKey - Chave PIX de destino
   * @param destinationPixKeyType - Tipo da chave PIX (EMAIL, CPF, CNPJ, PHONE, EVP)
   * @returns Resultado do saque
   */
  async processDriverWithdrawal(
    driverId: string,
    destinationPixKey: string,
    destinationPixKeyType: 'EMAIL' | 'CPF' | 'CNPJ' | 'PHONE' | 'EVP',
    amount?: number
  ): Promise<{
    success: boolean;
    withdrawnAmount: number;
    withdrawalFee: number;
    netAmount: number;
    transactionId?: string;
    error?: string;
  }> {
    const WITHDRAWAL_FEE = 1.50; // Taxa de saque fixa de R$1,50

    try {
      console.log(`💰 Processando saque do entregador ${driverId}...`);

      // ==========================================
      // REGRA: Limite de 1 saque por dia
      // ==========================================
      const alreadyWithdrewToday = await this.hasWithdrawnToday(driverId);
      if (alreadyWithdrewToday) {
        throw new Error('Limite de saque atingido. Você já realizou um saque hoje. Tente novamente amanhã.');
      }

      // Buscar subconta do entregador
      const driverSubaccount = await this.getDriverSubaccount(driverId);

      if (!driverSubaccount) {
        throw new Error('Entregador não possui subconta configurada');
      }

      // Obter saldo atual
      const balanceInCents = await this.updateSubaccountBalance(driverSubaccount.id);
      const currentBalance = wooviService.toReais(balanceInCents);

      console.log(`   Saldo atual: R$ ${currentBalance.toFixed(2)}`);
      console.log(`   Taxa de saque: R$ ${WITHDRAWAL_FEE.toFixed(2)}`);

      // Verificar se tem saldo suficiente para a taxa
      if (currentBalance < WITHDRAWAL_FEE) {
        throw new Error(`Saldo insuficiente para cobrir a taxa de saque de R$ ${WITHDRAWAL_FEE.toFixed(2)}. Saldo: R$ ${currentBalance.toFixed(2)}`);
      }

      // Calcular valor disponível para saque (saldo - taxa)
      const availableForWithdrawal = currentBalance - WITHDRAWAL_FEE;

      // Determinar valor do saque
      let withdrawAmount: number;
      if (amount !== undefined) {
        withdrawAmount = amount;
      } else {
        // Se não informou valor, saca tudo menos a taxa
        withdrawAmount = availableForWithdrawal;
      }

      if (withdrawAmount <= 0) {
        throw new Error('Valor do saque deve ser maior que zero');
      }

      if (withdrawAmount > availableForWithdrawal) {
        throw new Error(`Valor máximo para saque: R$ ${availableForWithdrawal.toFixed(2)} (saldo R$ ${currentBalance.toFixed(2)} - taxa R$ ${WITHDRAWAL_FEE.toFixed(2)})`);
      }

      // Valor mínimo para saque
      const MIN_WITHDRAWAL = 1.00;
      if (withdrawAmount < MIN_WITHDRAWAL) {
        throw new Error(`Valor mínimo para saque é R$ ${MIN_WITHDRAWAL.toFixed(2)}`);
      }

      console.log(`   Valor do saque: R$ ${withdrawAmount.toFixed(2)}`);
      console.log(`   Chave PIX destino: ${destinationPixKey} (${destinationPixKeyType})`);

      // ==========================================
      // OPERAÇÃO 1: Cobrar taxa de saque via débito
      // Débito da subconta para a conta principal Woovi
      // ==========================================
      console.log(`\n💸 [1/2] Cobrando taxa de saque de R$ ${WITHDRAWAL_FEE.toFixed(2)}...`);

      const debitResult = await wooviService.debitFromSubaccount(driverSubaccount.pixKey, {
        value: wooviService.toCents(WITHDRAWAL_FEE),
        description: `Taxa de saque Fretus`,
      });

      console.log(`   ✅ Taxa de saque cobrada com sucesso`);

      // Registrar log da taxa de saque
      await this.logTransaction({
        type: 'withdrawal_fee',
        driverId,
        fromSubaccountId: driverSubaccount.id,
        amount: WITHDRAWAL_FEE.toString(),
        status: 'completed',
        description: `Taxa de saque: R$ ${WITHDRAWAL_FEE.toFixed(2)}`,
        wooviResponse: JSON.parse(JSON.stringify(debitResult)),
        metadata: JSON.parse(JSON.stringify({
          feeType: 'withdrawal_fee',
          fixedAmount: WITHDRAWAL_FEE,
        })),
      });

      // ==========================================
      // OPERAÇÃO 2: Realizar transferência PIX para a chave de destino
      // ==========================================
      console.log(`\n🔄 [2/2] Transferindo R$ ${withdrawAmount.toFixed(2)} para ${destinationPixKey}...`);

      const correlationId = wooviService.generateCorrelationId('WITHDRAW');

      const withdrawResult = await wooviService.withdrawToPixKey(
        driverSubaccount.pixKey,
        {
          value: wooviService.toCents(withdrawAmount),
          destinationPixKey,
          destinationPixKeyType,
          correlationID: correlationId,
        }
      );

      console.log(`   ✅ Saque realizado com sucesso!`);

      // Registrar log do saque
      await this.logTransaction({
        type: 'withdrawal',
        driverId,
        fromSubaccountId: driverSubaccount.id,
        amount: withdrawAmount.toString(),
        status: 'completed',
        description: `Saque de R$ ${withdrawAmount.toFixed(2)} para ${destinationPixKey}`,
        wooviTransactionId: correlationId,
        wooviResponse: JSON.parse(JSON.stringify(withdrawResult)),
        metadata: JSON.parse(JSON.stringify({
          destinationPixKey,
          destinationPixKeyType,
          correlationId,
          withdrawalFee: WITHDRAWAL_FEE,
        })),
      });

      // Atualizar saldo em cache
      await this.updateSubaccountBalance(driverSubaccount.id);

      const totalDeducted = withdrawAmount + WITHDRAWAL_FEE;
      console.log(`\n✅ Saque processado com sucesso!`);
      console.log(`   Valor transferido: R$ ${withdrawAmount.toFixed(2)}`);
      console.log(`   Taxa cobrada: R$ ${WITHDRAWAL_FEE.toFixed(2)}`);
      console.log(`   Total debitado: R$ ${totalDeducted.toFixed(2)}`);

      return {
        success: true,
        withdrawnAmount: withdrawAmount,
        withdrawalFee: WITHDRAWAL_FEE,
        netAmount: withdrawAmount, // Valor que o entregador recebe na conta
        transactionId: correlationId,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro ao processar saque:', errorMessage);

      // Registrar erro no log
      await this.logTransaction({
        type: 'withdrawal',
        driverId,
        amount: (amount ?? 0).toString(),
        status: 'failed',
        description: `Falha no saque`,
        errorMessage,
      });

      return {
        success: false,
        withdrawnAmount: 0,
        withdrawalFee: WITHDRAWAL_FEE,
        netAmount: 0,
        error: errorMessage,
      };
    }
  }
}

// Exportar instância única (singleton)
export const financialService = new FinancialService();
export default financialService;
