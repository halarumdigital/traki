-- Create Ticket Subjects Table
CREATE TABLE IF NOT EXISTS ticket_subjects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  driver_id VARCHAR NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  driver_name VARCHAR(255) NOT NULL,
  driver_email VARCHAR(255),
  driver_whatsapp VARCHAR(20) NOT NULL,
  subject_id VARCHAR NOT NULL REFERENCES ticket_subjects(id),
  message TEXT NOT NULL,
  attachment_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  replies_count INTEGER NOT NULL DEFAULT 0,
  unread_by_driver BOOLEAN NOT NULL DEFAULT false,
  last_reply_at TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create Ticket Replies Table
CREATE TABLE IF NOT EXISTS ticket_replies (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type VARCHAR(20) NOT NULL,
  author_id VARCHAR NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  read_by_driver BOOLEAN NOT NULL DEFAULT false,
  read_by_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_driver_id ON support_tickets(driver_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket_id ON ticket_replies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_subjects_active ON ticket_subjects(active);
