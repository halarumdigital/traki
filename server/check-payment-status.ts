import { db } from "./db";
import { wooviCharges, wooviSubaccounts, companies } from "@shared/schema";
import { eq, desc, and, or } from "drizzle-orm";
import wooviService from "./services/woovi.service";
import dotenv from "dotenv";

dotenv.config();

async function checkPaymentStatus() {
  console.log("========================================");
  console.log("💰 Verificando Status de Pagamentos");
  console.log("========================================\n");

  try {
    // 1. Buscar todas as cobranças recentes
    console.log("📊 Buscando cobranças recentes...");
    const recentCharges = await db
      .select({
        id: wooviCharges.id,
        correlationId: wooviCharges.correlationId,
        value: wooviCharges.value,
        status: wooviCharges.status,
        createdAt: wooviCharges.createdAt,
        updatedAt: wooviCharges.updatedAt,
        companyName: companies.name,
        companyId: wooviCharges.companyId,
      })
      .from(wooviCharges)
      .leftJoin(companies, eq(wooviCharges.companyId, companies.id))
      .orderBy(desc(wooviCharges.createdAt))
      .limit(10);

    if (recentCharges.length === 0) {
      console.log("❌ Nenhuma cobrança encontrada");
      return;
    }

    console.log(`\n✅ Encontradas ${recentCharges.length} cobranças:\n`);

    for (const charge of recentCharges) {
      console.log(`📝 Cobrança ID: ${charge.id}`);
      console.log(`   Empresa: ${charge.companyName || 'N/A'}`);
      console.log(`   Correlation ID: ${charge.correlationId}`);
      console.log(`   Valor: R$ ${parseFloat(charge.value).toFixed(2)}`);
      console.log(`   Status Local: ${charge.status}`);
      console.log(`   Criada em: ${charge.createdAt}`);
      console.log(`   Atualizada em: ${charge.updatedAt || 'Nunca'}`);

      // Verificar status na Woovi
      if (charge.correlationId) {
        console.log(`   🔍 Verificando status na Woovi...`);

        try {
          // Tentar buscar o status da cobrança na Woovi
          const wooviUrl = `${process.env.WOOVI_PRODUCTION === 'true' ? 'https://api.woovi.com' : 'https://api.woovi-sandbox.com'}/api/v1/charge/${charge.correlationId}`;

          const response = await fetch(wooviUrl, {
            method: 'GET',
            headers: {
              'Authorization': process.env.WOOVI_APP_ID!,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const wooviData = await response.json();
            console.log(`   ✅ Status na Woovi: ${wooviData.charge?.status || 'N/A'}`);

            // Se o status mudou, atualizar no banco
            if (wooviData.charge?.status && wooviData.charge.status !== charge.status) {
              console.log(`   ⚠️ Status diferente! Local: ${charge.status}, Woovi: ${wooviData.charge.status}`);

              // Atualizar status no banco
              if (wooviData.charge.status === 'COMPLETED' && charge.status !== 'completed') {
                console.log(`   💚 PAGAMENTO CONFIRMADO! Atualizando banco...`);

                await db
                  .update(wooviCharges)
                  .set({
                    status: 'completed',
                    updatedAt: new Date(),
                  })
                  .where(eq(wooviCharges.id, charge.id));

                console.log(`   ✅ Status atualizado para COMPLETED`);
              }
            }
          } else {
            const errorText = await response.text();
            console.log(`   ⚠️ Não foi possível verificar na Woovi: ${response.status}`);
          }
        } catch (error) {
          console.log(`   ❌ Erro ao verificar na Woovi: ${error}`);
        }
      }

      console.log(""); // Linha em branco entre cobranças
    }

    // 2. Verificar webhooks registrados
    console.log("\n========================================");
    console.log("📡 Verificando Webhooks Registrados");
    console.log("========================================\n");

    try {
      const webhooks = await wooviService.listWebhooks();

      if (webhooks.webhooks && webhooks.webhooks.length > 0) {
        console.log(`✅ ${webhooks.webhooks.length} webhook(s) registrado(s):\n`);

        webhooks.webhooks.forEach((webhook: any, index: number) => {
          console.log(`${index + 1}. ${webhook.name}`);
          console.log(`   URL: ${webhook.url}`);
          console.log(`   Evento: ${webhook.event}`);
          console.log(`   Ativo: ${webhook.isActive ? '✅ Sim' : '❌ Não'}`);
          console.log(`   ID: ${webhook.id}`);
          console.log("");
        });
      } else {
        console.log("❌ Nenhum webhook registrado!");
        console.log("\n⚠️ Sem webhooks, os pagamentos não serão detectados automaticamente!");
        console.log("   Execute: node --import tsx server/setup-webhook-local.ts");
      }
    } catch (error) {
      console.log("❌ Erro ao listar webhooks:", error);
    }

    // 3. Resumo de status
    console.log("\n========================================");
    console.log("📊 Resumo de Status");
    console.log("========================================\n");

    const statusCount = recentCharges.reduce((acc, charge) => {
      acc[charge.status] = (acc[charge.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(statusCount).forEach(([status, count]) => {
      const emoji = status === 'completed' ? '✅' : status === 'pending' ? '⏳' : '❌';
      console.log(`${emoji} ${status}: ${count} cobrança(s)`);
    });

    // 4. Verificar saldos das subcontas
    console.log("\n========================================");
    console.log("💳 Saldos das Subcontas");
    console.log("========================================\n");

    const subaccounts = await db
      .select()
      .from(wooviSubaccounts)
      .where(eq(wooviSubaccounts.accountType, 'company'))
      .limit(5);

    for (const subaccount of subaccounts) {
      console.log(`📊 ${subaccount.name}`);
      console.log(`   PIX: ${subaccount.pixKey}`);
      console.log(`   Saldo Cache: R$ ${parseFloat(subaccount.balanceCache || '0').toFixed(2)}`);

      // Tentar atualizar saldo da Woovi
      try {
        const balanceResponse = await wooviService.getSubaccountBalance(subaccount.pixKey);
        const balanceInReais = (balanceResponse.SubAccount.balance / 100).toFixed(2);
        console.log(`   Saldo Woovi: R$ ${balanceInReais}`);

        // Atualizar cache se diferente
        if (balanceResponse.SubAccount.balance.toString() !== subaccount.balanceCache) {
          await db
            .update(wooviSubaccounts)
            .set({
              balanceCache: balanceResponse.SubAccount.balance.toString(),
              lastBalanceUpdate: new Date(),
            })
            .where(eq(wooviSubaccounts.id, subaccount.id));
          console.log(`   ✅ Saldo atualizado no cache`);
        }
      } catch (error) {
        console.log(`   ⚠️ Não foi possível verificar saldo na Woovi`);
      }

      console.log("");
    }

  } catch (error) {
    console.error("\n❌ Erro durante verificação:", error);
  }
}

console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");
console.log("🔑 WOOVI_APP_ID:", process.env.WOOVI_APP_ID ? "Configurado" : "NÃO CONFIGURADO");
console.log("");

checkPaymentStatus()
  .then(() => {
    console.log("\n✅ Verificação finalizada!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
  });