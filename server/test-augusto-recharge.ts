import { db } from "./db";
import { companies, wooviSubaccounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { financialService } from "./services/financial.service";
import dotenv from "dotenv";

dotenv.config();

async function testAugustoRecharge() {
  console.log("========================================");
  console.log("🧪 Teste de Recarga - Augusto e Bianca");
  console.log("========================================\n");

  try {
    // 1. Buscar a empresa Augusto e Bianca
    console.log("📊 Buscando empresa Augusto e Bianca...");
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.pixKey, "compras@augustoebiancamudancasme.com.br"))
      .limit(1);

    if (!company) {
      console.log("❌ Empresa não encontrada!");
      return;
    }

    console.log("✅ Empresa encontrada:");
    console.log(`   ID: ${company.id}`);
    console.log(`   Nome: ${company.name}`);
    console.log(`   PIX: ${company.pixKey}`);

    // 2. Verificar subconta
    console.log("\n📊 Verificando subconta...");
    const [subaccount] = await db
      .select()
      .from(wooviSubaccounts)
      .where(eq(wooviSubaccounts.companyId, company.id))
      .limit(1);

    if (!subaccount) {
      console.log("❌ Subconta não encontrada no banco!");
      return;
    }

    console.log("✅ Subconta encontrada:");
    console.log(`   ID: ${subaccount.id}`);
    console.log(`   PIX: ${subaccount.pixKey}`);
    console.log(`   Nome: ${subaccount.name}`);

    // 3. Tentar criar uma recarga de R$ 50
    console.log("\n🎯 Criando recarga de R$ 50,00...");
    console.log("   Taxa da plataforma: R$ 0,85");
    console.log("   Valor para empresa: R$ 49,15");

    try {
      const recharge = await financialService.createRechargeWithSplit(
        company.id,
        50
      );

      console.log("\n✅ RECARGA CRIADA COM SUCESSO!");
      console.log(`   ID: ${recharge.id}`);
      console.log(`   Valor: R$ ${recharge.value}`);
      console.log(`   Status: ${recharge.status}`);
      console.log(`   QR Code: ${recharge.qrCode?.substring(0, 50)}...`);
      console.log(`   BR Code: ${recharge.brCode?.substring(0, 50)}...`);

      console.log("\n🎉 SUCESSO! A recarga foi criada!");
      console.log("\n📋 Instruções para o usuário:");
      console.log("1. Faça logout e login novamente como empresa");
      console.log("2. Acesse a carteira da empresa");
      console.log("3. A recarga deve aparecer com o QR Code para pagamento");

    } catch (rechargeError: any) {
      console.error("\n❌ ERRO ao criar recarga:", rechargeError?.message || rechargeError);

      // Diagnóstico adicional
      if (rechargeError?.message?.includes('não pertence a uma conta virtual')) {
        console.log("\n🔍 DIAGNÓSTICO:");
        console.log("   O erro indica que a subconta ainda não está ativa na Woovi.");
        console.log("   Mesmo que a criação tenha retornado sucesso, pode levar");
        console.log("   alguns segundos para a subconta ficar disponível.");
        console.log("\n   SOLUÇÃO: Aguarde 1-2 minutos e tente novamente.");
      }
    }

  } catch (error) {
    console.error("\n❌ Erro durante o teste:", error);
  }
}

console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");
console.log("🔑 WOOVI_APP_ID:", process.env.WOOVI_APP_ID ? "Configurado" : "NÃO CONFIGURADO");
console.log("");

testAugustoRecharge()
  .then(() => {
    console.log("\n✅ Teste finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });