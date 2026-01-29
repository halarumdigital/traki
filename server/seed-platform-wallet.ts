import "dotenv/config";
import { db, pool } from "./db";
import { wallets } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// ID fixo da plataforma - usado em todo o sistema
export const PLATFORM_WALLET_OWNER_ID = "00000000-0000-0000-0000-000000000001";

async function seedPlatformWallet() {
  try {
    console.log("🏦 Criando wallet da plataforma...");

    // Verificar se já existe
    const existingWallet = await db
      .select()
      .from(wallets)
      .where(
        and(
          eq(wallets.ownerId, PLATFORM_WALLET_OWNER_ID),
          eq(wallets.ownerType, "platform")
        )
      )
      .limit(1);

    if (existingWallet.length > 0) {
      console.log("⚠️  Wallet da plataforma já existe!");
      console.log("📍 ID:", existingWallet[0].id);
      console.log("💰 Saldo disponível: R$", existingWallet[0].availableBalance);
      return existingWallet[0];
    }

    // Criar wallet da plataforma
    const [platformWallet] = await db
      .insert(wallets)
      .values({
        ownerId: PLATFORM_WALLET_OWNER_ID,
        ownerType: "platform",
        availableBalance: "0.00",
        blockedBalance: "0.00",
        status: "active",
      })
      .returning();

    console.log("✅ Wallet da plataforma criada com sucesso!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📍 ID:", platformWallet.id);
    console.log("👤 Owner ID:", platformWallet.ownerId);
    console.log("🏷️  Tipo:", platformWallet.ownerType);
    console.log("💰 Saldo disponível: R$", platformWallet.availableBalance);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return platformWallet;
  } catch (error) {
    console.error("❌ Erro ao criar wallet da plataforma:", error);
    throw error;
  }
}

// Se executado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPlatformWallet()
    .then(() => {
      pool.end();
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      pool.end();
      process.exit(1);
    });
}

export { seedPlatformWallet };
