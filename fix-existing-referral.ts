import { db } from "./server/db.js";
import { referralCommissions, referralSettings, driverReferrals } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function fixExistingReferral() {
  const driverId = "35124173-62c9-4971-ba78-b00a31739ac9"; // ze10

  console.log("\n🔧 Criando registro em referralCommissions para ze10...\n");

  // 1. Buscar configurações
  const [settings] = await db.select().from(referralSettings).limit(1);
  const minimumDeliveries = settings?.minimumDeliveries || 10;
  const commissionAmount = settings?.commissionAmount || "50.00";

  console.log("⚙️ Configurações:");
  console.log({
    minimumDeliveries,
    commissionAmount
  });

  // 2. Buscar registro de indicação
  const [referral] = await db
    .select()
    .from(driverReferrals)
    .where(eq(driverReferrals.referredDriverId, driverId))
    .limit(1);

  if (!referral) {
    console.log("❌ Nenhum registro de indicação encontrado");
    process.exit(1);
  }

  console.log("\n📋 Dados da indicação:");
  console.log({
    referrerDriverId: referral.referrerDriverId,
    referredDriverId: referral.referredDriverId,
    deliveriesCompleted: referral.deliveriesCompleted
  });

  // 3. Verificar se já existe em referralCommissions
  const [existingCommission] = await db
    .select()
    .from(referralCommissions)
    .where(eq(referralCommissions.referredDriverId, driverId))
    .limit(1);

  if (existingCommission) {
    console.log("\n⚠️ Já existe registro em referralCommissions");
    console.log(existingCommission);
    process.exit(0);
  }

  // 4. Criar registro em referralCommissions
  await db.insert(referralCommissions).values({
    referrerDriverId: referral.referrerDriverId,
    referredDriverId: referral.referredDriverId,
    requiredDeliveries: minimumDeliveries,
    completedDeliveries: 0, // Começando do zero
    commissionAmount: commissionAmount,
    status: "pending",
  });

  console.log("\n✅ Registro criado em referralCommissions!");

  // 5. Verificar
  const [newCommission] = await db
    .select()
    .from(referralCommissions)
    .where(eq(referralCommissions.referredDriverId, driverId))
    .limit(1);

  console.log("\n📊 Novo registro:");
  console.log(newCommission);

  process.exit(0);
}

fixExistingReferral().catch(console.error);
