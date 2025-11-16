import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import https from "https";

// Carregar variáveis de ambiente
dotenv.config();

async function testR2NoSSL() {
  console.log("🧪 Testando conexão com Cloudflare R2 (sem verificação SSL)...\n");

  // Verificar variáveis de ambiente
  console.log("📋 Configurações:");
  console.log(`  Account ID: ${process.env.R2_ACCOUNT_ID}`);
  console.log(`  Access Key: ${process.env.R2_ACCESS_KEY_ID?.substring(0, 8)}...`);
  console.log(`  Bucket: ${process.env.R2_BUCKET_NAME || "fretus"}`);
  console.log(`  Endpoint: https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com\n`);

  // Cliente R2 SEM verificação SSL (apenas para teste)
  const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
    requestHandler: {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // ⚠️ DESABILITA verificação SSL
        keepAlive: true,
      }),
    },
    forcePathStyle: true,
  });

  try {
    console.log("📤 Tentando fazer upload de teste...");

    const testContent = Buffer.from("Este é um teste sem verificação SSL");
    const fileName = `documentos_entregadores/teste-${uuidv4()}.txt`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || "fretus",
      Key: fileName,
      Body: testContent,
      ContentType: "text/plain",
    });

    await r2Client.send(command);

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;
    console.log(`  ✅ Upload bem-sucedido!`);
    console.log(`  📍 URL: ${publicUrl}\n`);

    // Tentar deletar
    console.log("🗑️  Tentando deletar arquivo de teste...");
    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || "fretus",
      Key: fileName,
    });

    await r2Client.send(deleteCommand);
    console.log(`  ✅ Arquivo deletado com sucesso!\n`);

    console.log("✅ SUCESSO! O problema é a verificação SSL.");
    console.log("\n🔍 Diagnóstico:");
    console.log("  - As credenciais estão CORRETAS");
    console.log("  - O bucket existe e está acessível");
    console.log("  - O problema é SSL/TLS handshake");
    console.log("\n💡 Possíveis soluções:");
    console.log("  1. Atualizar certificados do Windows");
    console.log("  2. Verificar antivírus/firewall");
    console.log("  3. Verificar proxy corporativo");
    console.log("  4. Usar NODE_TLS_REJECT_UNAUTHORIZED=0 (não recomendado em produção)");

  } catch (error: any) {
    console.error("\n❌ Erro mesmo sem verificação SSL:");
    console.error(`  Mensagem: ${error.message}`);
    console.error(`  Código: ${error.Code || error.code}`);

    if (error.$metadata) {
      console.error(`  HTTP Status: ${error.$metadata.httpStatusCode}`);
      console.error(`  Tentativas: ${error.$metadata.attempts}`);
    }

    console.log("\n🔍 Possíveis causas:");
    console.log("  1. Credenciais incorretas");
    console.log("  2. Bucket 'fretus' não existe");
    console.log("  3. Permissões insuficientes no token");
    console.log("  4. Account ID incorreto");
  }
}

// Executar teste
testR2NoSSL();
