import { db } from "./server/db.js";
import { drivers } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { generateReferralCode } from "./server/utils/referralUtils.js";

async function checkAndFixDriverCode() {
  try {
    console.log("🔍 Buscando motorista ze8@gmail.com...\n");

    // Buscar motoristas com email ze8@gmail.com ou nome ze8
    const foundDrivers = await db
      .select()
      .from(drivers)
      .where(
        or(
          eq(drivers.email, "ze8@gmail.com"),
          eq(drivers.name, "ze8")
        )
      );

    console.log(`📊 Encontrados ${foundDrivers.length} motoristas:\n`);

    for (const driver of foundDrivers) {
      console.log("========================================");
      console.log(`👤 Nome: ${driver.name}`);
      console.log(`📧 Email: ${driver.email}`);
      console.log(`📱 Mobile: ${driver.mobile}`);
      console.log(`🆔 ID: ${driver.id}`);
      console.log(`🎫 Código Atual: ${driver.referralCode || 'SEM CÓDIGO'}`);
      console.log(`✅ Aprovado: ${driver.approve ? 'Sim' : 'Não'}`);
      console.log(`🚚 Total de Entregas: ${driver.totalDeliveries || 0}`);

      // Se não tem código, gerar um novo
      if (!driver.referralCode) {
        console.log("\n⚠️ Motorista sem código! Gerando...");

        const newCode = await generateReferralCode(driver.name);

        await db
          .update(drivers)
          .set({
            referralCode: newCode,
            updatedAt: new Date()
          })
          .where(eq(drivers.id, driver.id));

        console.log(`✅ Novo código gerado: ${newCode}`);
      }
      console.log("========================================\n");
    }

    // Buscar novamente para confirmar
    console.log("📋 Verificando após atualização...");
    const updatedDrivers = await db
      .select()
      .from(drivers)
      .where(
        or(
          eq(drivers.email, "ze8@gmail.com"),
          eq(drivers.name, "ze8")
        )
      );

    for (const driver of updatedDrivers) {
      console.log(`✅ ${driver.name} (${driver.email}) - Código: ${driver.referralCode}`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

checkAndFixDriverCode();