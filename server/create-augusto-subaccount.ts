import wooviService from "./services/woovi.service";
import dotenv from "dotenv";

dotenv.config();

async function createAugustoSubaccount() {
  console.log("========================================");
  console.log("🚀 Criando Subconta para Augusto e Bianca");
  console.log("========================================\n");

  const subaccountData = {
    name: "Empresa: Augusto e Bianca Mudanças ME",
    pixKey: "compras@augustoebiancamudancasme.com.br",
    pixKeyType: "EMAIL" as const
  };

  console.log("📊 Dados da subconta:");
  console.log(`   Nome: ${subaccountData.name}`);
  console.log(`   PIX: ${subaccountData.pixKey}`);
  console.log(`   Tipo: ${subaccountData.pixKeyType}\n`);

  try {
    console.log("📝 Criando subconta na Woovi...");

    const response = await wooviService.createSubaccount({
      name: subaccountData.name,
      pixKey: subaccountData.pixKey,
    });

    console.log("\n✅ Subconta criada com sucesso!");
    console.log(`   Nome: ${response.subAccount.name}`);
    console.log(`   PIX: ${response.subAccount.pixKey}`);

  } catch (error: any) {
    if (error?.message?.includes('already exists') || error?.message?.includes('já existe')) {
      console.log("\n✅ Subconta já existe na Woovi!");
    } else {
      console.error("\n❌ Erro ao criar subconta:", error?.message || error);
    }
  }

  console.log("\n📋 Próximos passos:");
  console.log("1. Faça logout e login novamente como empresa");
  console.log("2. Tente gerar uma recarga novamente");
  console.log("3. Agora deve funcionar!");
}

createAugustoSubaccount()
  .then(() => {
    console.log("\n✅ Processo finalizado!");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
  });