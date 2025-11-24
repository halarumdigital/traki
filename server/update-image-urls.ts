import { db } from "./db.js";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function updateImageUrls() {
  try {
    console.log("🔄 ATUALIZAÇÃO DE URLs DAS IMAGENS DOS MOTORISTAS");
    console.log("=".repeat(80));

    // Verificar configuração atual
    const currentServerUrl = process.env.SERVER_URL;
    console.log(`\n📍 SERVER_URL atual: ${currentServerUrl || "NÃO DEFINIDA"}`);

    if (!currentServerUrl) {
      console.log("\n⚠️  AVISO: SERVER_URL não está definida no .env");
      console.log("Configure SERVER_URL antes de continuar.");
      console.log("Exemplo: SERVER_URL=https://seu-dominio.com");
      process.exit(1);
    }

    // Buscar URLs que precisam ser atualizadas
    console.log("\n🔍 Analisando URLs no banco de dados...");

    const problematicUrls = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN document_url LIKE '%localhost%' THEN 1 END) as localhost_urls,
        COUNT(CASE WHEN document_url LIKE '%127.0.0.1%' THEN 1 END) as local_ip_urls,
        COUNT(CASE WHEN document_url LIKE '%192.168%' THEN 1 END) as private_ip_urls,
        COUNT(CASE WHEN document_url LIKE '/%' THEN 1 END) as relative_urls,
        COUNT(CASE WHEN document_url IS NULL THEN 1 END) as null_urls
      FROM driver_documents
    `);

    const stats = problematicUrls.rows[0];
    console.log(`\n📊 Estatísticas encontradas:`);
    console.log(`   Total de documentos: ${stats.total}`);
    console.log(`   URLs com localhost: ${stats.localhost_urls}`);
    console.log(`   URLs com 127.0.0.1: ${stats.local_ip_urls}`);
    console.log(`   URLs com IP privado: ${stats.private_ip_urls}`);
    console.log(`   URLs relativas: ${stats.relative_urls}`);
    console.log(`   URLs nulas: ${stats.null_urls}`);

    const totalProblematic = Number(stats.localhost_urls) + Number(stats.local_ip_urls) + Number(stats.private_ip_urls);

    if (totalProblematic === 0) {
      console.log("\n✅ Não há URLs problemáticas para atualizar!");

      if (Number(stats.relative_urls) > 0) {
        console.log(`\n📁 Existem ${stats.relative_urls} URLs relativas.`);
        console.log("Estas usarão SERVER_URL automaticamente quando servidas.");
      }

      const continuar = await question("\nDeseja ver exemplos de URLs atuais? (s/n): ");

      if (continuar.toLowerCase() === 's') {
        const samples = await db.execute(sql`
          SELECT document_url
          FROM driver_documents
          WHERE document_url IS NOT NULL
          LIMIT 5
        `);

        console.log("\n📋 Exemplos de URLs atuais:");
        samples.rows.forEach(row => {
          console.log(`   - ${row.document_url}`);
        });
      }

      rl.close();
      process.exit(0);
    }

    // Mostrar exemplos de URLs problemáticas
    console.log("\n⚠️  URLs problemáticas encontradas!");

    const examples = await db.execute(sql`
      SELECT id, document_url
      FROM driver_documents
      WHERE (
        document_url LIKE '%localhost%' OR
        document_url LIKE '%127.0.0.1%' OR
        document_url LIKE '%192.168%'
      )
      LIMIT 5
    `);

    console.log("\n📋 Exemplos:");
    examples.rows.forEach(row => {
      console.log(`   ID: ${row.id}`);
      console.log(`   URL: ${row.document_url}`);
      console.log("");
    });

    // Perguntar ao usuário o que fazer
    console.log("\n🔧 OPÇÕES DE ATUALIZAÇÃO:");
    console.log("1. Converter URLs absolutas com localhost/IP para URLs relativas");
    console.log("2. Substituir localhost/IP por novo domínio");
    console.log("3. Cancelar");

    const opcao = await question("\nEscolha uma opção (1, 2 ou 3): ");

    if (opcao === "3") {
      console.log("❌ Operação cancelada.");
      rl.close();
      process.exit(0);
    }

    let updateCount = 0;

    if (opcao === "1") {
      console.log("\n🔄 Convertendo URLs absolutas para relativas...");

      // Atualizar URLs com localhost
      const result1 = await db.execute(sql`
        UPDATE driver_documents
        SET document_url = REGEXP_REPLACE(
          document_url,
          '^https?://localhost:[0-9]+',
          '',
          'g'
        )
        WHERE document_url LIKE '%localhost%'
      `);

      // Atualizar URLs com 127.0.0.1
      const result2 = await db.execute(sql`
        UPDATE driver_documents
        SET document_url = REGEXP_REPLACE(
          document_url,
          '^https?://127.0.0.1:[0-9]+',
          '',
          'g'
        )
        WHERE document_url LIKE '%127.0.0.1%'
      `);

      // Atualizar URLs com IPs privados
      const result3 = await db.execute(sql`
        UPDATE driver_documents
        SET document_url = REGEXP_REPLACE(
          document_url,
          '^https?://192.168.[0-9]+.[0-9]+:[0-9]+',
          '',
          'g'
        )
        WHERE document_url LIKE '%192.168%'
      `);

      updateCount = (result1.rowCount || 0) + (result2.rowCount || 0) + (result3.rowCount || 0);

    } else if (opcao === "2") {
      const novoDominio = await question("\nDigite o novo domínio (ex: https://api.fretus.com): ");

      if (!novoDominio.startsWith('http')) {
        console.log("❌ O domínio deve começar com http:// ou https://");
        rl.close();
        process.exit(1);
      }

      console.log(`\n🔄 Substituindo localhost/IP por ${novoDominio}...`);

      // Atualizar URLs com localhost
      const result1 = await db.execute(sql`
        UPDATE driver_documents
        SET document_url = REGEXP_REPLACE(
          document_url,
          '^https?://localhost:[0-9]+',
          ${novoDominio},
          'g'
        )
        WHERE document_url LIKE '%localhost%'
      `);

      // Atualizar URLs com 127.0.0.1
      const result2 = await db.execute(sql`
        UPDATE driver_documents
        SET document_url = REGEXP_REPLACE(
          document_url,
          '^https?://127.0.0.1:[0-9]+',
          ${novoDominio},
          'g'
        )
        WHERE document_url LIKE '%127.0.0.1%'
      `);

      // Atualizar URLs com IPs privados
      const result3 = await db.execute(sql`
        UPDATE driver_documents
        SET document_url = REGEXP_REPLACE(
          document_url,
          '^https?://192.168.[0-9]+.[0-9]+:[0-9]+',
          ${novoDominio},
          'g'
        )
        WHERE document_url LIKE '%192.168%'
      `);

      updateCount = (result1.rowCount || 0) + (result2.rowCount || 0) + (result3.rowCount || 0);
    }

    console.log(`\n✅ ${updateCount} URLs atualizadas com sucesso!`);

    // Verificar resultado
    const verificacao = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN document_url LIKE '%localhost%' THEN 1 END) as localhost_remaining,
        COUNT(CASE WHEN document_url LIKE '%127.0.0.1%' THEN 1 END) as local_ip_remaining,
        COUNT(CASE WHEN document_url LIKE '%192.168%' THEN 1 END) as private_ip_remaining
      FROM driver_documents
    `);

    const remaining = verificacao.rows[0];
    const totalRemaining = Number(remaining.localhost_remaining) +
                          Number(remaining.local_ip_remaining) +
                          Number(remaining.private_ip_remaining);

    if (totalRemaining > 0) {
      console.log(`\n⚠️  Ainda existem ${totalRemaining} URLs problemáticas.`);
      console.log("Pode ser necessário executar o script novamente.");
    } else {
      console.log("\n✅ Todas as URLs problemáticas foram corrigidas!");
    }

    // Mostrar exemplos após atualização
    const examplesAfter = await db.execute(sql`
      SELECT document_url
      FROM driver_documents
      WHERE document_url IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 5
    `);

    console.log("\n📋 Exemplos de URLs após atualização:");
    examplesAfter.rows.forEach(row => {
      console.log(`   - ${row.document_url}`);
    });

    console.log("\n✨ Processo concluído!");
    console.log("\n📌 PRÓXIMOS PASSOS:");
    console.log("1. Certifique-se de que SERVER_URL está correta no .env");
    console.log("2. Reinicie o servidor para aplicar as mudanças");
    console.log("3. Teste o acesso às imagens no modal de visualização");

  } catch (error) {
    console.error("\n❌ Erro durante a atualização:", error);
  } finally {
    rl.close();
    process.exit(0);
  }
}

updateImageUrls();