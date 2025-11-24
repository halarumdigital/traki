import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

async function checkImageUrls() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ DATABASE_URL não encontrada no .env");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    console.log("🔍 Verificando URLs das imagens no banco de dados...\n");

    // Verificar documentos dos motoristas
    const driverDocuments = await db.execute(sql`
      SELECT
        dd.id,
        dd.driver_id,
        dd.document_url,
        ddt.name as document_type,
        d.name as driver_name,
        dd.created_at
      FROM driver_documents dd
      LEFT JOIN driver_document_types ddt ON dd.document_type_id = ddt.id
      LEFT JOIN drivers d ON dd.driver_id = d.id
      ORDER BY dd.created_at DESC
      LIMIT 10
    `);

    console.log("📄 DOCUMENTOS DOS MOTORISTAS (últimos 10):");
    console.log("=" .repeat(80));

    for (const doc of driverDocuments.rows) {
      console.log(`\nMotorista: ${doc.driver_name || 'Desconhecido'}`);
      console.log(`Tipo: ${doc.document_type}`);
      console.log(`URL: ${doc.document_url}`);
      console.log(`Data: ${new Date(doc.created_at).toLocaleString('pt-BR')}`);

      // Verificar o formato da URL
      if (doc.document_url) {
        if (doc.document_url.startsWith('http')) {
          const url = new URL(doc.document_url);
          console.log(`✅ URL completa - Host: ${url.host}`);
        } else if (doc.document_url.startsWith('/')) {
          console.log(`⚠️  URL relativa - Precisa de base URL`);
        } else {
          console.log(`❌ Formato de URL inválido`);
        }
      } else {
        console.log(`❌ URL vazia ou nula`);
      }
    }

    // Contar totais
    const totals = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN document_url IS NULL THEN 1 END) as null_urls,
        COUNT(CASE WHEN document_url LIKE 'http%' THEN 1 END) as absolute_urls,
        COUNT(CASE WHEN document_url LIKE '/%' THEN 1 END) as relative_urls,
        COUNT(CASE WHEN document_url NOT LIKE 'http%' AND document_url NOT LIKE '/%' AND document_url IS NOT NULL THEN 1 END) as invalid_urls
      FROM driver_documents
    `);

    const stats = totals.rows[0];
    console.log("\n" + "=" .repeat(80));
    console.log("📊 ESTATÍSTICAS DAS URLs:");
    console.log(`Total de documentos: ${stats.total}`);
    console.log(`URLs nulas/vazias: ${stats.null_urls}`);
    console.log(`URLs absolutas (http...): ${stats.absolute_urls}`);
    console.log(`URLs relativas (/...): ${stats.relative_urls}`);
    console.log(`URLs inválidas: ${stats.invalid_urls}`);

    // Verificar variável de ambiente SERVER_URL
    console.log("\n" + "=" .repeat(80));
    console.log("🔧 CONFIGURAÇÃO DO SERVIDOR:");
    console.log(`SERVER_URL: ${process.env.SERVER_URL || '❌ NÃO DEFINIDA'}`);

    if (!process.env.SERVER_URL) {
      console.log("\n⚠️  AVISO: SERVER_URL não está definida no .env");
      console.log("Isso significa que as URLs relativas usarão o host da requisição");
      console.log("Recomendado definir SERVER_URL para consistência");
    }

    // Verificar diretório de uploads
    const fs = await import('fs');
    const path = await import('path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'documents_driver');

    console.log("\n" + "=" .repeat(80));
    console.log("📁 DIRETÓRIO DE UPLOADS:");
    console.log(`Caminho: ${uploadsDir}`);

    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      console.log(`✅ Diretório existe - ${files.length} arquivos encontrados`);
      if (files.length > 0) {
        console.log("Primeiros 5 arquivos:");
        files.slice(0, 5).forEach(file => {
          console.log(`  - ${file}`);
        });
      }
    } else {
      console.log(`❌ Diretório não existe!`);
    }

  } catch (error) {
    console.error("❌ Erro ao verificar URLs:", error);
  } finally {
    await pool.end();
  }
}

checkImageUrls();