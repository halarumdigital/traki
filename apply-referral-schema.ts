import { db } from "./server/db.js";
import { sql } from "drizzle-orm";

async function applyReferralSchema() {
  try {
    console.log("🔄 Aplicando alterações do sistema de indicação...");

    // Adicionar campos na tabela drivers
    await db.execute(sql`
      ALTER TABLE drivers
      ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE,
      ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS referred_by_id VARCHAR(255) REFERENCES drivers(id),
      ADD COLUMN IF NOT EXISTS total_deliveries INTEGER DEFAULT 0
    `);
    console.log("✅ Campos adicionados na tabela drivers");

    // Criar tabela de configurações de indicação
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS referral_settings (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        minimum_deliveries INTEGER NOT NULL DEFAULT 10,
        commission_amount NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
        enabled BOOLEAN NOT NULL DEFAULT true,
        updated_by VARCHAR(255) REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela referral_settings criada");

    // Criar tabela de comissões de indicação
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS referral_commissions (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_driver_id VARCHAR(255) NOT NULL REFERENCES drivers(id),
        referred_driver_id VARCHAR(255) NOT NULL REFERENCES drivers(id),
        required_deliveries INTEGER NOT NULL,
        completed_deliveries INTEGER NOT NULL DEFAULT 0,
        commission_amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        qualified_at TIMESTAMP,
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela referral_commissions criada");

    // Criar tabela de indicações do motorista
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS driver_referrals (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_driver_id VARCHAR(255) NOT NULL REFERENCES drivers(id),
        referred_driver_id VARCHAR(255) REFERENCES drivers(id),
        referred_name VARCHAR(255),
        referred_phone VARCHAR(20),
        referral_code VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        registered_at TIMESTAMP,
        deliveries_completed INTEGER NOT NULL DEFAULT 0,
        commission_earned NUMERIC(10, 2) DEFAULT 0,
        commission_paid BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Tabela driver_referrals criada");

    // Inserir configuração padrão se não existir
    await db.execute(sql`
      INSERT INTO referral_settings (minimum_deliveries, commission_amount, enabled)
      SELECT 10, 50.00, true
      WHERE NOT EXISTS (SELECT 1 FROM referral_settings)
    `);
    console.log("✅ Configuração padrão inserida");

    console.log("🎉 Todas as alterações foram aplicadas com sucesso!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao aplicar alterações:", error);
    process.exit(1);
  }
}

applyReferralSchema();