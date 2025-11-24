import { db } from "./db.js";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function analyzeDocumentUrls() {
  console.log("📊 ANÁLISE DAS URLs DOS DOCUMENTOS");
  console.log("=" .repeat(80));

  try {
    // Estatísticas gerais
    const stats = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN document_url IS NULL THEN 1 END) as null_urls,
        COUNT(CASE WHEN document_url LIKE '%r2.dev%' THEN 1 END) as r2_urls,
        COUNT(CASE WHEN document_url LIKE '/uploads%' THEN 1 END) as local_urls,
        COUNT(CASE WHEN document_url LIKE 'http%' AND document_url NOT LIKE '%r2.dev%' THEN 1 END) as other_urls
      FROM driver_documents
    `);

    const s = stats.rows[0];
    console.log("\n📈 ESTATÍSTICAS GERAIS:");
    console.log(`Total de documentos: ${s.total}`);
    console.log(`URLs do R2: ${s.r2_urls} (${(s.r2_urls/s.total*100).toFixed(1)}%)`);
    console.log(`URLs locais (/uploads): ${s.local_urls} (${(s.local_urls/s.total*100).toFixed(1)}%)`);
    console.log(`URLs nulas/vazias: ${s.null_urls}`);
    console.log(`Outras URLs: ${s.other_urls}`);

    // Exemplos de cada tipo
    console.log("\n📁 EXEMPLOS DE URLS DO R2:");
    const r2Examples = await db.execute(sql`
      SELECT document_url, created_at
      FROM driver_documents
      WHERE document_url LIKE '%r2.dev%'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    for (const doc of r2Examples.rows) {
      console.log(`   ${new Date(doc.created_at).toLocaleDateString('pt-BR')} - ${doc.document_url}`);
    }

    console.log("\n📁 EXEMPLOS DE URLS LOCAIS:");
    const localExamples = await db.execute(sql`
      SELECT document_url, created_at
      FROM driver_documents
      WHERE document_url LIKE '/uploads%'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    for (const doc of localExamples.rows) {
      console.log(`   ${new Date(doc.created_at).toLocaleDateString('pt-BR')} - ${doc.document_url}`);
    }

    // Análise temporal
    console.log("\n📅 ANÁLISE TEMPORAL:");
    const temporal = await db.execute(sql`
      SELECT
        DATE(created_at) as date,
        COUNT(CASE WHEN document_url LIKE '%r2.dev%' THEN 1 END) as r2_count,
        COUNT(CASE WHEN document_url LIKE '/uploads%' THEN 1 END) as local_count
      FROM driver_documents
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 10
    `);

    console.log("Últimos 10 dias com uploads:");
    for (const row of temporal.rows) {
      console.log(`   ${row.date}: R2=${row.r2_count}, Local=${row.local_count}`);
    }

    // Motoristas afetados
    console.log("\n👥 MOTORISTAS AFETADOS:");

    const driversWithLocal = await db.execute(sql`
      SELECT
        d.name,
        COUNT(dd.id) as total_docs,
        COUNT(CASE WHEN dd.document_url LIKE '/uploads%' THEN 1 END) as local_docs,
        COUNT(CASE WHEN dd.document_url LIKE '%r2.dev%' THEN 1 END) as r2_docs
      FROM drivers d
      INNER JOIN driver_documents dd ON dd.driver_id = d.id
      WHERE d.active = true AND d.approve = true
      GROUP BY d.id, d.name
      HAVING COUNT(CASE WHEN dd.document_url LIKE '/uploads%' THEN 1 END) > 0
      ORDER BY local_docs DESC
      LIMIT 10
    `);

    console.log("Motoristas ativos com documentos locais:");
    for (const driver of driversWithLocal.rows) {
      console.log(`   ${driver.name}: ${driver.local_docs} locais, ${driver.r2_docs} R2`);
    }

    console.log("\n" + "=" .repeat(80));
    console.log("\n🔍 DIAGNÓSTICO:\n");

    if (Number(s.local_urls) > 0) {
      console.log("⚠️  PROBLEMA IDENTIFICADO:");
      console.log(`   - ${s.local_urls} documentos estão com URLs locais`);
      console.log("   - O diretório /uploads/documents_driver está VAZIO");
      console.log("   - As imagens foram perdidas na migração do servidor");
      console.log("\n🔧 SOLUÇÕES POSSÍVEIS:\n");
      console.log("1. RECUPERAR AS IMAGENS (se possível):");
      console.log("   - Copie os arquivos do servidor antigo para:");
      console.log("     /media/gilliard/Desenvolvimento1/fretus/uploads/documents_driver/");
      console.log("\n2. SOLICITAR REENVIO:");
      console.log("   - Marque os documentos como 'rejected' com mensagem");
      console.log("   - Peça aos motoristas para enviarem novamente");
      console.log("\n3. USAR PLACEHOLDER TEMPORÁRIO:");
      console.log("   - Criar imagem placeholder para documentos perdidos");
      console.log("   - Notificar motoristas para reenviar");
    }

    if (Number(s.r2_urls) > 0) {
      console.log("\n✅ Documentos no R2:");
      console.log(`   - ${s.r2_urls} documentos estão no R2`);
      console.log("   - O proxy está configurado para servir essas imagens");
    }

  } catch (error) {
    console.error("❌ Erro:", error);
  }

  process.exit(0);
}

analyzeDocumentUrls();