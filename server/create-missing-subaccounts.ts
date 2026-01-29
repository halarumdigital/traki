import { db } from "./db";
import { companies, wooviSubaccounts } from "@shared/schema";
import { eq, and, isNotNull, isNull } from "drizzle-orm";
import financialService from "./services/financial.service";

async function createMissingSubaccounts() {
  console.log("🔍 Buscando empresas com PIX mas sem subconta...\n");

  try {

    // Buscar todas as empresas que têm PIX configurado
    const companiesWithPix = await db
      .select()
      .from(companies)
      .where(
        and(
          isNotNull(companies.pixKey),
          isNotNull(companies.pixKeyType)
        )
      );

    console.log(`📊 Total de empresas com PIX: ${companiesWithPix.length}`);

    for (const company of companiesWithPix) {
      console.log(`\n🏢 Verificando empresa: ${company.name}`);
      console.log(`   PIX: ${company.pixKey} (${company.pixKeyType})`);

      // Verificar se já tem subconta
      const existingSubaccount = await db
        .select()
        .from(wooviSubaccounts)
        .where(
          and(
            eq(wooviSubaccounts.companyId, company.id),
            eq(wooviSubaccounts.accountType, 'company')
          )
        )
        .limit(1);

      if (existingSubaccount.length > 0) {
        console.log(`   ✅ Já possui subconta: ${existingSubaccount[0].id}`);
        continue;
      }

      // Criar subconta
      console.log(`   ⚠️  Não possui subconta. Criando...`);

      try {
        const subconta = await financialService.createCompanySubaccount(
          company.id,
          company.pixKey!,
          company.pixKeyType as any,
          company.name
        );

        console.log(`   ✅ Subconta criada com sucesso!`);
        console.log(`      ID: ${subconta.id}`);
        console.log(`      PIX: ${subconta.pixKey}`);
      } catch (error) {
        console.error(`   ❌ Erro ao criar subconta:`, error);

        // Se o erro for que a subconta já existe na Woovi, apenas registrar no banco
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log(`   📝 Subconta já existe na Woovi, registrando no banco...`);

          const [newSubaccount] = await db.insert(wooviSubaccounts).values({
            accountType: 'company',
            companyId: company.id,
            pixKey: company.pixKey!,
            pixKeyType: company.pixKeyType!,
            name: company.name,
            active: true,
            balanceCache: '0',
          }).returning();

          console.log(`   ✅ Subconta registrada no banco: ${newSubaccount.id}`);
        }
      }
    }

    console.log("\n✅ Verificação concluída!");

    // Mostrar resumo final
    const totalSubaccounts = await db
      .select()
      .from(wooviSubaccounts)
      .where(eq(wooviSubaccounts.accountType, 'company'));

    console.log(`\n📊 Resumo final:`);
    console.log(`   Total de empresas com PIX: ${companiesWithPix.length}`);
    console.log(`   Total de subcontas de empresa: ${totalSubaccounts.length}`);

  } catch (error) {
    console.error("❌ Erro durante a verificação:", error);
    process.exit(1);
  }
}

// Executar
console.log("========================================");
console.log("🚀 Criação de Subcontas Faltantes");
console.log("========================================\n");

createMissingSubaccounts()
  .then(() => {
    console.log("\n✅ Processo finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });