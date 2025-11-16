import { uploadToR2, deleteFromR2 } from "./r2-storage";
import dotenv from "dotenv";

// Carregar variáveis de ambiente
dotenv.config();

async function testR2() {
  console.log("🧪 Testando conexão com Cloudflare R2...\n");

  // Verificar variáveis de ambiente
  console.log("📋 Verificando variáveis de ambiente:");
  console.log(`  ✓ R2_ACCOUNT_ID: ${process.env.R2_ACCOUNT_ID ? "✅ Configurado" : "❌ Não configurado"}`);
  console.log(`  ✓ R2_ACCESS_KEY_ID: ${process.env.R2_ACCESS_KEY_ID ? "✅ Configurado" : "❌ Não configurado"}`);
  console.log(`  ✓ R2_SECRET_ACCESS_KEY: ${process.env.R2_SECRET_ACCESS_KEY ? "✅ Configurado" : "❌ Não configurado"}`);
  console.log(`  ✓ R2_BUCKET_NAME: ${process.env.R2_BUCKET_NAME || "fretus"}`);
  console.log(`  ✓ R2_PUBLIC_URL: ${process.env.R2_PUBLIC_URL || "❌ Não configurado"}\n`);

  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.error("❌ Erro: Variáveis de ambiente não configuradas!");
    process.exit(1);
  }

  try {
    // Teste 1: Upload de arquivo de teste para documentos_entregadores
    console.log("📤 Teste 1: Upload para documentos_entregadores...");
    const testContent1 = Buffer.from("Este é um arquivo de teste para documentos de entregadores");
    const uploadedUrl1 = await uploadToR2(testContent1, "documentos_entregadores", "teste.txt");
    console.log(`  ✅ Upload bem-sucedido!`);
    console.log(`  📍 URL: ${uploadedUrl1}\n`);

    // Teste 2: Upload de arquivo de teste para imagens_tickets
    console.log("📤 Teste 2: Upload para imagens_tickets...");
    const testContent2 = Buffer.from("Este é um arquivo de teste para imagens de tickets");
    const uploadedUrl2 = await uploadToR2(testContent2, "imagens_tickets", "teste.txt");
    console.log(`  ✅ Upload bem-sucedido!`);
    console.log(`  📍 URL: ${uploadedUrl2}\n`);

    // Teste 3: Deletar arquivos de teste
    console.log("🗑️  Teste 3: Deletando arquivos de teste...");
    await deleteFromR2(uploadedUrl1);
    console.log(`  ✅ Arquivo 1 deletado com sucesso!`);

    await deleteFromR2(uploadedUrl2);
    console.log(`  ✅ Arquivo 2 deletado com sucesso!\n`);

    console.log("✅ Todos os testes passaram! O Cloudflare R2 está configurado corretamente! 🎉");
    console.log("\n📝 Próximos passos:");
    console.log("  1. Os endpoints de upload estão prontos para uso");
    console.log("  2. Use POST /api/r2/upload/driver-document para documentos");
    console.log("  3. Use POST /api/r2/upload/ticket-image para imagens de tickets");

  } catch (error: any) {
    console.error("\n❌ Erro durante os testes:");
    console.error(`  Mensagem: ${error.message}`);
    console.error(`  Detalhes:`, error);

    console.log("\n🔍 Possíveis causas:");
    console.log("  1. Credenciais R2 incorretas");
    console.log("  2. Bucket 'fretus' não existe");
    console.log("  3. Permissões insuficientes no token");
    console.log("  4. Endpoint incorreto");

    process.exit(1);
  }
}

// Executar testes
testR2();
