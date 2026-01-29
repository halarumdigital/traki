import { db } from "./db";
import { wooviCharges, wooviSubaccounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

const WOOVI_APP_ID = process.env.WOOVI_APP_ID;
const WOOVI_API_URL = process.env.WOOVI_API_URL || 'https://api.woovi-sandbox.com';

async function syncChargesStatus() {
  console.log("========================================");
  console.log("🔄 Sincronizando Status das Cobranças");
  console.log("========================================\n");

  try {
    // 1. Buscar todas as cobranças pending no banco
    const pendingCharges = await db
      .select()
      .from(wooviCharges)
      .where(eq(wooviCharges.status, 'pending'));

    console.log(`📊 Encontradas ${pendingCharges.length} cobranças pendentes\n`);

    for (const charge of pendingCharges) {
      console.log(`📝 Verificando: ${charge.correlationId}`);

      try {
        // Consultar status na Woovi
        const response = await fetch(
          `${WOOVI_API_URL}/api/v1/charge/${charge.correlationId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': WOOVI_APP_ID!,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const wooviStatus = data.charge?.status;

          console.log(`   Status na Woovi: ${wooviStatus}`);

          if (wooviStatus === 'COMPLETED' && charge.status !== 'paid') {
            // Atualizar para paid
            await db
              .update(wooviCharges)
              .set({
                status: 'paid',
                paidAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(wooviCharges.id, charge.id));

            console.log(`   ✅ Atualizado para PAID`);
          } else if (wooviStatus === 'EXPIRED') {
            await db
              .update(wooviCharges)
              .set({
                status: 'expired',
                updatedAt: new Date(),
              })
              .where(eq(wooviCharges.id, charge.id));

            console.log(`   ⏰ Atualizado para EXPIRED`);
          } else {
            console.log(`   ⏳ Mantido como ${charge.status}`);
          }
        } else {
          console.log(`   ⚠️ Erro ao consultar: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Erro: ${error}`);
      }

      console.log("");
    }

    // 2. Atualizar saldo da subconta
    console.log("========================================");
    console.log("💰 Atualizando Saldo da Subconta");
    console.log("========================================\n");

    const subaccountId = "6c1d68d8-2e5f-472b-8c38-730d7ca94578";
    const pixKey = "compras@augustoebiancamudancasme.com.br";

    const balanceResponse = await fetch(
      `${WOOVI_API_URL}/api/v1/subaccount/${encodeURIComponent(pixKey)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': WOOVI_APP_ID!,
          'Content-Type': 'application/json',
        },
      }
    );

    if (balanceResponse.ok) {
      const balanceData = await balanceResponse.json();
      const subAccountData = balanceData.SubAccount || balanceData.subAccount;

      if (subAccountData) {
        const balanceInCents = subAccountData.balance;
        console.log(`✅ Saldo na Woovi: ${balanceInCents} centavos (R$ ${(balanceInCents / 100).toFixed(2)})`);

        // Salvar como inteiro (sem decimais)
        await db
          .update(wooviSubaccounts)
          .set({
            balanceCache: balanceInCents.toString(),
            lastBalanceUpdate: new Date(),
          })
          .where(eq(wooviSubaccounts.id, subaccountId));

        console.log(`✅ Saldo atualizado no banco: ${balanceInCents}`);
      }
    }

  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

syncChargesStatus()
  .then(() => {
    console.log("\n✅ Sincronização finalizada!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });
