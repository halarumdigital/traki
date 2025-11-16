import { db } from "./server/db.js";
import { referralCommissions, driverReferrals, drivers } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function updateZe10Count() {
  const driverId = "35124173-62c9-4971-ba78-b00a31739ac9"; // ze10

  console.log("\n🔄 Atualizando contador de entregas para ze10...\n");

  // 1. Atualizar para 2 entregas
  const newTotal = 2;

  // 2. Atualizar drivers.totalDeliveries
  await db
    .update(drivers)
    .set({
      totalDeliveries: newTotal,
      updatedAt: new Date()
    })
    .where(eq(drivers.id, driverId));

  console.log(`✅ Atualizado drivers.totalDeliveries para ${newTotal}`);

  // 3. Atualizar referralCommissions
  await db
    .update(referralCommissions)
    .set({
      completedDeliveries: newTotal,
      updatedAt: new Date()
    })
    .where(eq(referralCommissions.referredDriverId, driverId));

  console.log(`✅ Atualizado referralCommissions`);

  // 4. Atualizar driverReferrals
  await db
    .update(driverReferrals)
    .set({
      deliveriesCompleted: newTotal,
      updatedAt: new Date()
    })
    .where(eq(driverReferrals.referredDriverId, driverId));

  console.log(`✅ Atualizado driverReferrals`);

  // 5. Verificar
  const [driver] = await db
    .select()
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1);

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

  console.log("\n📋 Resultado final:");
  console.log({
    driverTotalDeliveries: driver?.totalDeliveries,
    commissionCompletedDeliveries: commission?.completedDeliveries,
    referralDeliveriesCompleted: referral?.deliveriesCompleted
  });

  process.exit(0);
}

updateZe10Count().catch(console.error);
