import { db } from "./db.js";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function testDocumentsEndpoint() {
  console.log("🔍 TESTE DO ENDPOINT DE DOCUMENTOS");
  console.log("=" .repeat(80));

  try {
    // Buscar um motorista que tenha documentos
    const driversWithDocs = await db.execute(sql`
      SELECT DISTINCT d.id, d.name
      FROM drivers d
      INNER JOIN driver_documents dd ON dd.driver_id = d.id
      WHERE d.active = true AND d.approve = true
      LIMIT 5
    `);

    if (driversWithDocs.rows.length === 0) {
      console.log("❌ Nenhum motorista ativo com documentos encontrado!");
      process.exit(1);
    }

    console.log("\n📋 Motoristas ativos com documentos:");
    for (const driver of driversWithDocs.rows) {
      console.log(`   - ${driver.name} (ID: ${driver.id})`);
    }

    // Pegar o primeiro motorista para teste
    const testDriverId = driversWithDocs.rows[0].id;
    const testDriverName = driversWithDocs.rows[0].name;

    console.log(`\n🧪 Testando com motorista: ${testDriverName} (ID: ${testDriverId})`);

    // Buscar documentos diretamente do banco
    const documents = await db.execute(sql`
      SELECT
        dd.id,
        dd.driver_id,
        dd.document_url,
        dd.status,
        ddt.name as document_type_name
      FROM driver_documents dd
      LEFT JOIN driver_document_types ddt ON dd.document_type_id = ddt.id
      WHERE dd.driver_id = ${testDriverId}
    `);

    console.log(`\n📄 Documentos no banco (${documents.rows.length} encontrados):`);
    for (const doc of documents.rows) {
      console.log(`\n   Tipo: ${doc.document_type_name}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   URL Original: ${doc.document_url}`);

      // Simular a transformação que deveria acontecer
      if (doc.document_url && doc.document_url.includes('r2.dev')) {
        const serverUrl = process.env.SERVER_URL || 'http://192.168.3.3:5010';
        const r2PublicUrl = process.env.R2_PUBLIC_URL;
        const transformedUrl = doc.document_url.replace(r2PublicUrl + '/', serverUrl + '/api/r2-proxy/');
        console.log(`   URL Transformada: ${transformedUrl}`);

        // Testar se a URL transformada funciona
        try {
          const response = await fetch(transformedUrl, { method: 'HEAD' });
          if (response.ok) {
            console.log(`   ✅ Proxy funcionando para este documento`);
          } else {
            console.log(`   ❌ Proxy retornou status ${response.status}`);
          }
        } catch (error) {
          console.log(`   ❌ Erro ao testar proxy: ${error}`);
        }
      }
    }

    // Agora testar o endpoint real
    console.log("\n" + "=" .repeat(80));
    console.log("🌐 Testando endpoint /api/drivers/:id/documents\n");

    const serverUrl = process.env.SERVER_URL || 'http://192.168.3.3:5010';
    const endpointUrl = `${serverUrl}/api/drivers/${testDriverId}/documents`;

    console.log(`URL do endpoint: ${endpointUrl}`);
    console.log("Fazendo requisição...\n");

    // Fazer requisição ao endpoint
    const response = await fetch(endpointUrl, {
      headers: {
        'Cookie': 'connect.sid=s%3A...' // Você precisaria de uma sessão válida aqui
      }
    });

    if (response.status === 401) {
      console.log("⚠️  Endpoint requer autenticação (esperado)");
      console.log("Para testar completamente, você precisa:");
      console.log("1. Fazer login na aplicação");
      console.log("2. Copiar o cookie de sessão do navegador");
      console.log("3. Usar o cookie neste teste");
    } else if (response.ok) {
      const data = await response.json();
      console.log("✅ Resposta do endpoint:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ Erro: Status ${response.status}`);
      const error = await response.text();
      console.log(`Mensagem: ${error}`);
    }

    console.log("\n" + "=" .repeat(80));
    console.log("\n🔍 PRÓXIMOS PASSOS DE DEBUG:\n");
    console.log("1. Abra o navegador em: http://192.168.3.3:5173/motoristas/ativos");
    console.log("2. Abra o Console do navegador (F12)");
    console.log("3. Clique no ícone de visualizar de um motorista");
    console.log("4. Na aba Network, procure por requisições para:");
    console.log("   - /api/drivers/{id}/documents");
    console.log("   - /api/r2-proxy/...");
    console.log("5. Verifique se há erros no console");
    console.log("\n6. Execute este comando para ver os logs do servidor:");
    console.log("   npm run dev");
    console.log("\n7. Compartilhe:");
    console.log("   - Erros do console do navegador");
    console.log("   - Status das requisições na aba Network");
    console.log("   - Logs do servidor");

  } catch (error) {
    console.error("❌ Erro:", error);
  }

  process.exit(0);
}

testDocumentsEndpoint();