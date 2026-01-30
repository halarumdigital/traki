import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, numeric, integer, uuid, json, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// ========================================
// USERS (Passageiros/Usuários)
// ========================================
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  mobile: varchar("mobile", { length: 20 }).unique(),
  password: text("password").notNull(),

  profilePicture: text("profile_picture"),
  active: boolean("active").notNull().default(true),
  emailConfirmed: boolean("email_confirmed").notNull().default(false),
  mobileConfirmed: boolean("mobile_confirmed").notNull().default(false),

  // Ratings
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0"),
  ratingTotal: numeric("rating_total").default("0"),
  noOfRatings: integer("no_of_ratings").default(0),

  // Push Notifications (para depois)
  fcmToken: text("fcm_token"),
  apnToken: text("apn_token"),
  loginBy: varchar("login_by", { length: 20 }).default("web"),

  // Dados empresariais
  cnpj: varchar("cnpj", { length: 18 }).unique(),

  // Responsável
  responsibleName: varchar("responsible_name", { length: 255 }),
  responsibleWhatsapp: varchar("responsible_whatsapp", { length: 20 }),
  responsibleEmail: varchar("responsible_email", { length: 255 }),

  // Financeiro - Chave PIX
  pixKey: varchar("pix_key", { length: 255 }),
  pixKeyType: varchar("pix_key_type", { length: 20 }), // EMAIL, CPF, CNPJ, PHONE, EVP

  // Referral (para depois)
  refferalCode: varchar("refferal_code", { length: 50 }).unique(),
  referredBy: varchar("referred_by", { length: 255 }),

  // Preferences
  timezone: varchar("timezone", { length: 100 }).default("America/Sao_Paulo"),
  lang: varchar("lang", { length: 10 }).default("pt"),
  gender: varchar("gender", { length: 10 }),

  // Admin flag
  isAdmin: boolean("is_admin").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// PASSWORD RESET TOKENS (Tokens de Recuperação de Senha)
// ========================================
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Removida foreign key para suportar users, drivers e companies
  userType: varchar("user_type", { length: 20 }).notNull().default("user"), // 'user', 'driver', 'company'
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ========================================
// SERVICE LOCATIONS (Cidades)
// ========================================
export const serviceLocations = pgTable("service_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  state: varchar("state", { length: 2 }).notNull(), // UF - Estado

  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),

  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// VEHICLE TYPES (Categorias de Veículos)
// ========================================
export const vehicleTypes = pgTable("vehicle_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  icon: text("icon"), // URL do ícone
  capacity: integer("capacity").notNull().default(4),
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// BRANDS (Marcas de Veículos)
// ========================================
export const brands = pgTable("brands", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// VEHICLE MODELS (Modelos de Veículos)
// ========================================
export const vehicleModels = pgTable("vehicle_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brandId: varchar("brand_id").notNull().references(() => brands.id),
  name: varchar("name", { length: 100 }).notNull(),
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// DRIVER DOCUMENT TYPES (Tipos de Documentos do Motorista)
// ========================================
export const driverDocumentTypes = pgTable("driver_document_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  required: boolean("required").notNull().default(true),
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// DRIVER DOCUMENTS (Documentos Enviados pelos Motoristas)
// ========================================
export const driverDocuments = pgTable("driver_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  documentTypeId: varchar("document_type_id").notNull().references(() => driverDocumentTypes.id),
  documentUrl: text("document_url").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, rejected
  rejectionReason: text("rejection_reason"),

  // Campos de validação de documento (CNH)
  expirationDate: timestamp("expiration_date"), // Data de validade extraída do documento
  isExpired: boolean("is_expired").default(false), // Se o documento está vencido
  validationData: json("validation_data").$type<Record<string, string>>(), // Dados extraídos da validação

  // Campos de validação FaceMatch (Selfie vs CNH)
  faceMatchScore: real("face_match_score"), // Score de similaridade da comparação facial (0-100)
  faceMatchValidated: boolean("face_match_validated"), // Se passou na validação facial
  faceMatchData: json("face_match_data"), // Dados completos da resposta da API FaceMatch

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// DRIVER NOTES (Comentários/Notas sobre Motoristas)
// ========================================
export const driverNotes = pgTable("driver_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id), // Quem adicionou o comentário
  note: text("note").notNull(),
  noteType: varchar("note_type", { length: 20 }).notNull().default("general"), // general, block, unblock, warning

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ========================================
// COMPANIES (Empresas)
// ========================================
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 18 }).unique(),
  logoUrl: varchar("logo_url", { length: 500 }), // URL do logo no Cloudflare R2
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),

  // Responsável
  responsibleName: varchar("responsible_name", { length: 255 }),
  responsibleWhatsapp: varchar("responsible_whatsapp", { length: 20 }),
  responsibleEmail: varchar("responsible_email", { length: 255 }),

  // Endereço
  street: varchar("street", { length: 255 }),
  number: varchar("number", { length: 20 }),
  complement: varchar("complement", { length: 100 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  cep: varchar("cep", { length: 10 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  reference: text("reference"),

  active: boolean("active").notNull().default(true),

  // Ratings (avaliações dos motoristas)
  rating: varchar("rating", { length: 10 }).default("0"), // Média das avaliações
  ratingTotal: varchar("rating_total", { length: 10 }).default("0"), // Soma total dos pontos
  noOfRatings: integer("no_of_ratings").default(0), // Número de avaliações

  // Indicação
  referredByDriverId: varchar("referred_by_driver_id").references(() => drivers.id), // Motorista que indicou a empresa

  // Financeiro - Chave PIX para transações
  pixKey: varchar("pix_key", { length: 255 }),
  pixKeyType: varchar("pix_key_type", { length: 20 }), // EMAIL, CPF, CNPJ, PHONE, EVP

  // Tipo de pagamento
  paymentType: varchar("payment_type", { length: 20 }).notNull().default("PRE_PAGO"), // PRE_PAGO, BOLETO

  password: varchar("password", { length: 255 }),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// ROTAS INTERMUNICIPAIS (Rotas entre cidades)
// ========================================
export const rotasIntermunicipais = pgTable("rotas_intermunicipais", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  nomeRota: varchar("nome_rota", { length: 255 }).notNull(),
  cidadeOrigemId: varchar("cidade_origem_id").notNull().references(() => serviceLocations.id),
  cidadeDestinoId: varchar("cidade_destino_id").notNull().references(() => serviceLocations.id),

  // Dados da rota (calculados via Google Maps ou inseridos manualmente)
  distanciaKm: numeric("distancia_km", { precision: 10, scale: 2 }).notNull(),
  tempoMedioMinutos: integer("tempo_medio_minutos").notNull(),

  ativa: boolean("ativa").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// ENTREGADOR ROTAS (Rotas que o entregador faz)
// ========================================
export const entregadorRotas = pgTable("entregador_rotas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  entregadorId: varchar("entregador_id").notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  rotaId: varchar("rota_id").notNull().references(() => rotasIntermunicipais.id, { onDelete: 'cascade' }),

  // Disponibilidade
  diasSemana: integer("dias_semana").array().notNull(), // [1,2,3,4,5] = Seg a Sex
  horarioSaida: varchar("horario_saida", { length: 8 }).notNull(), // TIME -> "08:00:00"
  horarioChegada: varchar("horario_chegada", { length: 8 }), // TIME -> "11:00:00"

  // Capacidades definidas pelo entregador
  capacidadePacotes: integer("capacidade_pacotes").notNull(),
  capacidadePesoKg: numeric("capacidade_peso_kg", { precision: 10, scale: 2 }).notNull(),
  capacidadeVolumeM3: numeric("capacidade_volume_m3", { precision: 10, scale: 3 }),

  // Configurações
  aceitaMultiplasColetas: boolean("aceita_multiplas_coletas").default(true),
  aceitaMultiplasEntregas: boolean("aceita_multiplas_entregas").default(true),
  raioColetaKm: numeric("raio_coleta_km", { precision: 10, scale: 2 }),

  ativa: boolean("ativa").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// ENTREGADOR CAPACIDADE DIÁRIA (Controle de capacidade por dia)
// ========================================
export const entregadorCapacidadeDiaria = pgTable("entregador_capacidade_diaria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  entregadorId: varchar("entregador_id").notNull().references(() => drivers.id, { onDelete: 'cascade' }),
  rotaId: varchar("rota_id").notNull().references(() => rotasIntermunicipais.id, { onDelete: 'cascade' }),
  data: varchar("data", { length: 10 }).notNull(), // DATE -> "2025-11-20"

  // Capacidade total
  capacidadeTotalPacotes: integer("capacidade_total_pacotes").notNull(),
  capacidadeTotalPesoKg: numeric("capacidade_total_peso_kg", { precision: 10, scale: 2 }).notNull(),

  // Já aceito
  pacotesAceitos: integer("pacotes_aceitos").default(0),
  pesoAceitoKg: numeric("peso_aceito_kg", { precision: 10, scale: 2 }).default("0"),
  volumeAceitoM3: numeric("volume_aceito_m3", { precision: 10, scale: 3 }).default("0"),

  entregasAceitas: integer("entregas_aceitas").default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// CITY PRICES (Preços por Categoria em cada Cidade)
// ========================================
export const cityPrices = pgTable("city_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceLocationId: varchar("service_location_id").references(() => serviceLocations.id), // Nullable para rotas intermunicipais
  vehicleTypeId: varchar("vehicle_type_id").notNull().references(() => vehicleTypes.id),

  // Pricing
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  pricePerDistance: numeric("price_per_distance", { precision: 10, scale: 2 }).notNull(),
  pricePerTime: numeric("price_per_time", { precision: 10, scale: 2 }).notNull(),
  baseDistance: numeric("base_distance", { precision: 10, scale: 2 }).notNull().default("0"),

  // Waiting Charges
  waitingChargePerMinute: numeric("waiting_charge_per_minute", { precision: 10, scale: 2 }).default("0"),
  freeWaitingTimeMins: integer("free_waiting_time_mins").default(5),

  // Cancellation
  cancellationFee: numeric("cancellation_fee", { precision: 10, scale: 2 }).default("0"),

  // Stop and Return Prices
  stopPrice: numeric("stop_price", { precision: 10, scale: 2 }).default("0"),
  returnPrice: numeric("return_price", { precision: 10, scale: 2 }).default("0"),

  // Preço Dinâmica (surge pricing)
  dynamicPrice: numeric("dynamic_price", { precision: 10, scale: 2 }).default("0"),
  dynamicPriceActive: boolean("dynamic_price_active").notNull().default(false),

  // Tipo de preço: entrega_rapida ou rota_intermunicipal
  tipo: varchar("tipo", { length: 20 }).notNull().default("entrega_rapida"),
  rotaIntermunicipalId: varchar("rota_intermunicipal_id").references(() => rotasIntermunicipais.id),

  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// DRIVERS (Motoristas)
// ========================================
export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Opcional - apenas para compatibilidade
  serviceLocationId: varchar("service_location_id").notNull().references(() => serviceLocations.id),

  // Personal Info
  name: varchar("name", { length: 255 }).notNull(),
  cpf: varchar("cpf", { length: 14 }),
  mobile: varchar("mobile", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  password: text("password"),
  profilePicture: text("profile_picture"),

  // Vehicle Info
  vehicleTypeId: varchar("vehicle_type_id").references(() => vehicleTypes.id),
  brandId: varchar("brand_id").references(() => brands.id),
  modelId: varchar("model_id").references(() => vehicleModels.id),
  carMake: varchar("car_make", { length: 100 }),
  carModel: varchar("car_model", { length: 100 }),
  carNumber: varchar("car_number", { length: 50 }),
  carColor: varchar("car_color", { length: 50 }),
  carYear: varchar("car_year", { length: 4 }),

  // Status
  active: boolean("active").notNull().default(true),
  approve: boolean("approve").notNull().default(false),
  available: boolean("available").notNull().default(false),
  onDelivery: boolean("on_delivery").notNull().default(false), // Marcador se está em uma entrega

  // Bloqueio de Motorista (por violações dos termos de uso)
  blocked: boolean("blocked").notNull().default(false), // Se está bloqueado
  blockedAt: timestamp("blocked_at"), // Data do bloqueio
  blockedReason: text("blocked_reason"), // Motivo do bloqueio
  blockedByUserId: varchar("blocked_by_user_id").references(() => users.id), // Quem bloqueou

  // Bloqueio de Entregas (pode usar o app, mas não recebe entregas)
  deliveriesBlocked: boolean("deliveries_blocked").notNull().default(false), // Se está com entregas bloqueadas
  deliveriesBlockedAt: timestamp("deliveries_blocked_at"), // Data do bloqueio de entregas
  deliveriesBlockedReason: text("deliveries_blocked_reason"), // Motivo do bloqueio de entregas
  deliveriesBlockedByUserId: varchar("deliveries_blocked_by_user_id").references(() => users.id), // Quem bloqueou as entregas

  // Documents
  uploadedDocuments: boolean("uploaded_documents").notNull().default(false),

  // Ratings
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0"),
  ratingTotal: numeric("rating_total").default("0"),
  noOfRatings: integer("no_of_ratings").default(0),

  // Monthly Commission Tracking (Comissão Progressiva)
  monthlyDeliveryCount: integer("monthly_delivery_count").notNull().default(0),
  lastMonthlyReset: timestamp("last_monthly_reset").defaultNow(),

  // Location (armazenamos lat/lng simples)
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),

  // Push Notifications
  fcmToken: text("fcm_token"),
  apnToken: text("apn_token"),
  timezone: varchar("timezone", { length: 100 }).default("America/Sao_Paulo"),

  // Device Info
  deviceId: varchar("device_id", { length: 255 }), // IMEI ou ID único do dispositivo

  // Heartbeat - Última atividade do motorista (usado para verificar se está realmente online)
  lastHeartbeat: timestamp("last_heartbeat"), // Atualizado a cada ping do app

  // Referral System (Sistema de Indicação)
  referralCode: varchar("referral_code", { length: 50 }).unique(), // Código único do entregador
  referredByCode: varchar("referred_by_code", { length: 50 }), // Código de quem indicou
  referredById: varchar("referred_by_id"), // ID de quem indicou (auto-referência para drivers)
  totalDeliveries: integer("total_deliveries").notNull().default(0), // Total de entregas completas

  // Criminal Background Check (Consulta de Antecedentes Criminais)
  hasCriminalRecords: boolean("has_criminal_records").default(false), // Se tem processos criminais
  criminalRecords: json("criminal_records").$type<Array<{
    tipo: string;
    assunto: string;
    tribunalTipo: string;
  }>>(), // Lista de processos criminais
  criminalCheckDate: timestamp("criminal_check_date"), // Data da última consulta

  // Financeiro - Chave PIX para transações
  pixKey: varchar("pix_key", { length: 255 }),
  pixKeyType: varchar("pix_key_type", { length: 20 }), // EMAIL, CPF, CNPJ, PHONE, EVP

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// REQUESTS (Corridas)
// ========================================
export const requests = pgTable("requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestNumber: varchar("request_number", { length: 50 }).unique().notNull(),

  // Participants (userId OU companyId deve estar presente)
  userId: varchar("user_id").references(() => users.id),
  companyId: varchar("company_id").references(() => companies.id),
  customerName: varchar("customer_name", { length: 255 }),
  customerWhatsapp: varchar("customer_whatsapp", { length: 20 }), // WhatsApp com DDD
  deliveryReference: text("delivery_reference"), // Referência do local de entrega
  driverId: varchar("driver_id").references(() => drivers.id),

  // Type
  zoneTypeId: varchar("zone_type_id").notNull().references(() => vehicleTypes.id),
  serviceLocationId: varchar("service_location_id").references(() => serviceLocations.id),

  // Timing
  isLater: boolean("is_later").notNull().default(false),
  scheduledAt: timestamp("scheduled_at"), // Data/hora para entrega agendada
  tripStartTime: timestamp("trip_start_time"),
  acceptedAt: timestamp("accepted_at"),
  arrivedAt: timestamp("arrived_at"),
  tripStartedAt: timestamp("trip_started_at"),
  deliveredAt: timestamp("delivered_at"), // Quando entregou o produto ao cliente
  returningAt: timestamp("returning_at"), // Quando começou a voltar ao ponto de origem
  returnedAt: timestamp("returned_at"), // Quando chegou de volta ao ponto de origem
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),

  // Status Flags
  isDriverStarted: boolean("is_driver_started").notNull().default(false),
  isDriverArrived: boolean("is_driver_arrived").notNull().default(false),
  isTripStart: boolean("is_trip_start").notNull().default(false),
  isCompleted: boolean("is_completed").notNull().default(false),
  isCancelled: boolean("is_cancelled").notNull().default(false),

  // Cancellation
  cancelReason: text("cancel_reason"),
  cancelMethod: varchar("cancel_method", { length: 20 }),

  // Trip Details
  totalDistance: numeric("total_distance", { precision: 10, scale: 2 }),
  totalTime: numeric("total_time", { precision: 10, scale: 2 }),
  estimatedTime: numeric("estimated_time", { precision: 10, scale: 2 }), // Tempo estimado de entrega em minutos
  needsReturn: boolean("needs_return").notNull().default(false), // Se o motorista precisa retornar ao ponto de origem
  notes: text("notes"), // Observações da entrega

  // Payment (simplificado - apenas cash por enquanto)
  paymentOpt: integer("payment_opt").notNull().default(0), // 0: cash
  isPaid: boolean("is_paid").notNull().default(false),

  // Ratings
  userRated: boolean("user_rated").notNull().default(false),
  driverRated: boolean("driver_rated").notNull().default(false),
  companyRated: boolean("company_rated").notNull().default(false), // Se a empresa avaliou o motorista

  // Config
  timezone: varchar("timezone", { length: 100 }).default("America/Sao_Paulo"),
  unit: varchar("unit", { length: 10 }).default("km"),
  requestedCurrencyCode: varchar("requested_currency_code", { length: 10 }).default("BRL"),
  requestedCurrencySymbol: varchar("requested_currency_symbol", { length: 10 }).default("R$"),

  // Security
  rideOtp: varchar("ride_otp", { length: 10 }),

  // Pricing
  requestEtaAmount: numeric("request_eta_amount", { precision: 10, scale: 2 }),
  isSurgeApplied: boolean("is_surge_applied").notNull().default(false),

  // Polyline
  polyLine: text("poly_line"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// REQUEST PLACES (Localização da Corrida)
// ========================================
export const requestPlaces = pgTable("request_places", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => requests.id),

  // Pickup
  pickLat: numeric("pick_lat", { precision: 10, scale: 7 }),
  pickLng: numeric("pick_lng", { precision: 10, scale: 7 }),
  pickAddress: text("pick_address").notNull(),

  // Drop
  dropLat: numeric("drop_lat", { precision: 10, scale: 7 }),
  dropLng: numeric("drop_lng", { precision: 10, scale: 7 }),
  dropAddress: text("drop_address").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// DELIVERY STOPS (Paradas de Entrega - Múltiplos Pontos)
// ========================================
export const deliveryStops = pgTable("delivery_stops", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),

  // Ordem da parada (1, 2, 3, etc.)
  stopOrder: integer("stop_order").notNull(),

  // Tipo da parada: "pickup" (coleta) ou "delivery" (entrega)
  stopType: varchar("stop_type", { length: 20 }).notNull().default("delivery"),

  // Informações do cliente (para entregas)
  customerName: varchar("customer_name", { length: 255 }),
  customerWhatsapp: varchar("customer_whatsapp", { length: 20 }),
  deliveryReference: text("delivery_reference"),

  // Endereço completo
  address: text("address").notNull(),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),

  // Status da parada
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, arrived, completed, skipped
  arrivedAt: timestamp("arrived_at"),
  completedAt: timestamp("completed_at"),

  // Observações específicas desta parada
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// REQUEST BILLS (Cobrança da Corrida)
// ========================================
export const requestBills = pgTable("request_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => requests.id),

  // Base Pricing
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  baseDistance: numeric("base_distance", { precision: 10, scale: 2 }).notNull(),

  // Distance Pricing
  pricePerDistance: numeric("price_per_distance", { precision: 10, scale: 2 }).notNull(),
  distancePrice: numeric("distance_price", { precision: 10, scale: 2 }).notNull(),

  // Time Pricing
  pricePerTime: numeric("price_per_time", { precision: 10, scale: 2 }).notNull(),
  timePrice: numeric("time_price", { precision: 10, scale: 2 }).notNull(),

  // Fees
  cancellationFee: numeric("cancellation_fee", { precision: 10, scale: 2 }).default("0"),
  waitingCharge: numeric("waiting_charge", { precision: 10, scale: 2 }).default("0"),

  // Taxes
  serviceTax: numeric("service_tax", { precision: 10, scale: 2 }).default("0"),
  serviceTaxPercentage: numeric("service_tax_percentage", { precision: 5, scale: 2 }).default("0"),

  // Commissions
  adminCommision: numeric("admin_commision", { precision: 10, scale: 2 }).notNull(),
  adminCommisionType: varchar("admin_commision_type", { length: 20 }).notNull(),

  // Surge
  surgePrice: numeric("surge_price", { precision: 10, scale: 2 }).default("0"),

  // Total
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// CANCELLATION REASONS
// ========================================
export const cancellationReasons = pgTable("cancellation_reasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reason: text("reason").notNull(),
  userType: varchar("user_type", { length: 20 }).notNull(), // 'user' ou 'driver'
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ========================================
// FAVOURITE LOCATIONS
// ========================================
export const favouriteLocations = pgTable("favourite_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  address: text("address").notNull(),
  lat: numeric("lat", { precision: 10, scale: 7 }).notNull(),
  lng: numeric("lng", { precision: 10, scale: 7 }).notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ========================================
// REQUEST RATINGS
// ========================================
export const requestRatings = pgTable("request_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => requests.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ========================================
// COMPANY DRIVER RATINGS (Avaliações de Empresas sobre Motoristas)
// ========================================
export const companyDriverRatings = pgTable("company_driver_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => requests.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  rating: integer("rating").notNull(), // 1-5 estrelas
  comment: text("comment"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ========================================
// DRIVER COMPANY RATINGS (Avaliações de Motoristas sobre Empresas)
// ========================================
export const driverCompanyRatings = pgTable("driver_company_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => requests.id),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  rating: integer("rating").notNull(), // 1-5 estrelas

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ========================================
// DRIVER NOTIFICATIONS (Notificações de Solicitações para Motoristas)
// ========================================
export const driverNotifications = pgTable("driver_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),
  driverId: varchar("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),

  // Status: notified, accepted, rejected, expired
  status: varchar("status", { length: 20 }).notNull().default("notified"),

  // Timestamps
  notifiedAt: timestamp("notified_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// SETTINGS (Configurações do Sistema)
// ========================================
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Driver Assignment
  driverAssignmentType: varchar("driver_assignment_type", { length: 20 }).notNull().default("one_by_one"), // one_by_one | all
  driverSearchRadius: numeric("driver_search_radius", { precision: 10, scale: 2 }).notNull().default("10"), // km
  minTimeToFindDriver: integer("min_time_to_find_driver").notNull().default(120), // segundos
  driverAcceptanceTimeout: integer("driver_acceptance_timeout").notNull().default(30), // segundos
  autoCancelTimeout: integer("auto_cancel_timeout").notNull().default(30), // minutos - tempo para cancelamento automático de entregas não aceitas

  // Pricing
  canRoundTripValues: boolean("can_round_trip_values").notNull().default(true),
  enableCommission: boolean("enable_commission").notNull().default(true),
  adminCommissionPercentage: numeric("admin_commission_percentage", { precision: 5, scale: 2 }).notNull().default("20"),

  // OTP Settings
  enableOtpForLogin: boolean("enable_otp_for_login").notNull().default(false),
  enableOtpForRegistration: boolean("enable_otp_for_registration").notNull().default(false),

  // Payment Gateway (Asaas/Efi)
  paymentGateway: varchar("payment_gateway", { length: 20 }).default("asaas"), // asaas | efi
  asaasApiKey: text("asaas_api_key"),
  asaasEnvironment: varchar("asaas_environment", { length: 20 }).default("sandbox"), // sandbox | production
  efiClientId: text("efi_client_id"),
  efiClientSecret: text("efi_client_secret"),
  efiCertificate: text("efi_certificate"),
  efiEnvironment: varchar("efi_environment", { length: 20 }).default("sandbox"),

  // Referral System
  enableReferralSystem: boolean("enable_referral_system").notNull().default(true),
  referralBonusAmount: numeric("referral_bonus_amount", { precision: 10, scale: 2 }).default("10"),
  referralMinimumTrips: integer("referral_minimum_trips").default(1),

  // Map Configuration
  mapProvider: varchar("map_provider", { length: 20 }).notNull().default("google"), // google | openstreet
  googleMapsApiKey: text("google_maps_api_key"),

  // Firebase Configuration
  firebaseProjectId: text("firebase_project_id"),
  firebaseClientEmail: text("firebase_client_email"),
  firebasePrivateKey: text("firebase_private_key"),
  firebaseDatabaseUrl: text("firebase_database_url"),

  // SMTP Configuration
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port").default(587),
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpPassword: text("smtp_password"),
  smtpFromEmail: varchar("smtp_from_email", { length: 255 }),
  smtpFromName: varchar("smtp_from_name", { length: 255 }),
  smtpSecure: boolean("smtp_secure").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// COMMISSION TIERS (Comissões Progressivas)
// ========================================
export const commissionTiers = pgTable("commission_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  minDeliveries: integer("min_deliveries").notNull(),
  maxDeliveries: integer("max_deliveries"), // null = sem limite superior
  commissionPercentage: numeric("commission_percentage", { precision: 5, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========================================
// ZOD SCHEMAS
// ========================================

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token obrigatório"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

export const insertServiceLocationSchema = createInsertSchema(serviceLocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleTypeSchema = createInsertSchema(vehicleTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBrandSchema = createInsertSchema(brands).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleModelSchema = createInsertSchema(vehicleModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDriverDocumentTypeSchema = createInsertSchema(driverDocumentTypes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDriverDocumentSchema = createInsertSchema(driverDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDriverNoteSchema = createInsertSchema(driverNotes).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCityPriceSchema = createInsertSchema(cityPrices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDriverSchema = createInsertSchema(drivers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRequestSchema = createInsertSchema(requests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSettingsSchema = z.object({
  // Driver Assignment
  driverAssignmentType: z.enum(["one_by_one", "all"]),
  driverSearchRadius: z.union([z.string(), z.number()]).transform(val => String(val)),
  minTimeToFindDriver: z.union([z.string(), z.number()]).transform(val => Number(val)),
  driverAcceptanceTimeout: z.union([z.string(), z.number()]).transform(val => Number(val)),
  autoCancelTimeout: z.union([z.string(), z.number()]).transform(val => Number(val)),

  // Pricing
  canRoundTripValues: z.boolean(),
  enableCommission: z.boolean(),
  adminCommissionPercentage: z.union([z.string(), z.number()]).transform(val => String(val)),

  // OTP Settings
  enableOtpForLogin: z.boolean(),
  enableOtpForRegistration: z.boolean(),

  // Payment Gateway
  paymentGateway: z.enum(["asaas", "efi"]).nullable().optional(),
  asaasApiKey: z.string().nullable().optional(),
  asaasEnvironment: z.enum(["sandbox", "production"]).nullable().optional(),
  efiClientId: z.string().nullable().optional(),
  efiClientSecret: z.string().nullable().optional(),
  efiCertificate: z.string().nullable().optional(),
  efiEnvironment: z.enum(["sandbox", "production"]).nullable().optional(),

  // Referral System
  enableReferralSystem: z.boolean(),
  referralBonusAmount: z.union([z.string(), z.number(), z.null()]).transform(val => val === null ? null : String(val)).nullable().optional(),
  referralMinimumTrips: z.union([z.string(), z.number(), z.null()]).transform(val => val === null ? null : Number(val)).nullable().optional(),

  // Map Configuration
  mapProvider: z.enum(["google", "openstreet"]),
  googleMapsApiKey: z.string().nullable().optional(),

  // Firebase Configuration
  firebaseProjectId: z.string().nullable().optional(),
  firebaseClientEmail: z.string().nullable().optional(),
  firebasePrivateKey: z.string().nullable().optional(),
  firebaseDatabaseUrl: z.string().nullable().optional(),

  // SMTP Configuration
  smtpHost: z.string().nullable().optional(),
  smtpPort: z.union([z.string(), z.number(), z.null()]).transform(val => val === null ? null : Number(val)).nullable().optional(),
  smtpUser: z.string().nullable().optional(),
  smtpPassword: z.string().nullable().optional(),
  smtpFromEmail: z.string().nullable().optional(),
  smtpFromName: z.string().nullable().optional(),
  smtpSecure: z.boolean().nullable().optional(),
});

// ========================================
// COMPANY CANCELLATION TYPES (Tipos de Cancelamento Empresa)
// ========================================
export const companyCancellationTypes = pgTable("company_cancellation_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompanyCancellationTypeSchema = createInsertSchema(companyCancellationTypes, {
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  active: z.boolean().default(true),
});

// ========================================
// TYPES
// ========================================

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginCredentials = z.infer<typeof loginSchema>;

export type ServiceLocation = typeof serviceLocations.$inferSelect;
export type InsertServiceLocation = z.infer<typeof insertServiceLocationSchema>;

export type VehicleType = typeof vehicleTypes.$inferSelect;
export type InsertVehicleType = z.infer<typeof insertVehicleTypeSchema>;

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = z.infer<typeof insertBrandSchema>;

export type VehicleModel = typeof vehicleModels.$inferSelect;
export type InsertVehicleModel = z.infer<typeof insertVehicleModelSchema>;

export type DriverDocumentType = typeof driverDocumentTypes.$inferSelect;
export type InsertDriverDocumentType = z.infer<typeof insertDriverDocumentTypeSchema>;

export type DriverDocument = typeof driverDocuments.$inferSelect;
export type InsertDriverDocument = z.infer<typeof insertDriverDocumentSchema>;

export type DriverNote = typeof driverNotes.$inferSelect;
export type InsertDriverNote = z.infer<typeof insertDriverNoteSchema>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type CityPrice = typeof cityPrices.$inferSelect;
export type InsertCityPrice = z.infer<typeof insertCityPriceSchema>;

export type RotaIntermunicipal = typeof rotasIntermunicipais.$inferSelect;
export const insertRotaIntermunicipalSchema = createInsertSchema(rotasIntermunicipais).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRotaIntermunicipal = z.infer<typeof insertRotaIntermunicipalSchema>;

export type EntregadorRota = typeof entregadorRotas.$inferSelect;
export const insertEntregadorRotaSchema = createInsertSchema(entregadorRotas, {
  diasSemana: z.array(z.number().min(1).max(7)).min(1, "Selecione pelo menos um dia da semana"),
  horarioSaida: z.string().regex(/^\d{2}:\d{2}$/, "Formato inválido (HH:MM)"),
  horarioChegada: z.string().regex(/^\d{2}:\d{2}$/, "Formato inválido (HH:MM)").optional(),
  capacidadePacotes: z.number().min(1, "Capacidade deve ser maior que 0"),
  capacidadePesoKg: z.union([
    z.number().min(0.1, "Peso deve ser maior que 0").transform(v => v.toString()),
    z.string()
  ]),
  capacidadeVolumeM3: z.union([
    z.number().min(0).transform(v => v.toString()),
    z.string()
  ]).optional(),
  raioColetaKm: z.union([
    z.number().min(0).transform(v => v.toString()),
    z.string()
  ]).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEntregadorRota = z.infer<typeof insertEntregadorRotaSchema>;

export type EntregadorCapacidadeDiaria = typeof entregadorCapacidadeDiaria.$inferSelect;
export const insertEntregadorCapacidadeDiariaSchema = createInsertSchema(entregadorCapacidadeDiaria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEntregadorCapacidadeDiaria = z.infer<typeof insertEntregadorCapacidadeDiariaSchema>;

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = z.infer<typeof insertDriverSchema>;

export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;

export type RequestPlace = typeof requestPlaces.$inferSelect;
export type RequestBill = typeof requestBills.$inferSelect;
export type CancellationReason = typeof cancellationReasons.$inferSelect;
export type FavouriteLocation = typeof favouriteLocations.$inferSelect;
export type RequestRating = typeof requestRatings.$inferSelect;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export type CompanyCancellationType = typeof companyCancellationTypes.$inferSelect;
export type InsertCompanyCancellationType = z.infer<typeof insertCompanyCancellationTypeSchema>;

export const insertCommissionTierSchema = createInsertSchema(commissionTiers, {
  minDeliveries: z.number().int().min(0, "Mínimo de entregas deve ser >= 0"),
  maxDeliveries: z.number().int().min(1, "Máximo de entregas deve ser >= 1").nullable().optional(),
  commissionPercentage: z.union([z.string(), z.number()]).transform(val => String(val)),
  active: z.boolean().default(true),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CommissionTier = typeof commissionTiers.$inferSelect;
export type InsertCommissionTier = z.infer<typeof insertCommissionTierSchema>;

// ========================================
// PROMOTIONS (Complete e Ganhe)
// ========================================
export const promotions = pgTable("promotions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull().default("complete_and_win"), // complete_and_win | top_performer
  name: varchar("name", { length: 255 }).notNull(),
  serviceLocationId: varchar("service_location_id").references(() => serviceLocations.id), // Cidade onde a promoção é válida
  validDates: text("valid_dates").notNull(), // Array de datas específicas: "2025-11-11,2025-11-12,2025-11-15"
  rule: text("rule").notNull(), // Descrição da regra da promoção
  deliveryQuantity: integer("delivery_quantity"), // Para complete_and_win: meta de entregas; Para top_performer: não usado
  prize: text("prize"), // Prêmio para top_performer
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPromotionSchema = createInsertSchema(promotions, {
  type: z.enum(["complete_and_win", "top_performer"]).default("complete_and_win"),
  name: z.string().min(1, "Nome da promoção é obrigatório"),
  serviceLocationId: z.string().min(1, "Selecione a cidade onde a promoção é válida"),
  validDates: z.string().min(1, "Selecione pelo menos uma data"),
  rule: z.string().min(1, "Descrição da regra é obrigatória"),
  deliveryQuantity: z.number().int().min(1, "Quantidade deve ser maior que 0").nullable().optional(),
  prize: z.string().nullable().optional(),
  active: z.boolean().default(true),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;

// ========================================
// PROMOTION PROGRESS (Progresso das Promoções)
// ========================================
export const promotionProgress = pgTable("promotion_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promotionId: varchar("promotion_id").notNull().references(() => promotions.id, { onDelete: "cascade" }),
  driverId: varchar("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  deliveryCount: integer("delivery_count").notNull().default(0),
  goalReached: boolean("goal_reached").notNull().default(false),
  goalReachedAt: timestamp("goal_reached_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPromotionProgressSchema = createInsertSchema(promotionProgress, {
  promotionId: z.string().min(1, "Promoção é obrigatória"),
  driverId: z.string().min(1, "Motorista é obrigatório"),
  deliveryCount: z.number().int().min(0).default(0),
  goalReached: z.boolean().default(false),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  goalReachedAt: true,
});

export type PromotionProgress = typeof promotionProgress.$inferSelect;
export type InsertPromotionProgress = z.infer<typeof insertPromotionProgressSchema>;

// Company Driver Ratings
export const insertCompanyDriverRatingSchema = createInsertSchema(companyDriverRatings, {
  rating: z.number().int().min(1, "Avaliação deve ser entre 1 e 5").max(5, "Avaliação deve ser entre 1 e 5"),
  comment: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type CompanyDriverRating = typeof companyDriverRatings.$inferSelect;
export type InsertCompanyDriverRating = z.infer<typeof insertCompanyDriverRatingSchema>;

// Driver Company Ratings
export const insertDriverCompanyRatingSchema = createInsertSchema(driverCompanyRatings, {
  rating: z.number().int().min(1, "Avaliação deve ser entre 1 e 5").max(5, "Avaliação deve ser entre 1 e 5"),
}).omit({
  id: true,
  createdAt: true,
});

export type DriverCompanyRating = typeof driverCompanyRatings.$inferSelect;
export type InsertDriverCompanyRating = z.infer<typeof insertDriverCompanyRatingSchema>;

// Delivery Stops
export const insertDeliveryStopSchema = createInsertSchema(deliveryStops, {
  stopOrder: z.number().int().min(1, "Ordem deve ser maior que 0"),
  stopType: z.enum(["pickup", "delivery"]).default("delivery"),
  address: z.string().min(1, "Endereço é obrigatório"),
  lat: z.union([z.string(), z.number()]).transform(val => String(val)),
  lng: z.union([z.string(), z.number()]).transform(val => String(val)),
  status: z.enum(["pending", "arrived", "completed", "skipped"]).default("pending"),
  customerName: z.string().optional(),
  customerWhatsapp: z.string().optional(),
  deliveryReference: z.string().optional(),
  notes: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DeliveryStop = typeof deliveryStops.$inferSelect;
export type InsertDeliveryStop = z.infer<typeof insertDeliveryStopSchema>;

// ========================================
// PUSH NOTIFICATIONS (Notificações Push)
// ========================================
export const pushNotifications = pgTable("push_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Informações da notificação
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  data: text("data"), // JSON string com dados adicionais

  // Destinatário(s)
  targetType: varchar("target_type", { length: 20 }).notNull(), // 'driver', 'city'
  targetId: varchar("target_id"), // ID do motorista específico
  targetCityId: varchar("target_city_id").references(() => serviceLocations.id), // ID da cidade

  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, sent, failed
  errorMessage: text("error_message"),

  // Contadores
  totalRecipients: integer("total_recipients").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),

  // Admin que enviou
  sentBy: varchar("sent_by").references(() => users.id),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
});

export const insertPushNotificationSchema = createInsertSchema(pushNotifications, {
  title: z.string().min(1, "Título é obrigatório"),
  body: z.string().min(1, "Mensagem é obrigatória"),
  data: z.string().optional(),
  targetType: z.enum(["driver", "city"]),
  targetId: z.string().optional(),
  targetCityId: z.string().optional(),
  status: z.enum(["pending", "sent", "failed"]).default("pending"),
  errorMessage: z.string().optional(),
  totalRecipients: z.number().int().default(0),
  successCount: z.number().int().default(0),
  failureCount: z.number().int().default(0),
}).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export type PushNotification = typeof pushNotifications.$inferSelect;
export type InsertPushNotification = z.infer<typeof insertPushNotificationSchema>;

// ========================================
// FAQ (Perguntas Frequentes)
// ========================================
export const faqs = pgTable("faqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Conteúdo
  question: text("question").notNull(),
  answer: text("answer").notNull(),

  // Categoria
  category: varchar("category", { length: 100 }).notNull(),

  // Target - Para quem é direcionado
  target: varchar("target", { length: 20 }).notNull(), // 'driver' (entregador) ou 'company' (empresa)

  // Ordem de exibição
  displayOrder: integer("display_order").default(0),

  // Status
  active: boolean("active").notNull().default(true),

  // Rastreamento
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFaqSchema = createInsertSchema(faqs, {
  question: z.string().min(1, "Pergunta é obrigatória"),
  answer: z.string().min(1, "Resposta é obrigatória"),
  category: z.string().min(1, "Categoria é obrigatória"),
  target: z.enum(["driver", "company"], {
    required_error: "Selecione o público alvo",
    invalid_type_error: "Público alvo inválido"
  }),
  displayOrder: z.number().int().optional(),
  active: z.boolean().default(true),
}).omit({
  id: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
});

export type Faq = typeof faqs.$inferSelect;
export type InsertFaq = z.infer<typeof insertFaqSchema>;

// ========================================
// REFERRAL SETTINGS (Configurações de Indicação)
// ========================================
export const referralSettings = pgTable("referral_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Configurações para Motoristas
  minimumDeliveries: integer("minimum_deliveries").notNull().default(10), // Mínimo de corridas para ganhar comissão
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }).notNull().default("50.00"), // Valor da comissão
  enabled: boolean("enabled").notNull().default(true), // Sistema habilitado ou não

  // Configurações para Empresas
  companyMinimumDeliveries: integer("company_minimum_deliveries").notNull().default(20), // Mínimo de entregas para empresa ganhar comissão
  companyCommissionAmount: numeric("company_commission_amount", { precision: 10, scale: 2 }).notNull().default("100.00"), // Valor da comissão por empresa

  // Rastreamento
  updatedBy: varchar("updated_by").references(() => users.id),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReferralSettingsSchema = createInsertSchema(referralSettings, {
  minimumDeliveries: z.number().int().min(1, "Mínimo de entregas deve ser maior que 0"),
  commissionAmount: z.union([z.string(), z.number()]).transform(val => String(val)),
  enabled: z.boolean().default(true),
  companyMinimumDeliveries: z.number().int().min(1, "Mínimo de entregas da empresa deve ser maior que 0"),
  companyCommissionAmount: z.union([z.string(), z.number()]).transform(val => String(val)),
}).omit({
  id: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
});

export type ReferralSettings = typeof referralSettings.$inferSelect;
export type InsertReferralSettings = z.infer<typeof insertReferralSettingsSchema>;

// ========================================
// REFERRAL COMMISSIONS (Comissões de Indicação)
// ========================================
export const referralCommissions = pgTable("referral_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Relacionamentos
  referrerDriverId: varchar("referrer_driver_id").notNull().references(() => drivers.id), // Quem indicou
  referredDriverId: varchar("referred_driver_id").notNull().references(() => drivers.id), // Quem foi indicado

  // Detalhes da Comissão
  requiredDeliveries: integer("required_deliveries").notNull(), // Meta de entregas na hora da indicação
  completedDeliveries: integer("completed_deliveries").notNull().default(0), // Entregas completadas
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }).notNull(), // Valor da comissão

  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, qualified, paid
  qualifiedAt: timestamp("qualified_at"), // Quando atingiu a meta
  paidAt: timestamp("paid_at"), // Quando foi paga

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReferralCommissionSchema = createInsertSchema(referralCommissions, {
  requiredDeliveries: z.number().int().min(1),
  completedDeliveries: z.number().int().min(0),
  commissionAmount: z.union([z.string(), z.number()]).transform(val => String(val)),
  status: z.enum(["pending", "qualified", "paid"]).default("pending"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ReferralCommission = typeof referralCommissions.$inferSelect;
export type InsertReferralCommission = z.infer<typeof insertReferralCommissionSchema>;

// ========================================
// DRIVER REFERRALS (Indicações do Motorista)
// ========================================
export const driverReferrals = pgTable("driver_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Relacionamentos
  referrerDriverId: varchar("referrer_driver_id").notNull().references(() => drivers.id), // Quem indicou
  referredDriverId: varchar("referred_driver_id").references(() => drivers.id), // Quem foi indicado (null até cadastro)

  // Informações do Indicado
  referredName: varchar("referred_name", { length: 255 }), // Nome do indicado (antes do cadastro)
  referredPhone: varchar("referred_phone", { length: 20 }), // Telefone do indicado
  referralCode: varchar("referral_code", { length: 50 }), // Código usado na indicação

  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, registered, active, cancelled
  registeredAt: timestamp("registered_at"), // Quando o indicado se cadastrou

  // Entregas e Comissão
  deliveriesCompleted: integer("deliveries_completed").notNull().default(0),
  commissionEarned: numeric("commission_earned", { precision: 10, scale: 2 }).default("0"),
  commissionPaid: boolean("commission_paid").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDriverReferralSchema = createInsertSchema(driverReferrals, {
  referredName: z.string().optional(),
  referredPhone: z.string().optional(),
  referralCode: z.string().optional(),
  status: z.enum(["pending", "registered", "active", "cancelled"]).default("pending"),
  deliveriesCompleted: z.number().int().min(0).default(0),
  commissionEarned: z.union([z.string(), z.number()]).transform(val => String(val)),
  commissionPaid: z.boolean().default(false),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DriverReferral = typeof driverReferrals.$inferSelect;
export type InsertDriverReferral = z.infer<typeof insertDriverReferralSchema>;

// ========================================
// COMPANY REFERRALS (Indicações de Empresas pelo Motorista)
// ========================================
export const companyReferrals = pgTable("company_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Relacionamentos
  referrerDriverId: varchar("referrer_driver_id").notNull().references(() => drivers.id), // Motorista que indicou
  companyId: varchar("company_id").notNull().references(() => companies.id), // Empresa indicada

  // Detalhes da Comissão
  requiredDeliveries: integer("required_deliveries").notNull(), // Meta de entregas na hora da indicação
  completedDeliveries: integer("completed_deliveries").notNull().default(0), // Entregas completadas pela empresa
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }).notNull(), // Valor da comissão

  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, qualified, paid
  qualifiedAt: timestamp("qualified_at"), // Quando atingiu a meta
  paidAt: timestamp("paid_at"), // Quando foi paga

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompanyReferralSchema = createInsertSchema(companyReferrals, {
  referrerDriverId: z.string().min(1, "Motorista indicador é obrigatório"),
  companyId: z.string().min(1, "Empresa é obrigatória"),
  requiredDeliveries: z.number().int().min(1, "Meta de entregas deve ser maior que 0"),
  completedDeliveries: z.number().int().min(0).default(0),
  commissionAmount: z.union([z.string(), z.number()]).transform(val => String(val)),
  status: z.enum(["pending", "qualified", "paid"]).default("pending"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CompanyReferral = typeof companyReferrals.$inferSelect;
export type InsertCompanyReferral = z.infer<typeof insertCompanyReferralSchema>;

// ========================================
// TICKET SUBJECTS (Assuntos de Tickets)
// ========================================
export const ticketSubjects = pgTable("ticket_subjects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).notNull().default("#3b82f6"),
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTicketSubjectSchema = createInsertSchema(ticketSubjects, {
  name: z.string().min(1, "Nome do assunto é obrigatório"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve estar no formato hexadecimal (#RRGGBB)").default("#3b82f6"),
  active: z.boolean().default(true),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TicketSubject = typeof ticketSubjects.$inferSelect;
export type InsertTicketSubject = z.infer<typeof insertTicketSubjectSchema>;

// ========================================
// SUPPORT TICKETS (Tickets de Suporte)
// ========================================
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: varchar("ticket_number", { length: 50 }).unique().notNull(), // Número único do ticket (ex: TKT-001)

  // Entregador
  driverId: varchar("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  driverName: varchar("driver_name", { length: 255 }).notNull(),
  driverEmail: varchar("driver_email", { length: 255 }),
  driverWhatsapp: varchar("driver_whatsapp", { length: 20 }).notNull(),

  // Ticket
  subjectId: varchar("subject_id").notNull().references(() => ticketSubjects.id),
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"), // URL da imagem anexada

  // Status: open (aberto), in_progress (em andamento), resolved (resolvido), closed (fechado)
  status: varchar("status", { length: 20 }).notNull().default("open"),

  // Contadores
  repliesCount: integer("replies_count").notNull().default(0),
  unreadByDriver: boolean("unread_by_driver").notNull().default(false), // Tem mensagens não lidas pelo entregador

  // Timestamps
  lastReplyAt: timestamp("last_reply_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets, {
  driverId: z.string().min(1, "ID do entregador é obrigatório"),
  driverName: z.string().min(1, "Nome do entregador é obrigatório"),
  driverEmail: z.string().email("Email inválido").nullable().optional(),
  driverWhatsapp: z.string().min(1, "WhatsApp é obrigatório"),
  subjectId: z.string().min(1, "Assunto é obrigatório"),
  message: z.string().min(1, "Mensagem é obrigatória"),
  attachmentUrl: z.string().nullable().optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).default("open"),
  ticketNumber: z.string().optional(), // Permitir ticketNumber opcional
}).omit({
  id: true,
  repliesCount: true,
  unreadByDriver: true,
  lastReplyAt: true,
  resolvedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

// ========================================
// TICKET REPLIES (Respostas de Tickets)
// ========================================
export const ticketReplies = pgTable("ticket_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),

  // Autor da resposta
  authorType: varchar("author_type", { length: 20 }).notNull(), // 'driver' ou 'admin'
  authorId: varchar("author_id").notNull(), // ID do driver ou user (admin)
  authorName: varchar("author_name", { length: 255 }).notNull(),

  // Conteúdo
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"), // URL da imagem anexada

  // Leitura
  readByDriver: boolean("read_by_driver").notNull().default(false),
  readByAdmin: boolean("read_by_admin").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTicketReplySchema = createInsertSchema(ticketReplies, {
  ticketId: z.string().min(1, "ID do ticket é obrigatório"),
  authorType: z.enum(["driver", "admin"]),
  authorId: z.string().min(1, "ID do autor é obrigatório"),
  authorName: z.string().min(1, "Nome do autor é obrigatório"),
  message: z.string().min(1, "Mensagem é obrigatória"),
  attachmentUrl: z.string().nullable().optional(),
}).omit({
  id: true,
  readByDriver: true,
  readByAdmin: true,
  createdAt: true,
});

export type TicketReply = typeof ticketReplies.$inferSelect;
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;

// ========================================
// ENTREGAS INTERMUNICIPAIS (Pedidos de entrega entre cidades)
// ========================================
export const entregasIntermunicipais = pgTable("entregas_intermunicipais", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Referências
  empresaId: varchar("empresa_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  rotaId: varchar("rota_id").notNull().references(() => rotasIntermunicipais.id),
  precoId: varchar("preco_id").notNull().references(() => cityPrices.id),

  // Informações da entrega
  numeroPedido: varchar("numero_pedido", { length: 50 }).notNull().unique(),
  dataAgendada: varchar("data_agendada", { length: 10 }).notNull(), // DATE como VARCHAR "2025-11-20"

  // Endereços
  enderecoColetaCompleto: text("endereco_coleta_completo").notNull(),
  enderecoColetaLatitude: varchar("endereco_coleta_latitude", { length: 50 }),
  enderecoColetaLongitude: varchar("endereco_coleta_longitude", { length: 50 }),
  enderecoEntregaCompleto: text("endereco_entrega_completo").notNull(),
  enderecoEntregaLatitude: varchar("endereco_entrega_latitude", { length: 50 }),
  enderecoEntregaLongitude: varchar("endereco_entrega_longitude", { length: 50 }),

  // Destinatário
  destinatarioNome: varchar("destinatario_nome", { length: 255 }).notNull(),
  destinatarioTelefone: varchar("destinatario_telefone", { length: 20 }).notNull(),

  // Informações do pacote
  quantidadePacotes: integer("quantidade_pacotes").notNull().default(1),
  pesoTotalKg: numeric("peso_total_kg", { precision: 10, scale: 2 }),
  volumeTotalM3: numeric("volume_total_m3", { precision: 10, scale: 3 }),
  descricaoConteudo: text("descricao_conteudo"),
  observacoes: text("observacoes"),

  // Cálculo de preço (valores salvos no momento da criação)
  tarifaBase: numeric("tarifa_base", { precision: 10, scale: 2 }).notNull(),
  precoPorKm: numeric("preco_por_km", { precision: 10, scale: 2 }).notNull(),
  distanciaKm: numeric("distancia_km", { precision: 10, scale: 2 }).notNull(),
  valorParada: numeric("valor_parada", { precision: 10, scale: 2 }).default("0"),
  valorTotal: numeric("valor_total", { precision: 10, scale: 2 }).notNull(),

  // Status da entrega
  status: varchar("status", { length: 30 }).notNull().default("aguardando_motorista"),

  // Viagem associada (quando motorista aceita)
  viagemId: varchar("viagem_id").references(() => viagensIntermunicipais.id),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEntregaIntermunicipalSchema = createInsertSchema(entregasIntermunicipais, {
  empresaId: z.string().min(1, "Empresa é obrigatória"),
  rotaId: z.string().min(1, "Rota é obrigatória"),
  precoId: z.string().min(1, "Preço é obrigatório"),
  numeroPedido: z.string().min(1, "Número do pedido é obrigatório"),
  dataAgendada: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  enderecoColetaCompleto: z.string().min(1, "Endereço de coleta é obrigatório"),
  enderecoEntregaCompleto: z.string().min(1, "Endereço de entrega é obrigatório"),
  destinatarioNome: z.string().min(1, "Nome do destinatário é obrigatório"),
  destinatarioTelefone: z.string().min(1, "Telefone do destinatário é obrigatório"),
  quantidadePacotes: z.number().min(1, "Quantidade de pacotes deve ser maior que zero"),
  pesoTotalKg: z.string().min(1, "Peso total é obrigatório"),
  tarifaBase: z.string().min(1, "Tarifa base é obrigatória"),
  precoPorKm: z.string().min(1, "Preço por km é obrigatório"),
  distanciaKm: z.string().min(1, "Distância é obrigatória"),
  valorTotal: z.string().min(1, "Valor total é obrigatório"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EntregaIntermunicipal = typeof entregasIntermunicipais.$inferSelect;
export type InsertEntregaIntermunicipal = z.infer<typeof insertEntregaIntermunicipalSchema>;

// ========================================
// PARADAS DE ENTREGA INTERMUNICIPAL (Múltiplos destinos em uma entrega)
// ========================================
export const entregasIntermunicipalParadas = pgTable("entregas_intermunicipal_paradas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Referência à entrega principal
  entregaId: varchar("entrega_id").notNull().references(() => entregasIntermunicipais.id, { onDelete: "cascade" }),

  // Ordem de entrega
  ordem: integer("ordem").notNull(),

  // Endereço de entrega
  logradouro: varchar("logradouro", { length: 255 }).notNull(),
  numero: varchar("numero", { length: 20 }).notNull(),
  bairro: varchar("bairro", { length: 100 }).notNull(),
  cidade: varchar("cidade", { length: 100 }).notNull(),
  cep: varchar("cep", { length: 10 }).notNull(),
  pontoReferencia: text("ponto_referencia"),
  enderecoCompleto: text("endereco_completo").notNull(),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),

  // Destinatário
  destinatarioNome: varchar("destinatario_nome", { length: 255 }).notNull(),
  destinatarioTelefone: varchar("destinatario_telefone", { length: 20 }).notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEntregaIntermunicipalParadaSchema = createInsertSchema(entregasIntermunicipalParadas, {
  entregaId: z.string().min(1, "Entrega é obrigatória"),
  ordem: z.number().min(1, "Ordem deve ser maior que zero"),
  logradouro: z.string().min(1, "Logradouro é obrigatório"),
  numero: z.string().min(1, "Número é obrigatório"),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  cep: z.string().min(8, "CEP é obrigatório"),
  enderecoCompleto: z.string().min(1, "Endereço completo é obrigatório"),
  destinatarioNome: z.string().min(1, "Nome do destinatário é obrigatório"),
  destinatarioTelefone: z.string().min(10, "Telefone do destinatário é obrigatório"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EntregaIntermunicipalParada = typeof entregasIntermunicipalParadas.$inferSelect;
export type InsertEntregaIntermunicipalParada = z.infer<typeof insertEntregaIntermunicipalParadaSchema>;

// ========================================
// VIAGENS INTERMUNICIPAIS (Viagens dos motoristas)
// ========================================
export const viagensIntermunicipais = pgTable("viagens_intermunicipais", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Referências
  entregadorId: varchar("entregador_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  rotaId: varchar("rota_id").notNull().references(() => rotasIntermunicipais.id),
  entregadorRotaId: varchar("entregador_rota_id").notNull().references(() => entregadorRotas.id),

  // Data da viagem
  dataViagem: varchar("data_viagem", { length: 10 }).notNull(), // DATE como VARCHAR "2025-11-20"

  // Status da viagem
  status: varchar("status", { length: 30 }).notNull().default("agendada"),

  // Capacidade
  capacidadePacotesTotal: integer("capacidade_pacotes_total").notNull(),
  capacidadePesoKgTotal: numeric("capacidade_peso_kg_total", { precision: 10, scale: 2 }).notNull(),
  pacotesAceitos: integer("pacotes_aceitos").default(0),
  pesoAceitoKg: numeric("peso_aceito_kg", { precision: 10, scale: 2 }).default("0"),

  // Horários
  horarioSaidaPlanejado: varchar("horario_saida_planejado", { length: 8 }).notNull(), // TIME como VARCHAR "08:00:00"
  horarioSaidaReal: timestamp("horario_saida_real"),
  horarioChegadaPrevisto: timestamp("horario_chegada_previsto"),
  horarioChegadaReal: timestamp("horario_chegada_real"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertViagemIntermunicipalSchema = createInsertSchema(viagensIntermunicipais, {
  entregadorId: z.string().min(1, "Entregador é obrigatório"),
  rotaId: z.string().min(1, "Rota é obrigatória"),
  entregadorRotaId: z.string().min(1, "Configuração de rota do entregador é obrigatória"),
  dataViagem: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  capacidadePacotesTotal: z.number().min(1, "Capacidade de pacotes deve ser maior que zero"),
  capacidadePesoKgTotal: z.string().min(1, "Capacidade de peso é obrigatória"),
  horarioSaidaPlanejado: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, "Horário inválido"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ViagemIntermunicipal = typeof viagensIntermunicipais.$inferSelect;
export type InsertViagemIntermunicipal = z.infer<typeof insertViagemIntermunicipalSchema>;

// ========================================
// VIAGEM COLETAS (Controle de coletas nas viagens)
// ========================================
export const viagemColetas = pgTable("viagem_coletas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Referências
  viagemId: varchar("viagem_id").notNull().references(() => viagensIntermunicipais.id, { onDelete: "cascade" }),
  entregaId: varchar("entrega_id").notNull().references(() => entregasIntermunicipais.id, { onDelete: "cascade" }),

  // Informações da coleta
  enderecoColeta: text("endereco_coleta").notNull(),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),

  // Status da coleta
  status: varchar("status", { length: 30 }).notNull().default("pendente"),

  // Ordem de coleta na rota
  ordemColeta: integer("ordem_coleta").notNull(),

  // Horários
  horarioPrevisto: timestamp("horario_previsto"),
  horarioChegada: timestamp("horario_chegada"),
  horarioColeta: timestamp("horario_coleta"),

  // Informações adicionais
  observacoes: text("observacoes"),
  motivoFalha: text("motivo_falha"),

  // Foto do pacote coletado
  fotoComprovanteUrl: text("foto_comprovante_url"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertViagemColetaSchema = createInsertSchema(viagemColetas, {
  viagemId: z.string().min(1, "Viagem é obrigatória"),
  entregaId: z.string().min(1, "Entrega é obrigatória"),
  enderecoColeta: z.string().min(1, "Endereço de coleta é obrigatório"),
  ordemColeta: z.number().min(1, "Ordem de coleta deve ser maior que zero"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ViagemColeta = typeof viagemColetas.$inferSelect;
export type InsertViagemColeta = z.infer<typeof insertViagemColetaSchema>;

// ========================================
// VIAGEM ENTREGAS (Controle de entregas nas viagens)
// ========================================
export const viagemEntregas = pgTable("viagem_entregas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Referências
  viagemId: varchar("viagem_id").notNull().references(() => viagensIntermunicipais.id, { onDelete: "cascade" }),
  entregaId: varchar("entrega_id").notNull().references(() => entregasIntermunicipais.id, { onDelete: "cascade" }),
  coletaId: varchar("coleta_id").notNull().references(() => viagemColetas.id, { onDelete: "cascade" }),
  paradaId: varchar("parada_id").references(() => entregasIntermunicipalParadas.id, { onDelete: "cascade" }),

  // Informações da entrega
  enderecoEntrega: text("endereco_entrega").notNull(),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  destinatarioNome: varchar("destinatario_nome", { length: 255 }).notNull(),
  destinatarioTelefone: varchar("destinatario_telefone", { length: 20 }).notNull(),

  // Status da entrega
  status: varchar("status", { length: 30 }).notNull().default("pendente"),

  // Ordem de entrega na rota
  ordemEntrega: integer("ordem_entrega").notNull(),

  // Horários
  horarioPrevisto: timestamp("horario_previsto"),
  horarioChegada: timestamp("horario_chegada"),
  horarioEntrega: timestamp("horario_entrega"),

  // Informações da entrega
  nomeRecebedor: varchar("nome_recebedor", { length: 255 }),
  cpfRecebedor: varchar("cpf_recebedor", { length: 14 }),
  observacoes: text("observacoes"),
  motivoFalha: text("motivo_falha"),

  // Comprovantes
  fotoComprovanteUrl: text("foto_comprovante_url"),
  assinaturaUrl: text("assinatura_url"),

  // Avaliação (opcional)
  avaliacaoEstrelas: integer("avaliacao_estrelas"),
  avaliacaoComentario: text("avaliacao_comentario"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertViagemEntregaSchema = createInsertSchema(viagemEntregas, {
  viagemId: z.string().min(1, "Viagem é obrigatória"),
  entregaId: z.string().min(1, "Entrega é obrigatória"),
  coletaId: z.string().min(1, "Coleta é obrigatória"),
  enderecoEntrega: z.string().min(1, "Endereço de entrega é obrigatório"),
  destinatarioNome: z.string().min(1, "Nome do destinatário é obrigatório"),
  destinatarioTelefone: z.string().min(1, "Telefone do destinatário é obrigatório"),
  ordemEntrega: z.number().min(1, "Ordem de entrega deve ser maior que zero"),
  avaliacaoEstrelas: z.number().min(1).max(5).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ViagemEntrega = typeof viagemEntregas.$inferSelect;
export type InsertViagemEntrega = z.infer<typeof insertViagemEntregaSchema>;

// ========================================
// SESSION TABLE (connect-pg-simple)
// ========================================
// Tabela de sessões criada pelo connect-pg-simple
// NÃO modificar - gerenciada automaticamente pelo express-session
export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// ========================================
// NPS SURVEYS (Pesquisas de Satisfação NPS)
// ========================================
export const npsSurveys = pgTable("nps_surveys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Informações da pesquisa
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),

  // Link público único para compartilhar
  publicSlug: varchar("public_slug", { length: 100 }).notNull().unique(),

  // Status
  active: boolean("active").notNull().default(true),

  // Datas
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNpsSurveySchema = createInsertSchema(npsSurveys, {
  title: z.string().min(1, "Título é obrigatório").max(255),
  description: z.string().optional(),
  publicSlug: z.string().min(1, "Slug público é obrigatório").max(100),
  active: z.boolean().default(true),
  startsAt: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endsAt: z.string().optional().transform(val => val ? new Date(val) : undefined),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type NpsSurvey = typeof npsSurveys.$inferSelect;
export type InsertNpsSurvey = z.infer<typeof insertNpsSurveySchema>;

// ========================================
// NPS SURVEY ITEMS (Itens/Perguntas da Pesquisa)
// ========================================
export const npsSurveyItems = pgTable("nps_survey_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Relacionamento com a pesquisa
  surveyId: varchar("survey_id").notNull().references(() => npsSurveys.id, { onDelete: "cascade" }),

  // Configurações do item
  label: varchar("label", { length: 255 }).notNull(), // Texto da pergunta
  type: varchar("type", { length: 20 }).notNull().default("nps"), // nps (0-10), text (livre)

  // Ordem de exibição
  displayOrder: integer("display_order").notNull().default(0),

  // Se é obrigatório
  required: boolean("required").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNpsSurveyItemSchema = createInsertSchema(npsSurveyItems, {
  surveyId: z.string().min(1, "Pesquisa é obrigatória"),
  label: z.string().min(1, "Texto da pergunta é obrigatório").max(255),
  type: z.enum(["nps", "text"]).default("nps"),
  displayOrder: z.number().int().min(0).default(0),
  required: z.boolean().default(true),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type NpsSurveyItem = typeof npsSurveyItems.$inferSelect;
export type InsertNpsSurveyItem = z.infer<typeof insertNpsSurveyItemSchema>;

// ========================================
// NPS RESPONSES (Respostas das Pesquisas)
// ========================================
export const npsResponses = pgTable("nps_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Relacionamento com a pesquisa
  surveyId: varchar("survey_id").notNull().references(() => npsSurveys.id, { onDelete: "cascade" }),

  // Identificação opcional do respondente
  respondentName: varchar("respondent_name", { length: 255 }),
  respondentEmail: varchar("respondent_email", { length: 255 }),
  respondentPhone: varchar("respondent_phone", { length: 20 }),

  // IP e User Agent para evitar respostas duplicadas
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNpsResponseSchema = createInsertSchema(npsResponses, {
  surveyId: z.string().min(1, "Pesquisa é obrigatória"),
  respondentName: z.string().optional(),
  respondentEmail: z.string().email().optional().or(z.literal("")),
  respondentPhone: z.string().optional(),
}).omit({
  id: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
});

export type NpsResponse = typeof npsResponses.$inferSelect;
export type InsertNpsResponse = z.infer<typeof insertNpsResponseSchema>;

// ========================================
// NPS RESPONSE ITEMS (Respostas de cada item)
// ========================================
export const npsResponseItems = pgTable("nps_response_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Relacionamentos
  responseId: varchar("response_id").notNull().references(() => npsResponses.id, { onDelete: "cascade" }),
  surveyItemId: varchar("survey_item_id").notNull().references(() => npsSurveyItems.id, { onDelete: "cascade" }),

  // Valores das respostas
  scoreValue: integer("score_value"), // Para perguntas NPS (0-10)
  textValue: text("text_value"), // Para perguntas de texto livre

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNpsResponseItemSchema = createInsertSchema(npsResponseItems, {
  responseId: z.string().min(1, "Resposta é obrigatória"),
  surveyItemId: z.string().min(1, "Item da pesquisa é obrigatório"),
  scoreValue: z.number().int().min(0).max(10).optional(),
  textValue: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type NpsResponseItem = typeof npsResponseItems.$inferSelect;
export type InsertNpsResponseItem = z.infer<typeof insertNpsResponseItemSchema>;

// ========================================
// WALLETS (Carteiras Virtuais)
// ========================================
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Relacionamento - pode ser empresa, entregador ou plataforma
  // Para plataforma: usa ID fixo '00000000-0000-0000-0000-000000000001'
  ownerId: varchar("owner_id").notNull(),
  ownerType: varchar("owner_type", { length: 20 }).notNull(), // 'company', 'driver', 'platform'

  // Saldos
  availableBalance: numeric("available_balance", { precision: 15, scale: 2 }).notNull().default("0.00"),
  blockedBalance: numeric("blocked_balance", { precision: 15, scale: 2 }).notNull().default("0.00"), // Saldo em processamento (ex: saque pendente)

  // Controle
  status: varchar("status", { length: 20 }).notNull().default("active"), // 'active', 'blocked', 'suspended'

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWalletSchema = createInsertSchema(wallets, {
  ownerId: z.string().min(1, "ID do proprietário é obrigatório"),
  ownerType: z.enum(["company", "driver", "platform"]),
  availableBalance: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  blockedBalance: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  status: z.enum(["active", "blocked", "suspended"]).default("active"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;

// ========================================
// WALLET TRANSACTIONS (Transações da Carteira)
// ========================================
export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Wallet relacionada
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),

  // Tipo de transação
  type: varchar("type", { length: 30 }).notNull(),
  // Tipos: 'recharge' (recarga), 'delivery_debit' (débito entrega), 'delivery_credit' (crédito entrega),
  //        'commission' (comissão plataforma), 'withdrawal' (saque), 'refund' (estorno),
  //        'manual_adjustment' (ajuste manual), 'weekly_charge' (cobrança pós-pago)

  // Status
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  // Status: 'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'

  // Valores
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  previousBalance: numeric("previous_balance", { precision: 15, scale: 2 }).notNull(),
  newBalance: numeric("new_balance", { precision: 15, scale: 2 }).notNull(),

  // Referências (opcional - depende do tipo de transação)
  requestId: varchar("request_id").references(() => requests.id), // Para entregas rápidas
  intermunicipalDeliveryId: varchar("intermunicipal_delivery_id"), // Para entregas intermunicipais
  chargeId: varchar("charge_id"), // Para recargas/cobranças
  originalTransactionId: varchar("original_transaction_id"), // Para estornos

  // Detalhes
  description: text("description"),
  metadata: json("metadata").$type<Record<string, unknown>>(),

  // Auditoria
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions, {
  walletId: z.string().min(1, "Wallet é obrigatória"),
  type: z.enum([
    "recharge", "delivery_debit", "delivery_credit", "commission",
    "withdrawal", "refund", "manual_adjustment", "weekly_charge"
  ]),
  status: z.enum(["pending", "processing", "completed", "failed", "cancelled", "refunded"]).default("pending"),
  amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  previousBalance: z.union([z.string(), z.number()]).transform(val => String(val)),
  newBalance: z.union([z.string(), z.number()]).transform(val => String(val)),
}).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;

// ========================================
// CHARGES (Cobranças - PIX/Boleto via Asaas)
// ========================================
export const charges = pgTable("charges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Relacionamentos
  companyId: varchar("company_id").notNull().references(() => companies.id),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),

  // Dados Asaas
  asaasId: varchar("asaas_id", { length: 100 }), // ID da cobrança no Asaas
  asaasCustomerId: varchar("asaas_customer_id", { length: 100 }), // ID do cliente no Asaas

  // Tipo e forma de pagamento
  chargeType: varchar("charge_type", { length: 20 }).notNull(), // 'recharge' (recarga), 'weekly' (pós-pago semanal)
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(), // 'pix', 'boleto'

  // Valores
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  netAmount: numeric("net_amount", { precision: 15, scale: 2 }), // Valor após taxas do Asaas

  // Datas
  dueDate: timestamp("due_date").notNull(),
  paidAt: timestamp("paid_at"),

  // Status
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  // Status: 'pending', 'waiting_payment', 'confirmed', 'overdue', 'cancelled', 'refunded'

  // Dados do pagamento PIX
  pixCopyPaste: text("pix_copy_paste"), // Código copia e cola
  pixQrCodeUrl: text("pix_qrcode_url"), // QR Code em base64

  // Dados do pagamento Boleto
  boletoUrl: text("boleto_url"),
  boletoBarcode: varchar("boleto_barcode", { length: 100 }),
  boletoDigitableLine: varchar("boleto_digitable_line", { length: 100 }),

  // Período (para pós-pago semanal)
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),

  // Metadata
  metadata: json("metadata").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChargeSchema = createInsertSchema(charges, {
  companyId: z.string().min(1, "Empresa é obrigatória"),
  walletId: z.string().min(1, "Wallet é obrigatória"),
  chargeType: z.enum(["recharge", "weekly"]),
  paymentMethod: z.enum(["pix", "boleto"]),
  amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  status: z.enum(["pending", "waiting_payment", "confirmed", "overdue", "cancelled", "refunded"]).default("pending"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Charge = typeof charges.$inferSelect;
export type InsertCharge = z.infer<typeof insertChargeSchema>;

// ========================================
// DELIVERY FINANCIALS (Vínculo Entregas com Financeiro - Split)
// ========================================
export const deliveryFinancials = pgTable("delivery_financials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Referências da entrega (um ou outro)
  requestId: varchar("request_id").references(() => requests.id), // Para entregas rápidas
  intermunicipalDeliveryId: varchar("intermunicipal_delivery_id"), // Para entregas intermunicipais

  // Participantes
  companyId: varchar("company_id").notNull().references(() => companies.id),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),

  // Valores do split
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(), // Valor total cobrado da empresa
  driverAmount: numeric("driver_amount", { precision: 15, scale: 2 }).notNull(), // Parte do entregador
  commissionAmount: numeric("commission_amount", { precision: 15, scale: 2 }).notNull(), // Parte da plataforma
  commissionPercentage: numeric("commission_percentage", { precision: 5, scale: 2 }).notNull(), // % da comissão aplicada

  // Transações relacionadas (preenchidas após processamento)
  companyDebitTransactionId: varchar("company_debit_transaction_id").references(() => walletTransactions.id),
  driverCreditTransactionId: varchar("driver_credit_transaction_id").references(() => walletTransactions.id),
  commissionTransactionId: varchar("commission_transaction_id").references(() => walletTransactions.id),

  // Cobrança (para pós-pago)
  chargeId: varchar("charge_id").references(() => charges.id),

  // Status
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDeliveryFinancialSchema = createInsertSchema(deliveryFinancials, {
  companyId: z.string().min(1, "Empresa é obrigatória"),
  driverId: z.string().min(1, "Entregador é obrigatório"),
  totalAmount: z.union([z.string(), z.number()]).transform(val => String(val)),
  driverAmount: z.union([z.string(), z.number()]).transform(val => String(val)),
  commissionAmount: z.union([z.string(), z.number()]).transform(val => String(val)),
  commissionPercentage: z.union([z.string(), z.number()]).transform(val => String(val)),
}).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type DeliveryFinancial = typeof deliveryFinancials.$inferSelect;
export type InsertDeliveryFinancial = z.infer<typeof insertDeliveryFinancialSchema>;

// ========================================
// WITHDRAWALS (Saques dos Entregadores)
// ========================================
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Entregador
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id),

  // Valores
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  fee: numeric("fee", { precision: 15, scale: 2 }).notNull().default("0.00"), // Taxa de saque se houver
  netAmount: numeric("net_amount", { precision: 15, scale: 2 }).notNull(), // Valor - taxa

  // Dados PIX (chave do entregador)
  pixKeyType: varchar("pix_key_type", { length: 20 }).notNull(), // 'cpf', 'cnpj', 'email', 'phone', 'evp'
  pixKey: varchar("pix_key", { length: 100 }).notNull(),

  // Asaas
  asaasTransferId: varchar("asaas_transfer_id", { length: 100 }),

  // Status
  status: varchar("status", { length: 20 }).notNull().default("requested"),
  // Status: 'requested', 'processing', 'completed', 'failed', 'cancelled'

  failureReason: text("failure_reason"),

  // Transação relacionada
  transactionId: varchar("transaction_id").references(() => walletTransactions.id),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals, {
  driverId: z.string().min(1, "Entregador é obrigatório"),
  walletId: z.string().min(1, "Wallet é obrigatória"),
  amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  fee: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  netAmount: z.union([z.string(), z.number()]).transform(val => String(val)),
  pixKeyType: z.enum(["cpf", "cnpj", "email", "phone", "evp"]),
  pixKey: z.string().min(1, "Chave PIX é obrigatória"),
  status: z.enum(["requested", "processing", "completed", "failed", "cancelled"]).default("requested"),
}).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;

// ========================================
// WEBHOOKS LOG (Log de Webhooks do Asaas)
// ========================================
export const webhooksLog = pgTable("webhooks_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Identificação
  provider: varchar("provider", { length: 50 }).notNull().default("asaas"),
  eventType: varchar("event_type", { length: 100 }).notNull(),

  // Dados recebidos
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  headers: json("headers").$type<Record<string, unknown>>(),

  // Processamento
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),

  // Referências (preenchidas após processamento)
  chargeId: varchar("charge_id").references(() => charges.id),
  withdrawalId: varchar("withdrawal_id").references(() => withdrawals.id),

  receivedAt: timestamp("received_at").notNull().defaultNow(),
});

export const insertWebhookLogSchema = createInsertSchema(webhooksLog, {
  provider: z.string().default("asaas"),
  eventType: z.string().min(1, "Tipo de evento é obrigatório"),
  payload: z.record(z.unknown()),
}).omit({
  id: true,
  receivedAt: true,
  processedAt: true,
});

export type WebhookLog = typeof webhooksLog.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

// ========================================
// APP VERSION (Controle de Versão do App)
// ========================================
export const appVersion = pgTable("app_version", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Versão mínima obrigatória (formato: 1.0.0)
  minVersion: varchar("min_version", { length: 20 }).notNull(),

  // Versão atual/recomendada (formato: 1.0.0)
  currentVersion: varchar("current_version", { length: 20 }).notNull(),

  // URL da loja para atualização
  storeUrl: varchar("store_url", { length: 500 }),

  // Mensagem a ser exibida quando atualização é obrigatória
  updateMessage: text("update_message").default("Uma nova versão do aplicativo está disponível. Por favor, atualize para continuar usando."),

  // Se a atualização é obrigatória
  forceUpdate: boolean("force_update").notNull().default(true),

  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAppVersionSchema = createInsertSchema(appVersion, {
  minVersion: z.string().min(1, "Versão mínima é obrigatória").regex(/^\d+\.\d+\.\d+$/, "Formato inválido. Use: X.X.X"),
  currentVersion: z.string().min(1, "Versão atual é obrigatória").regex(/^\d+\.\d+\.\d+$/, "Formato inválido. Use: X.X.X"),
  storeUrl: z.string().url("URL inválida").optional().nullable(),
  updateMessage: z.string().optional(),
  forceUpdate: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAppVersionSchema = insertAppVersionSchema.partial();

export type AppVersion = typeof appVersion.$inferSelect;
export type InsertAppVersion = z.infer<typeof insertAppVersionSchema>;
export type UpdateAppVersion = z.infer<typeof updateAppVersionSchema>;

// ========================================
// ALLOCATION TIME SLOTS (Faixas de Horário para Alocação de Entregadores)
// ========================================
export const allocationTimeSlots = pgTable("allocation_time_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  name: varchar("name", { length: 100 }).notNull(), // Ex: "Almoço", "Noite"
  startTime: varchar("start_time", { length: 8 }).notNull(), // "10:30:00"
  endTime: varchar("end_time", { length: 8 }).notNull(), // "14:00:00"

  // Preço base da alocação para esse período
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),

  // Cidade onde esta faixa é válida (opcional - null = todas)
  serviceLocationId: varchar("service_location_id").references(() => serviceLocations.id),

  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAllocationTimeSlotSchema = createInsertSchema(allocationTimeSlots, {
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Formato inválido (HH:MM ou HH:MM:SS)"),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Formato inválido (HH:MM ou HH:MM:SS)"),
  basePrice: z.union([z.string(), z.number()]).transform(val => String(val)),
  serviceLocationId: z.string().optional().nullable(),
  active: z.boolean().default(true),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAllocationTimeSlotSchema = insertAllocationTimeSlotSchema.partial();

export type AllocationTimeSlot = typeof allocationTimeSlots.$inferSelect;
export type InsertAllocationTimeSlot = z.infer<typeof insertAllocationTimeSlotSchema>;
export type UpdateAllocationTimeSlot = z.infer<typeof updateAllocationTimeSlotSchema>;

// ========================================
// ALLOCATIONS (Alocações de Entregadores)
// ========================================
export const allocations = pgTable("allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Referências
  companyId: varchar("company_id").notNull().references(() => companies.id),
  timeSlotId: varchar("time_slot_id").notNull().references(() => allocationTimeSlots.id),
  driverId: varchar("driver_id").references(() => drivers.id), // null até aceite

  // Data e horários efetivos
  allocationDate: varchar("allocation_date", { length: 10 }).notNull(), // "2025-01-29"
  startTime: varchar("start_time", { length: 8 }).notNull(), // "10:30:00"
  endTime: varchar("end_time", { length: 8 }).notNull(), // "14:00:00"

  // Status: pending, accepted, in_progress, completed, cancelled, expired, release_requested, released_early
  status: varchar("status", { length: 30 }).notNull().default("pending"),

  // Valores
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(), // Valor total da alocação
  driverAmount: numeric("driver_amount", { precision: 10, scale: 2 }), // Parte do entregador (calculado)
  commissionAmount: numeric("commission_amount", { precision: 10, scale: 2 }), // Comissão plataforma
  commissionPercentage: numeric("commission_percentage", { precision: 5, scale: 2 }), // % aplicado

  // Para liberação antecipada - valor proporcional
  workedMinutes: integer("worked_minutes"), // Minutos trabalhados até a liberação
  proportionalAmount: numeric("proportional_amount", { precision: 10, scale: 2 }), // Valor proporcional

  // Timestamps de controle
  acceptedAt: timestamp("accepted_at"),
  startedAt: timestamp("started_at"), // Quando começou efetivamente
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  releaseRequestedAt: timestamp("release_requested_at"),
  releasedAt: timestamp("released_at"),

  // Motivos
  cancelReason: text("cancel_reason"),
  releaseReason: text("release_reason"),

  // Referências financeiras
  walletTransactionId: varchar("wallet_transaction_id"),
  chargeId: varchar("charge_id"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAllocationSchema = createInsertSchema(allocations, {
  companyId: z.string().min(1, "Empresa é obrigatória"),
  timeSlotId: z.string().min(1, "Faixa de horário é obrigatória"),
  allocationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de data inválido (YYYY-MM-DD)"),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Formato inválido"),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Formato inválido"),
  totalAmount: z.union([z.string(), z.number()]).transform(val => String(val)),
  status: z.enum([
    "pending", "accepted", "in_progress", "completed",
    "cancelled", "expired", "release_requested", "released_early"
  ]).default("pending"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAllocationSchema = insertAllocationSchema.partial();

export type Allocation = typeof allocations.$inferSelect;
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type UpdateAllocation = z.infer<typeof updateAllocationSchema>;

// Schema para criar alocação via API (usado pela empresa)
export const createAllocationRequestSchema = z.object({
  timeSlotId: z.string().min(1, "Faixa de horário é obrigatória"),
  quantity: z.number().int().min(1, "Quantidade mínima é 1").max(10, "Quantidade máxima é 10"),
});

export type CreateAllocationRequest = z.infer<typeof createAllocationRequestSchema>;

// ========================================
// ALLOCATION ALERTS (Alertas de Alocação para Motoristas)
// ========================================
export const allocationAlerts = pgTable("allocation_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  allocationId: varchar("allocation_id").notNull().references(() => allocations.id, { onDelete: "cascade" }),
  driverId: varchar("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),

  // Status: notified, accepted, rejected, expired
  status: varchar("status", { length: 20 }).notNull().default("notified"),

  // Timestamps
  notifiedAt: timestamp("notified_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  expiresAt: timestamp("expires_at").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAllocationAlertSchema = createInsertSchema(allocationAlerts, {
  allocationId: z.string().min(1, "Alocação é obrigatória"),
  driverId: z.string().min(1, "Entregador é obrigatório"),
  status: z.enum(["notified", "accepted", "rejected", "expired"]).default("notified"),
  expiresAt: z.date(),
}).omit({
  id: true,
  createdAt: true,
  notifiedAt: true,
});

export type AllocationAlert = typeof allocationAlerts.$inferSelect;
export type InsertAllocationAlert = z.infer<typeof insertAllocationAlertSchema>;
