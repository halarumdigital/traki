import { db } from "./db.js";
import { eq } from "drizzle-orm";
import { drivers, companies, companyReferrals } from "@shared/schema";

async function checkCompanyReferral() {
  console.log("🔍 Verificando indicação da empresa...\n");

  try {
    // 1. Verificar motorista com código ze60
    console.log("1. Buscando motorista com código 'ze60'...");
    const driver = await db
      .select()
      .from(drivers)
      .where(eq(drivers.referralCode, "ZE60"))
      .limit(1);

    if (driver.length === 0) {
      console.log("   ❌ Motorista com código 'ze60' não encontrado");
      return;
    }

    const foundDriver = driver[0];
    console.log("   ✅ Motorista encontrado:");
    console.log(`      ID: ${foundDriver.id}`);
    console.log(`      Nome: ${foundDriver.name}`);
    console.log(`      Código: ${foundDriver.referralCode}\n`);

    // 2. Verificar empresa cadastrada
    console.log("2. Buscando empresa com email 'desenvolvimento@amandaecarolinamarcenariame.com.br'...");
    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.email, "desenvolvimento@amandaecarolinamarcenariame.com.br"))
      .limit(1);

    if (company.length === 0) {
      console.log("   ❌ Empresa não encontrada");
      return;
    }

    const foundCompany = company[0];
    console.log("   ✅ Empresa encontrada:");
    console.log(`      ID: ${foundCompany.id}`);
    console.log(`      Nome: ${foundCompany.name}`);
    console.log(`      Razão Social: ${foundCompany.razaoSocial}`);
    console.log(`      Email: ${foundCompany.email}`);
    console.log(`      Indicado por: ${foundCompany.referredByDriverId || 'N/A'}\n`);

    // 3. Verificar se o campo referredByDriverId está preenchido
    if (!foundCompany.referredByDriverId) {
      console.log("   ⚠️  ATENÇÃO: Campo 'referredByDriverId' não está preenchido na empresa!");
    } else if (foundCompany.referredByDriverId === foundDriver.id) {
      console.log("   ✅ Campo 'referredByDriverId' está correto na empresa\n");
    } else {
      console.log(`   ⚠️  ATENÇÃO: Campo 'referredByDriverId' aponta para outro motorista: ${foundCompany.referredByDriverId}\n`);
    }

    // 4. Verificar registro na tabela company_referrals
    console.log("3. Buscando registro de indicação na tabela 'company_referrals'...");
    const referral = await db
      .select()
      .from(companyReferrals)
      .where(eq(companyReferrals.companyId, foundCompany.id))
      .limit(1);

    if (referral.length === 0) {
      console.log("   ❌ Registro de indicação NÃO encontrado na tabela 'company_referrals'");
      console.log("\n❌ PROBLEMA: A indicação não foi contabilizada!");
      console.log("   A empresa foi cadastrada mas o registro de indicação não foi criado.");
      return;
    }

    const foundReferral = referral[0];
    console.log("   ✅ Registro de indicação encontrado:");
    console.log(`      ID: ${foundReferral.id}`);
    console.log(`      Empresa ID: ${foundReferral.companyId}`);
    console.log(`      Motorista (indicador) ID: ${foundReferral.referrerDriverId}`);
    console.log(`      Entregas necessárias: ${foundReferral.requiredDeliveries}`);
    console.log(`      Entregas completadas: ${foundReferral.completedDeliveries}`);
    console.log(`      Valor da comissão: R$ ${foundReferral.commissionAmount}`);
    console.log(`      Status: ${foundReferral.status}`);
    console.log(`      Data de criação: ${foundReferral.createdAt}\n`);

    // Verificar se o motorista está correto
    if (foundReferral.referrerDriverId === foundDriver.id) {
      console.log("✅ SUCESSO: Indicação contabilizada corretamente!");
      console.log(`   ${foundDriver.name} (${foundDriver.referralCode}) indicou ${foundCompany.name}`);
      console.log(`   Progresso: ${foundReferral.completedDeliveries}/${foundReferral.requiredDeliveries} entregas`);
      console.log(`   Status: ${foundReferral.status}`);

      if (foundReferral.status === "qualified") {
        console.log(`   🎉 Meta atingida! Comissão de R$ ${foundReferral.commissionAmount} qualificada`);
      } else if (foundReferral.status === "paid") {
        console.log(`   💰 Comissão de R$ ${foundReferral.commissionAmount} já foi paga`);
      } else {
        const remaining = foundReferral.requiredDeliveries - foundReferral.completedDeliveries;
        console.log(`   📊 Faltam ${remaining} entregas para qualificar a comissão`);
      }
    } else {
      console.log(`   ⚠️  ATENÇÃO: O registro aponta para outro motorista (${foundReferral.referrerDriverId})`);
    }

  } catch (error) {
    console.error("❌ Erro ao verificar indicação:", error);
  } finally {
    process.exit(0);
  }
}

checkCompanyReferral();
