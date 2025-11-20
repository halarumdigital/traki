import { db } from "./db";
import { entregasIntermunicipais, rotasIntermunicipais, companies } from "../shared/schema";
import { eq } from "drizzle-orm";

console.log("===========================================");
console.log("🔗 DATABASE_URL:", process.env.DATABASE_URL);
const dbName = process.env.DATABASE_URL?.split("/").pop();
console.log(`📊 Conectando ao banco: ${dbName}`);
console.log("===========================================\n");

async function main() {
  console.log("🔍 VERIFICANDO STATUS DAS ENTREGAS\n");

  // Buscar todas as entregas com JOIN
  const entregas = await db
    .select({
      id: entregasIntermunicipais.id,
      numeroPedido: entregasIntermunicipais.numeroPedido,
      status: entregasIntermunicipais.status,
      rotaNome: rotasIntermunicipais.nomeRota,
      empresaNome: companies.name,
    })
    .from(entregasIntermunicipais)
    .leftJoin(rotasIntermunicipais, eq(entregasIntermunicipais.rotaId, rotasIntermunicipais.id))
    .leftJoin(companies, eq(entregasIntermunicipais.empresaId, companies.id))
    .limit(10);

  console.log(`Total de entregas: ${entregas.length}\n`);

  entregas.forEach((entrega, i) => {
    console.log(`[${i + 1}] ${entrega.numeroPedido}`);
    console.log(`    Status: "${entrega.status}" (tipo: ${typeof entrega.status})`);
    console.log(`    Rota: "${entrega.rotaNome}"`);
    console.log(`    Empresa: "${entrega.empresaNome}"`);
    console.log(`    ID: ${entrega.id}\n`);
  });
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
