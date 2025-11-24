// Script rápido para registrar a subconta da empresa no banco
import { db } from "./db";
import { companies, wooviSubaccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

async function fixCompanySubaccount() {
  try {
    console.log("🔍 Buscando empresa Diego e Edson...");

    // Buscar a empresa
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.email, "producao@diegoeedsondocessalgadosltda.com.br"))
      .limit(1);

    if (!company) {
      console.log("❌ Empresa não encontrada!");
      process.exit(1);
    }

    console.log(`✅ Empresa encontrada: ${company.name}`);
    console.log(`   ID: ${company.id}`);
    console.log(`   PIX: ${company.pixKey}`);

    // Verificar se já tem subconta
    const [existing] = await db
      .select()
      .from(wooviSubaccounts)
      .where(eq(wooviSubaccounts.companyId, company.id))
      .limit(1);

    if (existing) {
      console.log("✅ Subconta já existe no banco!");
      process.exit(0);
    }

    // Criar subconta no banco
    console.log("📝 Criando registro da subconta...");

    const [newSubaccount] = await db.insert(wooviSubaccounts).values({
      accountType: 'company' as const,
      companyId: company.id,
      pixKey: company.pixKey || "producao@diegoeedsondocessalgadosltda.com.br",
      pixKeyType: company.pixKeyType || "EMAIL",
      name: company.name,
      active: true,
      balanceCache: '0',
    }).returning();

    console.log("✅ Subconta registrada com sucesso!");
    console.log(`   ID: ${newSubaccount.id}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

fixCompanySubaccount();