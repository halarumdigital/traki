import { db } from "./server/db.js";
import { drivers, driverReferrals, referralSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

async function fixZe9Referral() {
  try {
    console.log("🔧 Corrigindo indicação do ze9@gmail.com...\n");

    // 1. Buscar ze9
    const [ze9] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze9@gmail.com"))
      .limit(1);

    if (!ze9) {
      console.log("❌ Motorista ze9@gmail.com não encontrado!");
      process.exit(1);
    }

    console.log("✅ Motorista ze9 encontrado:");
    console.log(`   ID: ${ze9.id}`);
    console.log(`   Nome: ${ze9.name}`);

    // 2. Buscar ze8 (quem indicou)
    const [ze8] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze8@gmail.com"))
      .limit(1);

    if (!ze8) {
      console.log("❌ Motorista ze8@gmail.com não encontrado!");
      process.exit(1);
    }

    console.log("✅ Motorista ze8 encontrado:");
    console.log(`   ID: ${ze8.id}`);
    console.log(`   Nome: ${ze8.name}`);
    console.log(`   Código: ${ze8.referralCode}`);

    // 3. Atualizar ze9 com os dados de indicação
    console.log("\n📝 Atualizando dados de indicação do ze9...");
    await db
      .update(drivers)
      .set({
        referredByCode: ze8.referralCode,
        referredById: ze8.id,
        updatedAt: new Date()
      })
      .where(eq(drivers.id, ze9.id));

    console.log("✅ Campos referredByCode e referredById atualizados");

    // 4. Criar registro na tabela driver_referrals
    console.log("\n📝 Criando registro na tabela driver_referrals...");

    const [settings] = await db.select().from(referralSettings).limit(1);
    const minimumDeliveries = settings?.minimumDeliveries || 10;
    const commissionAmount = settings?.commissionAmount || "50.00";

    await db.insert(driverReferrals).values({
      referrerDriverId: ze8.id,
      referredDriverId: ze9.id,
      referralCode: ze8.referralCode,
      status: "registered",
      registeredAt: new Date(),
      deliveriesCompleted: 0,
      commissionEarned: "0",
      commissionPaid: false,
    });

    console.log("✅ Registro de indicação criado");

    // 5. Verificar resultado
    console.log("\n🔍 Verificando resultado...\n");

    const [updatedZe9] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze9@gmail.com"))
      .limit(1);

    console.log("📋 ze9@gmail.com atualizado:");
    console.log(`   🎫 Seu Código: ${updatedZe9.referralCode || "SEM CÓDIGO"}`);
    console.log(`   👤 Indicado por (código): ${updatedZe9.referredByCode || "NINGUÉM"}`);
    console.log(`   👤 Indicado por (ID): ${updatedZe9.referredById || "NINGUÉM"}`);

    const referrals = await db
      .select()
      .from(driverReferrals)
      .where(eq(driverReferrals.referrerDriverId, ze8.id));

    console.log(`\n✅ Total de indicações de ${ze8.name}: ${referrals.length}`);
    referrals.forEach((ref, i) => {
      console.log(`   ${i + 1}. Status: ${ref.status}, Entregas: ${ref.deliveriesCompleted}`);
    });

    console.log("\n🎉 Indicação corrigida com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

fixZe9Referral();
