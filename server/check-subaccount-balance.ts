import { db } from "./db";
import { wooviSubaccounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function checkSubaccountBalance() {
  console.log("========================================");
  console.log("💳 Verificando Saldo da Subconta");
  console.log("========================================\n");

  try {
    // Buscar subconta específica
    const subaccountId = "6c1d68d8-2e5f-472b-8c38-730d7ca94578";

    const [subaccount] = await db
      .select()
      .from(wooviSubaccounts)
      .where(eq(wooviSubaccounts.id, subaccountId))
      .limit(1);

    if (subaccount) {
      console.log("✅ Subconta encontrada:");
      console.log(`   ID: ${subaccount.id}`);
      console.log(`   Nome: ${subaccount.name}`);
      console.log(`   PIX: ${subaccount.pixKey}`);
      console.log(`   CompanyID: ${subaccount.companyId}`);
      console.log(`   BalanceCache (raw): ${subaccount.balanceCache}`);
      console.log(`   BalanceCache (centavos): ${parseInt(subaccount.balanceCache || '0')}`);
      console.log(`   BalanceCache (reais): R$ ${(parseInt(subaccount.balanceCache || '0') / 100).toFixed(2)}`);
      console.log(`   Última Atualização: ${subaccount.lastBalanceUpdate}`);
      console.log(`   Account Type: ${subaccount.accountType}`);
      console.log(`   Active: ${subaccount.active}`);
    } else {
      console.log("❌ Subconta não encontrada");
    }

    // Buscar todas as subcontas
    console.log("\n========================================");
    console.log("📋 Todas as Subcontas");
    console.log("========================================\n");

    const allSubaccounts = await db
      .select()
      .from(wooviSubaccounts);

    for (const sub of allSubaccounts) {
      console.log(`📊 ${sub.name || 'Sem nome'}`);
      console.log(`   ID: ${sub.id}`);
      console.log(`   PIX: ${sub.pixKey}`);
      console.log(`   Saldo: R$ ${(parseInt(sub.balanceCache || '0') / 100).toFixed(2)}`);
      console.log(`   Tipo: ${sub.accountType}`);
      console.log(`   Ativo: ${sub.active}`);
      console.log("");
    }

  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

checkSubaccountBalance()
  .then(() => {
    console.log("\n✅ Verificação finalizada!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });
