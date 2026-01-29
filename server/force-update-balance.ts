import { db } from "./db";
import { wooviSubaccounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import wooviService from "./services/woovi.service";
import dotenv from "dotenv";

dotenv.config();

async function forceUpdateBalance() {
  console.log("========================================");
  console.log("🔄 Forçando Atualização de Saldo");
  console.log("========================================\n");

  try {
    const subaccountId = "6c1d68d8-2e5f-472b-8c38-730d7ca94578";
    const pixKey = "compras@augustoebiancamudancasme.com.br";

    // 1. Buscar saldo na Woovi
    console.log("📊 Consultando saldo na Woovi...");
    const balanceResponse = await wooviService.getSubaccountBalance(pixKey);

    console.log("Resposta da API:", JSON.stringify(balanceResponse, null, 2));

    // A API pode retornar "SubAccount" ou "subAccount"
    const subAccountData = balanceResponse.SubAccount || balanceResponse.subAccount;
    if (balanceResponse && subAccountData) {
      const balanceInCents = subAccountData.balance;
      console.log(`\n✅ Saldo na Woovi: ${balanceInCents} centavos (R$ ${(balanceInCents / 100).toFixed(2)})`);

      // 2. Atualizar no banco
      console.log("\n📝 Atualizando no banco de dados...");
      await db
        .update(wooviSubaccounts)
        .set({
          balanceCache: balanceInCents.toString(),
          lastBalanceUpdate: new Date(),
        })
        .where(eq(wooviSubaccounts.id, subaccountId));

      console.log("✅ Saldo atualizado no banco!");

      // 3. Verificar
      const [updated] = await db
        .select()
        .from(wooviSubaccounts)
        .where(eq(wooviSubaccounts.id, subaccountId))
        .limit(1);

      console.log("\n📋 Subconta atualizada:");
      console.log(`   BalanceCache: ${updated.balanceCache}`);
      console.log(`   Em reais: R$ ${(parseInt(updated.balanceCache || '0') / 100).toFixed(2)}`);
      console.log(`   Última Atualização: ${updated.lastBalanceUpdate}`);
    } else {
      console.log("❌ Resposta inválida da Woovi");
    }

  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

forceUpdateBalance()
  .then(() => {
    console.log("\n✅ Atualização finalizada!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });
