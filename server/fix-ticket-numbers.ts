import "dotenv/config";
import { db } from "./db";
import { supportTickets } from "@shared/schema";
import { isNull, or, eq } from "drizzle-orm";

console.log("🔧 Corrigindo números dos tickets\n");
console.log("=".repeat(60));

async function fixTicketNumbers() {
  try {
    // Buscar todos os tickets
    const allTickets = await db
      .select()
      .from(supportTickets)
      .orderBy(supportTickets.createdAt);

    console.log(`\n📋 Total de tickets encontrados: ${allTickets.length}`);

    let fixed = 0;
    let alreadyOk = 0;

    for (let i = 0; i < allTickets.length; i++) {
      const ticket = allTickets[i];

      // Verificar se o ticketNumber está vazio ou inválido
      if (!ticket.ticketNumber || ticket.ticketNumber === 'TKT-0000' || ticket.ticketNumber === '') {
        const newTicketNumber = `TKT-${String(i + 1).padStart(5, "0")}`;

        await db
          .update(supportTickets)
          .set({ ticketNumber: newTicketNumber })
          .where(eq(supportTickets.id, ticket.id));

        console.log(`✅ Ticket ${ticket.id} atualizado: ${ticket.ticketNumber || 'null'} → ${newTicketNumber}`);
        fixed++;
      } else {
        console.log(`ℹ️  Ticket ${ticket.id}: ${ticket.ticketNumber} (OK)`);
        alreadyOk++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`\n✅ Processo concluído!`);
    console.log(`   - Tickets corrigidos: ${fixed}`);
    console.log(`   - Tickets já corretos: ${alreadyOk}`);
    console.log(`   - Total: ${allTickets.length}\n`);

  } catch (error: any) {
    console.error("\n❌ Erro ao corrigir tickets:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

fixTicketNumbers();
