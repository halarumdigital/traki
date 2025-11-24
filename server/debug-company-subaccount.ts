import { db } from "./db";
import { companies, wooviSubaccounts } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import wooviService from "./services/woovi.service";
import dotenv from "dotenv";

dotenv.config();

async function debugCompanySubaccount() {
  console.log("========================================");
  console.log("🔍 Debug de Subconta da Empresa");
  console.log("========================================\n");

  try {
    // 1. Buscar a última empresa criada
    console.log("📊 Buscando última empresa cadastrada...");
    const [lastCompany] = await db
      .select()
      .from(companies)
      .orderBy(desc(companies.createdAt))
      .limit(1);

    if (!lastCompany) {
      console.log("❌ Nenhuma empresa encontrada");
      return;
    }

    console.log("\n✅ Última empresa:");
    console.log(`   ID: ${lastCompany.id}`);
    console.log(`   Nome: ${lastCompany.name}`);
    console.log(`   Email: ${lastCompany.email}`);
    console.log(`   PIX Key: ${lastCompany.pixKey || 'NÃO CONFIGURADO'}`);
    console.log(`   PIX Type: ${lastCompany.pixKeyType || 'NÃO CONFIGURADO'}`);
    console.log(`   Criada em: ${lastCompany.createdAt}`);

    // 2. Buscar subconta no banco
    console.log("\n📊 Buscando subconta no banco local...");
    const [subaccount] = await db
      .select()
      .from(wooviSubaccounts)
      .where(and(
        eq(wooviSubaccounts.companyId, lastCompany.id),
        eq(wooviSubaccounts.accountType, 'company')
      ))
      .limit(1);

    if (!subaccount) {
      console.log("❌ Subconta NÃO encontrada no banco local!");
      console.log("   A subconta precisa ser registrada no banco");
    } else {
      console.log("✅ Subconta encontrada no banco:");
      console.log(`   ID: ${subaccount.id}`);
      console.log(`   Company ID: ${subaccount.companyId}`);
      console.log(`   PIX Key: ${subaccount.pixKey}`);
      console.log(`   PIX Type: ${subaccount.pixKeyType}`);
      console.log(`   Nome: ${subaccount.name}`);
      console.log(`   Ativa: ${subaccount.active ? 'SIM' : 'NÃO'}`);
      console.log(`   Saldo cache: R$ ${parseFloat(subaccount.balanceCache || '0').toFixed(2)}`);
    }

    // 3. Verificar na Woovi
    console.log("\n📊 Verificando subcontas na Woovi...");
    const wooviResponse = await wooviService.listSubaccounts(0, 100);

    console.log(`   Total de subcontas na Woovi: ${wooviResponse.subAccounts?.length || 0}`);

    if (wooviResponse.subAccounts) {
      console.log("\n   Subcontas encontradas:");
      wooviResponse.subAccounts.forEach((sub, index) => {
        console.log(`   ${index + 1}. ${sub.name}`);
        console.log(`      PIX: ${sub.pixKey}`);

        // Verificar se corresponde à empresa
        if (lastCompany.pixKey && sub.pixKey.toLowerCase().includes(lastCompany.name.toLowerCase().replace(/\s+/g, ''))) {
          console.log(`      ⭐ Esta parece ser a subconta da empresa!`);
        }
      });
    }

    // 4. Diagnóstico
    console.log("\n🔧 DIAGNÓSTICO:");

    if (lastCompany.pixKey && !subaccount) {
      console.log("❌ PROBLEMA: Empresa tem PIX configurado mas não tem subconta no banco!");
      console.log("   SOLUÇÃO: Registrar a subconta no banco de dados");

      // Criar automaticamente
      console.log("\n📝 Criando registro da subconta automaticamente...");

      const [newSubaccount] = await db.insert(wooviSubaccounts).values({
        accountType: 'company' as const,
        companyId: lastCompany.id,
        pixKey: lastCompany.pixKey,
        pixKeyType: lastCompany.pixKeyType || "EMAIL",
        name: lastCompany.name,
        active: true,
        balanceCache: '0',
      }).returning();

      console.log("✅ Subconta registrada com sucesso!");
      console.log(`   ID: ${newSubaccount.id}`);
      console.log(`   PIX: ${newSubaccount.pixKey}`);
    }

    if (!lastCompany.pixKey && subaccount) {
      console.log("⚠️  AVISO: Subconta existe mas empresa não tem PIX configurado");
    }

    if (lastCompany.pixKey && subaccount) {
      if (lastCompany.pixKey !== subaccount.pixKey) {
        console.log("⚠️  AVISO: PIX da empresa diferente do PIX da subconta!");
        console.log(`   Empresa PIX: ${lastCompany.pixKey}`);
        console.log(`   Subconta PIX: ${subaccount.pixKey}`);

        // Atualizar subconta
        console.log("\n📝 Atualizando PIX da subconta...");
        await db
          .update(wooviSubaccounts)
          .set({ pixKey: lastCompany.pixKey })
          .where(eq(wooviSubaccounts.id, subaccount.id));

        console.log("✅ PIX atualizado!");
      } else {
        console.log("✅ Tudo OK! Empresa e subconta configuradas corretamente.");
      }
    }

  } catch (error) {
    console.error("\n❌ Erro:", error);
  }
}

console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");
console.log("🔑 WOOVI_APP_ID:", process.env.WOOVI_APP_ID ? "Configurado" : "NÃO CONFIGURADO");
console.log("");

debugCompanySubaccount()
  .then(() => {
    console.log("\n✅ Debug finalizado!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });