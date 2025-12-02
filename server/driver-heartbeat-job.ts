/**
 * Job de verificação de heartbeat dos motoristas
 *
 * Este job roda a cada 30 segundos e verifica se os motoristas
 * que estão marcados como "online" ainda estão ativos.
 *
 * Se um motorista não enviar localização nos últimos 60 segundos,
 * ele é automaticamente marcado como offline.
 */

import { db } from './db';
import { drivers } from '@shared/schema';
import { eq, and, lt, isNotNull } from 'drizzle-orm';

// Tempo máximo sem heartbeat antes de marcar como offline (em segundos)
const HEARTBEAT_TIMEOUT_SECONDS = 60;

// Intervalo de verificação (em milissegundos)
const CHECK_INTERVAL_MS = 30000; // 30 segundos

let intervalId: NodeJS.Timeout | null = null;
let ioInstance: any = null;

/**
 * Verifica motoristas inativos e marca como offline
 */
async function checkInactiveDrivers(): Promise<void> {
  try {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - (HEARTBEAT_TIMEOUT_SECONDS * 1000));

    // Buscar motoristas que estão online mas com heartbeat antigo ou sem heartbeat
    const inactiveDrivers = await db
      .select({
        id: drivers.id,
        name: drivers.name,
        lastHeartbeat: drivers.lastHeartbeat,
      })
      .from(drivers)
      .where(
        and(
          eq(drivers.available, true),
          // Heartbeat é nulo OU é mais antigo que o tempo limite
          // Como drizzle não tem OR direto no where, vamos fazer duas queries
        )
      );

    // Filtrar os que precisam ser marcados como offline
    const toMarkOffline = inactiveDrivers.filter(driver => {
      // Se não tem heartbeat, marca como offline
      if (!driver.lastHeartbeat) return true;
      // Se heartbeat é mais antigo que o tempo limite, marca como offline
      return new Date(driver.lastHeartbeat) < cutoffTime;
    });

    if (toMarkOffline.length === 0) {
      return; // Nada a fazer
    }

    console.log(`\n⏰ [Heartbeat Check] ${new Date().toLocaleTimeString('pt-BR')}`);
    console.log(`   Encontrados ${toMarkOffline.length} motorista(s) inativo(s)`);

    // Marcar cada motorista como offline
    for (const driver of toMarkOffline) {
      await db
        .update(drivers)
        .set({
          available: false,
          updatedAt: new Date()
        })
        .where(eq(drivers.id, driver.id));

      console.log(`   ❌ ${driver.name} marcado como OFFLINE (sem atividade)`);

      // Emitir evento Socket.IO se disponível
      if (ioInstance) {
        ioInstance.emit('driver-status-changed', {
          driverId: driver.id,
          driverName: driver.name,
          available: false,
          timestamp: new Date().toISOString(),
          reason: 'heartbeat_timeout'
        });
      }
    }

    console.log(`   ✅ ${toMarkOffline.length} motorista(s) atualizado(s)\n`);

  } catch (error) {
    console.error('❌ Erro no job de heartbeat:', error);
  }
}

/**
 * Inicia o job de verificação de heartbeat
 */
export function startHeartbeatJob(io?: any): void {
  if (intervalId) {
    console.log('⚠️ Job de heartbeat já está rodando');
    return;
  }

  ioInstance = io;

  console.log('🔄 Iniciando job de verificação de heartbeat dos motoristas');
  console.log(`   ⏱️ Intervalo: ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(`   ⏱️ Timeout: ${HEARTBEAT_TIMEOUT_SECONDS}s sem atividade\n`);

  // Executar imediatamente na primeira vez
  checkInactiveDrivers();

  // Agendar execução periódica
  intervalId = setInterval(checkInactiveDrivers, CHECK_INTERVAL_MS);
}

/**
 * Para o job de verificação de heartbeat
 */
export function stopHeartbeatJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏹️ Job de heartbeat parado');
  }
}

/**
 * Atualiza a instância do Socket.IO
 */
export function setSocketIO(io: any): void {
  ioInstance = io;
}
