import { db } from "./db.js";
import { eq, desc } from "drizzle-orm";
import { drivers, companies, companyReferrals, referralSettings } from "@shared/schema";

async function testEndpointResponse() {
  const driverId = "fd4628f2-4c11-4041-b35f-11f542ff3d20"; // ze8

  console.log("🔍 Testando resposta do endpoint /api/v1/driver/my-company-referrals\n");

  try {
    // Buscar todas as empresas indicadas por este motorista
    const referrals = await db
      .select({
        id: companyReferrals.id,
        companyId: companyReferrals.companyId,
        companyName: companies.name,
        companyEmail: companies.email,
        companyPhone: companies.phone,
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
      .where(eq(companyReferrals.referrerDriverId, driverId))
      .orderBy(desc(companyReferrals.createdAt));

    console.log("📊 Referrals encontrados:", referrals.length);
    console.log("📋 Dados:", JSON.stringify(referrals, null, 2));

    // Calcular estatísticas
    const totalReferrals = referrals.length;
    const pendingReferrals = referrals.filter(r => r.status === 'pending').length;
    const qualifiedReferrals = referrals.filter(r => r.status === 'qualified').length;
    const paidReferrals = referrals.filter(r => r.status === 'paid').length;

    const totalCommissionEarned = referrals
      .filter(r => r.status === 'qualified' || r.status === 'paid')
      .reduce((sum, r) => sum + parseFloat(r.commissionAmount || '0'), 0);

    const totalCommissionPaid = referrals
      .filter(r => r.status === 'paid')
      .reduce((sum, r) => sum + parseFloat(r.commissionAmount || '0'), 0);

    // Buscar o código de indicação do motorista
    const [driver] = await db
      .select({ referralCode: drivers.referralCode })
      .from(drivers)
      .where(eq(drivers.id, driverId))
      .limit(1);

    // Buscar configurações de indicação de empresas
    const [settings] = await db
      .select()
      .from(referralSettings)
      .limit(1);

    const companyMinimumDeliveries = settings?.companyMinimumDeliveries || 20;
    const companyCommissionAmount = settings?.companyCommissionAmount || "100.00";

    const response = {
      success: true,
      data: {
        myReferralCode: driver?.referralCode || null,
        settings: {
          companyMinimumDeliveries: companyMinimumDeliveries,
          companyCommissionAmount: typeof companyCommissionAmount === 'string'
            ? parseFloat(companyCommissionAmount)
            : companyCommissionAmount,
        },
        referrals: referrals,
        stats: {
          totalReferrals,
          pendingReferrals,
          qualifiedReferrals,
          paidReferrals,
          totalCommissionEarned,
          totalCommissionPaid,
          totalCommissionPending: totalCommissionEarned - totalCommissionPaid
        }
      }
    };

    console.log("\n✅ RESPOSTA COMPLETA DO ENDPOINT:");
    console.log(JSON.stringify(response, null, 2));

    console.log("\n📊 RESUMO:");
    console.log("   - Código de indicação:", response.data.myReferralCode);
    console.log("   - Comissão por empresa: R$", response.data.settings.companyCommissionAmount);
    console.log("   - Meta de entregas:", response.data.settings.companyMinimumDeliveries);
    console.log("   - Total de empresas indicadas:", response.data.stats.totalReferrals);
    console.log("   - Empresas pendentes:", response.data.stats.pendingReferrals);
    console.log("   - Empresas no array:", response.data.referrals.length);

  } catch (error) {
    console.error("❌ Erro ao testar endpoint:", error);
  } finally {
    process.exit(0);
  }
}

testEndpointResponse();
