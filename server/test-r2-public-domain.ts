import dotenv from "dotenv";
import dns from "dns/promises";
import https from "https";

dotenv.config();

async function testR2PublicDomain() {
  console.log("🔍 DIAGNÓSTICO DO DOMÍNIO PÚBLICO DO R2");
  console.log("=" .repeat(80));

  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME || "fretus";

  console.log("\n📋 Configuração atual:");
  console.log(`R2_PUBLIC_URL: ${r2PublicUrl}`);
  console.log(`R2_ACCOUNT_ID: ${accountId}`);
  console.log(`R2_BUCKET_NAME: ${bucketName}`);

  // Possíveis formatos de URL do R2
  const possibleUrls = [
    `https://pub-6ba0d61f74d5418bbe35b6a595078a72.r2.dev`, // URL atual no .env
    `https://${bucketName}.${accountId}.r2.cloudflarestorage.com`, // Formato padrão
    `https://${accountId}.r2.cloudflarestorage.com/${bucketName}`, // Formato alternativo
  ];

  console.log("\n🌐 Testando possíveis URLs do R2:\n");

  for (const url of possibleUrls) {
    console.log(`Testando: ${url}`);

    try {
      // Verificar DNS
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      try {
        const addresses = await dns.resolve4(hostname);
        console.log(`  ✅ DNS resolvido: ${addresses.join(", ")}`);
      } catch (dnsError) {
        console.log(`  ❌ DNS não resolve: ${dnsError.message}`);
        continue;
      }

      // Testar conexão HTTPS
      await new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
          console.log(`  📡 Status HTTP: ${res.statusCode}`);
          console.log(`  📡 Headers: ${JSON.stringify(res.headers['server'])}`);

          if (res.statusCode === 404) {
            console.log(`  ⚠️  Bucket não encontrado ou não público`);
          } else if (res.statusCode === 403) {
            console.log(`  ⚠️  Acesso negado - bucket privado`);
          } else if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`  ✅ URL acessível!`);
          }

          res.destroy();
          resolve(null);
        });

        req.on('error', (error) => {
          if (error.message.includes('SSL')) {
            console.log(`  ❌ Erro SSL/TLS: ${error.message}`);
          } else {
            console.log(`  ❌ Erro de conexão: ${error.message}`);
          }
          resolve(null);
        });

        req.setTimeout(5000, () => {
          console.log(`  ❌ Timeout na conexão`);
          req.destroy();
          resolve(null);
        });
      });

    } catch (error: any) {
      console.log(`  ❌ Erro: ${error.message}`);
    }

    console.log("");
  }

  console.log("=" .repeat(80));
  console.log("\n🔧 INSTRUÇÕES PARA CORRIGIR:\n");

  console.log("1. ACESSE O PAINEL DO CLOUDFLARE:");
  console.log("   https://dash.cloudflare.com");
  console.log("   → R2 → Overview → Clique no bucket 'fretus'");

  console.log("\n2. VERIFIQUE AS CONFIGURAÇÕES DO BUCKET:");
  console.log("   → Settings → Public Access");
  console.log("   • Opção 1: Habilite 'R2.dev subdomain'");
  console.log("   • Opção 2: Configure um 'Custom Domain'");

  console.log("\n3. SE USAR R2.DEV SUBDOMAIN:");
  console.log("   → Copie a URL pública gerada");
  console.log("   → Deve ser algo como: https://pub-xxxxx.r2.dev");
  console.log("   → Atualize R2_PUBLIC_URL no .env com essa URL");

  console.log("\n4. SE USAR CUSTOM DOMAIN:");
  console.log("   → Configure um domínio seu (ex: cdn.seusite.com)");
  console.log("   → Aguarde propagação DNS (até 48h)");
  console.log("   → Atualize R2_PUBLIC_URL no .env");

  console.log("\n5. CONFIGURE CORS NO BUCKET:");
  console.log("   → Settings → CORS");
  console.log("   → Adicione esta configuração:");
  console.log(`
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
  `);

  console.log("\n6. VERIFIQUE O NOME DO BUCKET:");
  console.log(`   → Confirme que o nome é: '${bucketName}'`);
  console.log("   → Se for diferente, atualize R2_BUCKET_NAME no .env");

  console.log("\n📝 NOTA IMPORTANTE:");
  console.log("O domínio pub-6ba0d61f74d5418bbe35b6a595078a72.r2.dev");
  console.log("pode ter EXPIRADO ou sido DESABILITADO.");
  console.log("Você precisa gerar um NOVO domínio público no painel do R2.");
}

testR2PublicDomain();