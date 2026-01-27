import "dotenv/config";

const testEmail = process.argv[2] || "damaceno02@hotmail.com";

console.log("🧪 Testando rota de recuperação de senha\n");
console.log(`📧 Email: ${testEmail}\n`);

async function testForgotPassword() {
  try {
    const response = await fetch("http://192.168.1.2:5030/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: testEmail }),
    });

    const data = await response.json();

    console.log("📊 Status:", response.status);
    console.log("📋 Resposta:", JSON.stringify(data, null, 2));
    console.log("\n✅ Teste concluído!");
    console.log("\n💡 Verifique os logs do servidor para ver os detalhes do processamento");
  } catch (error: any) {
    console.error("❌ Erro:", error.message);
  }
}

testForgotPassword();
