import wooviService from "./services/woovi.service";
import dotenv from "dotenv";

dotenv.config();

async function createAllSubaccounts() {
  console.log("========================================");
  console.log("🚀 Criando TODAS as Subcontas na Woovi");
  console.log("========================================\n");

  const subaccounts = [
    {
      name: "Empresa: Diego e Edson Doces & Salgados Ltda",
      pixKey: "producao@diegoeedsondocessalgadosltda.com.br",
      pixKeyType: "EMAIL" as const
    },
    {
      name: "Empresa: Augusto e Bianca Mudanças ME",
      pixKey: "compras@augustoebiancamudancasme.com.br",
      pixKeyType: "EMAIL" as const
    }
  ];

  for (const subaccount of subaccounts) {
    console.log(`📊 Processando: ${subaccount.name}`);
    console.log(`   PIX: ${subaccount.pixKey}`);
    console.log(`   Tipo: ${subaccount.pixKeyType}`);

    try {
      console.log("   📝 Criando na Woovi...");

      const response = await wooviService.createSubaccount({
        name: subaccount.name,
        pixKey: subaccount.pixKey,
      });

      console.log("   ✅ Subconta criada com sucesso!");
      console.log(`   Nome: ${response.subAccount.name}`);
      console.log(`   PIX: ${response.subAccount.pixKey}\n`);

    } catch (error: any) {
      if (error?.message?.includes('already exists') ||
          error?.message?.includes('já existe') ||
          error?.message?.includes('already associated')) {
        console.log("   ℹ️ Subconta já existe na Woovi\n");
      } else {
        console.error(`   ❌ Erro: ${error?.message || error}\n`);
      }
    }
  }

  // Tentar listar as subcontas novamente
  console.log("========================================");
  console.log("📋 Verificando subcontas criadas:");
  console.log("========================================\n");

  try {
    // Usar uma chamada direta para testar
    const response = await fetch(
      `${process.env.WOOVI_PRODUCTION === 'true' ? 'https://api.woovi.com' : 'https://api.woovi-sandbox.com'}/api/v1/subaccount/list`,
      {
        method: 'GET',
        headers: {
          'Authorization': process.env.WOOVI_APP_ID!,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = await response.text();
    console.log("Resposta da API:", text);

    if (response.ok) {
      const data = JSON.parse(text);
      if (data.subAccounts && data.subAccounts.length > 0) {
        console.log(`\n✅ Total de subcontas: ${data.subAccounts.length}\n`);
        data.subAccounts.forEach((sub: any, index: number) => {
          console.log(`${index + 1}. ${sub.name}`);
          console.log(`   PIX: ${sub.pixKey}`);
        });
      }
    }
  } catch (error) {
    console.log("Não foi possível listar as subcontas:", error);
  }
}

createAllSubaccounts()
  .then(() => {
    console.log("\n✅ Processo finalizado!");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
  });