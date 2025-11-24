import { db } from "./db.js";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function checkDriverImages() {
  try {
    console.log("🔍 Verificando URLs das imagens dos motoristas...\n");
    console.log("SERVER_URL configurada:", process.env.SERVER_URL || "NÃO DEFINIDA");
    console.log("-".repeat(80));

    // Buscar últimos 10 documentos
    const documents = await db.execute(sql`
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
      WHERE dd.document_url IS NOT NULL
      ORDER BY dd.created_at DESC
      LIMIT 10
    `);

    if (documents.rows.length === 0) {
      console.log("❌ Nenhum documento encontrado no banco!");
      return;
    }

    console.log(`\n📄 Encontrados ${documents.rows.length} documentos recentes:\n`);

    for (const doc of documents.rows) {
      console.log(`\n👤 Motorista: ${doc.driver_name || 'Desconhecido'}`);
      console.log(`📋 Tipo: ${doc.document_type}`);
      console.log(`🔗 URL: ${doc.document_url}`);

      // Analisar tipo de URL
      const url = doc.document_url as string;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
          const urlObj = new URL(url);
          console.log(`✅ URL absoluta - Host: ${urlObj.host}`);

          // Verificar se o host é localhost ou IP local
          if (urlObj.host.includes('localhost') || urlObj.host.includes('127.0.0.1')) {
            console.log(`⚠️  PROBLEMA: URL aponta para localhost!`);
            console.log(`   Isso não funcionará em produção.`);
          }
        } catch (e) {
          console.log(`❌ URL inválida`);
        }
      } else if (url.startsWith('/')) {
        console.log(`📁 URL relativa - Será combinada com SERVER_URL ou host da requisição`);
        if (process.env.SERVER_URL) {
          console.log(`   Preview: ${process.env.SERVER_URL}${url}`);
        } else {
          console.log(`   ⚠️  SERVER_URL não definida - usará host da requisição`);
        }
      } else {
        console.log(`❓ Formato desconhecido de URL`);
      }
    }

    // Estatísticas gerais
    const stats = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN document_url IS NULL THEN 1 END) as null_urls,
        COUNT(CASE WHEN document_url LIKE 'http%' THEN 1 END) as absolute_urls,
        COUNT(CASE WHEN document_url LIKE '/%' THEN 1 END) as relative_urls,
        COUNT(CASE WHEN document_url LIKE '%localhost%' THEN 1 END) as localhost_urls
      FROM driver_documents
    `);

    const stat = stats.rows[0];
    console.log("\n" + "=".repeat(80));
    console.log("📊 ESTATÍSTICAS GERAIS:");
    console.log(`Total de documentos: ${stat.total}`);
    console.log(`URLs vazias: ${stat.null_urls}`);
    console.log(`URLs absolutas: ${stat.absolute_urls}`);
    console.log(`URLs relativas: ${stat.relative_urls}`);
    console.log(`URLs com localhost: ${stat.localhost_urls}`);

    if (Number(stat.localhost_urls) > 0) {
      console.log("\n⚠️  AVISO: Existem URLs apontando para localhost!");
      console.log("Essas imagens não funcionarão após a migração do servidor.");
    }

    // Verificar diretório de uploads
    const fs = await import('fs');
    const path = await import('path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'documents_driver');

    console.log("\n" + "=".repeat(80));
    console.log("📁 VERIFICAÇÃO DO DIRETÓRIO LOCAL:");

    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      console.log(`✅ Diretório existe: ${uploadsDir}`);
      console.log(`   Arquivos encontrados: ${files.length}`);
    } else {
      console.log(`❌ Diretório não existe: ${uploadsDir}`);
      console.log(`   As imagens podem estar em outro servidor ou na nuvem.`);
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n🔧 RECOMENDAÇÕES:");

    if (!process.env.SERVER_URL) {
      console.log("1. Configure SERVER_URL no arquivo .env");
      console.log("   Ex: SERVER_URL=https://seu-dominio.com");
    }

    if (Number(stat.localhost_urls) > 0) {
      console.log("2. Execute o script de atualização para corrigir URLs com localhost");
    }

    if (Number(stat.relative_urls) > 0 && !process.env.SERVER_URL) {
      console.log("3. Com URLs relativas, é importante ter SERVER_URL configurada");
    }

  } catch (error) {
    console.error("❌ Erro:", error);
  }

  process.exit(0);
}

checkDriverImages();