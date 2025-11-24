import dotenv from "dotenv";
dotenv.config();

async function testR2Proxy() {
  console.log("🔍 TESTE DO PROXY R2");
  console.log("=" .repeat(80));

  const serverUrl = process.env.SERVER_URL || "http://localhost:5010";
  const r2PublicUrl = process.env.R2_PUBLIC_URL;

  console.log(`\n📍 Configuração:`);
  console.log(`   SERVER_URL: ${serverUrl}`);
  console.log(`   R2_PUBLIC_URL: ${r2PublicUrl}`);

  // URLs de teste - imagens que sabemos que existem no R2
  const testImages = [
    "documentos_entregadores/04e43fb6-d16d-454a-812e-fae52f5b9f77.jpg",
    "documentos_entregadores/52d76ced-7fbb-4fc4-8f3f-5cf5766dfab2.jpg"
  ];

  console.log("\n🧪 Testando conversão de URLs:\n");

  for (const imagePath of testImages) {
    console.log(`📸 Imagem: ${imagePath}`);

    // URL original do R2
    const originalUrl = `${r2PublicUrl}/${imagePath}`;
    console.log(`   Original R2: ${originalUrl}`);

    // URL via proxy
    const proxyUrl = `${serverUrl}/api/r2-proxy/${imagePath}`;
    console.log(`   Via Proxy:   ${proxyUrl}`);

    // Testar acesso via proxy
    console.log(`   Testando acesso...`);

    try {
      const response = await fetch(proxyUrl);

      if (response.ok) {
        console.log(`   ✅ Status: ${response.status}`);
        console.log(`   ✅ Content-Type: ${response.headers.get('content-type')}`);
        console.log(`   ✅ Content-Length: ${response.headers.get('content-length')} bytes`);
        console.log(`   ✅ Cache-Control: ${response.headers.get('cache-control')}`);
      } else {
        console.log(`   ❌ Erro: Status ${response.status} - ${response.statusText}`);
        const error = await response.text();
        if (error) {
          console.log(`   ❌ Mensagem: ${error}`);
        }
      }
    } catch (error: any) {
      console.log(`   ❌ Erro de conexão: ${error.message}`);
      console.log(`   💡 Certifique-se de que o servidor está rodando em ${serverUrl}`);
    }

    console.log("");
  }

  console.log("=" .repeat(80));
  console.log("\n📊 RESULTADO DO TESTE:\n");

  console.log("Se os testes falharam:");
  console.log("1. Verifique se o servidor está rodando: npm run dev");
  console.log("2. Confirme que SERVER_URL está correto no .env");
  console.log("3. Verifique as credenciais do R2 no .env");

  console.log("\nSe os testes passaram:");
  console.log("✅ O proxy está funcionando!");
  console.log("✅ As imagens devem aparecer em /motoristas/ativos");
  console.log("✅ As URLs antigas do R2 serão convertidas automaticamente");

  console.log("\n🔧 Como funciona o proxy:");
  console.log("1. Frontend solicita: /api/drivers/:id/documents");
  console.log("2. Backend converte URLs do R2 para URLs do proxy");
  console.log("3. Frontend recebe: http://seu-servidor/api/r2-proxy/caminho/arquivo.jpg");
  console.log("4. Proxy busca o arquivo do R2 via API e retorna ao frontend");
}

testR2Proxy();