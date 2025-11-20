import { db } from "./db.js";
import { sql } from "drizzle-orm";

/**
 * Script para adicionar as funcionalidades de indicação de empresas
 * - Adiciona campos company_minimum_deliveries e company_commission_amount em referral_settings
 * - Adiciona campo referred_by_driver_id na tabela companies
 * - Cria tabela company_referrals
 */

async function migrate() {
  console.log("🚀 Iniciando migração para indicação de empresas...\n");

  try {
    // 1. Adicionar campos em referral_settings
    console.log("1. Adicionando campos em referral_settings...");
    await db.execute(sql`
      ALTER TABLE referral_settings
      ADD COLUMN IF NOT EXISTS company_minimum_deliveries INTEGER NOT NULL DEFAULT 20,
      ADD COLUMN IF NOT EXISTS company_commission_amount NUMERIC(10, 2) NOT NULL DEFAULT '100.00'
    `);
    console.log("   ✓ Campos adicionados em referral_settings\n");

    // 2. Adicionar campo referred_by_driver_id em companies
    console.log("2. Adicionando campo referred_by_driver_id em companies...");
    await db.execute(sql`
      ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS referred_by_driver_id VARCHAR REFERENCES drivers(id)
    `);
    console.log("   ✓ Campo referred_by_driver_id adicionado em companies\n");

    // 3. Criar tabela company_referrals
    console.log("3. Criando tabela company_referrals...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS company_referrals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_driver_id VARCHAR NOT NULL REFERENCES drivers(id),
        company_id VARCHAR NOT NULL REFERENCES companies(id),
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
    console.log("   ✓ Tabela company_referrals criada\n");

    console.log("✅ Migração concluída com sucesso!");
  } catch (error) {
    console.error("❌ Erro durante a migração:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

migrate();
