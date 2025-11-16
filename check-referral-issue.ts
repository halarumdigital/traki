import { db } from "./server/db.js";
import { drivers, driverReferrals, referralCommissions } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function checkReferralIssue() {
  const driverId = "35124173-62c9-4971-ba78-b00a31739ac9"; // ze10

  console.log("\n🔍 Verificando dados de indicação do motorista ze10...\n");

  // 1. Buscar informações do motorista
  const [driver] = await db
    .select()
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1);

  console.log("📋 Dados do motorista:");
  console.log({
    id: driver?.id,
    name: driver?.name,
    email: driver?.email,
    totalDeliveries: driver?.totalDeliveries,
    referredByCode: driver?.referredByCode,
    referredById: driver?.referredById,
    referralCode: driver?.referralCode
  });

  // 2. Buscar registro em driverReferrals
  const [referral] = await db
    .select()
    .from(driverReferrals)
    .where(eq(driverReferrals.referredDriverId, driverId))
    .limit(1);

  console.log("\n📊 Registro em driverReferrals:");
  if (referral) {
    console.log({
      id: referral.id,
      referrerDriverId: referral.referrerDriverId,
      referredDriverId: referral.referredDriverId,
      deliveriesCompleted: referral.deliveriesCompleted,
      commissionEarned: referral.commissionEarned,
      status: referral.status
    });

    // Buscar dados do indicador
    const [referrer] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.id, referral.referrerDriverId))
      .limit(1);

    console.log("\n👤 Motorista que indicou:");
    console.log({
      id: referrer?.id,
      name: referrer?.name,
      email: referrer?.email,
      referralCode: referrer?.referralCode
    });
  } else {
    console.log("❌ Nenhum registro encontrado em driverReferrals para este motorista");
  }

  // 3. Buscar registro em referralCommissions
  const [commission] = await db
    .select()
    .from(referralCommissions)
    .where(eq(referralCommissions.referredDriverId, driverId))
    .limit(1);

  console.log("\n💰 Registro em referralCommissions:");
  if (commission) {
    console.log({
      id: commission.id,
      referrerDriverId: commission.referrerDriverId,
      referredDriverId: commission.referredDriverId,
      requiredDeliveries: commission.requiredDeliveries,
      completedDeliveries: commission.completedDeliveries,
      commissionAmount: commission.commissionAmount,
      status: commission.status
    });
  } else {
    console.log("❌ Nenhum registro encontrado em referralCommissions para este motorista");
  }

  process.exit(0);
}

checkReferralIssue().catch(console.error);
