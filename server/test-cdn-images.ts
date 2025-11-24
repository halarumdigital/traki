import { db } from "./db.js";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function testCdnImages() {
  console.log("🔍 TESTE DE IMAGENS COM CDN");
  console.log("=" .repeat(80));

  console.log("\n📋 Configuração:");
  console.log(`R2_PUBLIC_URL: ${process.env.R2_PUBLIC_URL}`);

  try {
    // Buscar alguns documentos para teste
    const documents = await db.execute(sql`
      SELECT
        dd.id,
        dd.document_url,
        ddt.name as document_type,
        d.name as driver_name
      FROM driver_documents dd
      LEFT JOIN driver_document_types ddt ON dd.document_type_id = ddt.id
      LEFT JOIN drivers d ON dd.driver_id = d.id
      WHERE dd.document_url IS NOT NULL
      LIMIT 5
    `);

    console.log(`\n📄 Testando ${documents.rows.length} documentos:\n`);

    for (const doc of documents.rows) {
      console.log(`👤 ${doc.driver_name} - ${doc.document_type}`);
      console.log(`   URL no banco: ${doc.document_url}`);

      // Simular a transformação que acontece no endpoint
      let testUrl = doc.document_url as string;
      if (testUrl.includes('pub-6ba0d61f74d5418bbe35b6a595078a72.r2.dev')) {
        testUrl = testUrl.replace(
          'https://pub-6ba0d61f74d5418bbe35b6a595078a72.r2.dev',
          'https://cdn.fretus.com.br'
        );
        console.log(`   URL transformada: ${testUrl}`);
      }

      // Testar acesso
      try {
        const response = await fetch(testUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log(`   ✅ Imagem acessível! Status: ${response.status}`);
        } else {
          console.log(`   ❌ Erro: Status ${response.status}`);
        }
      } catch (error: any) {
        console.log(`   ❌ Erro de acesso: ${error.message}`);
      }

      console.log("");
    }

    // Verificar quantos documentos existem de cada tipo
    const stats = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN document_url LIKE '%cdn.fretus.com.br%' THEN 1 END) as cdn_urls,
        COUNT(CASE WHEN document_url LIKE '%pub-6ba0d61f74d5418bbe35b6a595078a72.r2.dev%' THEN 1 END) as old_r2_urls
      FROM driver_documents
    `);

    const s = stats.rows[0];
    console.log("=" .repeat(80));
    console.log("\n📊 ESTATÍSTICAS:");
    console.log(`Total de documentos: ${s.total}`);
    console.log(`URLs com CDN (cdn.fretus.com.br): ${s.cdn_urls}`);
    console.log(`URLs com R2 antigo: ${s.old_r2_urls}`);

    if (Number(s.old_r2_urls) > 0) {
      console.log("\n⚠️  Ainda existem URLs com o domínio antigo no banco.");
      console.log("Elas serão convertidas automaticamente pelo endpoint.");
    }

  } catch (error) {
    console.error("❌ Erro:", error);
  }

  console.log("\n🚀 PRÓXIMOS PASSOS:");
  console.log("1. Reinicie o servidor: npm run dev");
  console.log("2. Acesse /motoristas/ativos");
  console.log("3. Abra o console do navegador (F12)");
  console.log("4. Clique para visualizar um motorista");
  console.log("5. Verifique na aba Network as URLs das imagens");

  process.exit(0);
}

testCdnImages();