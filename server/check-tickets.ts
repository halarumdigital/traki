import "dotenv/config";
import { db } from "./db";
import { supportTickets } from "@shared/schema";

console.log("🔍 Verificando tickets no banco de dados\n");
console.log("=".repeat(60));

async function checkTickets() {
  try {
    const tickets = await db
      .select()
      .from(supportTickets)
      .orderBy(supportTickets.createdAt);

    console.log(`\n📋 Total de tickets: ${tickets.length}\n`);

    tickets.forEach((ticket, index) => {
      console.log(`${index + 1}. ID: ${ticket.id}`);
      console.log(`   ticketNumber: ${ticket.ticketNumber || 'NULL/VAZIO'}`);
      console.log(`   Motorista: ${ticket.driverName}`);
      console.log(`   Assunto: ${ticket.subjectId}`);
      console.log(`   Criado em: ${ticket.createdAt}`);
      console.log("");
    });

  } catch (error: any) {
    console.error("\n❌ Erro:", error);
    console.error(error.stack);
    process.exit(1);
  }
}

checkTickets();
