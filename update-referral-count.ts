import { db } from "./server/db.js";
import { referralCommissions, driverReferrals, drivers } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function updateReferralCount() {
  const driverId = "35124173-62c9-4971-ba78-b00a31739ac9"; // ze10

  console.log("\n🔄 Atualizando contador de entregas para ze10...\n");

  // 1. Buscar total de entregas do motorista
  const [driver] = await db
    .select()
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver) {
    console.log("❌ Motorista não encontrado");
    process.exit(1);
  }

  const totalDeliveries = driver.totalDeliveries || 0;

  console.log(`📊 Total de entregas do motorista: ${totalDeliveries}`);

  // 2. Atualizar referralCommissions
  await db
    .update(referralCommissions)
    .set({
      completedDeliveries: totalDeliveries,
      updatedAt: new Date()
    })
    .where(eq(referralCommissions.referredDriverId, driverId));

  console.log(`✅ Atualizado referralCommissions`);

  // 3. Atualizar driverReferrals
  await db
    .update(driverReferrals)
    .set({
      deliveriesCompleted: totalDeliveries,
      updatedAt: new Date()
    })
    .where(eq(driverReferrals.referredDriverId, driverId));

  console.log(`✅ Atualizado driverReferrals`);

  // 4. Verificar
  const [commission] = await db
    .select()
    .from(referralCommissions)
    .where(eq(referralCommissions.referredDriverId, driverId))
    .limit(1);

  const [referral] = await db
    .select()
    .from(driverReferrals)
    .where(eq(driverReferrals.referredDriverId, driverId))
    .limit(1);

  console.log("\n📋 referralCommissions:");
  console.log({
    completedDeliveries: commission?.completedDeliveries,
    requiredDeliveries: commission?.requiredDeliveries,
    status: commission?.status
  });

  console.log("\n📋 driverReferrals:");
  console.log({
    deliveriesCompleted: referral?.deliveriesCompleted,
    status: referral?.status
  });

  process.exit(0);
}

updateReferralCount().catch(console.error);
