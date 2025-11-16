import fetch from "node-fetch";

const driverToken = "eyJpZCI6ImZkNDYyOGYyLTRjMTEtNDA0MS1iMzVmLTExZjU0MmZmM2QyMCIsInR5cGUiOiJkcml2ZXIiLCJ0aW1lc3RhbXAiOjE3NjMwNDM4NTY5Njd9";

async function testDriverNotifications() {
  try {
    console.log("🔔 Testando endpoint de notificações do motorista...");

    const response = await fetch("http://localhost:5010/api/v1/driver/notifications", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${driverToken}`,
        "Content-Type": "application/json"
      }
    });

    console.log("Status:", response.status);

    const data = await response.json();
    console.log("Resposta:", JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`✅ Sucesso! ${data.count} notificações retornadas`);
      if (data.data && data.data.length > 0) {
        console.log("\n📬 Notificações:");
        data.data.forEach((notif, index) => {
          console.log(`\n${index + 1}. ${notif.title}`);
          console.log(`   ${notif.body}`);
          console.log(`   Data: ${new Date(notif.date).toLocaleString('pt-BR')}`);
        });
      }
    } else {
      console.error("❌ Erro:", data.message);
    }

  } catch (error) {
    console.error("❌ Erro na requisição:", error.message);
  }
}

testDriverNotifications();