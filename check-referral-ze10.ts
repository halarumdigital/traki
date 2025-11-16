import { db } from "./server/db.js";
import { drivers, driverReferrals } from "@shared/schema";
import { eq } from "drizzle-orm";

async function checkReferralForZe10() {
  try {
    console.log("🔍 Verificando cadastro e indicação do ze10@gmail.com...\n");

    // 1. Buscar motorista ze10
    console.log("1️⃣ Buscando motorista ze10@gmail.com:");
    const [ze10] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze10@gmail.com"))
      .limit(1);

    if (!ze10) {
      console.log("❌ Motorista ze10@gmail.com NÃO ENCONTRADO no banco!");
      process.exit(0);
    }

    console.log("✅ Motorista encontrado:");
    console.log(`   ID: ${ze10.id}`);
    console.log(`   Nome: ${ze10.name}`);
    console.log(`   Email: ${ze10.email}`);
    console.log(`   📱 Mobile: ${ze10.mobile}`);
    console.log(`   ✅ Aprovado: ${ze10.approve ? "Sim" : "Não"}`);
    console.log(`   🎫 Seu Código: ${ze10.referralCode || "SEM CÓDIGO"}`);
    console.log(`   👤 Indicado por (código): ${ze10.referredByCode || "NINGUÉM"}`);
    console.log(`   👤 Indicado por (ID): ${ze10.referredById || "NINGUÉM"}`);
    console.log(`   🚚 Total Entregas: ${ze10.totalDeliveries || 0}`);

    // 2. Buscar motorista ze8 (quem deveria ter indicado)
    console.log("\n2️⃣ Buscando motorista ze8@gmail.com (código ZE60):");
    const [ze8] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze8@gmail.com"))
      .limit(1);

    if (ze8) {
      console.log("✅ Motorista que deveria ter indicado:");
      console.log(`   ID: ${ze8.id}`);
      console.log(`   Nome: ${ze8.name}`);
      console.log(`   Email: ${ze8.email}`);
      console.log(`   🎫 Código: ${ze8.referralCode}`);
    }

    // 3. Buscar na tabela de indicações
    console.log("\n3️⃣ Buscando na tabela de indicações (driver_referrals):");

    if (ze8) {
      // Buscar indicações feitas pelo ze8
      const referralsFromZe8 = await db
        .select()
        .from(driverReferrals)
        .where(eq(driverReferrals.referrerDriverId, ze8.id));

      console.log(`   Indicações feitas por ${ze8.name}: ${referralsFromZe8.length}`);

      if (referralsFromZe8.length > 0) {
        referralsFromZe8.forEach((ref, i) => {
          console.log(`\n   Indicação ${i + 1}:`);
          console.log(`     Indicado ID: ${ref.referredDriverId}`);
          console.log(`     Status: ${ref.status}`);
          console.log(`     Entregas: ${ref.deliveriesCompleted}`);
          console.log(`     Comissão: R$ ${ref.commissionEarned}`);
        });
      }

      // Verificar se ze10 aparece como indicado
      const ze10AsReferred = await db
        .select()
        .from(driverReferrals)
        .where(eq(driverReferrals.referredDriverId, ze10.id));

      console.log(`\n   Ze10 aparece como indicado: ${ze10AsReferred.length > 0 ? "SIM ✅" : "NÃO ❌"}`);
      if (ze10AsReferred.length > 0) {
        ze10AsReferred.forEach((ref) => {
          console.log(`     Indicado por (driver ID): ${ref.referrerDriverId}`);
          console.log(`     Status: ${ref.status}`);
          console.log(`     Código usado: ${ref.referralCode}`);
        });
      }
    }

    // 4. Diagnóstico
    console.log("\n========================================");
    console.log("📊 DIAGNÓSTICO:");
    console.log("========================================");

    if (ze10.referredByCode && ze10.referredById) {
      console.log("✅ SUCESSO: Os campos de indicação estão preenchidos!");
      console.log(`   Indicado por código: ${ze10.referredByCode}`);
      console.log(`   Indicado por ID: ${ze10.referredById}`);
    } else {
      console.log("❌ PROBLEMA: Campos de indicação não foram salvos");
      if (!ze10.referredByCode) {
        console.log("   - Campo 'referredByCode' está vazio");
      }
      if (!ze10.referredById) {
        console.log("   - Campo 'referredById' está vazio");
      }
    }

    const ze10Referrals = await db
      .select()
      .from(driverReferrals)
      .where(eq(driverReferrals.referredDriverId, ze10.id));

    if (ze10Referrals.length > 0) {
      console.log("✅ SUCESSO: Registro na tabela driver_referrals encontrado!");
    } else {
      console.log("❌ PROBLEMA: Nenhum registro na tabela driver_referrals");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

checkReferralForZe10();
