import wooviService from "./services/woovi.service";
import { db } from "./db";
import { wooviSubaccounts, companies } from "@shared/schema";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function debugWooviBalance() {
  console.log("========================================");
  console.log("🔍 Debug de Saldo da Woovi");
  console.log("========================================\n");

  try {
    // Buscar subconta da empresa Augusto e Bianca
    const [subaccount] = await db
      .select({
        subaccount: wooviSubaccounts,
        company: companies,
      })
      .from(wooviSubaccounts)
      .leftJoin(companies, eq(wooviSubaccounts.companyId, companies.id))
      .where(eq(wooviSubaccounts.pixKey, "compras@augustoebiancamudancasme.com.br"))
      .limit(1);

    if (!subaccount) {
      console.log("❌ Subconta não encontrada no banco");
      return;
    }

    console.log("✅ Subconta encontrada no banco:");
    console.log(`   Nome: ${subaccount.company?.name}`);
    console.log(`   PIX: ${subaccount.subaccount.pixKey}`);
    console.log(`   Saldo Cache: R$ ${parseFloat(subaccount.subaccount.balanceCache || '0').toFixed(2)}`);

    // Tentar buscar saldo na Woovi
    console.log("\n🔍 Consultando saldo na API da Woovi...");
    console.log(`   Ambiente: ${process.env.WOOVI_PRODUCTION === 'true' ? 'PRODUÇÃO' : 'SANDBOX'}`);
    console.log(`   PIX Key: ${subaccount.subaccount.pixKey}`);

    try {
      const balanceResponse = await wooviService.getSubaccountBalance(subaccount.subaccount.pixKey);

      console.log("\n📊 Resposta da API:");
      console.log(JSON.stringify(balanceResponse, null, 2));

      if (balanceResponse && balanceResponse.SubAccount) {
        const balanceInReais = (balanceResponse.SubAccount.balance / 100).toFixed(2);
        console.log(`\n💰 Saldo na Woovi: R$ ${balanceInReais}`);
      } else {
        console.log("\n⚠️ Resposta não contém SubAccount");
      }
    } catch (error: any) {
      console.error("\n❌ Erro ao buscar saldo:", error.message);

      if (error.message.includes('não tem permissão')) {
        console.log("\n🔧 SOLUÇÃO:");
        console.log("   1. Acesse o painel da Woovi");
        console.log("   2. Vá em Configurações → Segurança → IPs Permitidos");
        console.log("   3. Adicione o IP do servidor");
        console.log("   4. Ou desabilite a restrição de IP para ambiente de desenvolvimento");
      }
    }

    // Listar subcontas na Woovi
    console.log("\n========================================");
    console.log("📋 Listando subcontas na Woovi:");
    console.log("========================================\n");

    try {
      const subaccountsList = await wooviService.listSubaccounts(0, 10);

      if (subaccountsList.subAccounts && subaccountsList.subAccounts.length > 0) {
        console.log(`✅ Encontradas ${subaccountsList.subAccounts.length} subconta(s):\n`);

        subaccountsList.subAccounts.forEach((sub: any, index: number) => {
          console.log(`${index + 1}. ${sub.name}`);
          console.log(`   PIX: ${sub.pixKey}`);
          console.log(`   Saldo: R$ ${(sub.balance / 100).toFixed(2)}`);
          console.log("");
        });
      } else {
        console.log("❌ Nenhuma subconta encontrada");
      }
    } catch (error: any) {
      console.error("❌ Erro ao listar subcontas:", error.message);
    }

  } catch (error) {
    console.error("\n❌ Erro durante debug:", error);
  }
}

console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");
console.log("🔑 WOOVI_APP_ID:", process.env.WOOVI_APP_ID ? "Configurado" : "NÃO CONFIGURADO");
console.log("🌍 Ambiente:", process.env.WOOVI_PRODUCTION === 'true' ? 'PRODUÇÃO' : 'SANDBOX');
console.log("");

debugWooviBalance()
  .then(() => {
    console.log("\n✅ Debug finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });