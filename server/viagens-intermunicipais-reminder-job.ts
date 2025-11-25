import { db } from "./db";
import { viagensIntermunicipais, drivers } from "../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { sendPushNotification } from "./firebase";

/**
 * Envia lembretes para motoristas sobre viagens intermunicipais do dia
 * Executa diariamente às 7:00 AM (horário de São Paulo)
 */
export async function sendTodayTripReminders() {
  try {
    // Obter data atual em São Paulo (formato: YYYY-MM-DD)
    const todayBrazil = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

    console.log(`📅 [Viagens Job] Verificando viagens para hoje: ${todayBrazil}`);

    // Buscar todas as viagens agendadas para hoje
    const viagensHoje = await db
      .select({
        id: viagensIntermunicipais.id,
        entregadorId: viagensIntermunicipais.entregadorId,
        rotaId: viagensIntermunicipais.rotaId,
        dataViagem: viagensIntermunicipais.dataViagem,
        status: viagensIntermunicipais.status,
        horarioSaidaPlanejado: viagensIntermunicipais.horarioSaidaPlanejado,
        pacotesAceitos: viagensIntermunicipais.pacotesAceitos,
      })
      .from(viagensIntermunicipais)
      .where(
        and(
          sql`${viagensIntermunicipais.dataViagem}::text = ${todayBrazil}`,
          eq(viagensIntermunicipais.status, "agendada")
        )
      );

    if (viagensHoje.length === 0) {
      console.log(`📭 Nenhuma viagem agendada para hoje`);
      return;
    }

    console.log(`📦 ${viagensHoje.length} viagem(ns) agendada(s) para hoje`);

    for (const viagem of viagensHoje) {
      try {
        // Buscar dados do motorista
        const motorista = await db
          .select({
            id: drivers.id,
            name: drivers.name,
            fcmToken: drivers.fcmToken,
          })
          .from(drivers)
          .where(eq(drivers.id, viagem.entregadorId))
          .limit(1);

        if (motorista.length === 0 || !motorista[0].fcmToken) {
          console.log(`⚠️ Motorista ${viagem.entregadorId} não encontrado ou sem FCM token`);
          continue;
        }

        const driver = motorista[0];

        // Buscar nome da rota
        const rotaResult = await db.query.rotasIntermunicipais.findFirst({
          where: (rotas, { eq }) => eq(rotas.id, viagem.rotaId),
        });

        const rotaNome = rotaResult?.nomeRota || "Rota";

        // Enviar notificação de lembrete
        console.log(`📤 Enviando lembrete para ${driver.name} sobre viagem ${rotaNome}...`);

        await sendPushNotification(
          driver.fcmToken!,
          "🚚 Lembrete: Você tem uma viagem hoje!",
          `${rotaNome} • ${viagem.pacotesAceitos ?? 0} pacote(s) • Saída prevista: ${viagem.horarioSaidaPlanejado}`,
          {
            type: "lembrete_viagem_intermunicipal",
            viagemId: viagem.id,
            rotaId: viagem.rotaId,
            rotaNome: rotaNome,
            dataViagem: todayBrazil,
            horarioSaida: viagem.horarioSaidaPlanejado,
            pacotesAceitos: (viagem.pacotesAceitos ?? 0).toString(),
          }
        );

        console.log(`✅ Lembrete enviado para ${driver.name}`);
      } catch (error) {
        console.error(`❌ Erro ao enviar lembrete para viagem ${viagem.id}:`, error);
      }
    }
  } catch (error) {
    console.error("❌ Erro ao processar lembretes de viagens:", error);
  }
}

/**
 * Calcula o próximo horário de execução (07:00 AM horário de São Paulo)
 * Se já passou das 07:00, agenda para 07:00 do próximo dia
 */
function getNextRunTime(): Date {
  const now = new Date();

  // Converter para horário de São Paulo
  const nowBrazil = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

  // Definir para 07:00 AM de hoje
  const targetTime = new Date(nowBrazil);
  targetTime.setHours(7, 0, 0, 0);

  // Se já passou das 07:00, agendar para amanhã
  if (nowBrazil >= targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  return targetTime;
}

/**
 * Inicia o job de lembretes de viagens que executa diariamente às 07:00 AM
 */
export function startViagemRemindersJob() {
  console.log("✓ Job de lembretes de viagens iniciado");

  // Executar a cada 1 hora e verificar se é hora de enviar
  const interval = setInterval(() => {
    const now = new Date();
    const nowBrazil = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

    // Executar se for 07:00 (hora 7, entre minuto 0 e 59)
    if (nowBrazil.getHours() === 7 && nowBrazil.getMinutes() < 60) {
      console.log("⏰ Hora de enviar lembretes de viagens!");
      sendTodayTripReminders();
    }
  }, 60 * 60 * 1000); // Verificar a cada 1 hora

  console.log("✓ Job configurado para executar diariamente às 07:00 AM (São Paulo)");

  return interval;
}
