import wooviService from "./services/woovi.service";
import dotenv from "dotenv";

dotenv.config();

async function listWooviSubaccounts() {
  console.log("========================================");
  console.log("📋 Listando Subcontas na Woovi");
  console.log("========================================\n");

  try {
    const response = await wooviService.listSubaccounts(0, 100);

    console.log(`Total de subcontas: ${response.subAccounts?.length || 0}\n`);

    if (response.subAccounts && response.subAccounts.length > 0) {
      response.subAccounts.forEach((sub, index) => {
        console.log(`${index + 1}. ${sub.name}`);
        console.log(`   PIX: ${sub.pixKey}`);
        console.log("");
      });
    }

    // Procurar por Augusto e Bianca
    const augusto = response.subAccounts?.find(s =>
      s.name.toLowerCase().includes('augusto') ||
      s.pixKey.toLowerCase().includes('augusto')
    );

    if (augusto) {
      console.log("⭐ ENCONTRADA - Subconta da Augusto e Bianca:");
      console.log(`   Nome: ${augusto.name}`);
      console.log(`   PIX: ${augusto.pixKey}`);
      console.log("\n   ⚠️  A chave PIX correta é: ${augusto.pixKey}");
      console.log("   Precisa atualizar no banco de dados!");
    }

  } catch (error) {
    console.error("Erro:", error);
  }
}

listWooviSubaccounts()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });