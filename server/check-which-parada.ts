import { db } from "./db";
import { entregasIntermunicipais, viagemEntregas, entregasIntermunicipalParadas } from "../shared/schema";
import { eq } from "drizzle-orm";

console.log("===========================================");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL);
const dbName = process.env.DATABASE_URL?.split("/").pop();
console.log(`📊 Conectando ao banco: ${dbName}`);
console.log("===========================================\n");

async function main() {
  console.log("🔍 VERIFICANDO QUAL PARADA FOI VINCULADA");
  console.log("================================================================================\n");

  const entregaId = "b4dab0a0-33f3-44f1-9a53-c9614f813522"; // INT-1763505822628-4U140KB

  // Buscar paradas
  const paradas = await db
    .select()
    .from(entregasIntermunicipalParadas)
    .where(eq(entregasIntermunicipalParadas.entregaId, entregaId))
    .orderBy(entregasIntermunicipalParadas.ordem);

  console.log(`📍 PARADAS DA ENTREGA:\n`);
  paradas.forEach((parada, index) => {
    console.log(`  [${index + 1}] Ordem ${parada.ordem} - ${parada.destinatarioNome}`);
    console.log(`      ID: ${parada.id}\n`);
  });

  // Buscar viagem_entregas
  const vEntregas = await db
    .select()
    .from(viagemEntregas)
    .where(eq(viagemEntregas.entregaId, entregaId));

  console.log(`🚚 VIAGEM_ENTREGAS:\n`);
  vEntregas.forEach((ve, index) => {
    console.log(`  [${index + 1}] ${ve.destinatarioNome}`);
    console.log(`      ID: ${ve.id}`);
    console.log(`      ParadaId: ${ve.paradaId || 'NENHUMA'}\n`);
  });

  // Verificar qual parada está vinculada
  if (vEntregas.length > 0 && vEntregas[0].paradaId) {
    const paradaVinculada = paradas.find(p => p.id === vEntregas[0].paradaId);
    if (paradaVinculada) {
      console.log(`✅ A viagem_entrega está vinculada à PARADA ${paradaVinculada.ordem} (${paradaVinculada.destinatarioNome})`);
    } else {
      console.log(`❌ A viagem_entrega tem paradaId mas a parada não foi encontrada!`);
    }
  }

  console.log("\n================================================================================");
  console.log("\n📊 RESUMO:");
  console.log(`   Paradas criadas: ${paradas.length}`);
  console.log(`   Viagem_entregas criadas: ${vEntregas.length}`);
  console.log(`   Paradas FALTANDO: ${paradas.length - vEntregas.length}`);

  if (paradas.length > vEntregas.length) {
    const faltantes = paradas.filter(p => !vEntregas.some(ve => ve.paradaId === p.id));
    console.log(`\n❌ PARADAS SEM VIAGEM_ENTREGA:`);
    faltantes.forEach(p => {
      console.log(`   - Parada ${p.ordem}: ${p.destinatarioNome} (ID: ${p.id})`);
    });
  }
}

main()
  .then(() => {
    console.log("\n✅ Verificação concluída");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Erro:", err);
    process.exit(1);
  });
