import { S3Client, ListBucketsCommand, ListObjectsV2Command, HeadBucketCommand } from "@aws-sdk/client-s3";
import https from "https";
import dotenv from "dotenv";

dotenv.config();

async function testR2Connection() {
  console.log("🔍 DIAGNÓSTICO DE CONEXÃO COM CLOUDFLARE R2");
  console.log("=" .repeat(80));

  // Verificar variáveis de ambiente
  console.log("\n📋 Variáveis de Ambiente:");
  console.log(`R2_ACCOUNT_ID: ${process.env.R2_ACCOUNT_ID ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`R2_ACCESS_KEY_ID: ${process.env.R2_ACCESS_KEY_ID ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`R2_SECRET_ACCESS_KEY: ${process.env.R2_SECRET_ACCESS_KEY ? '✅ Configurado' : '❌ Não configurado'}`);
  console.log(`R2_BUCKET_NAME: ${process.env.R2_BUCKET_NAME || 'Não configurado (usando padrão: fretus)'}`);
  console.log(`R2_PUBLIC_URL: ${process.env.R2_PUBLIC_URL || '❌ Não configurado'}`);

  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.log("\n❌ Configuração incompleta! Configure todas as variáveis R2_* no arquivo .env");
    process.exit(1);
  }

  const bucketName = process.env.R2_BUCKET_NAME || "fretus";
  const publicUrl = process.env.R2_PUBLIC_URL;

  // Criar cliente R2
  console.log("\n🔧 Criando cliente R2...");
  const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    requestHandler: {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
      }),
    },
    forcePathStyle: true,
  });

  try {
    // Teste 1: Listar buckets
    console.log("\n📦 Teste 1: Listando buckets...");
    try {
      const bucketsCommand = new ListBucketsCommand({});
      const bucketsResult = await r2Client.send(bucketsCommand);
      console.log(`✅ Buckets encontrados: ${bucketsResult.Buckets?.length || 0}`);
      bucketsResult.Buckets?.forEach(bucket => {
        console.log(`   - ${bucket.Name} ${bucket.Name === bucketName ? '← Bucket configurado' : ''}`);
      });
    } catch (error: any) {
      console.log(`❌ Erro ao listar buckets: ${error.message}`);
      console.log("   Possível problema: Credenciais inválidas ou sem permissão");
    }

    // Teste 2: Verificar se o bucket existe
    console.log(`\n📦 Teste 2: Verificando bucket '${bucketName}'...`);
    try {
      const headCommand = new HeadBucketCommand({ Bucket: bucketName });
      await r2Client.send(headCommand);
      console.log(`✅ Bucket '${bucketName}' existe e está acessível`);
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode === 404) {
        console.log(`❌ Bucket '${bucketName}' não existe`);
        console.log("   Solução: Crie o bucket no painel do Cloudflare R2");
      } else if (error.$metadata?.httpStatusCode === 403) {
        console.log(`❌ Sem permissão para acessar o bucket '${bucketName}'`);
        console.log("   Solução: Verifique as permissões da API key");
      } else {
        console.log(`❌ Erro ao verificar bucket: ${error.message}`);
      }
    }

    // Teste 3: Listar objetos no bucket
    console.log(`\n📁 Teste 3: Listando arquivos no bucket '${bucketName}'...`);
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: "documentos_entregadores/",
        MaxKeys: 5
      });
      const listResult = await r2Client.send(listCommand);

      if (listResult.Contents && listResult.Contents.length > 0) {
        console.log(`✅ Encontrados ${listResult.KeyCount} arquivos (mostrando até 5):`);
        listResult.Contents.forEach(obj => {
          console.log(`   - ${obj.Key} (${(obj.Size || 0) / 1024}KB)`);
        });
      } else {
        console.log("⚠️  Nenhum arquivo encontrado na pasta documentos_entregadores/");
      }
    } catch (error: any) {
      console.log(`❌ Erro ao listar objetos: ${error.message}`);
    }

    // Teste 4: Verificar URL pública
    console.log("\n🌐 Teste 4: Verificando URL pública...");
    if (!publicUrl) {
      console.log("❌ R2_PUBLIC_URL não configurada!");
      console.log("   Configure com o domínio público do seu bucket R2");
    } else {
      console.log(`URL configurada: ${publicUrl}`);

      // Testar acesso público a uma imagem de exemplo
      const testUrl = `${publicUrl}/documentos_entregadores/04e43fb6-d16d-454a-812e-fae52f5b9f77.jpg`;
      console.log(`Testando acesso a: ${testUrl}`);

      try {
        const response = await fetch(testUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log("✅ URL pública está funcionando");
          console.log(`   Status: ${response.status}`);
          console.log(`   Content-Type: ${response.headers.get('content-type')}`);
        } else {
          console.log(`❌ Erro ao acessar URL: Status ${response.status}`);
          if (response.status === 404) {
            console.log("   Arquivo não existe ou bucket não está público");
          } else if (response.status === 403) {
            console.log("   Bucket não está configurado para acesso público");
          }
        }
      } catch (error: any) {
        console.log(`❌ Erro ao testar URL pública: ${error.message}`);
      }
    }

    // Diagnóstico final
    console.log("\n" + "=" .repeat(80));
    console.log("📊 DIAGNÓSTICO FINAL:\n");

    console.log("🔧 POSSÍVEIS PROBLEMAS E SOLUÇÕES:\n");

    console.log("1. Se o bucket não está público:");
    console.log("   - Acesse: https://dash.cloudflare.com");
    console.log("   - Vá para R2 > Seu Bucket > Settings");
    console.log("   - Em 'Public Access', configure:");
    console.log("     • Custom Domain: seu-dominio.r2.dev");
    console.log("     • Ou habilite 'R2.dev subdomain'");
    console.log("   - Configure CORS Rules:");
    console.log(`     [{
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }]`);

    console.log("\n2. Se as credenciais estão incorretas:");
    console.log("   - Gere novas API keys em: R2 > Manage R2 API Tokens");
    console.log("   - Permissões necessárias: Admin Read & Write");
    console.log("   - Atualize no .env:");
    console.log("     • R2_ACCESS_KEY_ID");
    console.log("     • R2_SECRET_ACCESS_KEY");

    console.log("\n3. Se o domínio público mudou:");
    console.log("   - Verifique o domínio atual no painel do R2");
    console.log("   - Atualize R2_PUBLIC_URL no .env");
    console.log("   - Pode ser algo como:");
    console.log("     • https://pub-xxxxx.r2.dev");
    console.log("     • https://seu-dominio-customizado.com");

  } catch (error: any) {
    console.error("\n❌ Erro geral:", error.message);
  }
}

testR2Connection();