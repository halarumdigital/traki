import { db } from "./server/db.js";
import { drivers } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { generateReferralCode } from "./server/utils/referralUtils.js";

async function generateReferralCodesForApprovedDrivers() {
  try {
    console.log("🔄 Buscando motoristas aprovados sem código de indicação...");

    // Buscar motoristas aprovados que não têm código de indicação
    const driversWithoutCode = await db
      .select()
      .from(drivers)
      .where(
        and(
          eq(drivers.approve, true),
          isNull(drivers.referralCode)
        )
      );

    if (driversWithoutCode.length === 0) {
      console.log("✅ Todos os motoristas aprovados já possuem código de indicação!");
      process.exit(0);
    }

    console.log(`📊 Encontrados ${driversWithoutCode.length} motoristas sem código de indicação`);
    console.log("🎯 Gerando códigos únicos...\n");

    let successCount = 0;
    let errorCount = 0;

    for (const driver of driversWithoutCode) {
      try {
        // Gerar código único baseado no nome do motorista
        const referralCode = await generateReferralCode(driver.name);

        // Atualizar motorista com o novo código
        await db
          .update(drivers)
          .set({
            referralCode: referralCode,
            updatedAt: new Date()
          })
          .where(eq(drivers.id, driver.id));

        console.log(`✅ ${driver.name}: ${referralCode}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Erro ao gerar código para ${driver.name}:`, error);
        errorCount++;
      }
    }

    console.log("\n========================================");
    console.log(`✅ Códigos gerados com sucesso: ${successCount}`);
    if (errorCount > 0) {
      console.log(`❌ Erros ao gerar códigos: ${errorCount}`);
    }
    console.log("========================================");

    // Listar todos os motoristas aprovados com seus códigos
    console.log("\n📋 LISTA COMPLETA DE MOTORISTAS APROVADOS COM CÓDIGOS:");
    console.log("========================================");

    const allApprovedDrivers = await db
      .select({
        id: drivers.id,
        name: drivers.name,
        mobile: drivers.mobile,
        referralCode: drivers.referralCode,
        totalDeliveries: drivers.totalDeliveries,
      })
      .from(drivers)
      .where(eq(drivers.approve, true));

    for (const driver of allApprovedDrivers) {
      console.log(`👤 ${driver.name}`);
      console.log(`   📱 WhatsApp: ${driver.mobile}`);
      console.log(`   🎫 Código: ${driver.referralCode || 'SEM CÓDIGO'}`);
      console.log(`   🚚 Entregas: ${driver.totalDeliveries || 0}`);
      console.log("");
    }

    console.log(`\n🎉 Total de motoristas aprovados: ${allApprovedDrivers.length}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao gerar códigos de indicação:", error);
    process.exit(1);
  }
}

// Executar script
generateReferralCodesForApprovedDrivers();