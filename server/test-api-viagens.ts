import { db } from "./db.js";
import { viagensIntermunicipais, drivers, rotasIntermunicipais } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

async function testApiViagens() {
  console.log("🧪 TESTANDO QUERY DA API /api/admin/viagens-intermunicipais\n");

  // Replicar exatamente a query do endpoint
  const result = await db
    .select({
      id: viagensIntermunicipais.id,
      entregadorId: viagensIntermunicipais.entregadorId,
      entregadorNome: drivers.name,
      rotaId: viagensIntermunicipais.rotaId,
      rotaNome: rotasIntermunicipais.nomeRota,
      dataViagem: viagensIntermunicipais.dataViagem,
      status: viagensIntermunicipais.status,
      capacidadePacotesTotal: viagensIntermunicipais.capacidadePacotesTotal,
      capacidadePesoKgTotal: viagensIntermunicipais.capacidadePesoKgTotal,
      pacotesAceitos: viagensIntermunicipais.pacotesAceitos,
      pesoAceitoKg: viagensIntermunicipais.pesoAceitoKg,
      horarioSaidaPlanejado: viagensIntermunicipais.horarioSaidaPlanejado,
      horarioSaidaReal: viagensIntermunicipais.horarioSaidaReal,
      horarioChegadaPrevisto: viagensIntermunicipais.horarioChegadaPrevisto,
      horarioChegadaReal: viagensIntermunicipais.horarioChegadaReal,
      createdAt: viagensIntermunicipais.createdAt,
      updatedAt: viagensIntermunicipais.updatedAt,
    })
    .from(viagensIntermunicipais)
    .leftJoin(drivers, eq(viagensIntermunicipais.entregadorId, drivers.id))
    .leftJoin(rotasIntermunicipais, eq(viagensIntermunicipais.rotaId, rotasIntermunicipais.id))
    .orderBy(desc(viagensIntermunicipais.dataViagem));

  console.log(`✅ Query retornou ${result.length} viagem(s)\n`);

  if (result.length === 0) {
    console.log("❌ Nenhuma viagem retornada pela query");
  } else {
    console.log("📋 RESULTADO DA QUERY:");
    console.log("=" .repeat(80));
    result.forEach((viagem, index) => {
      console.log(`\n[${index + 1}] Viagem:`);
      console.log(JSON.stringify(viagem, null, 2));
    });
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n🔍 DETALHES TÉCNICOS:");

  // Verificar se há problema com as colunas
  if (result.length > 0) {
    const viagem = result[0];
    console.log("\nValores das colunas críticas:");
    console.log(`  entregadorNome: ${viagem.entregadorNome} (tipo: ${typeof viagem.entregadorNome})`);
    console.log(`  rotaNome: ${viagem.rotaNome} (tipo: ${typeof viagem.rotaNome})`);
    console.log(`  dataViagem: ${viagem.dataViagem} (tipo: ${typeof viagem.dataViagem})`);
    console.log(`  horarioSaidaPlanejado: ${viagem.horarioSaidaPlanejado} (tipo: ${typeof viagem.horarioSaidaPlanejado})`);
  }
}

testApiViagens()
  .then(() => {
    console.log("\n✅ Teste concluído");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
