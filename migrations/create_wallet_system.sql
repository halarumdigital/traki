-- Migration: Create Wallet System Tables
-- Date: 2026-01-29
-- Description: Creates tables for virtual wallet system with Asaas integration

-- Table: wallets
-- Stores company, driver, and platform wallets
CREATE TABLE IF NOT EXISTS wallets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id VARCHAR NOT NULL,
  owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('company', 'driver', 'platform')),
  available_balance NUMERIC(15, 2) NOT NULL DEFAULT '0.00',
  blocked_balance NUMERIC(15, 2) NOT NULL DEFAULT '0.00',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'suspended')),
  blocked_reason TEXT,
  blocked_at TIMESTAMP,
  asaas_customer_id VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for wallets
CREATE INDEX IF NOT EXISTS idx_wallets_owner ON wallets(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_wallets_status ON wallets(status);

-- Table: wallet_transactions
-- Records all wallet movements (credits, debits, blocks, unblocks)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id VARCHAR NOT NULL REFERENCES wallets(id),
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'recharge', 'delivery_credit', 'delivery_debit',
    'commission', 'withdrawal', 'withdrawal_fee',
    'block', 'unblock', 'refund', 'adjustment'
  )),
  amount NUMERIC(15, 2) NOT NULL,
  balance_before NUMERIC(15, 2) NOT NULL,
  balance_after NUMERIC(15, 2) NOT NULL,
  blocked_balance_before NUMERIC(15, 2),
  blocked_balance_after NUMERIC(15, 2),
  reference_type VARCHAR(50),
  reference_id VARCHAR,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for wallet_transactions
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at);

-- Table: charges
-- Stores Asaas payment charges (PIX/Boleto)
CREATE TABLE IF NOT EXISTS charges (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id VARCHAR NOT NULL REFERENCES wallets(id),
  charge_type VARCHAR(20) NOT NULL CHECK (charge_type IN ('recharge', 'weekly')),
  amount NUMERIC(15, 2) NOT NULL,
  net_amount NUMERIC(15, 2),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'received', 'overdue',
    'refunded', 'cancelled', 'failed'
  )),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('PIX', 'BOLETO')),
  asaas_payment_id VARCHAR,
  pix_qr_code TEXT,
  pix_copy_paste TEXT,
  pix_expiration TIMESTAMP,
  boleto_url TEXT,
  boleto_barcode TEXT,
  boleto_due_date TIMESTAMP,
  week_start_date DATE,
  week_end_date DATE,
  paid_at TIMESTAMP,
  asaas_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for charges
CREATE INDEX IF NOT EXISTS idx_charges_wallet ON charges(wallet_id);
CREATE INDEX IF NOT EXISTS idx_charges_status ON charges(status);
CREATE INDEX IF NOT EXISTS idx_charges_asaas ON charges(asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_charges_type ON charges(charge_type);
CREATE INDEX IF NOT EXISTS idx_charges_week ON charges(week_start_date, week_end_date);

-- Table: delivery_financials
-- Records financial details of each delivery for split processing
CREATE TABLE IF NOT EXISTS delivery_financials (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR NOT NULL,
  company_id VARCHAR NOT NULL,
  driver_id VARCHAR NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL,
  driver_amount NUMERIC(15, 2) NOT NULL,
  commission_amount NUMERIC(15, 2) NOT NULL,
  commission_percentage NUMERIC(5, 2) NOT NULL,
  company_debit_transaction_id VARCHAR REFERENCES wallet_transactions(id),
  driver_credit_transaction_id VARCHAR REFERENCES wallet_transactions(id),
  commission_transaction_id VARCHAR REFERENCES wallet_transactions(id),
  charge_id VARCHAR REFERENCES charges(id),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for delivery_financials
CREATE INDEX IF NOT EXISTS idx_delivery_financials_request ON delivery_financials(request_id);
CREATE INDEX IF NOT EXISTS idx_delivery_financials_company ON delivery_financials(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_financials_driver ON delivery_financials(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_financials_charge ON delivery_financials(charge_id);
CREATE INDEX IF NOT EXISTS idx_delivery_financials_processed ON delivery_financials(processed);

-- Table: withdrawals
-- Records driver withdrawal requests
CREATE TABLE IF NOT EXISTS withdrawals (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id VARCHAR NOT NULL REFERENCES wallets(id),
  driver_id VARCHAR NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  net_amount NUMERIC(15, 2),
  fee_amount NUMERIC(15, 2) DEFAULT '0.00',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),
  pix_key VARCHAR NOT NULL,
  pix_key_type VARCHAR(20) NOT NULL CHECK (pix_key_type IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP')),
  asaas_transfer_id VARCHAR,
  fail_reason TEXT,
  block_transaction_id VARCHAR REFERENCES wallet_transactions(id),
  debit_transaction_id VARCHAR REFERENCES wallet_transactions(id),
  completed_at TIMESTAMP,
  asaas_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for withdrawals
CREATE INDEX IF NOT EXISTS idx_withdrawals_wallet ON withdrawals(wallet_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_driver ON withdrawals(driver_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON withdrawals(created_at);

-- Table: webhooks_log
-- Logs all incoming webhooks from Asaas
CREATE TABLE IF NOT EXISTS webhooks_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(20) NOT NULL DEFAULT 'asaas',
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  headers JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for webhooks_log
CREATE INDEX IF NOT EXISTS idx_webhooks_log_provider ON webhooks_log(provider);
CREATE INDEX IF NOT EXISTS idx_webhooks_log_event ON webhooks_log(event_type);
CREATE INDEX IF NOT EXISTS idx_webhooks_log_processed ON webhooks_log(processed);
CREATE INDEX IF NOT EXISTS idx_webhooks_log_created ON webhooks_log(created_at);

-- Create the platform wallet (singleton)
INSERT INTO wallets (id, owner_id, owner_type, status)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'platform',
  'active'
)
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE wallets IS 'Virtual wallets for companies, drivers, and platform';
COMMENT ON TABLE wallet_transactions IS 'All financial movements in wallets';
COMMENT ON TABLE charges IS 'Asaas payment charges (PIX and Boleto)';
COMMENT ON TABLE delivery_financials IS 'Financial records for each delivery (split details)';
COMMENT ON TABLE withdrawals IS 'Driver withdrawal requests to their PIX keys';
COMMENT ON TABLE webhooks_log IS 'Log of all webhooks received from payment providers';
