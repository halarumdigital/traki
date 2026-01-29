import { db } from "./db";
import { companies, wooviSubaccounts } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import wooviService from "./services/woovi.service";
import dotenv from "dotenv";

dotenv.config();

async function registerSubaccountInDatabase() {
  console.log("========================================");
  console.log("🚀 Registro de Subconta no Banco Local");
  console.log("========================================\n");

  // Dados da empresa
  const companyEmail = "producao@diegoeedsondocessalgadosltda.com.br";

  try {
    // 1. Buscar a empresa pelo email (que é a chave PIX)
    console.log("🔍 Buscando empresa no banco de dados...");
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.pixKey, companyEmail))
      .limit(1);

    if (!company) {
      console.error(`❌ Empresa com PIX ${companyEmail} não encontrada no banco`);

      // Listar empresas com PIX
      const companiesWithPix = await db
        .select({ id: companies.id, name: companies.name, pixKey: companies.pixKey })
        .from(companies)
        .where(and(
          eq(companies.pixKey, companyEmail)
        ));

      console.log("\n📋 Empresas encontradas:");
      companiesWithPix.forEach(c => {
        console.log(`   - ${c.name}: ${c.pixKey || 'sem PIX'}`);
      });

      return;
    }

    console.log(`✅ Empresa encontrada: ${company.name}`);
    console.log(`   ID: ${company.id}`);
    console.log(`   PIX: ${company.pixKey}`);

    // 2. Verificar se já existe subconta registrada
    console.log("\n🔍 Verificando subconta no banco local...");
    const [existingSubaccount] = await db
      .select()
      .from(wooviSubaccounts)
      .where(
        and(
          eq(wooviSubaccounts.companyId, company.id),
          eq(wooviSubaccounts.accountType, 'company')
        )
      )
      .limit(1);

    if (existingSubaccount) {
      console.log(`✅ Subconta já registrada no banco:`);
      console.log(`   ID: ${existingSubaccount.id}`);
      console.log(`   PIX: ${existingSubaccount.pixKey}`);
      console.log(`   Ativa: ${existingSubaccount.active ? 'Sim' : 'Não'}`);
      return;
    }

    // 3. Verificar se subconta existe na Woovi
    console.log("\n🔍 Verificando subconta na Woovi...");
    const wooviSubaccount = await wooviService.getSubaccountByPixKey(company.pixKey!);

    if (!wooviSubaccount) {
      console.log("❌ Subconta não encontrada na Woovi");
      console.log("   Execute o script create-company-subaccount.ts primeiro");
      return;
    }

    console.log("✅ Subconta encontrada na Woovi:");
    console.log(`   Nome: ${wooviSubaccount.name}`);
    console.log(`   PIX: ${wooviSubaccount.pixKey}`);

    // 4. Registrar subconta no banco local
    console.log("\n📝 Registrando subconta no banco de dados local...");
    const [newSubaccount] = await db.insert(wooviSubaccounts).values({
      accountType: 'company',
      companyId: company.id,
      pixKey: company.pixKey!,
      pixKeyType: company.pixKeyType || 'EMAIL',
      name: company.name,
      active: true,
      balanceCache: '0',
      lastBalanceUpdate: new Date(),
    }).returning();

    console.log("\n✅ Subconta registrada com sucesso!");
    console.log(`   ID: ${newSubaccount.id}`);
    console.log(`   Empresa: ${newSubaccount.name}`);
    console.log(`   PIX: ${newSubaccount.pixKey}`);
    console.log(`   Tipo: ${newSubaccount.pixKeyType}`);

    // 5. Listar todas as subcontas da Woovi
    console.log("\n📋 Listando todas as subcontas na Woovi...");
    const allSubaccounts = await wooviService.listSubaccounts(0, 100);

    console.log(`   Total de subcontas: ${allSubaccounts.subAccounts?.length || 0}`);

    if (allSubaccounts.subAccounts && allSubaccounts.subAccounts.length > 0) {
      console.log("\n   Subcontas encontradas:");
      allSubaccounts.subAccounts.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.name}`);
        console.log(`      PIX: ${sub.pixKey}`);
      });
    }

  } catch (error) {
    console.error("\n❌ Erro durante o processo:", error);
    process.exit(1);
  }
}

// Executar
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");
console.log("");

registerSubaccountInDatabase()
  .then(() => {
    console.log("\n✅ Processo finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });