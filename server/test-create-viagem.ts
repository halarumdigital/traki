import { db } from "./db.js";
import { entregasIntermunicipais, viagensIntermunicipais, drivers, rotasIntermunicipais, entregadorRotas } from "../shared/schema.js";
import { eq, and } from "drizzle-orm";

async function testCreateViagem() {
  console.log("🔍 Verificando entregas pendentes...");

  // Buscar todas as entregas aguardando motorista
  const entregas = await db
    .select()
    .from(entregasIntermunicipais)
    .where(eq(entregasIntermunicipais.status, "aguardando_motorista"));

  console.log(`✅ Encontradas ${entregas.length} entrega(s) aguardando motorista:`);
  entregas.forEach(e => {
    console.log(`  - ${e.numeroPedido} | Rota: ${e.rotaId} | Data: ${e.dataAgendada}`);
  });

  if (entregas.length === 0) {
    console.log("❌ Nenhuma entrega pendente encontrada");
    return;
  }

  // Pegar a primeira entrega
  const entrega = entregas[0];
  console.log(`\n📦 Processando entrega: ${entrega.numeroPedido}`);

  // Buscar motoristas que têm configuração para esta rota
  console.log("🔍 Buscando motoristas com rota configurada...");
  const motoristasComRota = await db
    .select({
      motorista: drivers,
      rotaConfig: entregadorRotas
    })
    .from(entregadorRotas)
    .innerJoin(drivers, eq(entregadorRotas.entregadorId, drivers.id))
    .where(
      and(
        eq(entregadorRotas.rotaId, entrega.rotaId),
        eq(entregadorRotas.ativa, true),
        eq(drivers.active, true),
        eq(drivers.approve, true)
      )
    );

  console.log(`✅ Encontrados ${motoristasComRota.length} motorista(s) com rota configurada`);

  if (motoristasComRota.length === 0) {
    console.log("❌ Nenhum motorista com essa rota configurada");
    console.log("\n🔍 Buscando todos os motoristas ativos...");

    const todosMotoristas = await db
      .select()
      .from(drivers)
      .where(
        and(
          eq(drivers.active, true),
          eq(drivers.approve, true)
        )
      );

    console.log(`✅ Encontrados ${todosMotoristas.length} motorista(s) ativo(s)`);

    if (todosMotoristas.length === 0) {
      console.log("❌ Nenhum motorista ativo no sistema");
      return;
    }

    const motorista = todosMotoristas[0];
    console.log(`\n⚠️ Usando motorista sem configuração de rota: ${motorista.name}`);
    console.log("   (Você precisará criar uma configuração de rota para este motorista)");

    // Verificar se existe configuração de rota para esse motorista e essa rota específica
    console.log(`\n🔍 Verificando se ${motorista.name} tem alguma rota configurada...`);
    const rotasDoMotorista = await db
      .select()
      .from(entregadorRotas)
      .where(eq(entregadorRotas.entregadorId, motorista.id));

    console.log(`✅ ${motorista.name} tem ${rotasDoMotorista.length} rota(s) configurada(s)`);

    if (rotasDoMotorista.length === 0) {
      console.log("\n❌ Motorista não tem nenhuma rota configurada");
      console.log("   Para criar uma viagem, o motorista precisa ter uma configuração de rota");
      console.log("\n💡 Solução:");
      console.log("   1. Acesse a página de configuração de rotas do motorista");
      console.log("   2. Configure uma rota para este motorista");
      console.log("   3. Execute este script novamente");
      return;
    }

    // Criar configuração de rota temporária para teste
    console.log(`\n📝 Criando configuração de rota temporária para teste...`);
    const [rotaConfigTeste] = await db
      .insert(entregadorRotas)
      .values({
        entregadorId: motorista.id,
        rotaId: entrega.rotaId,
        diasSemana: [1, 2, 3, 4, 5], // Seg a Sex
        horarioSaida: "08:00",
        horarioChegada: "12:00",
        capacidadePacotes: 10,
        capacidadePesoKg: "100",
        aceitaMultiplasColetas: true,
        aceitaMultiplasEntregas: true,
        ativa: true
      })
      .returning();

    console.log(`✅ Configuração de rota criada: ${rotaConfigTeste.id}`);

    // Criar a viagem
    console.log(`\n🚚 Criando viagem para ${motorista.name}...`);
    const [viagem] = await db
      .insert(viagensIntermunicipais)
      .values({
        entregadorId: motorista.id,
        rotaId: entrega.rotaId,
        entregadorRotaId: rotaConfigTeste.id,
        dataViagem: entrega.dataAgendada,
        status: "agendada",
        capacidadePacotesTotal: 10,
        capacidadePesoKgTotal: "100",
        pacotesAceitos: entrega.quantidadePacotes,
        pesoAceitoKg: entrega.pesoTotalKg || "0",
        horarioSaidaPlanejado: "08:00:00"
      })
      .returning();

    console.log(`✅ Viagem criada: ${viagem.id}`);

    // Atualizar a entrega para vincular à viagem
    console.log(`\n📝 Vinculando entrega à viagem...`);
    await db
      .update(entregasIntermunicipais)
      .set({
        viagemId: viagem.id,
        status: "motorista_aceito"
      })
      .where(eq(entregasIntermunicipais.id, entrega.id));

    console.log(`✅ Entrega vinculada à viagem e status atualizado para "motorista_aceito"`);

    console.log("\n✨ Processo concluído com sucesso!");
    console.log(`   Viagem ID: ${viagem.id}`);
    console.log(`   Motorista: ${motorista.name}`);
    console.log(`   Entrega: ${entrega.numeroPedido}`);

  } else {
    // Usar o primeiro motorista com rota configurada
    const { motorista, rotaConfig } = motoristasComRota[0];
    console.log(`\n✅ Usando motorista: ${motorista.name}`);

    // Criar a viagem
    console.log(`\n🚚 Criando viagem...`);
    const [viagem] = await db
      .insert(viagensIntermunicipais)
      .values({
        entregadorId: motorista.id,
        rotaId: entrega.rotaId,
        entregadorRotaId: rotaConfig.id,
        dataViagem: entrega.dataAgendada,
        status: "agendada",
        capacidadePacotesTotal: rotaConfig.capacidadePacotes,
        capacidadePesoKgTotal: rotaConfig.capacidadePesoKg,
        pacotesAceitos: entrega.quantidadePacotes,
        pesoAceitoKg: entrega.pesoTotalKg || "0",
        horarioSaidaPlanejado: `${rotaConfig.horarioSaida}:00`
      })
      .returning();

    console.log(`✅ Viagem criada: ${viagem.id}`);

    // Atualizar a entrega para vincular à viagem
    console.log(`\n📝 Vinculando entrega à viagem...`);
    await db
      .update(entregasIntermunicipais)
      .set({
        viagemId: viagem.id,
        status: "motorista_aceito"
      })
      .where(eq(entregasIntermunicipais.id, entrega.id));

    console.log(`✅ Entrega vinculada à viagem e status atualizado para "motorista_aceito"`);

    console.log("\n✨ Processo concluído com sucesso!");
    console.log(`   Viagem ID: ${viagem.id}`);
    console.log(`   Motorista: ${motorista.name}`);
    console.log(`   Entrega: ${entrega.numeroPedido}`);
  }
}

testCreateViagem()
  .then(() => {
    console.log("\n👋 Script finalizado");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro ao criar viagem:", error);
    process.exit(1);
  });
