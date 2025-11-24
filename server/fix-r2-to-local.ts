import { db } from "./db.js";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadImage(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        resolve(false);
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(true);
      });
    }).on('error', () => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      resolve(false);
    });
  });
}

async function fixR2ToLocal() {
  console.log("🔄 MIGRAÇÃO DE IMAGENS DO R2 PARA SERVIDOR LOCAL");
  console.log("=" .repeat(80));

  const serverUrl = process.env.SERVER_URL;
  if (!serverUrl) {
    console.log("❌ SERVER_URL não configurada no .env!");
    process.exit(1);
  }

  console.log(`📍 SERVER_URL: ${serverUrl}`);

  // Criar diretório se não existir
  const uploadsDir = path.join(process.cwd(), "uploads", "documents_driver");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`📁 Diretório criado: ${uploadsDir}`);
  }

  // Buscar documentos com URLs do R2
  const r2Documents = await db.execute(sql`
    SELECT
      dd.id,
      dd.driver_id,
      dd.document_url,
      ddt.name as document_type,
      d.name as driver_name
    FROM driver_documents dd
    LEFT JOIN driver_document_types ddt ON dd.document_type_id = ddt.id
    LEFT JOIN drivers d ON dd.driver_id = d.id
    WHERE dd.document_url LIKE '%r2.dev%'
    ORDER BY dd.created_at DESC
  `);

  if (r2Documents.rows.length === 0) {
    console.log("✅ Nenhum documento no R2 encontrado!");

    // Verificar documentos locais
    const localDocs = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM driver_documents
      WHERE document_url LIKE '/uploads%'
    `);

    console.log(`📊 Documentos com URLs locais: ${localDocs.rows[0].total}`);
    process.exit(0);
  }

  console.log(`\n📸 Encontrados ${r2Documents.rows.length} documentos no R2`);
  console.log("\n🔧 OPÇÕES:");
  console.log("1. Tentar baixar imagens do R2 (se ainda acessível)");
  console.log("2. Converter todas as URLs para formato local");
  console.log("3. Gerar URLs locais vazias (placeholder)");

  const readline = (await import("readline")).createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise<string>(resolve => {
    readline.question("\nEscolha uma opção (1, 2 ou 3): ", resolve);
  });

  let successCount = 0;
  let failCount = 0;

  if (answer === "1") {
    console.log("\n📥 Tentando baixar imagens do R2...\n");

    for (const doc of r2Documents.rows) {
      const oldUrl = doc.document_url as string;
      const fileName = oldUrl.split('/').pop() || `${doc.id}.jpg`;
      const localPath = path.join(uploadsDir, fileName);
      const newUrl = `/uploads/documents_driver/${fileName}`;

      process.stdout.write(`Baixando ${doc.driver_name} - ${doc.document_type}... `);

      const success = await downloadImage(oldUrl, localPath);

      if (success) {
        // Atualizar URL no banco
        await db.execute(sql`
          UPDATE driver_documents
          SET document_url = ${newUrl}
          WHERE id = ${doc.id}
        `);
        console.log("✅");
        successCount++;
      } else {
        console.log("❌");
        failCount++;
      }
    }

    console.log(`\n📊 Resultado: ${successCount} baixados, ${failCount} falharam`);

  } else if (answer === "2") {
    console.log("\n🔄 Convertendo URLs para formato local...\n");

    for (const doc of r2Documents.rows) {
      const oldUrl = doc.document_url as string;
      const fileName = oldUrl.split('/').pop() || `${doc.id}.jpg`;
      const newUrl = `/uploads/documents_driver/${fileName}`;

      await db.execute(sql`
        UPDATE driver_documents
        SET document_url = ${newUrl}
        WHERE id = ${doc.id}
      `);

      console.log(`✅ ${doc.driver_name} - ${doc.document_type}`);
      successCount++;
    }

    console.log(`\n✅ ${successCount} URLs convertidas`);
    console.log("⚠️  AVISO: As imagens precisam existir em ${uploadsDir}");

  } else if (answer === "3") {
    console.log("\n🔄 Gerando URLs locais com placeholder...\n");

    // Criar imagem placeholder
    const placeholderPath = path.join(uploadsDir, "placeholder.jpg");
    if (!fs.existsSync(placeholderPath)) {
      // Criar um SVG simples como placeholder
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#f0f0f0"/>
  <text x="200" y="150" text-anchor="middle" font-family="Arial" font-size="20" fill="#999">
    Documento Pendente
  </text>
</svg>`;
      fs.writeFileSync(placeholderPath.replace('.jpg', '.svg'), svgContent);
      console.log("📄 Placeholder criado");
    }

    for (const doc of r2Documents.rows) {
      const newUrl = `/uploads/documents_driver/placeholder.svg`;

      await db.execute(sql`
        UPDATE driver_documents
        SET document_url = ${newUrl}
        WHERE id = ${doc.id}
      `);

      console.log(`✅ ${doc.driver_name} - ${doc.document_type}`);
      successCount++;
    }

    console.log(`\n✅ ${successCount} URLs atualizadas com placeholder`);
  }

  // Verificação final
  const finalCheck = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN document_url LIKE '%r2.dev%' THEN 1 END) as r2_remaining,
      COUNT(CASE WHEN document_url LIKE '/uploads%' THEN 1 END) as local_urls
    FROM driver_documents
  `);

  const stats = finalCheck.rows[0];
  console.log("\n" + "=" .repeat(80));
  console.log("📊 ESTATÍSTICAS FINAIS:");
  console.log(`Total de documentos: ${stats.total}`);
  console.log(`URLs do R2 restantes: ${stats.r2_remaining}`);
  console.log(`URLs locais: ${stats.local_urls}`);

  if (Number(stats.r2_remaining) === 0) {
    console.log("\n✅ Migração concluída com sucesso!");
    console.log("\n📌 PRÓXIMOS PASSOS:");
    console.log("1. Reinicie o servidor: npm run dev");
    console.log("2. Teste a visualização em /motoristas/ativos");
    console.log("3. Se necessário, faça upload manual das imagens em uploads/documents_driver/");
  }

  readline.close();
  process.exit(0);
}

fixR2ToLocal();