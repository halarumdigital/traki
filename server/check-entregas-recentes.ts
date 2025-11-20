import { db } from "./db.js";
import { entregasIntermunicipais, companies } from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

async function checkEntregasRecentes() {
  console.log("📋 VERIFICANDO ENTREGAS RECENTES");
  console.log("=".repeat(80));

  // Buscar as últimas 10 entregas
  const entregas = await db
    .select({
      entrega: entregasIntermunicipais,
      empresa: companies
    })
    .from(entregasIntermunicipais)
    .leftJoin(companies, eq(entregasIntermunicipais.empresaId, companies.id))
    .orderBy(desc(entregasIntermunicipais.createdAt))
    .limit(10);

  console.log(`\n📦 ÚLTIMAS ${entregas.length} ENTREGAS:\n`);

  entregas.forEach((item, i) => {
    const e = item.entrega;
    const emp = item.empresa;

    console.log(`[${i + 1}] ${e.numeroPedido}`);
    console.log(`    ID: ${e.id}`);
    console.log(`    Empresa: ${emp?.name || 'N/A'}`);
    console.log(`    Status: ${e.status}`);
    console.log(`    Data Agendada: ${e.dataAgendada}`);
    console.log(`    Rota ID: ${e.rotaId}`);
    console.log(`    Viagem ID: ${e.viagemId || 'Nenhuma'}`);
    console.log(`    Criado em: ${e.createdAt}`);
    console.log("");
  });

  // Agrupar por empresa
  console.log("\n📊 ENTREGAS POR EMPRESA (últimas 10):");
  console.log("=".repeat(80));

  const porEmpresa = entregas.reduce((acc, item) => {
    const empresaId = item.entrega.empresaId;
    const empresaNome = item.empresa?.name || 'Desconhecida';

    if (!acc[empresaId]) {
      acc[empresaId] = {
        nome: empresaNome,
        entregas: []
      };
    }

    acc[empresaId].entregas.push(item.entrega);
    return acc;
  }, {} as Record<string, { nome: string; entregas: any[] }>);

  Object.entries(porEmpresa).forEach(([empresaId, data]) => {
    console.log(`\n${data.nome}:`);
    console.log(`  Total: ${data.entregas.length} entregas`);
    data.entregas.forEach((e, i) => {
      console.log(`  [${i + 1}] ${e.numeroPedido} - Status: ${e.status}`);
    });
  });
}

checkEntregasRecentes()
  .then(() => {
    console.log("\n✅ Verificação concluída");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
