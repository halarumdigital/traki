import { db } from "./db";
import { wooviCharges, wooviSubaccounts, companies } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function checkChargesDb() {
  console.log("========================================");
  console.log("💰 Verificando Cobranças no Banco");
  console.log("========================================\n");

  try {
    // Buscar cobranças recentes
    const charges = await db
      .select({
        id: wooviCharges.id,
        correlationId: wooviCharges.correlationId,
        value: wooviCharges.value,
        status: wooviCharges.status,
        subaccountId: wooviCharges.subaccountId,
        companyId: wooviCharges.companyId,
        createdAt: wooviCharges.createdAt,
        updatedAt: wooviCharges.updatedAt,
      })
      .from(wooviCharges)
      .orderBy(desc(wooviCharges.createdAt))
      .limit(10);

    console.log(`📊 Encontradas ${charges.length} cobranças:\n`);

    for (const charge of charges) {
      console.log(`📝 ID: ${charge.id}`);
      console.log(`   CorrelationID: ${charge.correlationId}`);
      console.log(`   Valor: R$ ${parseFloat(charge.value).toFixed(2)}`);
      console.log(`   Status: ${charge.status}`);
      console.log(`   SubaccountID: ${charge.subaccountId || '❌ NÃO DEFINIDO'}`);
      console.log(`   CompanyID: ${charge.companyId || 'N/A'}`);
      console.log(`   Criada: ${charge.createdAt}`);
      console.log(`   Atualizada: ${charge.updatedAt || 'Nunca'}`);
      console.log("");
    }

    // Verificar subcontas
    console.log("========================================");
    console.log("📋 Subcontas Cadastradas");
    console.log("========================================\n");

    const subaccounts = await db
      .select({
        id: wooviSubaccounts.id,
        name: wooviSubaccounts.name,
        pixKey: wooviSubaccounts.pixKey,
        companyId: wooviSubaccounts.companyId,
        balanceCache: wooviSubaccounts.balanceCache,
        lastBalanceUpdate: wooviSubaccounts.lastBalanceUpdate,
      })
      .from(wooviSubaccounts)
      .limit(10);

    for (const sub of subaccounts) {
      console.log(`📊 ${sub.name}`);
      console.log(`   ID: ${sub.id}`);
      console.log(`   PIX: ${sub.pixKey}`);
      console.log(`   CompanyID: ${sub.companyId || 'N/A'}`);
      console.log(`   Saldo Cache: ${sub.balanceCache ? (parseInt(sub.balanceCache) / 100).toFixed(2) : '0.00'} reais`);
      console.log(`   Última Atualização: ${sub.lastBalanceUpdate || 'Nunca'}`);
      console.log("");
    }

  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

checkChargesDb()
  .then(() => {
    console.log("\n✅ Verificação finalizada!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });
