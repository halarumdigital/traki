import { db } from "./db";
import { companies, wooviSubaccounts } from "@shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import wooviService from "./services/woovi.service";
import { financialService } from "./services/financial.service";
import dotenv from "dotenv";

dotenv.config();

async function syncCompanySubaccounts() {
  console.log("========================================");
  console.log("🔄 Sincronizando Subcontas das Empresas");
  console.log("========================================\n");

  try {
    // 1. Buscar todas as empresas com PIX configurado
    console.log("📊 Buscando empresas com PIX configurado...");
    const companiesWithPix = await db
      .select()
      .from(companies)
      .where(isNotNull(companies.pixKey));

    console.log(`✅ Encontradas ${companiesWithPix.length} empresas com PIX\n`);

    // 2. Para cada empresa, verificar se tem subconta
    for (const company of companiesWithPix) {
      console.log(`\n🏢 Processando: ${company.name}`);
      console.log(`   PIX: ${company.pixKey}`);

      // Verificar se já tem subconta no banco
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
        console.log(`   ✅ Subconta já existe no banco local`);

        // Verificar se existe na Woovi
        try {
          const wooviSubaccounts = await wooviService.listSubaccounts(0, 100);
          const foundInWoovi = wooviSubaccounts.subAccounts?.some(
            sub => sub.pixKey === company.pixKey
          );

          if (foundInWoovi) {
            console.log(`   ✅ Subconta existe na Woovi`);
          } else {
            console.log(`   ⚠️ Subconta NÃO existe na Woovi - Criando...`);

            // Criar na Woovi
            try {
              const wooviResponse = await wooviService.createSubaccount({
                name: `Empresa: ${company.name}`,
                pixKey: company.pixKey!,
              });
              console.log(`   ✅ Subconta criada na Woovi!`);
            } catch (error: any) {
              if (error?.message?.includes('already exists')) {
                console.log(`   ℹ️ Subconta já existe na Woovi (erro capturado)`);
              } else {
                console.error(`   ❌ Erro ao criar na Woovi: ${error?.message}`);
              }
            }
          }
        } catch (error) {
          console.error(`   ❌ Erro ao verificar na Woovi: ${error}`);
        }
      } else {
        console.log(`   ⚠️ Subconta NÃO existe no banco local`);

        // Tentar criar subconta completa (Woovi + banco)
        try {
          console.log(`   📝 Criando subconta completa...`);

          await financialService.createCompanySubaccount(
            company.id,
            company.pixKey!,
            company.pixKeyType as 'EMAIL' | 'CPF' | 'CNPJ' | 'PHONE' | 'EVP' || 'EMAIL',
            company.name
          );

          console.log(`   ✅ Subconta criada com sucesso!`);
        } catch (error: any) {
          console.error(`   ❌ Erro ao criar subconta: ${error?.message}`);

          // Se falhou na Woovi mas a chave já existe, registrar apenas no banco
          if (error?.message?.includes('already exists') || error?.message?.includes('já existe')) {
            console.log(`   ℹ️ Subconta já existe na Woovi, registrando apenas no banco...`);

            try {
              await db.insert(wooviSubaccounts).values({
                accountType: 'company' as const,
                companyId: company.id,
                pixKey: company.pixKey!,
                pixKeyType: company.pixKeyType || "EMAIL",
                name: `Empresa: ${company.name}`,
                active: true,
                balanceCache: '0',
              });

              console.log(`   ✅ Subconta registrada no banco local!`);
            } catch (dbError) {
              console.error(`   ❌ Erro ao registrar no banco: ${dbError}`);
            }
          }
        }
      }
    }

    // 3. Listar todas as subcontas na Woovi para verificação
    console.log("\n========================================");
    console.log("📋 Verificando todas as subcontas na Woovi:");
    console.log("========================================\n");

    const wooviResponse = await wooviService.listSubaccounts(0, 100);

    if (wooviResponse.subAccounts && wooviResponse.subAccounts.length > 0) {
      console.log(`Total de subcontas na Woovi: ${wooviResponse.subAccounts.length}\n`);

      wooviResponse.subAccounts.forEach((sub, index) => {
        console.log(`${index + 1}. ${sub.name}`);
        console.log(`   PIX: ${sub.pixKey}`);
      });
    } else {
      console.log("Nenhuma subconta encontrada na Woovi");
    }

  } catch (error) {
    console.error("\n❌ Erro durante a sincronização:", error);
  }
}

console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");
console.log("🔑 WOOVI_APP_ID:", process.env.WOOVI_APP_ID ? "Configurado" : "NÃO CONFIGURADO");
console.log("");

syncCompanySubaccounts()
  .then(() => {
    console.log("\n✅ Sincronização finalizada!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });