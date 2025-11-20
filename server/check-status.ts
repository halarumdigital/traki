import { db } from "./db.js";
import { entregasIntermunicipais, viagensIntermunicipais, drivers, rotasIntermunicipais } from "../shared/schema.js";
import { eq } from "drizzle-orm";

async function checkStatus() {
  console.log("📊 VERIFICANDO STATUS DO SISTEMA\n");

  // 1. Verificar entregas
  console.log("📦 ENTREGAS INTERMUNICIPAIS:");
  console.log("=" .repeat(60));

  const todasEntregas = await db
    .select()
    .from(entregasIntermunicipais)
    .orderBy(entregasIntermunicipais.createdAt);

  if (todasEntregas.length === 0) {
    console.log("❌ Nenhuma entrega encontrada\n");
  } else {
    for (const entrega of todasEntregas) {
      console.log(`Pedido: ${entrega.numeroPedido}`);
      console.log(`  Status: ${entrega.status}`);
      console.log(`  Data Agendada: ${entrega.dataAgendada}`);
      console.log(`  Viagem ID: ${entrega.viagemId || "Não vinculada"}`);
      console.log(`  Pacotes: ${entrega.quantidadePacotes}`);
      console.log(`  Valor: R$ ${entrega.valorTotal}`);
      console.log("");
    }
    console.log(`Total: ${todasEntregas.length} entrega(s)\n`);
  }

  // 2. Verificar viagens
  console.log("🚚 VIAGENS INTERMUNICIPAIS:");
  console.log("=" .repeat(60));

  const todasViagens = await db
    .select({
      viagem: viagensIntermunicipais,
      motorista: drivers,
      rota: rotasIntermunicipais
    })
    .from(viagensIntermunicipais)
    .leftJoin(drivers, eq(viagensIntermunicipais.entregadorId, drivers.id))
    .leftJoin(rotasIntermunicipais, eq(viagensIntermunicipais.rotaId, rotasIntermunicipais.id))
    .orderBy(viagensIntermunicipais.createdAt);

  if (todasViagens.length === 0) {
    console.log("❌ Nenhuma viagem encontrada\n");
  } else {
    for (const { viagem, motorista, rota } of todasViagens) {
      console.log(`Viagem ID: ${viagem.id}`);
      console.log(`  Motorista: ${motorista?.name || "Desconhecido"}`);
      console.log(`  Rota: ${rota?.nomeRota || "Desconhecida"}`);
      console.log(`  Data: ${viagem.dataViagem}`);
      console.log(`  Status: ${viagem.status}`);
      console.log(`  Capacidade: ${viagem.capacidadePacotesTotal} pacotes / ${viagem.capacidadePesoKgTotal} kg`);
      console.log(`  Ocupação: ${viagem.pacotesAceitos} pacotes / ${viagem.pesoAceitoKg} kg`);
      console.log(`  Horário Saída: ${viagem.horarioSaidaPlanejado}`);
      console.log("");
    }
    console.log(`Total: ${todasViagens.length} viagem(s)\n`);
  }

  // 3. Resumo por status
  console.log("📈 RESUMO:");
  console.log("=" .repeat(60));

  const entregasPorStatus = todasEntregas.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("Entregas por status:");
  Object.entries(entregasPorStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log(`\nViagens: ${todasViagens.length}`);
  console.log(`Entregas vinculadas a viagens: ${todasEntregas.filter(e => e.viagemId).length}`);
  console.log(`Entregas sem viagem: ${todasEntregas.filter(e => !e.viagemId).length}`);
}

checkStatus()
  .then(() => {
    console.log("\n✅ Verificação concluída");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
