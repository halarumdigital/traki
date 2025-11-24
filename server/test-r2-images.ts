import dotenv from "dotenv";
dotenv.config();

async function testR2Images() {
  console.log("🔍 Testando acesso às imagens no Cloudflare R2\n");
  console.log("=" .repeat(80));

  // URLs de exemplo do R2 (baseadas no output anterior)
  const testUrls = [
    "https://pub-6ba0d61f74d5418bbe35b6a595078a72.r2.dev/documentos_entregadores/04e43fb6-d16d-454a-812e-fae52f5b9f77.jpg",
    "https://pub-6ba0d61f74d5418bbe35b6a595078a72.r2.dev/documentos_entregadores/fa0c3c22-00ae-42e5-ad9a-26730a0296e1.jpg"
  ];

  for (const url of testUrls) {
    console.log(`\n📸 Testando: ${url}`);
    console.log("-" .repeat(40));

    try {
      // Fazer requisição HEAD para verificar se o recurso existe
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors'
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${response.headers.get('content-type')}`);
      console.log(`   Content-Length: ${response.headers.get('content-length')} bytes`);
      console.log(`   Access-Control-Allow-Origin: ${response.headers.get('access-control-allow-origin') || 'NÃO CONFIGURADO'}`);
      console.log(`   Cache-Control: ${response.headers.get('cache-control')}`);

      if (response.status === 200) {
        console.log(`   ✅ Imagem acessível`);
      } else if (response.status === 403) {
        console.log(`   ❌ Acesso negado - Bucket privado ou URL expirada`);
      } else if (response.status === 404) {
        console.log(`   ❌ Imagem não encontrada`);
      }

      // Verificar CORS
      const corsHeader = response.headers.get('access-control-allow-origin');
      if (!corsHeader) {
        console.log(`   ⚠️  AVISO: Sem header CORS - pode causar problemas no navegador`);
      } else if (corsHeader === '*') {
        console.log(`   ✅ CORS configurado para permitir qualquer origem`);
      } else {
        console.log(`   ℹ️  CORS permite origem: ${corsHeader}`);
      }

    } catch (error: any) {
      console.log(`   ❌ Erro ao acessar: ${error.message}`);

      if (error.message.includes('CORS')) {
        console.log(`   💡 Problema de CORS detectado`);
      } else if (error.message.includes('network')) {
        console.log(`   💡 Problema de rede ou URL inacessível`);
      }
    }
  }

  console.log("\n" + "=" .repeat(80));
  console.log("\n📊 DIAGNÓSTICO DO CLOUDFLARE R2:\n");

  console.log("Configurações no .env:");
  console.log(`   R2_BUCKET_NAME: ${process.env.R2_BUCKET_NAME || 'NÃO CONFIGURADO'}`);
  console.log(`   R2_PUBLIC_URL: ${process.env.R2_PUBLIC_URL || 'NÃO CONFIGURADO'}`);
  console.log(`   R2_ACCOUNT_ID: ${process.env.R2_ACCOUNT_ID ? '***' + process.env.R2_ACCOUNT_ID.slice(-4) : 'NÃO CONFIGURADO'}`);

  console.log("\n🔧 POSSÍVEIS SOLUÇÕES:\n");

  console.log("1. CORS no Cloudflare R2:");
  console.log("   - Acesse o painel do Cloudflare");
  console.log("   - Vá para R2 > seu bucket > Settings");
  console.log("   - Configure CORS Rules para permitir seu domínio:");
  console.log("   ```json");
  console.log("   [{");
  console.log('     "AllowedOrigins": ["http://192.168.3.3:5173", "http://192.168.3.3:5010"],');
  console.log('     "AllowedMethods": ["GET", "HEAD"],');
  console.log('     "AllowedHeaders": ["*"],');
  console.log('     "MaxAgeSeconds": 3600');
  console.log("   }]");
  console.log("   ```");

  console.log("\n2. Tornar o Bucket Público:");
  console.log("   - No painel do R2, vá para Settings");
  console.log("   - Ative 'Public access' ou 'Custom Domain'");
  console.log("   - Configure um domínio customizado se necessário");

  console.log("\n3. Usar Proxy no Backend:");
  console.log("   - Criar endpoint no Express para servir as imagens");
  console.log("   - Ex: GET /api/images/proxy?url=...");
  console.log("   - O backend busca a imagem do R2 e retorna ao frontend");

  console.log("\n4. URLs Assinadas:");
  console.log("   - Gerar URLs temporárias com assinatura");
  console.log("   - Mais seguro mas requer renovação periódica");

  console.log("\n" + "=" .repeat(80));
}

testR2Images();