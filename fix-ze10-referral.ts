import { db } from "./server/db.js";
import { drivers, driverReferrals, referralSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

async function fixZe10Referral() {
  try {
    console.log("🔧 Corrigindo indicação do ze10@gmail.com...\n");

    // 1. Buscar ze10
    const [ze10] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze10@gmail.com"))
      .limit(1);

    if (!ze10) {
      console.log("❌ Motorista ze10@gmail.com não encontrado!");
      process.exit(1);
    }

    console.log("✅ Motorista ze10 encontrado:");
    console.log(`   ID: ${ze10.id}`);
    console.log(`   Nome: ${ze10.name}`);
    console.log(`   Indicado por código: ${ze10.referredByCode}`);
    console.log(`   Indicado por ID: ${ze10.referredById}`);

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

    // 3. Verificar se já existe registro
    const existingReferral = await db
      .select()
      .from(driverReferrals)
      .where(eq(driverReferrals.referredDriverId, ze10.id));

    if (existingReferral.length > 0) {
      console.log("\n✅ Já existe registro na tabela driver_referrals para ze10!");
      process.exit(0);
    }

    // 4. Buscar configurações de indicação
    const [settings] = await db.select().from(referralSettings).limit(1);
    const minimumDeliveries = settings?.minimumDeliveries || 10;
    const commissionAmount = settings?.commissionAmount || "50.00";

    console.log("\n📝 Criando registro na tabela driver_referrals...");
    console.log(`   Mínimo de entregas: ${minimumDeliveries}`);
    console.log(`   Valor da comissão: R$ ${commissionAmount}`);

    // 5. Criar registro na tabela driver_referrals
    await db.insert(driverReferrals).values({
      referrerDriverId: ze8.id,
      referredDriverId: ze10.id,
      referralCode: ze8.referralCode,
      status: "registered",
      registeredAt: new Date(),
      deliveriesCompleted: 0,
      commissionEarned: "0",
      commissionPaid: false,
    });

    console.log("✅ Registro de indicação criado com sucesso!");

    // 6. Verificar resultado
    console.log("\n🔍 Verificando resultado...\n");

    const referrals = await db
      .select()
      .from(driverReferrals)
      .where(eq(driverReferrals.referrerDriverId, ze8.id));

    console.log(`✅ Total de indicações de ${ze8.name}: ${referrals.length}`);
    referrals.forEach((ref, i) => {
      console.log(`\n   Indicação ${i + 1}:`);
      console.log(`     Indicado ID: ${ref.referredDriverId}`);
      console.log(`     Status: ${ref.status}`);
      console.log(`     Entregas: ${ref.deliveriesCompleted}`);
      console.log(`     Comissão: R$ ${ref.commissionEarned}`);
    });

    console.log("\n🎉 Indicação do ze10 corrigida com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

fixZe10Referral();
