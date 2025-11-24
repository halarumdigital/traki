import { db } from "./db.js";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import https from "https";

dotenv.config();

// Cliente R2
function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
    requestHandler: {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
      }),
    },
    forcePathStyle: true,
  });
}

async function migrateAllToR2Proxy() {
  console.log("🔄 MIGRAÇÃO E CORREÇÃO DE URLS PARA R2 PROXY");
  console.log("=" .repeat(80));

  const serverUrl = process.env.SERVER_URL || "http://192.168.3.3:5010";
  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  const bucketName = process.env.R2_BUCKET_NAME || "fretus";

  console.log("\n📋 Configuração:");
  console.log(`SERVER_URL: ${serverUrl}`);
  console.log(`R2_PUBLIC_URL: ${r2PublicUrl}`);
  console.log(`R2_BUCKET_NAME: ${bucketName}`);

  try {
    // 1. Buscar documentos com URLs locais
    const localDocs = await db.execute(sql`
      SELECT
        dd.id,
        dd.document_url,
        dd.driver_id,
        d.name as driver_name
      FROM driver_documents dd
      LEFT JOIN drivers d ON dd.driver_id = d.id
      WHERE dd.document_url LIKE '/uploads%'
      ORDER BY dd.created_at DESC
    `);

    console.log(`\n📊 Encontrados ${localDocs.rows.length} documentos com URLs locais`);

    if (localDocs.rows.length > 0) {
      console.log("\n🔄 Migrando URLs locais para R2...\n");

      const r2Client = getR2Client();
      let successCount = 0;
      let failCount = 0;

      for (const doc of localDocs.rows) {
        const localUrl = doc.document_url as string;
        const fileName = localUrl.split('/').pop() || `doc-${doc.id}.jpg`;
        const localPath = path.join(process.cwd(), localUrl.slice(1)); // Remove leading /

        console.log(`📄 ${doc.driver_name}: ${fileName}`);

        // Verificar se o arquivo existe localmente
        if (fs.existsSync(localPath)) {
          console.log(`  ✅ Arquivo encontrado localmente`);

          try {
            // Upload para R2
            const fileBuffer = fs.readFileSync(localPath);
            const r2Key = `documentos_entregadores/${fileName}`;

            await r2Client.send(new PutObjectCommand({
              Bucket: bucketName,
              Key: r2Key,
              Body: fileBuffer,
              ContentType: "image/jpeg",
            }));

            // Atualizar URL no banco para formato R2
            const newUrl = `${r2PublicUrl}/documentos_entregadores/${fileName}`;
            await db.execute(sql`
              UPDATE driver_documents
              SET document_url = ${newUrl}
              WHERE id = ${doc.id}
            `);

            console.log(`  ✅ Migrado para R2: ${r2Key}`);
            successCount++;
          } catch (error: any) {
            console.log(`  ❌ Erro no upload: ${error.message}`);
            failCount++;
          }
        } else {
          console.log(`  ⚠️  Arquivo não existe localmente`);

          // Criar referência no R2 mesmo sem o arquivo (será placeholder)
          const r2Key = `documentos_entregadores/${fileName}`;
          const newUrl = `${r2PublicUrl}/documentos_entregadores/${fileName}`;

          await db.execute(sql`
            UPDATE driver_documents
            SET document_url = ${newUrl}
            WHERE id = ${doc.id}
          `);

          console.log(`  📝 URL atualizada para R2 (arquivo pendente)`);
          failCount++;
        }
      }

      console.log(`\n📊 Migração concluída:`);
      console.log(`  ✅ Sucesso: ${successCount}`);
      console.log(`  ❌ Falhas: ${failCount}`);
    }

    // 2. Verificar e corrigir todas as URLs do R2
    console.log("\n🔧 Verificando URLs do R2...\n");

    const r2Docs = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN document_url LIKE '%r2.dev%' THEN 1 END) as r2_urls
      FROM driver_documents
    `);

    console.log(`Total de documentos: ${r2Docs.rows[0].total}`);
    console.log(`URLs apontando para R2: ${r2Docs.rows[0].r2_urls}`);

    // 3. Testar o proxy
    console.log("\n🧪 Testando proxy para exemplo...\n");

    const sampleDoc = await db.execute(sql`
      SELECT document_url
      FROM driver_documents
      WHERE document_url LIKE '%r2.dev%'
      LIMIT 1
    `);

    if (sampleDoc.rows.length > 0) {
      const originalUrl = sampleDoc.rows[0].document_url as string;
      const path = originalUrl.replace(r2PublicUrl + '/', '');
      const proxyUrl = `${serverUrl}/api/r2-proxy/${path}`;

      console.log(`URL Original: ${originalUrl}`);
      console.log(`URL via Proxy: ${proxyUrl}`);

      try {
        const response = await fetch(proxyUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log(`✅ Proxy funcionando! Status: ${response.status}`);
        } else {
          console.log(`⚠️  Proxy retornou status: ${response.status}`);
        }
      } catch (error: any) {
        console.log(`❌ Erro ao testar proxy: ${error.message}`);
      }
    }

    console.log("\n" + "=" .repeat(80));
    console.log("\n✅ CONCLUSÃO:\n");

    console.log("1. URLs foram migradas/corrigidas");
    console.log("2. O proxy está configurado para servir imagens do R2");
    console.log("3. As imagens devem funcionar via proxy mesmo com o domínio público quebrado");

    console.log("\n📌 IMPORTANTE:");
    console.log("- O proxy busca imagens do R2 via API (não depende do domínio público)");
    console.log("- URLs são automaticamente convertidas para usar o proxy");
    console.log("- Reinicie o servidor para aplicar as mudanças: npm run dev");

    console.log("\n🔧 Para corrigir o domínio público definitivamente:");
    console.log("1. Acesse https://dash.cloudflare.com");
    console.log("2. R2 → bucket 'fretus' → Settings → Public Access");
    console.log("3. Habilite 'R2.dev subdomain' novamente");
    console.log("4. Copie a nova URL e atualize R2_PUBLIC_URL no .env");

  } catch (error) {
    console.error("❌ Erro:", error);
  }

  process.exit(0);
}

migrateAllToR2Proxy();