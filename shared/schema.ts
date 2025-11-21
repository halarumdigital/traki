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
  serviceLocationId: varchar("service_location_id").notNull().references(() => serviceLocations.id),
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

  // Referral System (Sistema de Indicação)
  referralCode: varchar("referral_code", { length: 50 }).unique(), // Código único do entregador
  referredByCode: varchar("referred_by_code", { length: 50 }), // Código de quem indicou
  referredById: varchar("referred_by_id").references(() => drivers.id), // ID de quem indicou
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
  capacidadePesoKg: z.number().min(0.1, "Peso deve ser maior que 0"),
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
}).omit({
  id: true,
  ticketNumber: true,
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
// WOOVI SUBACCOUNTS (Subcontas Woovi)
// ========================================
export const wooviSubaccounts = pgTable("woovi_subaccounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Tipo de conta: 'company', 'driver', ou 'admin'
  accountType: varchar("account_type", { length: 20 }).notNull(),

  // Relacionamento com empresa ou entregador
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "cascade" }),
  driverId: varchar("driver_id").references(() => drivers.id, { onDelete: "cascade" }),

  // Dados da Woovi
  pixKey: varchar("pix_key", { length: 255 }).notNull().unique(), // Chave PIX registrada
  pixKeyType: varchar("pix_key_type", { length: 20 }).notNull(), // EMAIL, CPF, CNPJ, PHONE, EVP
  wooviSubaccountId: varchar("woovi_subaccount_id", { length: 255 }), // ID retornado pela Woovi (se houver)

  // Saldo virtual (cache do saldo da Woovi - atualizado periodicamente)
  balanceCache: numeric("balance_cache", { precision: 10, scale: 2 }).default("0"),
  lastBalanceUpdate: timestamp("last_balance_update"),

  // Status
  active: boolean("active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWooviSubaccountSchema = createInsertSchema(wooviSubaccounts, {
  accountType: z.enum(["company", "driver", "admin"]),
  pixKey: z.string().min(1, "Chave PIX é obrigatória"),
  pixKeyType: z.enum(["EMAIL", "CPF", "CNPJ", "PHONE", "EVP"]),
  companyId: z.string().optional(),
  driverId: z.string().optional(),
  wooviSubaccountId: z.string().optional(),
  balanceCache: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  active: z.boolean().default(true),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WooviSubaccount = typeof wooviSubaccounts.$inferSelect;
export type InsertWooviSubaccount = z.infer<typeof insertWooviSubaccountSchema>;

// ========================================
// WOOVI CHARGES (Cobranças PIX - Recargas)
// ========================================
export const wooviCharges = pgTable("woovi_charges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Empresa que solicitou a recarga
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  subaccountId: varchar("subaccount_id").notNull().references(() => wooviSubaccounts.id),

  // Dados da Woovi
  wooviChargeId: varchar("woovi_charge_id", { length: 255 }), // ID da cobrança retornado pela Woovi
  correlationId: varchar("correlation_id", { length: 255 }).unique(), // ID único da cobrança

  // Valor
  value: numeric("value", { precision: 10, scale: 2 }).notNull(), // Valor em reais

  // QR Code e BR Code
  qrCode: text("qr_code"), // QR Code em base64
  brCode: text("br_code"), // BR Code (copia e cola)

  // Status: 'pending', 'paid', 'expired', 'cancelled'
  status: varchar("status", { length: 20 }).notNull().default("pending"),

  // Datas
  paidAt: timestamp("paid_at"),
  expiresAt: timestamp("expires_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWooviChargeSchema = createInsertSchema(wooviCharges, {
  companyId: z.string().min(1, "Empresa é obrigatória"),
  subaccountId: z.string().min(1, "Subconta é obrigatória"),
  value: z.union([z.string(), z.number()]).transform(val => String(val)),
  status: z.enum(["pending", "paid", "expired", "cancelled"]).default("pending"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WooviCharge = typeof wooviCharges.$inferSelect;
export type InsertWooviCharge = z.infer<typeof insertWooviChargeSchema>;

// ========================================
// FINANCIAL TRANSACTIONS (Logs de Transações)
// ========================================
export const financialTransactions = pgTable("financial_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Tipo de transação
  type: varchar("type", { length: 30 }).notNull(),
  // Tipos possíveis:
  // - 'charge_created': Cobrança criada
  // - 'charge_paid': Cobrança paga (recarga confirmada)
  // - 'transfer_delivery': Transferência por finalização de entrega
  // - 'transfer_cancellation': Transferência por cancelamento
  // - 'withdrawal': Saque
  // - 'balance_block': Bloqueio de saldo
  // - 'balance_unblock': Desbloqueio de saldo

  // Relacionamentos
  companyId: varchar("company_id").references(() => companies.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  entregaId: varchar("entrega_id").references(() => entregasIntermunicipais.id),
  chargeId: varchar("charge_id").references(() => wooviCharges.id),
  fromSubaccountId: varchar("from_subaccount_id").references(() => wooviSubaccounts.id),
  toSubaccountId: varchar("to_subaccount_id").references(() => wooviSubaccounts.id),

  // Valores
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),

  // Status: 'pending', 'completed', 'failed'
  status: varchar("status", { length: 20 }).notNull().default("pending"),

  // Dados da API Woovi
  wooviTransactionId: varchar("woovi_transaction_id", { length: 255 }), // ID retornado pela Woovi
  wooviResponse: json("woovi_response"), // Resposta completa da API

  // Descrição e observações
  description: text("description").notNull(),
  metadata: json("metadata"), // Dados adicionais (ex: detalhes do split, etc)

  // Erro (se houver)
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactions, {
  type: z.enum([
    "charge_created",
    "charge_paid",
    "transfer_delivery",
    "transfer_cancellation",
    "withdrawal",
    "balance_block",
    "balance_unblock",
  ]),
  amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  status: z.enum(["pending", "completed", "failed"]).default("pending"),
  description: z.string().min(1, "Descrição é obrigatória"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;

// ========================================
// COMPANY BALANCE BLOCKS (Bloqueios de Saldo)
// ========================================
export const companyBalanceBlocks = pgTable("company_balance_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Empresa e subconta
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  subaccountId: varchar("subaccount_id").notNull().references(() => wooviSubaccounts.id),

  // Entrega relacionada
  entregaId: varchar("entrega_id").notNull().references(() => entregasIntermunicipais.id, { onDelete: "cascade" }),

  // Valor bloqueado
  blockedAmount: numeric("blocked_amount", { precision: 10, scale: 2 }).notNull(),

  // Status: 'active' (bloqueado), 'released' (liberado por conclusão), 'cancelled' (liberado por cancelamento)
  status: varchar("status", { length: 20 }).notNull().default("active"),

  // Datas
  releasedAt: timestamp("released_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCompanyBalanceBlockSchema = createInsertSchema(companyBalanceBlocks, {
  companyId: z.string().min(1, "Empresa é obrigatória"),
  subaccountId: z.string().min(1, "Subconta é obrigatória"),
  entregaId: z.string().min(1, "Entrega é obrigatória"),
  blockedAmount: z.union([z.string(), z.number()]).transform(val => String(val)),
  status: z.enum(["active", "released", "cancelled"]).default("active"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CompanyBalanceBlock = typeof companyBalanceBlocks.$inferSelect;
export type InsertCompanyBalanceBlock = z.infer<typeof insertCompanyBalanceBlockSchema>;
