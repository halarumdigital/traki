/**
 * Script de teste para verificar a integração Woovi
 *
 * Uso: npx cross-env DATABASE_URL=postgresql://postgres:@0dJ2m0q82320@206.183.129.145:5432/fretus-dev npx tsx server/test-woovi-integration.ts
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
config({ path: path.join(__dirname, '../.env') });

import { db } from './db';
import { companies, wooviSubaccounts } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { financialService } from './services/financial.service';
import wooviService from './services/woovi.service';

async function testWooviIntegration() {
  console.log('\n🔍 Testando Integração Woovi\n');
  console.log('========================================\n');

  // Verificar configuração
  console.log('📋 Configuração:');
  console.log(`   WOOVI_APP_ID: ${process.env.WOOVI_APP_ID ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`   WOOVI_ENVIRONMENT: ${process.env.WOOVI_ENVIRONMENT || 'Não configurado'}`);
  console.log(`   WOOVI_API_URL: ${process.env.WOOVI_API_URL || 'Não configurado'}`);
  console.log(`   WOOVI_ADMIN_PIX_KEY: ${process.env.WOOVI_ADMIN_PIX_KEY || 'Não configurado'}`);
  console.log('\n');

  // Buscar última empresa com PIX
  console.log('🔍 Buscando última empresa com chave PIX...');
  const [lastCompanyWithPix] = await db
    .select()
    .from(companies)
    .where(eq(companies.pixKey, sql`${companies.pixKey} IS NOT NULL`))
    .orderBy(desc(companies.createdAt))
    .limit(1);

  if (lastCompanyWithPix) {
    console.log(`✅ Empresa encontrada: ${lastCompanyWithPix.name}`);
    console.log(`   PIX Key: ${lastCompanyWithPix.pixKey}`);
    console.log(`   PIX Type: ${lastCompanyWithPix.pixKeyType}`);

    // Verificar se já tem subconta
    const [existingSubaccount] = await db
      .select()
      .from(wooviSubaccounts)
      .where(eq(wooviSubaccounts.companyId, lastCompanyWithPix.id))
      .limit(1);

    if (existingSubaccount) {
      console.log(`✅ Subconta já existe:`, {
        id: existingSubaccount.id,
        pixKey: existingSubaccount.pixKey,
        balance: existingSubaccount.balanceCache,
      });

      // Atualizar saldo
      console.log('\n📊 Atualizando saldo...');
      try {
        const balance = await financialService.updateSubaccountBalance(existingSubaccount.id);
        console.log(`   Saldo atualizado: R$ ${balance.toFixed(2)}`);
      } catch (error) {
        console.log(`   ⚠️ Erro ao atualizar saldo:`, error);
      }
    } else {
      console.log('❌ Empresa não tem subconta Woovi');

      if (lastCompanyWithPix.pixKey && lastCompanyWithPix.pixKeyType) {
        console.log('\n🚀 Tentando criar subconta...');
        try {
          const subaccount = await financialService.createCompanySubaccount(
            lastCompanyWithPix.id,
            lastCompanyWithPix.pixKey,
            lastCompanyWithPix.pixKeyType as any,
            lastCompanyWithPix.name
          );
          console.log('✅ Subconta criada com sucesso!', subaccount);
        } catch (error) {
          console.error('❌ Erro ao criar subconta:', error);
        }
      }
    }
  } else {
    console.log('❌ Nenhuma empresa com chave PIX encontrada');
  }

  // Listar todas as subcontas
  console.log('\n📋 Listando todas as subcontas:');
  const allSubaccounts = await db.select().from(wooviSubaccounts);

  if (allSubaccounts.length === 0) {
    console.log('   Nenhuma subconta encontrada');
  } else {
    allSubaccounts.forEach((sub, index) => {
      console.log(`   ${index + 1}. ${sub.accountType} - ${sub.pixKey} - Saldo: R$ ${parseFloat(sub.balanceCache || '0').toFixed(2)}`);
    });
  }

  // Testar conexão com API Woovi
  console.log('\n🔌 Testando conexão com API Woovi...');
  try {
    const testCharge = await wooviService.createCharge({
      correlationID: `TEST_${Date.now()}`,
      value: 100, // R$ 1,00 em centavos
      comment: 'Teste de integração',
    });
    console.log('✅ API Woovi funcionando!');
    console.log(`   QR Code gerado: ${testCharge.charge.brCode?.substring(0, 50)}...`);
  } catch (error: any) {
    console.error('❌ Erro ao conectar com API Woovi:', error?.message || error);
  }

  console.log('\n========================================');
  console.log('✅ Teste concluído!\n');
  process.exit(0);
}

// Adicionar import para sql
import { sql } from 'drizzle-orm';

// Executar teste
testWooviIntegration().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});