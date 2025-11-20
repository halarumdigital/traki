import { db } from "./db.js";
import { entregasIntermunicipais, companies, viagensIntermunicipais } from "../shared/schema.js";
import { eq, and, sql } from "drizzle-orm";

async function debugColeta() {
  const viagemId = "ec42dc4a-a237-4cb1-9785-d2988305bae5";

  console.log("🔍 DEBUGANDO COLETA PARA VIAGEM:", viagemId);
  console.log("=" .repeat(80));

  // 1. Buscar entregas da viagem com join da empresa (exatamente como na função)
  const entregas = await db
    .select({
      entrega: entregasIntermunicipais,
      empresa: companies
    })
    .from(entregasIntermunicipais)
    .leftJoin(companies, eq(entregasIntermunicipais.empresaId, companies.id))
    .where(
      and(
        eq(entregasIntermunicipais.viagemId, viagemId),
        sql`${entregasIntermunicipais.status} != 'cancelada'`
      )
    );

  console.log(`\n✅ Entregas encontradas: ${entregas.length}\n`);

  for (const { entrega, empresa } of entregas) {
    console.log("📦 ENTREGA:", entrega.numeroPedido);
    console.log("  ID:", entrega.id);
    console.log("  Empresa ID:", entrega.empresaId);
    console.log("  Status:", entrega.status);
    console.log("\n🏢 EMPRESA:");
    if (empresa) {
      console.log("  ✅ Empresa encontrada:");
      console.log("    ID:", empresa.id);
      console.log("    Nome:", empresa.name);
      console.log("    Endereço:", empresa.street, empresa.number);
      console.log("    Bairro:", empresa.neighborhood);
      console.log("    Cidade:", empresa.city);
      console.log("    CEP:", empresa.cep);
      console.log("    Telefone:", empresa.phone);
      console.log("    Responsável:", empresa.responsibleName);
      console.log("    WhatsApp:", empresa.responsibleWhatsapp);
    } else {
      console.log("  ❌ Empresa NÃO encontrada (null)");
      console.log("  ⚠️ Verificando se existe empresa com este ID...");

      const [empresaManual] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, entrega.empresaId));

      if (empresaManual) {
        console.log("  ✅ Empresa existe no banco:", empresaManual.name);
      } else {
        console.log("  ❌ Empresa NÃO existe no banco!");
      }
    }

    console.log("\n📍 ENDEREÇO DE COLETA:");
    console.log("  Completo:", entrega.enderecoColetaCompleto);
    console.log("  Logradouro:", entrega.enderecoColetaLogradouro);
    console.log("  Número:", entrega.enderecoColetaNumero);
    console.log("  Bairro:", entrega.enderecoColetaBairro);
    console.log("  Cidade:", entrega.enderecoColetaCidade);
    console.log("  CEP:", entrega.enderecoColetaCep);

    console.log("\n" + "-".repeat(80) + "\n");
  }

  // Montar estrutura de coletas (exatamente como na função)
  const coletas = entregas.map(({ entrega, empresa }, index) => ({
    id: entrega.id,
    ordem_coleta: index + 1,
    viagem_id: viagemId,
    empresa_id: entrega.empresaId,
    empresa_nome: empresa?.name || 'Empresa não encontrada',
    empresa_endereco: empresa ? `${empresa.street}, ${empresa.number} - ${empresa.neighborhood}, ${empresa.city}` : null,
    empresa_telefone: empresa?.phone,
    empresa_responsavel: empresa?.responsibleName,
    empresa_whatsapp: empresa?.responsibleWhatsapp,
    numero_pedido: entrega.numeroPedido,
    endereco_completo: entrega.enderecoColetaCompleto,
    logradouro: entrega.enderecoColetaLogradouro,
    numero: entrega.enderecoColetaNumero,
    bairro: entrega.enderecoColetaBairro,
    cidade: entrega.enderecoColetaCidade,
    cep: entrega.enderecoColetaCep,
    latitude: entrega.enderecoColetaLatitude,
    longitude: entrega.enderecoColetaLongitude,
    quantidade_pacotes: entrega.quantidadePacotes,
    status: "pendente"
  }));

  console.log("\n📋 ESTRUTURA DE COLETA FINAL:");
  console.log("=" .repeat(80));
  console.log(JSON.stringify(coletas, null, 2));
}

debugColeta()
  .then(() => {
    console.log("\n✅ Debug concluído");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  });
