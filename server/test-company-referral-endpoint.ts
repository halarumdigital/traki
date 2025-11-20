import { db } from "./db.js";
import { eq, and } from "drizzle-orm";
import { drivers, companies, companyReferrals } from "@shared/schema";

async function testEndpoint() {
  const driverId = "fd4628f2-4c11-4041-b35f-11f542ff3d20"; // ze8

  console.log(`🔍 Testando endpoint GET /api/drivers/${driverId}/company-referrals\n`);

  try {
    // Simular o que o endpoint faz
    const referrals = await db
      .select({
        id: companyReferrals.id,
        companyId: companyReferrals.companyId,
        companyName: companies.name,
        requiredDeliveries: companyReferrals.requiredDeliveries,
        completedDeliveries: companyReferrals.completedDeliveries,
        commissionAmount: companyReferrals.commissionAmount,
        status: companyReferrals.status,
        qualifiedAt: companyReferrals.qualifiedAt,
        paidAt: companyReferrals.paidAt,
        createdAt: companyReferrals.createdAt,
      })
      .from(companyReferrals)
      .leftJoin(companies, eq(companyReferrals.companyId, companies.id))
      .where(eq(companyReferrals.referrerDriverId, driverId));

    console.log("📊 Resultado da query:");
    console.log(JSON.stringify({ referrals }, null, 2));

    if (referrals.length === 0) {
      console.log("\n❌ Nenhuma empresa encontrada para este motorista");
    } else {
      console.log(`\n✅ ${referrals.length} empresa(s) encontrada(s)`);
    }

  } catch (error) {
    console.error("❌ Erro ao testar endpoint:", error);
  } finally {
    process.exit(0);
  }
}

testEndpoint();
