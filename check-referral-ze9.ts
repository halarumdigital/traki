import { db } from "./server/db.js";
import { drivers, driverReferrals } from "@shared/schema";
import { eq, or } from "drizzle-orm";

async function checkReferralForZe9() {
  try {
    console.log("🔍 Verificando cadastro e indicação do ze9@gmail.com...\n");

    // 1. Buscar motorista ze9
    console.log("1️⃣ Buscando motorista ze9@gmail.com:");
    const [ze9] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.email, "ze9@gmail.com"))
      .limit(1);

    if (!ze9) {
      console.log("❌ Motorista ze9@gmail.com NÃO ENCONTRADO no banco!");
      console.log("\n⚠️ O cadastro pode não ter sido completado.");
      process.exit(0);
    }

    console.log("✅ Motorista encontrado:");
    console.log(`   ID: ${ze9.id}`);
    console.log(`   Nome: ${ze9.name}`);
    console.log(`   Email: ${ze9.email}`);
    console.log(`   📱 Mobile: ${ze9.mobile}`);
    console.log(`   ✅ Aprovado: ${ze9.approve ? "Sim" : "Não"}`);
    console.log(`   🎫 Seu Código: ${ze9.referralCode || "SEM CÓDIGO"}`);
    console.log(`   👤 Indicado por (código): ${ze9.referredByCode || "NINGUÉM"}`);
    console.log(`   👤 Indicado por (ID): ${ze9.referredById || "NINGUÉM"}`);
    console.log(`   🚚 Total Entregas: ${ze9.totalDeliveries || 0}`);

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
          console.log(`     Indicado ID: ${ref.referredDriverId || "Não cadastrado ainda"}`);
          console.log(`     Nome: ${ref.referredName || "N/A"}`);
          console.log(`     Telefone: ${ref.referredPhone || "N/A"}`);
          console.log(`     Status: ${ref.status}`);
          console.log(`     Entregas: ${ref.deliveriesCompleted}`);
          console.log(`     Comissão: R$ ${ref.commissionEarned}`);
        });
      } else {
        console.log("   ❌ Nenhuma indicação registrada para ze8");
      }

      // Verificar se ze9 aparece como indicado
      const ze9AsReferred = await db
        .select()
        .from(driverReferrals)
        .where(eq(driverReferrals.referredDriverId, ze9.id));

      console.log(`\n   Ze9 aparece como indicado: ${ze9AsReferred.length > 0 ? "SIM" : "NÃO"}`);
      if (ze9AsReferred.length > 0) {
        ze9AsReferred.forEach((ref) => {
          console.log(`     Indicado por (driver ID): ${ref.referrerDriverId}`);
        });
      }
    }

    // 4. Diagnóstico
    console.log("\n========================================");
    console.log("📊 DIAGNÓSTICO:");
    console.log("========================================");

    if (!ze9.referredByCode) {
      console.log("❌ PROBLEMA: O campo 'referredByCode' está vazio no cadastro de ze9");
      console.log("   Isso significa que o código de indicação NÃO foi salvo durante o cadastro");
    }

    if (!ze9.referredById) {
      console.log("❌ PROBLEMA: O campo 'referredById' está vazio no cadastro de ze9");
      console.log("   Isso significa que a referência ao motorista que indicou NÃO foi salva");
    }

    if (ze8) {
      const referralsCount = await db
        .select()
        .from(driverReferrals)
        .where(eq(driverReferrals.referrerDriverId, ze8.id));

      if (referralsCount.length === 0) {
        console.log("❌ PROBLEMA: Não há registro na tabela 'driver_referrals' para esta indicação");
        console.log("   A indicação não foi registrada no sistema");
      }
    }

    console.log("\n💡 POSSÍVEIS CAUSAS:");
    console.log("   1. O campo de indicação não foi preenchido no formulário de cadastro");
    console.log("   2. O endpoint de cadastro não está processando o código de indicação");
    console.log("   3. A validação do código está falhando silenciosamente");
    console.log("   4. O código foi digitado incorretamente (case-sensitive?)");

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

checkReferralForZe9();
