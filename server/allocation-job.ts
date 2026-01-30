import { db, pool } from "./db";
import { allocations, allocationAlerts, settings, drivers } from "../shared/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { storage } from "./storage";
import { sendPushNotification } from "./firebase";
import { Server as SocketIOServer } from "socket.io";

let ioInstance: SocketIOServer | null = null;

/**
 * Job 1: Expirar alertas não respondidos
 * Executa a cada 30 segundos
 */
async function expireOldAlerts() {
  try {
    const now = new Date();

    // Buscar alertas expirados
    const expiredAlerts = await db
      .select()
      .from(allocationAlerts)
      .where(
        and(
          eq(allocationAlerts.status, "notified"),
          lte(allocationAlerts.expiresAt, now)
        )
      );

    for (const alert of expiredAlerts) {
      await db
        .update(allocationAlerts)
        .set({ status: "expired" })
        .where(eq(allocationAlerts.id, alert.id));
    }

    if (expiredAlerts.length > 0) {
      console.log(`✓ [Allocation Job] ${expiredAlerts.length} alertas de alocação expirados`);
    }

  } catch (error) {
    console.error("Erro ao expirar alertas de alocação:", error);
  }
}

/**
 * Job 2: Expirar alocações pendentes sem aceite
 * Executa a cada 1 minuto
 */
async function expirePendingAllocations() {
  try {
    const systemSettings = await storage.getSettings();
    const acceptanceTimeout = (systemSettings?.driverAcceptanceTimeout || 30) * 2; // 2x o timeout
    const expirationTime = new Date(Date.now() - acceptanceTimeout * 1000);

    // Buscar alocações pendentes antigas
    const pendingAllocations = await db
      .select()
      .from(allocations)
      .where(
        and(
          eq(allocations.status, "pending"),
          lte(allocations.createdAt, expirationTime)
        )
      );

    for (const allocation of pendingAllocations) {
      await db
        .update(allocations)
        .set({
          status: "expired",
          updatedAt: new Date(),
        })
        .where(eq(allocations.id, allocation.id));

      // Notificar empresa via Socket.IO
      if (ioInstance) {
        ioInstance.to(`company-${allocation.companyId}`).emit("allocation-expired", {
          allocationId: allocation.id,
          message: "Nenhum entregador aceitou a alocação",
        });
      }

      console.log(`✓ [Allocation Job] Alocação ${allocation.id} expirada por falta de aceite`);
    }

    if (pendingAllocations.length > 0) {
      console.log(`✓ [Allocation Job] ${pendingAllocations.length} alocações expiradas por falta de aceite`);
    }

  } catch (error) {
    console.error("Erro ao expirar alocações pendentes:", error);
  }
}

/**
 * Job 3: Iniciar período das alocações aceitas
 * Muda status de 'accepted' para 'in_progress' quando o horário de início chega
 * Executa a cada 30 segundos
 */
async function startAcceptedAllocations() {
  try {
    const nowBrazil = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const [dateStr, timeStr] = nowBrazil.split(' ');
    const currentTime = timeStr.slice(0, 8);

    // Buscar alocações aceitas cujo horário de início chegou
    const allocationsToStart = await pool.query(`
      SELECT id, driver_id, company_id
      FROM allocations
      WHERE allocation_date = $1
        AND start_time <= $2
        AND status = 'accepted'
    `, [dateStr, currentTime]);

    for (const allocation of allocationsToStart.rows) {
      await db
        .update(allocations)
        .set({
          status: "in_progress",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(allocations.id, allocation.id));

      // Notificar entregador
      if (allocation.driver_id) {
        const driver = await storage.getDriver(allocation.driver_id);
        if (driver?.fcmToken) {
          try {
            await sendPushNotification(
              driver.fcmToken,
              "Alocação Iniciada!",
              "Seu período de alocação começou. Você receberá entregas apenas desta empresa.",
              { type: "allocation_started", allocationId: allocation.id }
            );
          } catch (pushError) {
            console.error("Erro ao enviar push:", pushError);
          }
        }
      }

      // Notificar empresa
      if (ioInstance) {
        ioInstance.to(`company-${allocation.company_id}`).emit("allocation-started", {
          allocationId: allocation.id,
          driverId: allocation.driver_id,
        });
      }

      console.log(`✓ [Allocation Job] Alocação ${allocation.id} iniciada`);
    }

  } catch (error) {
    console.error("Erro ao iniciar alocações:", error);
  }
}

/**
 * Job 4: Auto-liberar alocações no fim do período
 * Processa pagamentos e libera entregadores
 * Executa a cada 1 minuto
 */
async function autoReleaseCompletedAllocations() {
  try {
    const nowBrazil = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    const [dateStr, timeStr] = nowBrazil.split(' ');
    const currentTime = timeStr.slice(0, 8);

    // Buscar alocações que terminaram
    const allocationsToRelease = await pool.query(`
      SELECT a.*, d.name as driver_name, d.fcm_token
      FROM allocations a
      LEFT JOIN drivers d ON a.driver_id = d.id
      WHERE a.allocation_date = $1
        AND a.end_time <= $2
        AND a.status IN ('accepted', 'in_progress')
    `, [dateStr, currentTime]);

    for (const allocation of allocationsToRelease.rows) {
      // Processar pagamentos
      const company = await storage.getCompany(allocation.company_id);
      const totalAmount = parseFloat(allocation.total_amount);
      const driverAmount = parseFloat(allocation.driver_amount || "0");
      const commissionAmount = parseFloat(allocation.commission_amount || "0");

      if (company?.paymentType === "PRE_PAGO" && allocation.driver_id) {
        // Débito empresa
        const companyWallet = await storage.getWalletByOwner(allocation.company_id, "company");
        if (companyWallet) {
          const prevBalance = parseFloat(companyWallet.availableBalance);
          const newBalance = prevBalance - totalAmount;

          await storage.updateWalletBalance(companyWallet.id, newBalance.toFixed(2));
          await storage.createWalletTransaction({
            walletId: companyWallet.id,
            type: "allocation_debit",
            status: "completed",
            amount: (-totalAmount).toFixed(2),
            previousBalance: prevBalance.toFixed(2),
            newBalance: newBalance.toFixed(2),
            description: `Alocação de entregador - Período completo`,
          });
        }

        // Crédito entregador
        const driverWallet = await storage.getWalletByOwner(allocation.driver_id, "driver");
        if (driverWallet) {
          const prevBalance = parseFloat(driverWallet.availableBalance);
          const newBalance = prevBalance + driverAmount;

          await storage.updateWalletBalance(driverWallet.id, newBalance.toFixed(2));
          await storage.createWalletTransaction({
            walletId: driverWallet.id,
            type: "allocation_credit",
            status: "completed",
            amount: driverAmount.toFixed(2),
            previousBalance: prevBalance.toFixed(2),
            newBalance: newBalance.toFixed(2),
            description: `Alocação de entregador - Período completo`,
          });
        }

        // Comissão plataforma
        const platformWallet = await storage.getPlatformWallet();
        if (platformWallet) {
          const prevBalance = parseFloat(platformWallet.availableBalance);
          const newBalance = prevBalance + commissionAmount;

          await storage.updateWalletBalance(platformWallet.id, newBalance.toFixed(2));
          await storage.createWalletTransaction({
            walletId: platformWallet.id,
            type: "allocation_commission",
            status: "completed",
            amount: commissionAmount.toFixed(2),
            previousBalance: prevBalance.toFixed(2),
            newBalance: newBalance.toFixed(2),
            description: `Comissão de alocação - Período completo`,
          });
        }
      }
      // TODO: Para BOLETO, adicionar ao próximo fechamento semanal

      // Atualizar alocação
      await db
        .update(allocations)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(allocations.id, allocation.id));

      // Notificar entregador
      if (allocation.fcm_token) {
        try {
          await sendPushNotification(
            allocation.fcm_token,
            "Alocação Finalizada",
            `Seu período de alocação terminou. R$ ${driverAmount.toFixed(2)} creditado.`,
            { type: "allocation_completed", allocationId: allocation.id }
          );
        } catch (pushError) {
          console.error("Erro ao enviar push:", pushError);
        }
      }

      // Notificar via Socket
      if (ioInstance) {
        if (allocation.driver_id) {
          ioInstance.to(`driver-${allocation.driver_id}`).emit("allocation-completed", {
            allocationId: allocation.id,
            amountCredited: driverAmount,
          });
        }
        ioInstance.to(`company-${allocation.company_id}`).emit("allocation-completed", {
          allocationId: allocation.id,
          driverId: allocation.driver_id,
        });
      }

      console.log(`✓ [Allocation Job] Alocação ${allocation.id} auto-liberada (período completo)`);
    }

  } catch (error) {
    console.error("Erro ao auto-liberar alocações:", error);
  }
}

/**
 * Configura a instância do Socket.IO para uso nos jobs
 */
export function setAllocationJobsSocketIO(io: SocketIOServer): void {
  ioInstance = io;
}

/**
 * Inicia todos os jobs de alocação
 */
export function startAllocationJobs(): void {
  console.log("✓ [Allocation Job] Iniciando jobs de alocação...");

  // Executar imediatamente na inicialização
  expireOldAlerts();
  expirePendingAllocations();
  startAcceptedAllocations();
  autoReleaseCompletedAllocations();

  // Jobs a cada 30 segundos
  setInterval(() => {
    expireOldAlerts();
    startAcceptedAllocations();
  }, 30000);

  // Jobs a cada 1 minuto
  setInterval(() => {
    expirePendingAllocations();
    autoReleaseCompletedAllocations();
  }, 60000);

  console.log("✓ [Allocation Job] Jobs de alocação iniciados com sucesso");
}
