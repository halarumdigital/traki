import { db } from "./server/db.js";
import { drivers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateReferralCode } from "./server/utils/referralUtils.js";

async function generateCodeForZe9() {
  try {
    console.log("🔍 Gerando código para ze9@gmail.com...\n");

    // Buscar ze9
    const [ze9] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze9@gmail.com"))
      .limit(1);

    if (!ze9) {
      console.log("❌ Motorista ze9@gmail.com não encontrado!");
      process.exit(1);
    }

    console.log("✅ Motorista encontrado:");
    console.log(`   Nome: ${ze9.name}`);
    console.log(`   Email: ${ze9.email}`);
    console.log(`   Código atual: ${ze9.referralCode || "SEM CÓDIGO"}`);

    if (ze9.referralCode) {
      console.log("\n✅ Motorista já possui código!");
      process.exit(0);
    }

    // Gerar novo código
    console.log("\n🎯 Gerando novo código...");
    const newCode = await generateReferralCode(ze9.name);

    // Atualizar motorista
    await db
      .update(drivers)
      .set({
        referralCode: newCode,
        updatedAt: new Date()
      })
      .where(eq(drivers.id, ze9.id));

    console.log(`✅ Código gerado: ${newCode}`);

    // Verificar
    const [updated] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze9@gmail.com"))
      .limit(1);

    console.log("\n📋 Dados atualizados:");
    console.log(`   🎫 Código: ${updated.referralCode}`);
    console.log(`   👤 Indicado por: ${updated.referredByCode || "Ninguém"}`);

    console.log("\n🎉 Código gerado com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

generateCodeForZe9();
