import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { loginSchema, insertSettingsSchema, serviceLocations, vehicleTypes, brands, vehicleModels, driverDocumentTypes, driverDocuments, drivers, companies, requests, requestPlaces, requestBills, driverNotifications, cityPrices, settings, companyCancellationTypes, insertCompanyCancellationTypeSchema, promotions, insertPromotionSchema, companyDriverRatings, driverCompanyRatings, deliveryStops, faqs, insertFaqSchema, pushNotifications, referralSettings, driverReferrals, ticketSubjects, insertTicketSubjectSchema, supportTickets, insertSupportTicketSchema, ticketReplies, insertTicketReplySchema } from "@shared/schema";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, db } from "./db";
import { eq, and, or, sql, desc } from "drizzle-orm";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import { initializeFirebase, sendPushNotification, sendPushToMultipleDevices } from "./firebase";
import { sentryUserContext } from "./sentry-middleware";
import { uploadToR2, deleteFromR2, isValidImage, isValidDocument, isValidFileSize } from "./r2-storage";

const PgSession = connectPgSimple(session);

// Função para calcular distância entre duas coordenadas usando Haversine (em km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Função para construir URL completa para imagens
function getFullImageUrl(req: express.Request, relativePath: string | null): string | null {
  if (!relativePath) return null;
  // Se já for uma URL completa, retorna como está
  if (relativePath.startsWith('http')) return relativePath;

  // Usa a variável de ambiente SERVER_URL se estiver definida, senão usa o host do request
  const baseUrl = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
  const fullUrl = `${baseUrl}${relativePath}`;
  console.log(`🖼️  [IMAGE URL] ${relativePath} -> ${fullUrl}`);
  return fullUrl;
}

// Configuração do multer para upload de arquivos
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storageMulter = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Storage específico para documentos do motorista
const documentsDriverDir = path.join(process.cwd(), "uploads", "documents_driver");
if (!fs.existsSync(documentsDriverDir)) {
  fs.mkdirSync(documentsDriverDir, { recursive: true });
}

const storageDocumentsDriver = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDriverDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storageMulter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Apenas imagens são permitidas (jpeg, jpg, png, gif, svg)"));
    }
  },
});

const uploadDocument = multer({
  storage: storageDocumentsDriver,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB para documentos
  fileFilter: (req, file, cb) => {
    console.log("🔍 Verificando arquivo:");
    console.log("  - Nome:", file.originalname);
    console.log("  - MIME type:", file.mimetype);
    console.log("  - Campo:", file.fieldname);

    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      console.log("  ✓ Arquivo aceito");
      return cb(null, true);
    } else {
      console.log("  ✗ Arquivo rejeitado - tipo não permitido");
      console.log("    Extensão válida:", extname);
      console.log("    MIME type válido:", mimetype);
      cb(new Error("Apenas imagens (jpeg, jpg, png) e PDF são permitidos"));
    }
  },
});

// Upload para tickets - aceita imagens opcionais
const uploadTicket = multer({
  storage: storageMulter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    console.log("🔍 [MULTER FILTER] Verificando arquivo:");
    console.log("  - fieldname:", file.fieldname);
    console.log("  - originalname:", file.originalname);
    console.log("  - mimetype:", file.mimetype);
    console.log("  - size:", file.size);

    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    // Aceitar application/octet-stream se a extensão for válida (mobile apps podem enviar com esse mimetype)
    const isOctetStreamWithValidExt = file.mimetype === 'application/octet-stream' && extname;

    console.log("  - extname válido:", extname);
    console.log("  - mimetype válido:", mimetype);
    console.log("  - octet-stream com ext válida:", isOctetStreamWithValidExt);

    // Aceita se: (mimetype E extensão válidos) OU (octet-stream com extensão válida)
    if ((mimetype && extname) || isOctetStreamWithValidExt) {
      console.log("✅ Arquivo aceito pelo filtro");
      return cb(null, true);
    } else {
      console.log("❌ Arquivo rejeitado pelo filtro - tipo não permitido");
      // Ignora o arquivo se não for válido (em vez de dar erro)
      return cb(null, false);
    }
  },
});

// Configuração do multer para upload em memória (para R2)
const uploadR2 = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    console.log(`📎 [UPLOAD R2] Validando arquivo:`);
    console.log(`   - Original name: ${file.originalname}`);
    console.log(`   - MIME type: ${file.mimetype}`);
    console.log(`   - Field name: ${file.fieldname}`);

    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|webp/i;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = isValidDocument(file.mimetype);

    console.log(`   - Extensão válida: ${extname}`);
    console.log(`   - MIME type válido: ${mimetype}`);

    if (mimetype || extname) {
      console.log(`   ✅ Arquivo aceito`);
      return cb(null, true);
    } else {
      console.log(`   ❌ Arquivo rejeitado - mimetype: ${file.mimetype}, extensão: ${path.extname(file.originalname)}`);
      cb(new Error("Tipo de arquivo não permitido"));
    }
  },
});

declare module "express-session" {
  interface SessionData {
    userId?: string;
    userEmail?: string;
    userName?: string;
    isAdmin?: boolean;
    companyId?: string;
    companyEmail?: string;
    companyName?: string;
    isCompany?: boolean;
    driverId?: string;
    driverName?: string;
    driverMobile?: string;
    isDriver?: boolean;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {  // Configurar CORS para permitir credenciais
  app.use((req, res, next) => {
    const origin = req.headers.origin || "http://localhost:5173";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle preflight
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });


  // Servir arquivos estáticos da pasta uploads
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });
  app.use("/uploads", express.static(uploadsDir));
  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      },
    })
  );

  // Add Sentry user context middleware
  app.use(sentryUserContext);

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: "Dados inválidos",
          errors: result.error.errors 
        });
      }

      const { email, password } = result.data;

      const user = await storage.getUserByEmail(email);

      if (!user) {
        return res.status(401).json({
          message: "Email ou senha incorretos"
        });
      }

      // Verificar senha usando bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          message: "Email ou senha incorretos"
        });
      }

      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userName = user.nome;
      req.session.isAdmin = user.isAdmin;

      return res.json({
        id: user.id,
        email: user.email,
        nome: user.nome,
        isAdmin: user.isAdmin,
      });
    } catch (error) {
      console.error("Erro no login:", error);
      return res.status(500).json({ 
        message: "Erro interno do servidor" 
      });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logout realizado com sucesso" });
    });
  });

  const resolveServiceLocationIdForRequest = async (request: any): Promise<string | null> => {
    if (request.serviceLocationId) {
      return request.serviceLocationId;
    }

    if (!request.companyId) {
      return null;
    }

    const { rows: companyRows } = await pool.query(
      `SELECT city, state
       FROM companies
       WHERE id = $1
       LIMIT 1`,
      [request.companyId]
    );

    if (!companyRows.length) {
      return null;
    }

    const companyCity = companyRows[0].city;
    const companyState = companyRows[0].state;

    if (!companyCity || !companyState) {
      return null;
    }

    const { rows: serviceLocationRows } = await pool.query(
      `SELECT id
       FROM service_locations
       WHERE LOWER(name) = LOWER($1)
         AND LOWER(state) = LOWER($2)
       LIMIT 1`,
      [companyCity, companyState]
    );

    if (serviceLocationRows.length > 0) {
      return serviceLocationRows[0].id;
    }

    return null;
  };

  const calculateCancellationFeeForRequest = async (request: any) => {
    const result = {
      configuredPercentage: null as number | null,
      appliedPercentage: null as number | null,
      amount: null as number | null,
    };

    if (!request.driverId) {
      return result;
    }

    const serviceLocationId = await resolveServiceLocationIdForRequest(request);
    if (!serviceLocationId) {
      return result;
    }

    const { rows: priceRows } = await pool.query(
      `SELECT cancellation_fee
       FROM city_prices
       WHERE service_location_id = $1
         AND vehicle_type_id = $2
         AND active = true
       LIMIT 1`,
      [serviceLocationId, request.zoneTypeId]
    );

    if (!priceRows.length || !priceRows[0].cancellation_fee) {
      return result;
    }

    const configuredPercentage = parseFloat(priceRows[0].cancellation_fee);
    if (!configuredPercentage) {
      return result;
    }

    const { rows: billRows } = await pool.query(
      `SELECT total_amount
       FROM request_bills
       WHERE request_id = $1
       LIMIT 1`,
      [request.id]
    );

    if (!billRows.length || !billRows[0].total_amount) {
      return result;
    }

    const totalAmount = parseFloat(billRows[0].total_amount);
    if (!totalAmount) {
      return result;
    }

    const appliedPercentage = configuredPercentage;
    const amount = totalAmount * (appliedPercentage / 100);

    return {
      configuredPercentage,
      appliedPercentage,
      amount,
    };
  };

  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    return res.json({
      id: req.session.userId,
      email: req.session.userEmail,
      nome: req.session.userName,
      isAdmin: req.session.isAdmin,
    });
  });

  // ========================================
  // COMPANY AUTH ROUTES
  // ========================================

  app.post("/api/empresa/auth/login", async (req, res) => {
    try {
      console.log("🔐 Tentativa de login da empresa");
      console.log("   Email recebido:", req.body.email);

      const result = loginSchema.safeParse(req.body);

      if (!result.success) {
        console.log("❌ Validação falhou:", result.error.errors);
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors
        });
      }

      const { email, password } = result.data;
      console.log("✅ Dados validados");

      const company = await storage.getCompanyByEmail(email);

      if (!company) {
        console.log("❌ Empresa não encontrada com email:", email);
        return res.status(401).json({
          message: "Email ou senha incorretos"
        });
      }

      console.log("✅ Empresa encontrada:", company.name);
      console.log("   Ativa:", company.active);
      console.log("   Tem senha:", !!company.password);

      if (!company.active) {
        console.log("❌ Empresa inativa");
        return res.status(401).json({
          message: "Empresa inativa. Entre em contato com o suporte."
        });
      }

      if (!company.password) {
        console.log("❌ Empresa sem senha configurada");
        return res.status(401).json({
          message: "Senha não configurada. Entre em contato com o suporte."
        });
      }

      console.log("🔑 Comparando senhas...");
      const isValidPassword = await bcrypt.compare(password, company.password);
      console.log("   Senha válida:", isValidPassword);

      if (!isValidPassword) {
        console.log("❌ Senha incorreta");
        return res.status(401).json({
          message: "Email ou senha incorretos"
        });
      }

      req.session.companyId = company.id;
      req.session.companyEmail = company.email;
      req.session.companyName = company.name;
      req.session.isCompany = true;

      console.log("✅ Login bem sucedido para:", company.name);

      return res.json({
        message: "Login realizado com sucesso",
        company: {
          id: company.id,
          name: company.name,
          email: company.email,
        }
      });
    } catch (error) {
      console.error("❌ Erro ao fazer login:", error);
      return res.status(500).json({
        message: "Erro interno do servidor"
      });
    }
  });

  app.post("/api/empresa/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logout realizado com sucesso" });
    });
  });

  app.get("/api/empresa/auth/me", async (req, res) => {
    if (!req.session.companyId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    try {
      // Buscar dados completos da empresa do banco
      const company = await storage.getCompany(req.session.companyId);

      if (!company) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      return res.json({
        id: company.id,
        email: company.email,
        name: company.name,
        street: company.street,
        number: company.number,
        neighborhood: company.neighborhood,
        city: company.city,
        state: company.state,
        cep: company.cep,
        reference: company.reference,
        isCompany: true,
      });
    } catch (error) {
      console.error("Erro ao buscar dados da empresa:", error);
      return res.status(500).json({ message: "Erro ao buscar dados da empresa" });
    }
  });

  // ========================================
  // SOLICITAÇÕES DE ENTREGA (EMPRESA)
  // ========================================

  // POST /api/company/requests - Criar solicitação de entrega
  app.post("/api/company/requests", async (req, res) => {
    try {
      // Verificar autenticação da empresa
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Empresa não autenticada" });
      }

      const { zoneTypeId, pickupAddress, pickupLat, pickupLng, deliveryAddress, deliveryLat, deliveryLng, customerName, notes } = req.body;

      // Validação básica
      if (!zoneTypeId || !pickupAddress || !pickupLat || !pickupLng || !deliveryAddress || !deliveryLat || !deliveryLng) {
        return res.status(400).json({ message: "Dados incompletos" });
      }

      console.log("📦 Nova solicitação de entrega da empresa:", req.session.companyName);

      // 1. Buscar configurações
      const settings = await storage.getSettings();
      const driverSearchRadius = settings?.driverSearchRadius || 10; // km
      const driverAcceptanceTimeout = settings?.driverAcceptanceTimeout || 30; // segundos
      const minTimeToFindDriver = settings?.minTimeToFindDriver || 120; // segundos
      const adminCommissionPercentage = settings?.adminCommissionPercentage || 20; // %

      console.log("⚙️ Configurações:");
      console.log(`   - Raio de busca: ${driverSearchRadius} km`);
      console.log(`   - Tempo de aceitação: ${driverAcceptanceTimeout}s`);
      console.log(`   - Tempo mínimo para encontrar motorista: ${minTimeToFindDriver}s`);
      console.log(`   - Comissão admin: ${adminCommissionPercentage}%`);

      // 2. Calcular distância e tempo estimado
      const distance = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);
      const estimatedTime = Math.ceil((distance / 40) * 60); // Assumindo 40 km/h, resultado em minutos

      console.log(`📍 Distância calculada: ${distance.toFixed(2)} km`);
      console.log(`⏱️ Tempo estimado: ${estimatedTime} min`);

      // 3. Calcular valor da entrega (implementar lógica de precificação)
      // Por enquanto, vou usar um valor fixo baseado na distância
      const basePrice = 10.00; // R$ 10 base
      const pricePerKm = 3.00; // R$ 3.00 por km
      const totalAmount = basePrice + (distance * pricePerKm);
      const adminCommission = totalAmount * (adminCommissionPercentage / 100);
      const driverAmount = totalAmount - adminCommission;

      console.log(`💰 Valores:`);
      console.log(`   - Total: R$ ${totalAmount.toFixed(2)}`);
      console.log(`   - Comissão: R$ ${adminCommission.toFixed(2)}`);
      console.log(`   - Motorista recebe: R$ ${driverAmount.toFixed(2)}`);

      // 4. Buscar motoristas dentro do raio usando Haversine
      // Excluir motoristas que têm entregas NÃO retiradas
      // Motoristas com entregas retiradas PODEM receber novas notificações
      const driversQuery = await db.execute(sql`
        SELECT
          d.id,
          d.name,
          d.email,
          d.fcm_token,
          d.latitude,
          d.longitude,
          (6371 * acos(
            cos(radians(${pickupLat})) *
            cos(radians(d.latitude)) *
            cos(radians(d.longitude) - radians(${pickupLng})) +
            sin(radians(${pickupLat})) *
            sin(radians(d.latitude))
          )) AS distance
        FROM drivers d
        WHERE d.active = true
          AND d.approve = true
          AND d.available = true
          AND d.fcm_token IS NOT NULL
          AND d.latitude IS NOT NULL
          AND d.longitude IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM requests r
            WHERE r.driver_id = d.id
              AND r.is_completed = false
              AND r.is_cancelled = false
              AND r.is_trip_start = false
          )
        HAVING distance <= ${driverSearchRadius}
        ORDER BY distance ASC
      `);

      const availableDrivers = driversQuery.rows as any[];

      // Log de motoristas excluídos por terem entregas não retiradas
      const allDriversInRadius = await db.execute(sql`
        SELECT COUNT(*) as total
        FROM drivers d
        WHERE d.active = true
          AND d.approve = true
          AND d.available = true
          AND d.fcm_token IS NOT NULL
          AND d.latitude IS NOT NULL
          AND d.longitude IS NOT NULL
          AND (6371 * acos(
            cos(radians(${pickupLat})) *
            cos(radians(d.latitude)) *
            cos(radians(d.longitude) - radians(${pickupLng})) +
            sin(radians(${pickupLat})) *
            sin(radians(d.latitude))
          )) <= ${driverSearchRadius}
      `);
      const totalInRadius = parseInt(allDriversInRadius.rows[0]?.total || "0");
      const excludedByDelivery = totalInRadius - availableDrivers.length;
      if (excludedByDelivery > 0) {
        console.log(`🚫 ${excludedByDelivery} motorista(s) no raio excluído(s) por ter entrega não retirada`);
      }

      if (availableDrivers.length === 0) {
        console.log("❌ Nenhum motorista disponível no raio de busca");
        return res.status(404).json({
          message: "Nenhum motorista disponível no momento",
          details: "Tente novamente em alguns minutos ou aumente o raio de busca."
        });
      }

      console.log(`✅ ${availableDrivers.length} motorista(s) encontrado(s) no raio de ${driverSearchRadius} km`);

      // 5. Gerar número da solicitação
      const requestNumber = `REQ-${Date.now()}`;

      // 6. Buscar dados da empresa
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, req.session.companyId))
        .limit(1);

      // 7. Criar registro de solicitação
      const [newRequest] = await db
        .insert(requests)
        .values({
          requestNumber,
          companyId: req.session.companyId,
          customerName: customerName || null,
          zoneTypeId,
          notes: notes || null,
          requestEtaAmount: driverAmount.toFixed(2), // Valor líquido para o motorista (após comissão)
        })
        .returning();

      console.log(`✅ Solicitação criada: ${newRequest.id}`);

      // 8. Criar registro de localização
      await db
        .insert(requestPlaces)
        .values({
          requestId: newRequest.id,
          pickLat: pickupLat.toString(),
          pickLng: pickupLng.toString(),
          pickAddress: pickupAddress,
          dropLat: deliveryLat.toString(),
          dropLng: deliveryLng.toString(),
          dropAddress: deliveryAddress,
        });

      console.log(`✅ Localizações registradas`);

      // 9. Criar registro de cobrança
      await db
        .insert(requestBills)
        .values({
          requestId: newRequest.id,
          basePrice: basePrice.toFixed(2),
          baseDistance: "0",
          pricePerDistance: pricePerKm.toFixed(2),
          distancePrice: (distance * pricePerKm).toFixed(2),
          pricePerTime: "0",
          timePrice: "0",
          totalAmount: totalAmount.toFixed(2), // Valor BRUTO (para empresa/admin)
          adminCommision: adminCommission.toFixed(2), // Comissão do app
        });

      console.log(`✅ Cobrança registrada`);

      // 10. Calcular tempo de expiração
      const expiresAt = new Date(Date.now() + driverAcceptanceTimeout * 1000);

      // 11. Criar notificações para cada motorista e disparar push
      const fcmTokens: string[] = [];
      const notificationPromises = availableDrivers.map(async (driver) => {
        // Criar registro de notificação
        await db
          .insert(driverNotifications)
          .values({
            requestId: newRequest.id,
            driverId: driver.id,
            status: "notified",
            expiresAt,
          });

        if (driver.fcm_token) {
          fcmTokens.push(driver.fcm_token);
        }
      });

      await Promise.all(notificationPromises);
      console.log(`✅ ${notificationPromises.length} notificações registradas`);

      // 12. Enviar notificações push para todos os motoristas
      if (fcmTokens.length > 0) {
        // Firebase requer que todos os valores sejam strings
        const notificationData = {
          type: "new_delivery_request",
          deliveryId: newRequest.id,
          requestId: newRequest.id,
          requestNumber: newRequest.requestNumber,
          customerName: company?.name || "Empresa",
          pickupAddress,
          dropoffAddress: deliveryAddress,
          totalDistance: distance.toFixed(1),
          totalTime: Math.ceil(estimatedTime).toString(),
          estimatedAmount: driverAmount.toFixed(2), // VALOR DO MOTORISTA (o que ele receberá) - app lê este campo
          totalAmount: totalAmount.toFixed(2), // Valor total da entrega (para referência)
          driverAmount: driverAmount.toFixed(2), // Mantido por compatibilidade
          acceptanceTimeout: driverAcceptanceTimeout.toString(),
          searchTimeout: minTimeToFindDriver.toString(),
          expiresAt: expiresAt.toISOString(),
        };

        console.log("🔔 Preparando envio de notificações FCM:");
        console.log("  - Número de tokens:", fcmTokens.length);
        console.log("  - Tokens FCM:", fcmTokens.map(t => `${t.substring(0, 30)}...`));
        console.log("  - Dados da notificação:", JSON.stringify(notificationData, null, 2));

        await sendPushToMultipleDevices(
          fcmTokens,
          "🚚 Nova Solicitação de Entrega!",
          `${company?.name || "Empresa"} - ${distance.toFixed(1)}km - R$ ${totalAmount.toFixed(2)}`,
          notificationData
        );

        console.log(`✓ Notificação enviada para ${fcmTokens.length} motoristas dentro do raio`);
      }

      return res.json({
        success: true,
        message: "Solicitação criada com sucesso!",
        data: {
          requestId: newRequest.id,
          requestNumber: newRequest.requestNumber,
          distance: distance.toFixed(2),
          estimatedTime,
          totalAmount: totalAmount.toFixed(2),
          driverAmount: driverAmount.toFixed(2),
          driversNotified: availableDrivers.length,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error) {
      console.error("❌ Erro ao criar solicitação:", error);
      return res.status(500).json({
        message: "Erro ao criar solicitação",
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Endpoint de diagnóstico - verificar conexão do banco
  app.get("/api/debug/db-info", async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          current_database() as database,
          current_schema() as schema,
          current_user as user,
          version() as version
      `);

      const { rows: driversCount } = await pool.query(`SELECT COUNT(*) as total FROM drivers`);
      const { rows: citiesCount } = await pool.query(`SELECT COUNT(*) as total FROM service_locations`);

      return res.json({
        connection: rows[0],
        counts: {
          drivers: parseInt(driversCount[0].total),
          cities: parseInt(citiesCount[0].total)
        },
        env: {
          NODE_ENV: process.env.NODE_ENV,
          DATABASE_URL: process.env.DATABASE_URL?.replace(/@[^@]+@/, '@***@') // oculta senha
        }
      });
    } catch (error) {
      console.error("Erro no debug:", error);
      return res.status(500).json({ message: "Erro ao obter informações do banco" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { nome, email, password } = req.body;

      if (!nome || !email || !password) {
        return res.status(400).json({ 
          message: "Todos os campos são obrigatórios" 
        });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          message: "Este email já está em uso"
        });
      }

      // Hash da senha antes de salvar
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await storage.createUser({
        nome,
        email,
        password: hashedPassword,
        isAdmin: false,
      });

      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userName = user.nome;
      req.session.isAdmin = user.isAdmin;

      return res.json({
        id: user.id,
        email: user.email,
        nome: user.nome,
        isAdmin: user.isAdmin,
      });
    } catch (error) {
      console.error("Erro no registro:", error);
      return res.status(500).json({ 
        message: "Erro interno do servidor" 
      });
    }
  });

  app.get("/api/users", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const users = await storage.getAllUsers();
      return res.json(users);
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      return res.status(500).json({
        message: "Erro ao buscar usuários"
      });
    }
  });

  // ========================================
  // SERVICE LOCATIONS (CIDADES) ROUTES
  // ========================================

  // GET /api/service-locations - Listar cidades
  app.get("/api/service-locations", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const serviceLocations = await storage.getAllServiceLocations();
      return res.json(serviceLocations);
    } catch (error) {
      console.error("Erro ao listar cidades:", error);
      return res.status(500).json({ message: "Erro ao buscar cidades" });
    }
  });

  // ========================================
  // VEHICLE TYPES (CATEGORIAS) ROUTES
  // ========================================

  // POST /api/upload - Upload de arquivo
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const filePath = `/uploads/${req.file.filename}`;
      return res.json({ path: filePath });
    } catch (error: any) {
      console.error("Erro no upload:", error);
      return res.status(500).json({ message: error.message || "Erro ao fazer upload" });
    }
  });

  // GET /api/vehicle-types - Listar categorias
  app.get("/api/vehicle-types", async (req, res) => {
    try {
      // Permitir acesso para usuários admin (userId) e empresas (companyId)
      if (!req.session.userId && !req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const vehicleTypes = await storage.getAllVehicleTypes();
      return res.json(vehicleTypes);
    } catch (error) {
      console.error("Erro ao listar categorias:", error);
      return res.status(500).json({ message: "Erro ao buscar categorias" });
    }
  });

  // POST /api/vehicle-types - Criar categoria
  app.post("/api/vehicle-types", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { name, icon } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Nome é obrigatório" });
      }

      const newVehicleType = await storage.createVehicleType({
        name,
        icon: icon || null,
        capacity: 4, // valor padrão
        active: true,
      });

      return res.json(newVehicleType);
    } catch (error) {
      console.error("Erro ao criar categoria:", error);
      return res.status(500).json({ message: "Erro ao criar categoria" });
    }
  });

  // PUT /api/vehicle-types/:id - Atualizar categoria
  app.put("/api/vehicle-types/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { name, icon } = req.body;

      const updated = await storage.updateVehicleType(id, { name, icon });

      if (!updated) {
        return res.status(404).json({ message: "Categoria não encontrada" });
      }

      return res.json(updated);
    } catch (error) {
      console.error("Erro ao atualizar categoria:", error);
      return res.status(500).json({ message: "Erro ao atualizar categoria" });
    }
  });

  // DELETE /api/vehicle-types/:id - Excluir categoria
  app.delete("/api/vehicle-types/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      // Verificar se existem motoristas usando esta categoria
      const drivers = await storage.getAllDrivers();
      const driversWithType = drivers.filter(d => d.vehicleTypeId === id);

      if (driversWithType.length > 0) {
        return res.status(400).json({
          message: `Não é possível excluir esta categoria pois existem ${driversWithType.length} motorista(s) usando ela. Altere os motoristas primeiro.`
        });
      }

      // Verificar se existem city_prices usando esta categoria
      const allCityPrices = await storage.getAllCityPrices();
      const cityPricesWithVehicle = allCityPrices.filter(cp => cp.vehicleTypeId === id);

      if (cityPricesWithVehicle.length > 0) {
        return res.status(400).json({
          message: `Não é possível excluir esta categoria pois existem ${cityPricesWithVehicle.length} configuração(ões) de preço usando ela. Exclua os preços primeiro.`
        });
      }

      await storage.deleteVehicleType(id);

      return res.json({ message: "Categoria excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir categoria:", error);
      return res.status(500).json({ message: "Erro ao excluir categoria" });
    }
  });

  // ========================================
  // BRANDS (MARCAS) ROUTES
  // ========================================

  // GET /api/brands - Listar marcas
  app.get("/api/brands", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const brands = await storage.getAllBrands();
      return res.json(brands);
    } catch (error) {
      console.error("Erro ao listar marcas:", error);
      return res.status(500).json({ message: "Erro ao buscar marcas" });
    }
  });

  // POST /api/brands - Criar nova marca
  app.post("/api/brands", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { name } = req.body;

      if (!name) {
        return res.status(400).json({
          message: "O nome da marca é obrigatório"
        });
      }

      const newBrand = await storage.createBrand({ name, active: true });

      return res.status(201).json(newBrand);
    } catch (error) {
      console.error("Erro ao criar marca:", error);
      return res.status(500).json({ message: "Erro ao criar marca" });
    }
  });

  // PUT /api/brands/:id - Atualizar marca
  app.put("/api/brands/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { name } = req.body;

      const updated = await storage.updateBrand(id, { name });

      if (!updated) {
        return res.status(404).json({ message: "Marca não encontrada" });
      }

      return res.json(updated);
    } catch (error) {
      console.error("Erro ao atualizar marca:", error);
      return res.status(500).json({ message: "Erro ao atualizar marca" });
    }
  });

  // DELETE /api/brands/:id - Excluir marca
  app.delete("/api/brands/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      // Verificar se existem modelos usando esta marca
      const models = await storage.getVehicleModelsByBrand(id);

      if (models.length > 0) {
        return res.status(400).json({
          message: `Não é possível excluir esta marca pois existem ${models.length} modelo(s) associado(s). Exclua os modelos primeiro.`
        });
      }

      await storage.deleteBrand(id);

      return res.json({ message: "Marca excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir marca:", error);
      return res.status(500).json({ message: "Erro ao excluir marca" });
    }
  });

  // ========================================
  // VEHICLE MODELS (MODELOS) ROUTES
  // ========================================

  // GET /api/vehicle-models - Listar modelos
  app.get("/api/vehicle-models", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const models = await storage.getAllVehicleModels();
      return res.json(models);
    } catch (error) {
      console.error("Erro ao listar modelos:", error);
      return res.status(500).json({ message: "Erro ao buscar modelos" });
    }
  });

  // GET /api/vehicle-models/by-brand/:brandId - Listar modelos por marca
  app.get("/api/vehicle-models/by-brand/:brandId", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { brandId } = req.params;
      const models = await storage.getVehicleModelsByBrand(brandId);
      return res.json(models);
    } catch (error) {
      console.error("Erro ao listar modelos por marca:", error);
      return res.status(500).json({ message: "Erro ao buscar modelos" });
    }
  });

  // POST /api/vehicle-models - Criar novo modelo
  app.post("/api/vehicle-models", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { brandId, name } = req.body;

      if (!brandId || !name) {
        return res.status(400).json({
          message: "Marca e nome do modelo são obrigatórios"
        });
      }

      const newModel = await storage.createVehicleModel({ brandId, name, active: true });

      return res.status(201).json(newModel);
    } catch (error) {
      console.error("Erro ao criar modelo:", error);
      return res.status(500).json({ message: "Erro ao criar modelo" });
    }
  });

  // PUT /api/vehicle-models/:id - Atualizar modelo
  app.put("/api/vehicle-models/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { brandId, name } = req.body;

      const updated = await storage.updateVehicleModel(id, { brandId, name });

      if (!updated) {
        return res.status(404).json({ message: "Modelo não encontrado" });
      }

      return res.json(updated);
    } catch (error) {
      console.error("Erro ao atualizar modelo:", error);
      return res.status(500).json({ message: "Erro ao atualizar modelo" });
    }
  });

  // DELETE /api/vehicle-models/:id - Excluir modelo
  app.delete("/api/vehicle-models/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      await storage.deleteVehicleModel(id);

      return res.json({ message: "Modelo excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir modelo:", error);
      return res.status(500).json({ message: "Erro ao excluir modelo" });
    }
  });

  // ========================================
  // DRIVER DOCUMENT TYPES (TIPOS DE DOCUMENTOS) ROUTES
  // ========================================

  // GET /api/driver-document-types - Listar tipos de documentos
  app.get("/api/driver-document-types", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const documentTypes = await storage.getAllDriverDocumentTypes();
      return res.json(documentTypes);
    } catch (error) {
      console.error("Erro ao listar tipos de documentos:", error);
      return res.status(500).json({ message: "Erro ao buscar tipos de documentos" });
    }
  });

  // POST /api/driver-document-types - Criar novo tipo de documento
  app.post("/api/driver-document-types", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { name, description, required } = req.body;

      if (!name) {
        return res.status(400).json({
          message: "O nome do tipo de documento é obrigatório"
        });
      }

      const newDocType = await storage.createDriverDocumentType({
        name,
        description: description || null,
        required: required !== undefined ? required : true,
        active: true,
      });

      return res.status(201).json(newDocType);
    } catch (error) {
      console.error("Erro ao criar tipo de documento:", error);
      return res.status(500).json({ message: "Erro ao criar tipo de documento" });
    }
  });

  // PUT /api/driver-document-types/:id - Atualizar tipo de documento
  app.put("/api/driver-document-types/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { name, description, required, active } = req.body;

      const updated = await storage.updateDriverDocumentType(id, {
        name,
        description,
        required,
        active,
      });

      if (!updated) {
        return res.status(404).json({ message: "Tipo de documento não encontrado" });
      }

      return res.json(updated);
    } catch (error) {
      console.error("Erro ao atualizar tipo de documento:", error);
      return res.status(500).json({ message: "Erro ao atualizar tipo de documento" });
    }
  });

  // DELETE /api/driver-document-types/:id - Excluir tipo de documento
  app.delete("/api/driver-document-types/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      await storage.deleteDriverDocumentType(id);

      return res.json({ message: "Tipo de documento excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir tipo de documento:", error);
      return res.status(500).json({ message: "Erro ao excluir tipo de documento" });
    }
  });

  // ========================================
  // COMPANY CANCELLATION TYPES (TIPOS DE CANCELAMENTO EMPRESA) ROUTES
  // ========================================

  // GET /api/company-cancellation-types - Listar tipos de cancelamento
  app.get("/api/company-cancellation-types", async (req, res) => {
    try {
      // Permitir acesso tanto para admin (userId) quanto para empresas (companyId)
      if (!req.session.userId && !req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const types = await db.select().from(companyCancellationTypes);
      return res.json(types);
    } catch (error) {
      console.error("Erro ao listar tipos de cancelamento:", error);
      return res.status(500).json({ message: "Erro ao buscar tipos de cancelamento" });
    }
  });

  // POST /api/company-cancellation-types - Criar tipo de cancelamento
  app.post("/api/company-cancellation-types", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const validatedData = insertCompanyCancellationTypeSchema.parse(req.body);

      const [newType] = await db.insert(companyCancellationTypes).values(validatedData).returning();

      return res.json(newType);
    } catch (error: any) {
      console.error("Erro ao criar tipo de cancelamento:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      return res.status(500).json({ message: "Erro ao criar tipo de cancelamento" });
    }
  });

  // PUT /api/company-cancellation-types/:id - Atualizar tipo de cancelamento
  app.put("/api/company-cancellation-types/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const validatedData = insertCompanyCancellationTypeSchema.partial().parse(req.body);

      const [updated] = await db
        .update(companyCancellationTypes)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(companyCancellationTypes.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Tipo de cancelamento não encontrado" });
      }

      return res.json(updated);
    } catch (error: any) {
      console.error("Erro ao atualizar tipo de cancelamento:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      return res.status(500).json({ message: "Erro ao atualizar tipo de cancelamento" });
    }
  });

  // DELETE /api/company-cancellation-types/:id - Excluir tipo de cancelamento
  app.delete("/api/company-cancellation-types/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      const [deleted] = await db
        .delete(companyCancellationTypes)
        .where(eq(companyCancellationTypes.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ message: "Tipo de cancelamento não encontrado" });
      }

      return res.json({ message: "Tipo de cancelamento excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir tipo de cancelamento:", error);
      return res.status(500).json({ message: "Erro ao excluir tipo de cancelamento" });
    }
  });

  // ========================================
  // REFERRAL SYSTEM (SISTEMA DE INDICAÇÃO) ROUTES
  // ========================================

  // GET /api/referral-settings - Buscar configurações de indicação
  app.get("/api/referral-settings", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { referralSettings } = await import("@shared/schema");

      // Buscar configurações atuais
      const [settings] = await db
        .select()
        .from(referralSettings)
        .limit(1);

      // Se não existir, criar configuração padrão
      if (!settings) {
        const [newSettings] = await db
          .insert(referralSettings)
          .values({
            minimumDeliveries: 10,
            commissionAmount: "50.00",
            enabled: true,
          })
          .returning();

        return res.json(newSettings);
      }

      return res.json(settings);
    } catch (error) {
      console.error("Erro ao buscar configurações de indicação:", error);
      return res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  // PUT /api/referral-settings - Atualizar configurações de indicação
  app.put("/api/referral-settings", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { referralSettings, insertReferralSettingsSchema } = await import("@shared/schema");

      // Validar dados
      const result = insertReferralSettingsSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: result.error.errors
        });
      }

      // Buscar configuração existente
      const [existingSettings] = await db
        .select()
        .from(referralSettings)
        .limit(1);

      let updatedSettings;

      if (existingSettings) {
        // Atualizar configuração existente
        [updatedSettings] = await db
          .update(referralSettings)
          .set({
            ...result.data,
            updatedBy: req.session.userId,
            updatedAt: new Date(),
          })
          .where(eq(referralSettings.id, existingSettings.id))
          .returning();
      } else {
        // Criar nova configuração
        [updatedSettings] = await db
          .insert(referralSettings)
          .values({
            ...result.data,
            updatedBy: req.session.userId,
          })
          .returning();
      }

      return res.json(updatedSettings);
    } catch (error) {
      console.error("Erro ao atualizar configurações de indicação:", error);
      return res.status(500).json({ message: "Erro ao atualizar configurações" });
    }
  });

  // POST /api/referrals/validate - Validar código de indicação
  app.post("/api/referrals/validate", async (req, res) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ message: "Código é obrigatório" });
      }

      const { validateReferralCode } = await import("./utils/referralUtils");

      const driver = await validateReferralCode(code);

      if (!driver) {
        return res.status(404).json({
          valid: false,
          message: "Código de indicação inválido"
        });
      }

      return res.json({
        valid: true,
        driver: {
          id: driver.id,
          name: driver.name,
          referralCode: driver.referralCode,
        }
      });
    } catch (error) {
      console.error("Erro ao validar código de indicação:", error);
      return res.status(500).json({ message: "Erro ao validar código" });
    }
  });

  // GET /api/drivers/:id/referrals - Buscar indicações de um motorista
  app.get("/api/drivers/:id/referrals", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { driverReferrals, referralSettings } = await import("@shared/schema");

      // Buscar configurações de indicação
      const [settings] = await db
        .select()
        .from(referralSettings)
        .limit(1);

      const minimumDeliveries = settings?.minimumDeliveries || 10;
      const commissionAmount = settings?.commissionAmount || "50.00";

      // Buscar todas as indicações feitas por este motorista
      const rawReferrals = await db
        .select({
          id: driverReferrals.id,
          referredDriverId: driverReferrals.referredDriverId,
          referredName: driverReferrals.referredName,
          referredPhone: driverReferrals.referredPhone,
          status: driverReferrals.status,
          registeredAt: driverReferrals.registeredAt,
          deliveriesCompleted: driverReferrals.deliveriesCompleted,
          commissionEarned: driverReferrals.commissionEarned,
          commissionPaid: driverReferrals.commissionPaid,
          createdAt: driverReferrals.createdAt,
        })
        .from(driverReferrals)
        .where(eq(driverReferrals.referrerDriverId, id))
        .orderBy(desc(driverReferrals.createdAt));

      // Buscar nome do motorista indicado se já estiver cadastrado
      const referrals = await Promise.all(rawReferrals.map(async (referral) => {
        let referredName = referral.referredName;

        // Se tiver referredDriverId, buscar nome atualizado da tabela drivers
        if (referral.referredDriverId) {
          const [referred] = await db
            .select({ name: drivers.name })
            .from(drivers)
            .where(eq(drivers.id, referral.referredDriverId))
            .limit(1);

          if (referred?.name) {
            referredName = referred.name;
          }
        }

        return {
          ...referral,
          referredName: referredName || 'N/A'
        };
      }));

      // Adicionar informações de configuração a cada indicação
      const referralsWithConfig = referrals.map(referral => ({
        ...referral,
        minimumDeliveries,
        commissionAmount,
        // Status para exibição no app:
        // - Se commissionPaid = true: "pago"
        // - Se commissionEarned = true e commissionPaid = false: "aguardando"
        // - Se commissionEarned = false: "em_progresso"
        displayStatus: referral.commissionPaid
          ? "pago"
          : referral.commissionEarned
            ? "aguardando"
            : "em_progresso"
      }));

      // Calcular totais para exibir nos cards
      const totals = {
        // Total de comissões qualificadas (aguardando ou pagas)
        totalEarned: referrals
          .filter(r => r.commissionEarned)
          .reduce((sum, r) => sum + parseFloat(commissionAmount), 0),
        // Total já pago
        totalPaid: referrals
          .filter(r => r.commissionPaid)
          .reduce((sum, r) => sum + parseFloat(commissionAmount), 0),
        // Total aguardando pagamento
        totalPending: referrals
          .filter(r => r.commissionEarned && !r.commissionPaid)
          .reduce((sum, r) => sum + parseFloat(commissionAmount), 0),
        // Contadores
        count: {
          total: referrals.length,
          active: referrals.filter(r => r.status === "active").length,
          earned: referrals.filter(r => r.commissionEarned).length,
          paid: referrals.filter(r => r.commissionPaid).length,
          pending: referrals.filter(r => r.commissionEarned && !r.commissionPaid).length,
        }
      };

      return res.json({
        referrals: referralsWithConfig,
        totals
      });
    } catch (error) {
      console.error("Erro ao buscar indicações:", error);
      return res.status(500).json({ message: "Erro ao buscar indicações" });
    }
  });

  // GET /api/drivers/:id/commissions - Buscar comissões de um motorista
  app.get("/api/drivers/:id/commissions", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { referralCommissions } = await import("@shared/schema");

      // Buscar todas as comissões do motorista
      const commissions = await db
        .select({
          id: referralCommissions.id,
          referredDriverId: referralCommissions.referredDriverId,
          requiredDeliveries: referralCommissions.requiredDeliveries,
          completedDeliveries: referralCommissions.completedDeliveries,
          commissionAmount: referralCommissions.commissionAmount,
          status: referralCommissions.status,
          qualifiedAt: referralCommissions.qualifiedAt,
          paidAt: referralCommissions.paidAt,
          createdAt: referralCommissions.createdAt,
          // Dados do motorista indicado
          driverName: drivers.name,
        })
        .from(referralCommissions)
        .leftJoin(drivers, eq(referralCommissions.referredDriverId, drivers.id))
        .where(eq(referralCommissions.referrerDriverId, id))
        .orderBy(desc(referralCommissions.createdAt));

      // Calcular totais
      const totals = {
        pending: commissions.filter(c => c.status === 'pending').length,
        qualified: commissions.filter(c => c.status === 'qualified').length,
        paid: commissions.filter(c => c.status === 'paid').length,
        totalEarned: commissions
          .filter(c => c.status === 'qualified' || c.status === 'paid')
          .reduce((sum, c) => sum + parseFloat(c.commissionAmount || '0'), 0),
        totalPaid: commissions
          .filter(c => c.status === 'paid')
          .reduce((sum, c) => sum + parseFloat(c.commissionAmount || '0'), 0),
      };

      return res.json({
        commissions,
        totals,
      });
    } catch (error) {
      console.error("Erro ao buscar comissões:", error);
      return res.status(500).json({ message: "Erro ao buscar comissões" });
    }
  });

  // PUT /api/commissions/:id/pay - Marcar comissão como paga
  app.put("/api/commissions/:id/pay", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { referralCommissions, driverReferrals } = await import("@shared/schema");

      // Buscar a comissão
      const [commission] = await db
        .select()
        .from(referralCommissions)
        .where(eq(referralCommissions.id, id))
        .limit(1);

      if (!commission) {
        return res.status(404).json({ message: "Comissão não encontrada" });
      }

      if (commission.status !== 'qualified') {
        return res.status(400).json({ message: "Comissão não está qualificada para pagamento" });
      }

      // Atualizar status para pago
      const [updatedCommission] = await db
        .update(referralCommissions)
        .set({
          status: 'paid',
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(referralCommissions.id, id))
        .returning();

      // Atualizar também o registro de indicação
      await db
        .update(driverReferrals)
        .set({
          commissionPaid: true,
          updatedAt: new Date(),
        })
        .where(eq(driverReferrals.referredDriverId, commission.referredDriverId));

      return res.json(updatedCommission);
    } catch (error) {
      console.error("Erro ao marcar comissão como paga:", error);
      return res.status(500).json({ message: "Erro ao processar pagamento" });
    }
  });

  // GET /api/referrals - Listar todas as indicações/comissões (para admin)
  app.get("/api/referrals", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { driverReferrals, referralSettings } = await import("@shared/schema");

      // Buscar configurações de indicação para saber quantas entregas são necessárias
      const [settings] = await db
        .select()
        .from(referralSettings)
        .limit(1);

      const deliveriesRequired = settings?.minimumDeliveries || 10;
      const commissionAmount = settings?.commissionAmount || "50.00";

      // Buscar todas as indicações com informações dos motoristas e cidades
      const rawReferrals = await db
        .select({
          id: driverReferrals.id,
          referrerId: driverReferrals.referrerDriverId,
          referredId: driverReferrals.referredDriverId,
          deliveriesCompleted: driverReferrals.deliveriesCompleted,
          commissionEarned: driverReferrals.commissionEarned,
          commissionPaid: driverReferrals.commissionPaid,
          status: driverReferrals.status,
          createdAt: driverReferrals.createdAt,
        })
        .from(driverReferrals)
        .orderBy(desc(driverReferrals.createdAt));

      // Buscar dados dos motoristas e cidades separadamente
      const referrals = await Promise.all(rawReferrals.map(async (referral) => {
        // Buscar dados do indicador
        const [referrer] = await db
          .select({
            name: drivers.name,
            email: drivers.email,
            cpf: drivers.cpf,
            serviceLocationId: drivers.serviceLocationId,
          })
          .from(drivers)
          .where(eq(drivers.id, referral.referrerId))
          .limit(1);

        // Buscar dados do indicado (se já estiver cadastrado)
        const [referred] = referral.referredId ? await db
          .select({
            name: drivers.name,
            email: drivers.email,
            cpf: drivers.cpf,
            serviceLocationId: drivers.serviceLocationId,
          })
          .from(drivers)
          .where(eq(drivers.id, referral.referredId))
          .limit(1) : [];

        // Buscar cidade do indicador
        const [referrerCity] = referrer?.serviceLocationId ? await db
          .select({ nome: serviceLocations.name })
          .from(serviceLocations)
          .where(eq(serviceLocations.id, referrer.serviceLocationId))
          .limit(1) : [{ nome: 'N/A' }];

        // Buscar cidade do indicado
        const [referredCity] = referred?.serviceLocationId ? await db
          .select({ nome: serviceLocations.name })
          .from(serviceLocations)
          .where(eq(serviceLocations.id, referred.serviceLocationId))
          .limit(1) : [{ nome: 'N/A' }];

        return {
          id: referral.id,
          referrerId: referral.referrerId,
          referrerName: referrer?.name || 'N/A',
          referrerEmail: referrer?.email || 'N/A',
          referrerCpf: referrer?.cpf || 'N/A',
          referrerCity: referrerCity?.nome || 'N/A',
          referrerCityId: referrer?.serviceLocationId || null,
          referredId: referral.referredId || null,
          referredName: referred?.name || 'N/A',
          referredEmail: referred?.email || 'N/A',
          referredCpf: referred?.cpf || 'N/A',
          referredCity: referredCity?.nome || 'N/A',
          referredCityId: referred?.serviceLocationId || null,
          deliveriesCompleted: referral.deliveriesCompleted,
          deliveriesRequired: deliveriesRequired,
          commissionPaid: referral.commissionPaid,
          commissionAmount: `R$ ${parseFloat(referral.commissionEarned || commissionAmount).toFixed(2)}`,
          status: referral.status,
          createdAt: referral.createdAt,
        };
      }));

      return res.json(referrals);
    } catch (error) {
      console.error("Erro ao buscar indicações:", error);
      return res.status(500).json({ message: "Erro ao buscar indicações" });
    }
  });

  // PUT /api/referrals/:id/mark-commission-paid - Marcar comissão como paga
  app.put("/api/referrals/:id/mark-commission-paid", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { driverReferrals } = await import("@shared/schema");

      // Buscar a indicação
      const [referral] = await db
        .select()
        .from(driverReferrals)
        .where(eq(driverReferrals.id, id))
        .limit(1);

      if (!referral) {
        return res.status(404).json({ message: "Indicação não encontrada" });
      }

      if (referral.commissionPaid) {
        return res.status(400).json({ message: "Comissão já foi paga" });
      }

      // Atualizar status para pago
      const [updatedReferral] = await db
        .update(driverReferrals)
        .set({
          commissionPaid: true,
          updatedAt: new Date(),
        })
        .where(eq(driverReferrals.id, id))
        .returning();

      return res.json(updatedReferral);
    } catch (error) {
      console.error("Erro ao marcar comissão como paga:", error);
      return res.status(500).json({ message: "Erro ao processar pagamento" });
    }
  });

  // ========================================
  // COMPANIES (EMPRESAS) ROUTES
  // ========================================

  // GET /api/companies - Listar empresas
  app.get("/api/companies", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const companies = await storage.getAllCompanies();
      return res.json(companies);
    } catch (error) {
      console.error("Erro ao listar empresas:", error);
      return res.status(500).json({ message: "Erro ao buscar empresas" });
    }
  });

  // POST /api/companies - Criar nova empresa
  app.post("/api/companies", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { name, cnpj, password } = req.body;

      if (!name) {
        return res.status(400).json({
          message: "O nome da empresa é obrigatório"
        });
      }

      // Verificar se já existe uma empresa com o mesmo CNPJ
      if (cnpj) {
        const existing = await storage.getCompanyByCnpj(cnpj);
        if (existing) {
          return res.status(400).json({
            message: "Já existe uma empresa cadastrada com este CNPJ"
          });
        }
      }

      // Fazer hash da senha se foi fornecida
      const companyData = { ...req.body };
      if (password) {
        companyData.password = await bcrypt.hash(password, 10);
      }

      const newCompany = await storage.createCompany(companyData);

      return res.status(201).json(newCompany);
    } catch (error) {
      console.error("Erro ao criar empresa:", error);
      return res.status(500).json({ message: "Erro ao criar empresa" });
    }
  });

  // PUT /api/companies/:id - Atualizar empresa
  app.put("/api/companies/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { cnpj, password } = req.body;

      // Se o CNPJ foi alterado, verificar se já existe outra empresa com esse CNPJ
      if (cnpj) {
        const existing = await storage.getCompanyByCnpj(cnpj);
        if (existing && existing.id !== id) {
          return res.status(400).json({
            message: "Já existe uma empresa cadastrada com este CNPJ"
          });
        }
      }

      // Fazer hash da senha se foi fornecida (ao editar, só atualiza se veio no request)
      const companyData = { ...req.body };
      if (password) {
        companyData.password = await bcrypt.hash(password, 10);
      } else {
        // Se não forneceu senha, remove do objeto para não sobrescrever
        delete companyData.password;
      }

      const updated = await storage.updateCompany(id, companyData);

      if (!updated) {
        return res.status(404).json({ message: "Empresa não encontrada" });
      }

      return res.json(updated);
    } catch (error) {
      console.error("Erro ao atualizar empresa:", error);
      return res.status(500).json({ message: "Erro ao atualizar empresa" });
    }
  });

  // DELETE /api/companies/:id - Excluir empresa
  app.delete("/api/companies/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      await storage.deleteCompany(id);

      return res.json({ message: "Empresa excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir empresa:", error);
      return res.status(500).json({ message: "Erro ao excluir empresa" });
    }
  });

  // GET /api/companies/:id/trips - Buscar corridas de uma empresa
  app.get("/api/companies/:id/trips", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const trips = await storage.getCompanyTrips(id);

      return res.json(trips);
    } catch (error) {
      console.error("Erro ao buscar corridas da empresa:", error);
      return res.status(500).json({ message: "Erro ao buscar corridas" });
    }
  });

  // ========================================
  // CITY PRICES (PREÇOS) ROUTES
  // ========================================

  // GET /api/city-prices - Listar preços
  app.get("/api/city-prices", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const cityPrices = await storage.getAllCityPrices();
      return res.json(cityPrices);
    } catch (error) {
      console.error("Erro ao listar preços:", error);
      return res.status(500).json({ message: "Erro ao buscar preços" });
    }
  });

  // POST /api/city-prices - Criar novo preço
  app.post("/api/city-prices", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      console.log("📝 Dados recebidos para criar preço:", req.body);

      // Verificar se já existe um preço para essa combinação cidade + categoria
      const existing = await storage.getCityPriceByLocationAndVehicle(
        req.body.serviceLocationId,
        req.body.vehicleTypeId
      );

      if (existing) {
        console.log("⚠️ Preço já existe para esta combinação");
        return res.status(400).json({
          message: "Já existe uma configuração de preço para esta cidade e categoria"
        });
      }

      console.log("✅ Criando novo preço...");
      const cityPrice = await storage.createCityPrice(req.body);
      console.log("✅ Preço criado com sucesso:", cityPrice);
      return res.status(201).json(cityPrice);
    } catch (error: any) {
      console.error("❌ Erro ao criar preço:", error);
      console.error("❌ Detalhes do erro:", error.message);
      console.error("❌ Stack trace:", error.stack);
      return res.status(500).json({ message: "Erro ao criar preço: " + error.message });
    }
  });

  // PUT /api/city-prices/:id - Atualizar preço
  app.put("/api/city-prices/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const cityPrice = await storage.updateCityPrice(id, req.body);

      if (!cityPrice) {
        return res.status(404).json({ message: "Preço não encontrado" });
      }

      return res.json(cityPrice);
    } catch (error) {
      console.error("Erro ao atualizar preço:", error);
      return res.status(500).json({ message: "Erro ao atualizar preço" });
    }
  });

  // DELETE /api/city-prices/:id - Excluir preço
  app.delete("/api/city-prices/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      await storage.deleteCityPrice(id);

      return res.json({ message: "Configuração de preço excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir preço:", error);
      return res.status(500).json({ message: "Erro ao excluir preço" });
    }
  });

  // ========================================
  // SETTINGS ROUTES
  // ========================================

  // GET /api/settings - Buscar configurações
  app.get("/api/settings", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const settings = await storage.getSettings();

      if (!settings) {
        return res.status(404).json({ message: "Configurações não encontradas" });
      }

      res.json(settings);
    } catch (error: any) {
      console.error("Erro ao buscar configurações:", error);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  // PUT /api/settings - Atualizar configurações
  app.put("/api/settings", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      console.log("📝 Dados recebidos para salvar configurações:");
      console.log("   autoCancelTimeout:", req.body.autoCancelTimeout, typeof req.body.autoCancelTimeout);
      console.log("   driverAcceptanceTimeout:", req.body.driverAcceptanceTimeout, typeof req.body.driverAcceptanceTimeout);
      console.log("   minTimeToFindDriver:", req.body.minTimeToFindDriver, typeof req.body.minTimeToFindDriver);

      // Validar dados
      const validatedData = insertSettingsSchema.parse(req.body);
      console.log("✅ Dados validados:");
      console.log("   autoCancelTimeout:", validatedData.autoCancelTimeout, typeof validatedData.autoCancelTimeout);

      // Atualizar ou criar configurações
      const settings = await storage.updateSettings(validatedData);
      console.log("💾 Configurações salvas no banco:");
      console.log("   autoCancelTimeout:", settings?.autoCancelTimeout, typeof settings?.autoCancelTimeout);

      if (!settings) {
        return res.status(500).json({ message: "Erro ao salvar configurações" });
      }

      res.json(settings);
    } catch (error: any) {
      console.error("Erro ao salvar configurações:", error);

      if (error.name === "ZodError") {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: error.errors
        });
      }

      res.status(500).json({ message: "Erro ao salvar configurações" });
    }
  });

  // ========================================
  // COMMISSION TIERS ROUTES
  // ========================================

  // GET /api/commission-tiers - Listar todas as faixas de comissão
  app.get("/api/commission-tiers", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const tiers = await storage.getAllCommissionTiers();
      res.json(tiers);
    } catch (error: any) {
      console.error("Erro ao buscar faixas de comissão:", error);
      res.status(500).json({ message: "Erro ao buscar faixas de comissão" });
    }
  });

  // POST /api/commission-tiers - Criar nova faixa de comissão
  app.post("/api/commission-tiers", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { minDeliveries, maxDeliveries, commissionPercentage, active } = req.body;

      if (minDeliveries === undefined || commissionPercentage === undefined) {
        return res.status(400).json({
          message: "Mínimo de entregas e percentual de comissão são obrigatórios"
        });
      }

      // Validação: maxDeliveries deve ser maior que minDeliveries
      if (maxDeliveries !== null && maxDeliveries !== undefined && maxDeliveries <= minDeliveries) {
        return res.status(400).json({
          message: "Máximo de entregas deve ser maior que o mínimo"
        });
      }

      const tier = await storage.createCommissionTier({
        minDeliveries: Number(minDeliveries),
        maxDeliveries: maxDeliveries ? Number(maxDeliveries) : null,
        commissionPercentage: String(commissionPercentage),
        active: active ?? true,
      });

      res.status(201).json(tier);
    } catch (error: any) {
      console.error("Erro ao criar faixa de comissão:", error);
      res.status(500).json({ message: "Erro ao criar faixa de comissão" });
    }
  });

  // PUT /api/commission-tiers/:id - Atualizar faixa de comissão
  app.put("/api/commission-tiers/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { minDeliveries, maxDeliveries, commissionPercentage, active } = req.body;

      // Validação: maxDeliveries deve ser maior que minDeliveries
      if (maxDeliveries !== null && maxDeliveries !== undefined &&
          minDeliveries !== undefined && maxDeliveries <= minDeliveries) {
        return res.status(400).json({
          message: "Máximo de entregas deve ser maior que o mínimo"
        });
      }

      const updateData: any = {};
      if (minDeliveries !== undefined) updateData.minDeliveries = Number(minDeliveries);
      if (maxDeliveries !== undefined) updateData.maxDeliveries = maxDeliveries ? Number(maxDeliveries) : null;
      if (commissionPercentage !== undefined) updateData.commissionPercentage = String(commissionPercentage);
      if (active !== undefined) updateData.active = active;

      const tier = await storage.updateCommissionTier(id, updateData);

      if (!tier) {
        return res.status(404).json({ message: "Faixa de comissão não encontrada" });
      }

      res.json(tier);
    } catch (error: any) {
      console.error("Erro ao atualizar faixa de comissão:", error);
      res.status(500).json({ message: "Erro ao atualizar faixa de comissão" });
    }
  });

  // DELETE /api/commission-tiers/:id - Excluir faixa de comissão
  app.delete("/api/commission-tiers/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      await storage.deleteCommissionTier(id);

      res.json({ message: "Faixa de comissão excluída com sucesso" });
    } catch (error: any) {
      console.error("Erro ao excluir faixa de comissão:", error);
      res.status(500).json({ message: "Erro ao excluir faixa de comissão" });
    }
  });

  // ========================================
  // PROMOTIONS (Complete e Ganhe) ROUTES
  // ========================================

  // GET /api/promotions - Listar todas as promoções
  app.get("/api/promotions", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const result = await db.select().from(promotions).orderBy(promotions.createdAt);
      res.json(result);
    } catch (error: any) {
      console.error("Erro ao listar promoções:", error);
      res.status(500).json({ message: "Erro ao listar promoções" });
    }
  });

  // POST /api/promotions - Criar nova promoção
  app.post("/api/promotions", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const validation = insertPromotionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validation.error.errors,
        });
      }

      const [promotion] = await db
        .insert(promotions)
        .values(validation.data)
        .returning();

      res.json(promotion);
    } catch (error: any) {
      console.error("Erro ao criar promoção:", error);
      res.status(500).json({ message: "Erro ao criar promoção" });
    }
  });

  // PUT /api/promotions/:id - Atualizar promoção
  app.put("/api/promotions/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      const validation = insertPromotionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validation.error.errors,
        });
      }

      const [promotion] = await db
        .update(promotions)
        .set({ ...validation.data, updatedAt: new Date() })
        .where(eq(promotions.id, id))
        .returning();

      res.json(promotion);
    } catch (error: any) {
      console.error("Erro ao atualizar promoção:", error);
      res.status(500).json({ message: "Erro ao atualizar promoção" });
    }
  });

  // DELETE /api/promotions/:id - Excluir promoção
  app.delete("/api/promotions/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      await db.delete(promotions).where(eq(promotions.id, id));

      res.json({ message: "Promoção excluída com sucesso" });
    } catch (error: any) {
      console.error("Erro ao excluir promoção:", error);
      res.status(500).json({ message: "Erro ao excluir promoção" });
    }
  });

  // ========================================
  // SERVICE LOCATIONS (CIDADES) ROUTES
  // ========================================

  // GET /api/cities - Listar cidades
  app.get("/api/cities", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const cities = await storage.getAllServiceLocations();
      return res.json(cities);
    } catch (error) {
      console.error("Erro ao listar cidades:", error);
      return res.status(500).json({ message: "Erro ao buscar cidades" });
    }
  });

  // POST /api/cities - Criar cidade
  app.post("/api/cities", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { name, state, latitude, longitude } = req.body;

      if (!name || !state) {
        return res.status(400).json({ message: "Nome e estado são obrigatórios" });
      }

      const city = await storage.createServiceLocation({
        name,
        state,
        latitude: latitude || null,
        longitude: longitude || null,
        active: true,
      });

      return res.json(city);
    } catch (error) {
      console.error("Erro ao criar cidade:", error);
      return res.status(500).json({ message: "Erro ao criar cidade" });
    }
  });

  // PUT /api/cities/:id - Atualizar cidade
  app.put("/api/cities/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { name, state, active, latitude, longitude } = req.body;

      const city = await storage.updateServiceLocation(id, {
        name,
        state,
        active,
        latitude: latitude || null,
        longitude: longitude || null,
      });

      if (!city) {
        return res.status(404).json({ message: "Cidade não encontrada" });
      }

      return res.json(city);
    } catch (error) {
      console.error("Erro ao atualizar cidade:", error);
      return res.status(500).json({ message: "Erro ao atualizar cidade" });
    }
  });

  // DELETE /api/cities/:id - Excluir cidade
  app.delete("/api/cities/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      // Verificar se existem preços associados
      const cityPrices = await storage.getCityPricesByLocation(id);

      if (cityPrices.length > 0) {
        return res.status(400).json({
          message: `Não é possível excluir esta cidade pois existem ${cityPrices.length} configuração(ões) de preço associada(s). Exclua os preços primeiro.`
        });
      }

      // Verificar se existem motoristas associados
      const drivers = await storage.getDriversByLocation(id);

      if (drivers.length > 0) {
        return res.status(400).json({
          message: `Não é possível excluir esta cidade pois existem ${drivers.length} motorista(s) associado(s). Exclua os motoristas primeiro.`
        });
      }

      await storage.deleteServiceLocation(id);

      return res.json({ message: "Cidade excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir cidade:", error);
      return res.status(500).json({ message: "Erro ao excluir cidade" });
    }
  });

  // ========================================
  // DRIVERS (MOTORISTAS) ROUTES
  // ========================================

  // GET /api/drivers - Listar motoristas
  app.get("/api/drivers", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const drivers = await storage.getAllDrivers();
      return res.json(drivers);
    } catch (error) {
      console.error("Erro ao listar motoristas:", error);
      return res.status(500).json({ message: "Erro ao buscar motoristas" });
    }
  });

  // GET /api/drivers/:id - Buscar motorista específico
  app.get("/api/drivers/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const driver = await storage.getDriver(id);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      return res.json({
        ...driver,
        referralCode: driver.referralCode, // Garantir que o código está incluído
        totalDeliveries: driver.totalDeliveries,
        referredByCode: driver.referredByCode,
      });
    } catch (error) {
      console.error("Erro ao buscar motorista:", error);
      return res.status(500).json({ message: "Erro ao buscar motorista" });
    }
  });

  // POST /api/drivers - Criar novo motorista
  app.post("/api/drivers", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { name, email, password, cpf, mobile, referralCode } = req.body;

      if (!name || !mobile) {
        return res.status(400).json({
          message: "Nome e WhatsApp são obrigatórios"
        });
      }

      // Importar utilitários de indicação
      const { generateReferralCode, validateReferralCode } = await import("./utils/referralUtils");
      const { referralCommissions, referralSettings, driverReferrals } = await import("@shared/schema");

      // Gerar código único de indicação para o novo motorista
      const uniqueReferralCode = await generateReferralCode(name);

      // Hash da senha se foi fornecida
      let hashedPassword = null;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // Validar código de indicação se fornecido
      let referredById = null;
      let referredByCode = null;

      if (referralCode) {
        const referrer = await validateReferralCode(referralCode);
        if (referrer) {
          referredById = referrer.id;
          referredByCode = referralCode.toUpperCase();
        } else {
          return res.status(400).json({
            message: "Código de indicação inválido"
          });
        }
      }

      // Criar motorista com código de indicação
      const newDriver = await storage.createDriver({
        ...req.body,
        password: hashedPassword,
        active: true,
        approve: false,
        available: false,
        referralCode: uniqueReferralCode,
        referredByCode,
        referredById,
        totalDeliveries: 0,
      });

      // Consultar processos criminais automaticamente se o CPF foi fornecido
      if (cpf && process.env.CELLEREIT_API_TOKEN) {
        try {
          const cleanCpf = cpf.replace(/[^\d]/g, "");
          if (cleanCpf.length === 11) {
            console.log(`🔍 Consultando CPF ${cleanCpf} automaticamente para novo motorista ${newDriver.id}`);

            const apiUrl = `https://api.gw.cellereit.com.br/consultas/validacao-fiscal-pj?cpf=${cleanCpf}`;
            const criminalResponse = await fetch(apiUrl, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${process.env.CELLEREIT_API_TOKEN}`,
              },
            });

            if (criminalResponse.ok) {
              const apiData = await criminalResponse.json();
              const criminalRecords: Array<{ tipo: string; assunto: string; tribunalTipo: string }> = [];

              if (apiData.Processos && Array.isArray(apiData.Processos)) {
                for (const processo of apiData.Processos) {
                  if (processo.TribunalTipo === "CRIMINAL") {
                    criminalRecords.push({
                      tipo: processo.Tipo || "Não informado",
                      assunto: processo.Assunto || "Não informado",
                      tribunalTipo: processo.TribunalTipo,
                    });
                  }
                }
              }

              const hasCriminalRecords = criminalRecords.length > 0;

              await db
                .update(drivers)
                .set({
                  hasCriminalRecords,
                  criminalRecords: hasCriminalRecords ? criminalRecords : null,
                  criminalCheckDate: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(drivers.id, newDriver.id));

              console.log(`✅ Consulta criminal automática concluída para motorista ${newDriver.id}. Processos: ${criminalRecords.length}`);
            }
          }
        } catch (criminalError) {
          console.error("Erro ao consultar processos criminais automaticamente:", criminalError);
          // Não bloqueia o cadastro se a consulta falhar
        }
      }

      // Se foi indicado, criar registros de indicação e comissão
      if (referredById) {
        // Buscar configurações de indicação
        const [settings] = await db
          .select()
          .from(referralSettings)
          .where(eq(referralSettings.enabled, true))
          .limit(1);

        if (settings) {
          // Criar registro de comissão pendente
          await db.insert(referralCommissions).values({
            referrerDriverId: referredById,
            referredDriverId: newDriver.id,
            requiredDeliveries: settings.minimumDeliveries,
            completedDeliveries: 0,
            commissionAmount: settings.commissionAmount,
            status: "pending",
          });

          // Criar registro de indicação para visualização
          await db.insert(driverReferrals).values({
            referrerDriverId: referredById,
            referredDriverId: newDriver.id,
            referredName: name,
            referredPhone: mobile,
            referralCode: referredByCode,
            status: "registered",
            registeredAt: new Date(),
            deliveriesCompleted: 0,
            commissionEarned: "0",
            commissionPaid: false,
          });
        }
      }

      return res.status(201).json(newDriver);
    } catch (error) {
      console.error("Erro ao criar motorista:", error);
      return res.status(500).json({ message: "Erro ao criar motorista" });
    }
  });

  // PUT /api/drivers/:id - Atualizar motorista
  app.put("/api/drivers/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { password, ...otherData } = req.body;

      // Buscar motorista atual para comparar o status de aprovação
      const [currentDriver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, id))
        .limit(1);

      if (!currentDriver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      let updateData = { ...otherData };

      // Se a senha foi fornecida, fazer o hash
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const updated = await storage.updateDriver(id, updateData);

      if (!updated) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      // 🔔 Enviar notificação push se o status de aprovação mudou
      if ('approve' in otherData && currentDriver.fcmToken) {
        const wasApproved = currentDriver.approve;
        const isNowApproved = otherData.approve;

        if (!wasApproved && isNowApproved) {
          // Motorista foi aprovado
          await sendPushNotification(
            currentDriver.fcmToken,
            "🎉 Cadastro Aprovado!",
            "Parabéns! Seu cadastro foi aprovado pelo administrador. Agora você pode fazer login e começar a trabalhar.",
            {
              type: "driver_approved",
              driverId: id,
            }
          );
        } else if (wasApproved && !isNowApproved) {
          // Motorista foi desaprovado/rejeitado
          await sendPushNotification(
            currentDriver.fcmToken,
            "❌ Cadastro Rejeitado",
            "Seu cadastro foi rejeitado pelo administrador. Entre em contato com o suporte para mais informações.",
            {
              type: "driver_rejected",
              driverId: id,
            }
          );
        }
      }

      return res.json(updated);
    } catch (error) {
      console.error("Erro ao atualizar motorista:", error);
      return res.status(500).json({ message: "Erro ao atualizar motorista" });
    }
  });

  // DELETE /api/drivers/:id - Excluir motorista
  app.delete("/api/drivers/:id", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      await storage.deleteDriver(id);

      return res.json({ message: "Motorista excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir motorista:", error);
      return res.status(500).json({ message: "Erro ao excluir motorista" });
    }
  });

  // GET /api/drivers/:id/documents - Buscar documentos de um motorista
  app.get("/api/drivers/:id/documents", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const documents = await storage.getDriverDocuments(id);

      return res.json({
        success: true,
        documents: documents
      });
    } catch (error) {
      console.error("Erro ao buscar documentos do motorista:", error);
      return res.status(500).json({ message: "Erro ao buscar documentos" });
    }
  });

  // POST /api/drivers/documents/:documentId/approve - Aprovar documento
  app.post("/api/drivers/documents/:documentId/approve", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { documentId } = req.params;

      // Buscar documento para obter informações
      const [document] = await db
        .select({
          id: driverDocuments.id,
          driverId: driverDocuments.driverId,
          documentTypeId: driverDocuments.documentTypeId,
          documentTypeName: driverDocumentTypes.name,
        })
        .from(driverDocuments)
        .leftJoin(driverDocumentTypes, eq(driverDocuments.documentTypeId, driverDocumentTypes.id))
        .where(eq(driverDocuments.id, documentId))
        .limit(1);

      if (!document) {
        return res.status(404).json({ message: "Documento não encontrado" });
      }

      // Atualizar status do documento para aprovado
      const [updatedDoc] = await db
        .update(driverDocuments)
        .set({
          status: "approved",
          rejectionReason: null,
        })
        .where(eq(driverDocuments.id, documentId))
        .returning();

      // 🔔 Enviar notificação push para o motorista
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, document.driverId))
        .limit(1);

      if (driver && driver.fcmToken) {
        // Verificar quantos documentos estão aprovados agora
        const allDocs = await db
          .select()
          .from(driverDocuments)
          .where(eq(driverDocuments.driverId, document.driverId));

        const approvedCount = allDocs.filter(d => d.status === "approved").length;
        const totalCount = allDocs.length;

        await sendPushNotification(
          driver.fcmToken,
          "✅ Documento Aprovado",
          `Seu documento "${document.documentTypeName || 'documento'}" foi aprovado! ${approvedCount}/${totalCount} documentos aprovados. Continue aguardando a análise final.`,
          {
            type: "document_approved",
            driverId: driver.id,
            documentId: documentId,
            documentType: document.documentTypeName || "",
            approvedCount: approvedCount.toString(),
            totalCount: totalCount.toString(),
          }
        );
      }

      return res.json({
        success: true,
        message: "Documento aprovado com sucesso",
        data: updatedDoc
      });
    } catch (error) {
      console.error("Erro ao aprovar documento:", error);
      return res.status(500).json({ message: "Erro ao aprovar documento" });
    }
  });

  // POST /api/drivers/documents/:documentId/reject - Rejeitar documento
  app.post("/api/drivers/documents/:documentId/reject", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { documentId } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason) {
        return res.status(400).json({
          message: "O motivo da rejeição é obrigatório"
        });
      }

      // Buscar documento para obter informações
      const [document] = await db
        .select({
          id: driverDocuments.id,
          driverId: driverDocuments.driverId,
          documentTypeId: driverDocuments.documentTypeId,
          documentTypeName: driverDocumentTypes.name,
        })
        .from(driverDocuments)
        .leftJoin(driverDocumentTypes, eq(driverDocuments.documentTypeId, driverDocumentTypes.id))
        .where(eq(driverDocuments.id, documentId))
        .limit(1);

      if (!document) {
        return res.status(404).json({ message: "Documento não encontrado" });
      }

      // Atualizar status do documento para rejeitado
      const [updatedDoc] = await db
        .update(driverDocuments)
        .set({
          status: "rejected",
          rejectionReason: rejectionReason,
        })
        .where(eq(driverDocuments.id, documentId))
        .returning();

      // 🔔 Enviar notificação push para o motorista
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, document.driverId))
        .limit(1);

      console.log(`📲 Tentando enviar notificação de rejeição de documento:`, {
        driverId: document.driverId,
        documentType: document.documentTypeName,
        hasFcmToken: !!driver?.fcmToken,
        fcmToken: driver?.fcmToken ? `${driver.fcmToken.substring(0, 20)}...` : 'null'
      });

      if (driver && driver.fcmToken) {
        const result = await sendPushNotification(
          driver.fcmToken,
          "📄 Documento Rejeitado",
          `Seu documento "${document.documentTypeName || 'documento'}" foi rejeitado. Motivo: ${rejectionReason}. Por favor, envie novamente.`,
          {
            type: "document_rejected",
            driverId: driver.id,
            documentId: documentId,
            documentType: document.documentTypeName || "",
            rejectionReason: rejectionReason,
          }
        );

        if (result) {
          console.log(`✅ Notificação de documento rejeitado enviada com sucesso!`);
        } else {
          console.log(`❌ Falha ao enviar notificação - Firebase pode não estar configurado`);
        }
      } else {
        console.log(`⚠️ Notificação não enviada: ${!driver ? 'motorista não encontrado' : 'motorista sem FCM token'}`);
      }

      return res.json({
        success: true,
        message: "Documento rejeitado",
        data: updatedDoc
      });
    } catch (error) {
      console.error("Erro ao rejeitar documento:", error);
      return res.status(500).json({ message: "Erro ao rejeitar documento" });
    }
  });

  // GET /api/drivers/:id/notes - Buscar notas de um motorista
  app.get("/api/drivers/:id/notes", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const notes = await storage.getDriverNotes(id);

      return res.json(notes);
    } catch (error) {
      console.error("Erro ao buscar notas do motorista:", error);
      return res.status(500).json({ message: "Erro ao buscar notas" });
    }
  });

  // GET /api/drivers/:id/trips - Buscar corridas de um motorista
  app.get("/api/drivers/:id/trips", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const trips = await storage.getDriverTrips(id);

      return res.json(trips);
    } catch (error) {
      console.error("Erro ao buscar corridas do motorista:", error);
      return res.status(500).json({ message: "Erro ao buscar corridas" });
    }
  });

  // POST /api/drivers/:id/notes - Adicionar nota a um motorista
  app.post("/api/drivers/:id/notes", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { note, noteType } = req.body;

      if (!note) {
        return res.status(400).json({ message: "Comentário é obrigatório" });
      }

      const newNote = await storage.createDriverNote({
        driverId: id,
        userId: req.session.userId,
        note,
        noteType: noteType || "general",
      });

      return res.status(201).json(newNote);
    } catch (error) {
      console.error("Erro ao adicionar nota:", error);
      return res.status(500).json({ message: "Erro ao adicionar nota" });
    }
  });

  // POST /api/drivers/:id/block - Bloquear motorista
  app.post("/api/drivers/:id/block", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { reason } = req.body;

      // Atualizar motorista para bloqueado
      await storage.updateDriver(id, { active: false });

      // Adicionar nota de bloqueio
      if (reason) {
        await storage.createDriverNote({
          driverId: id,
          userId: req.session.userId,
          note: reason,
          noteType: "block",
        });
      }

      return res.json({ message: "Motorista bloqueado com sucesso" });
    } catch (error) {
      console.error("Erro ao bloquear motorista:", error);
      return res.status(500).json({ message: "Erro ao bloquear motorista" });
    }
  });

  // POST /api/drivers/:id/unblock - Desbloquear motorista
  app.post("/api/drivers/:id/unblock", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { reason } = req.body;

      // Atualizar motorista para ativo
      await storage.updateDriver(id, { active: true });

      // Adicionar nota de desbloqueio
      if (reason) {
        await storage.createDriverNote({
          driverId: id,
          userId: req.session.userId,
          note: reason,
          noteType: "unblock",
        });
      }

      return res.json({ message: "Motorista desbloqueado com sucesso" });
    } catch (error) {
      console.error("Erro ao desbloquear motorista:", error);
      return res.status(500).json({ message: "Erro ao desbloquear motorista" });
    }
  });

  // POST /api/drivers/:id/device - Salvar device_id (IMEI) do motorista
  app.post("/api/drivers/:id/device", async (req, res) => {
    try {
      const { id } = req.params;
      const { deviceId } = req.body;

      if (!deviceId) {
        return res.status(400).json({ message: "Device ID é obrigatório" });
      }

      // Verificar se o motorista existe
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, id))
        .limit(1);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      // Atualizar o device_id do motorista
      const [updatedDriver] = await db
        .update(drivers)
        .set({
          deviceId: deviceId,
          updatedAt: new Date(),
        })
        .where(eq(drivers.id, id))
        .returning();

      console.log(`✅ Device ID atualizado para motorista ${id}: ${deviceId}`);

      return res.json({
        success: true,
        message: "Device ID salvo com sucesso",
        data: {
          driverId: updatedDriver.id,
          deviceId: updatedDriver.deviceId,
        }
      });
    } catch (error) {
      console.error("Erro ao salvar device ID:", error);
      return res.status(500).json({ message: "Erro ao salvar device ID" });
    }
  });

  // POST /api/drivers/:id/check-criminal - Consultar processos criminais do motorista
  app.post("/api/drivers/:id/check-criminal", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      // Verificar se o motorista existe
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, id))
        .limit(1);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      if (!driver.cpf) {
        return res.status(400).json({ message: "Motorista não possui CPF cadastrado" });
      }

      // Limpar CPF (remover pontos e traços)
      const cleanCpf = driver.cpf.replace(/[^\d]/g, "");

      if (cleanCpf.length !== 11) {
        return res.status(400).json({ message: "CPF inválido" });
      }

      const apiToken = process.env.CELLEREIT_API_TOKEN;
      if (!apiToken) {
        return res.status(500).json({ message: "Token da API de consulta não configurado" });
      }

      // Fazer consulta à API externa (GET com query string)
      console.log(`🔍 Consultando CPF ${cleanCpf} para motorista ${id}`);

      const apiUrl = `https://api.gw.cellereit.com.br/consultas/validacao-fiscal-pj?cpf=${cleanCpf}`;
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro na API externa:", errorText);

        // Se a API retornar erro, pode ser que não encontrou nada (nada consta)
        if (response.status === 404 || response.status === 400) {
          // Marcar como consultado mas sem registros
          const [updatedDriver] = await db
            .update(drivers)
            .set({
              hasCriminalRecords: false,
              criminalRecords: null,
              criminalCheckDate: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(drivers.id, id))
            .returning();

          return res.json({
            success: true,
            hasCriminalRecords: false,
            criminalRecords: [],
            checkDate: updatedDriver.criminalCheckDate,
            message: "Consulta realizada - Nada consta"
          });
        }

        return res.status(500).json({ message: "Erro ao consultar API externa. Verifique o endpoint e token da API." });
      }

      const apiData = await response.json();
      console.log("Resposta da API:", JSON.stringify(apiData, null, 2));

      // Filtrar processos criminais
      const criminalRecords: Array<{ tipo: string; assunto: string; tribunalTipo: string }> = [];

      // Verificar se há processos na resposta (campo "Processos" com P maiúsculo conforme documentação)
      if (apiData.Processos && Array.isArray(apiData.Processos)) {
        for (const processo of apiData.Processos) {
          if (processo.TribunalTipo === "CRIMINAL") {
            criminalRecords.push({
              tipo: processo.Tipo || "Não informado",
              assunto: processo.Assunto || "Não informado",
              tribunalTipo: processo.TribunalTipo,
            });
          }
        }
      }

      const hasCriminalRecords = criminalRecords.length > 0;

      // Atualizar motorista com os dados da consulta
      const [updatedDriver] = await db
        .update(drivers)
        .set({
          hasCriminalRecords,
          criminalRecords: hasCriminalRecords ? criminalRecords : null,
          criminalCheckDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(drivers.id, id))
        .returning();

      console.log(`✅ Consulta criminal concluída para motorista ${id}. Processos criminais: ${criminalRecords.length}`);

      return res.json({
        success: true,
        hasCriminalRecords,
        criminalRecords,
        checkDate: updatedDriver.criminalCheckDate,
      });
    } catch (error) {
      console.error("Erro ao consultar processos criminais:", error);
      return res.status(500).json({ message: "Erro ao consultar processos criminais" });
    }
  });

  // ========================================
  // EMPRESA DELIVERIES ROUTES
  // ========================================

  // GET /api/empresa/deliveries - Listar entregas da empresa
  app.get("/api/empresa/deliveries", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      // Usar SQL direto com conversão de UTC para horário de Brasília
      // Os timestamps estão armazenados em UTC no banco (timestamp without timezone)
      // Primeiro indicamos que são UTC, depois convertemos para America/Sao_Paulo
      const { rows } = await pool.query(`
        SELECT
          r.id,
          r.request_number AS "requestNumber",
          r.customer_name AS "customerName",
          to_char(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "createdAt",
          r.driver_id AS "driverId",
          r.is_driver_started AS "isDriverStarted",
          r.is_driver_arrived AS "isDriverArrived",
          r.is_trip_start AS "isTripStart",
          r.is_completed AS "isCompleted",
          r.is_cancelled AS "isCancelled",
          r.cancel_reason AS "cancelReason",
          to_char(r.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "cancelledAt",
          to_char(r.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "completedAt",
          to_char(r.accepted_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "acceptedAt",
          to_char(r.arrived_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "arrivedAt",
          to_char(r.trip_started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "tripStartedAt",
          to_char(r.delivered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "deliveredAt",
          to_char(r.returning_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "returningAt",
          to_char(r.returned_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "returnedAt",
          r.needs_return AS "needsReturn",
          r.total_distance AS "totalDistance",
          r.total_time AS "totalTime",
          r.estimated_time AS "estimatedTime",
          rp.pick_address AS "pickupAddress",
          rp.drop_address AS "dropoffAddress",
          rp.pick_lat AS "pickupLat",
          rp.pick_lng AS "pickupLng",
          rp.drop_lat AS "dropoffLat",
          rp.drop_lng AS "dropoffLng",
          rb.total_amount AS "totalPrice",
          vt.name AS "vehicleTypeName",
          d.name AS "driverName",
          d.mobile AS "driverPhone",
          cp.cancellation_fee AS "cancellationFeePercentage",
          CASE
            WHEN r.is_cancelled = true THEN 'cancelled'
            WHEN r.is_completed = true THEN 'completed'
            WHEN r.returning_at IS NOT NULL AND r.returned_at IS NULL THEN 'returning'
            WHEN r.delivered_at IS NOT NULL AND r.needs_return = true AND r.returning_at IS NULL THEN 'delivered_awaiting_return'
            WHEN r.is_driver_arrived = true AND r.is_trip_start = false THEN 'arrived_pickup'
            WHEN r.is_trip_start = true AND r.is_completed = false THEN 'in_progress'
            WHEN r.driver_id IS NOT NULL THEN 'accepted'
            ELSE 'pending'
          END AS status
        FROM requests r
        LEFT JOIN request_places rp ON r.id = rp.request_id
        LEFT JOIN request_bills rb ON r.id = rb.request_id
        LEFT JOIN vehicle_types vt ON r.zone_type_id = vt.id
        LEFT JOIN drivers d ON r.driver_id = d.id
        LEFT JOIN companies comp ON comp.id = r.company_id
        LEFT JOIN service_locations sl ON sl.name = comp.city AND sl.state = comp.state
        LEFT JOIN city_prices cp ON cp.service_location_id = COALESCE(r.service_location_id, sl.id)
          AND cp.vehicle_type_id = r.zone_type_id
          AND cp.active = true
        WHERE r.company_id = $1
        ORDER BY r.created_at DESC
      `, [req.session.companyId]);

      // Log da primeira entrega para debug
      if (rows.length > 0) {
        console.log(`📋 Primeira entrega retornada para empresa:
  - requestNumber: ${rows[0].requestNumber}
  - totalDistance: ${rows[0].totalDistance}
  - totalTime: ${rows[0].totalTime}
  - estimatedTime: ${rows[0].estimatedTime}`);
      }

      return res.json(rows);
    } catch (error) {
      console.error("Erro ao listar entregas:", error);
      return res.status(500).json({ message: "Erro ao buscar entregas" });
    }
  });

  // GET /api/empresa/deliveries/in-progress - Listar entregas em andamento da empresa
  app.get("/api/empresa/deliveries/in-progress", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { rows } = await pool.query(`
        SELECT
          r.id,
          r.request_number AS "requestNumber",
          r.customer_name AS "customerName",
          to_char(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "createdAt",
          r.driver_id AS "driverId",
          r.is_driver_started AS "isDriverStarted",
          r.is_driver_arrived AS "isDriverArrived",
          r.is_trip_start AS "isTripStart",
          r.is_completed AS "isCompleted",
          r.is_cancelled AS "isCancelled",
          r.cancel_reason AS "cancelReason",
          to_char(r.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "cancelledAt",
          to_char(r.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "completedAt",
          to_char(r.accepted_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "acceptedAt",
          to_char(r.arrived_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "arrivedAt",
          to_char(r.trip_started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "tripStartedAt",
          to_char(r.delivered_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "deliveredAt",
          to_char(r.returning_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "returningAt",
          to_char(r.returned_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "returnedAt",
          r.needs_return AS "needsReturn",
          r.total_distance AS "totalDistance",
          r.total_time AS "totalTime",
          r.estimated_time AS "estimatedTime",
          r.is_later AS "isLater",
          to_char(r.scheduled_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "scheduledAt",
          rp.pick_address AS "pickupAddress",
          rp.drop_address AS "dropoffAddress",
          rp.pick_lat AS "pickupLat",
          rp.pick_lng AS "pickupLng",
          rp.drop_lat AS "dropoffLat",
          rp.drop_lng AS "dropoffLng",
          rb.total_amount AS "totalPrice",
          vt.name AS "vehicleTypeName",
          d.name AS "driverName",
          d.mobile AS "driverPhone",
          CASE
            WHEN r.is_cancelled = true THEN 'cancelled'
            WHEN r.is_completed = true THEN 'completed'
            WHEN r.returning_at IS NOT NULL AND r.returned_at IS NULL THEN 'returning'
            WHEN r.delivered_at IS NOT NULL AND r.needs_return = true AND r.returning_at IS NULL THEN 'delivered_awaiting_return'
            WHEN r.is_driver_arrived = true AND r.is_trip_start = false THEN 'arrived_pickup'
            WHEN r.is_trip_start = true AND r.is_completed = false THEN 'in_progress'
            WHEN r.driver_id IS NOT NULL THEN 'accepted'
            WHEN r.is_later = true AND r.scheduled_at IS NOT NULL THEN 'scheduled'
            ELSE 'pending'
          END AS status
        FROM requests r
        LEFT JOIN request_places rp ON r.id = rp.request_id
        LEFT JOIN request_bills rb ON r.id = rb.request_id
        LEFT JOIN vehicle_types vt ON r.zone_type_id = vt.id
        LEFT JOIN drivers d ON r.driver_id = d.id
        WHERE r.company_id = $1
          AND r.is_completed = false
          AND r.is_cancelled = false
        ORDER BY r.created_at DESC
      `, [req.session.companyId]);

      return res.json(rows);
    } catch (error) {
      console.error("Erro ao listar entregas em andamento:", error);
      return res.status(500).json({ message: "Erro ao buscar entregas em andamento" });
    }
  });

  app.get("/api/empresa/deliveries/:id/cancellation-fee-preview", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const request = await storage.getRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      if (request.companyId !== req.session.companyId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const feeInfo = await calculateCancellationFeeForRequest(request);

      return res.json({
        cancellationFee: feeInfo.amount !== null ? feeInfo.amount.toFixed(2) : null,
        cancellationFeePercentage:
          feeInfo.appliedPercentage !== null ? Number(feeInfo.appliedPercentage.toFixed(2)) : null,
        cancellationFeeConfiguredPercentage:
          feeInfo.configuredPercentage !== null ? Number(feeInfo.configuredPercentage.toFixed(2)) : null,
      });
    } catch (error) {
      console.error("Erro ao calcular taxa de cancelamento (preview):", error);
      return res.status(500).json({ message: "Erro ao calcular taxa de cancelamento" });
    }
  });

  // GET /api/empresa/deliveries/completed - Listar entregas concluídas da empresa
  app.get("/api/empresa/deliveries/completed", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { rows } = await pool.query(`
        SELECT
          r.id,
          r.request_number AS "requestNumber",
          r.customer_name AS "customerName",
          to_char(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "createdAt",
          r.driver_id AS "driverId",
          r.is_driver_started AS "isDriverStarted",
          r.is_driver_arrived AS "isDriverArrived",
          r.is_trip_start AS "isTripStart",
          r.is_completed AS "isCompleted",
          r.is_cancelled AS "isCancelled",
          r.cancel_reason AS "cancelReason",
          r.company_rated AS "companyRated",
          to_char(r.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "cancelledAt",
          to_char(r.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "completedAt",
          to_char(r.accepted_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "acceptedAt",
          to_char(r.arrived_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "arrivedAt",
          to_char(r.trip_started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "tripStartedAt",
          r.needs_return AS "needsReturn",
          r.total_distance AS "totalDistance",
          r.total_time AS "totalTime",
          r.estimated_time AS "estimatedTime",
          rp.pick_address AS "pickupAddress",
          rp.drop_address AS "dropoffAddress",
          rp.pick_lat AS "pickupLat",
          rp.pick_lng AS "pickupLng",
          rp.drop_lat AS "dropoffLat",
          rp.drop_lng AS "dropoffLng",
          rb.total_amount AS "totalPrice",
          vt.name AS "vehicleTypeName",
          d.name AS "driverName",
          d.mobile AS "driverPhone",
          d.rating AS "driverRating",
          d.no_of_ratings AS "driverRatingCount",
          CASE
            WHEN r.is_cancelled = true THEN 'cancelled'
            WHEN r.is_completed = true THEN 'completed'
            WHEN r.is_driver_arrived = true AND r.is_trip_start = false THEN 'arrived_pickup'
            WHEN r.is_trip_start = true AND r.is_completed = false THEN 'in_progress'
            WHEN r.driver_id IS NOT NULL THEN 'accepted'
            ELSE 'pending'
          END AS status
        FROM requests r
        LEFT JOIN request_places rp ON r.id = rp.request_id
        LEFT JOIN request_bills rb ON r.id = rb.request_id
        LEFT JOIN vehicle_types vt ON r.zone_type_id = vt.id
        LEFT JOIN drivers d ON r.driver_id = d.id
        WHERE r.company_id = $1 AND r.is_completed = true
        ORDER BY r.completed_at DESC
      `, [req.session.companyId]);

      return res.json(rows);
    } catch (error) {
      console.error("Erro ao listar entregas concluídas:", error);
      return res.status(500).json({ message: "Erro ao buscar entregas concluídas" });
    }
  });

  // GET /api/empresa/deliveries/cancelled - Listar entregas canceladas da empresa
  app.get("/api/empresa/deliveries/cancelled", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { rows } = await pool.query(`
        SELECT
          r.id,
          r.request_number AS "requestNumber",
          r.customer_name AS "customerName",
          to_char(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "createdAt",
          r.driver_id AS "driverId",
          r.is_driver_started AS "isDriverStarted",
          r.is_driver_arrived AS "isDriverArrived",
          r.is_trip_start AS "isTripStart",
          r.is_completed AS "isCompleted",
          r.is_cancelled AS "isCancelled",
          r.cancel_reason AS "cancelReason",
          to_char(r.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "cancelledAt",
          to_char(r.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "completedAt",
          to_char(r.accepted_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "acceptedAt",
          to_char(r.arrived_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "arrivedAt",
          to_char(r.trip_started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS "tripStartedAt",
          r.needs_return AS "needsReturn",
          r.total_distance AS "totalDistance",
          r.total_time AS "totalTime",
          r.estimated_time AS "estimatedTime",
          rp.pick_address AS "pickupAddress",
          rp.drop_address AS "dropoffAddress",
          rp.pick_lat AS "pickupLat",
          rp.pick_lng AS "pickupLng",
          rp.drop_lat AS "dropoffLat",
          rp.drop_lng AS "dropoffLng",
          rb.total_amount AS "totalPrice",
          vt.name AS "vehicleTypeName",
          d.name AS "driverName",
          d.mobile AS "driverPhone",
          CASE
            WHEN r.is_cancelled = true THEN 'cancelled'
            WHEN r.is_completed = true THEN 'completed'
            WHEN r.is_driver_arrived = true AND r.is_trip_start = false THEN 'arrived_pickup'
            WHEN r.is_trip_start = true AND r.is_completed = false THEN 'in_progress'
            WHEN r.driver_id IS NOT NULL THEN 'accepted'
            ELSE 'pending'
          END AS status
        FROM requests r
        LEFT JOIN request_places rp ON r.id = rp.request_id
        LEFT JOIN request_bills rb ON r.id = rb.request_id
        LEFT JOIN vehicle_types vt ON r.zone_type_id = vt.id
        LEFT JOIN drivers d ON r.driver_id = d.id
        WHERE r.company_id = $1 AND r.is_cancelled = true
        ORDER BY r.cancelled_at DESC
      `, [req.session.companyId]);

      return res.json(rows);
    } catch (error) {
      console.error("Erro ao listar entregas canceladas:", error);
      return res.status(500).json({ message: "Erro ao buscar entregas canceladas" });
    }
  });

  // POST /api/empresa/deliveries/:requestId/rate - Avaliar motorista
  app.post("/api/empresa/deliveries/:requestId/rate", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { requestId } = req.params;
      const { rating, comment } = req.body;

      // Validar dados
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Avaliação deve ser entre 1 e 5 estrelas" });
      }

      // Verificar se a entrega existe e pertence à empresa
      const [request] = await db
        .select()
        .from(requests)
        .where(
          and(
            eq(requests.id, requestId),
            eq(requests.companyId, req.session.companyId)
          )
        )
        .limit(1);

      if (!request) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      if (!request.isCompleted) {
        return res.status(400).json({ message: "Apenas entregas concluídas podem ser avaliadas" });
      }

      if (!request.driverId) {
        return res.status(400).json({ message: "Esta entrega não possui motorista" });
      }

      if (request.companyRated) {
        return res.status(400).json({ message: "Você já avaliou esta entrega" });
      }

      // Criar avaliação
      const [newRating] = await db
        .insert(companyDriverRatings)
        .values({
          requestId,
          companyId: req.session.companyId,
          driverId: request.driverId,
          rating,
          comment: comment || null,
        })
        .returning();

      // Marcar entrega como avaliada
      await db
        .update(requests)
        .set({ companyRated: true })
        .where(eq(requests.id, requestId));

      // Atualizar avaliação média do motorista
      const ratingsResult = await db
        .select({
          avgRating: sql<number>`AVG(${companyDriverRatings.rating})`,
          totalRatings: sql<number>`COUNT(*)`,
          sumRating: sql<number>`SUM(${companyDriverRatings.rating})`,
        })
        .from(companyDriverRatings)
        .where(eq(companyDriverRatings.driverId, request.driverId));

      const { avgRating, totalRatings, sumRating } = ratingsResult[0];

      await db
        .update(drivers)
        .set({
          rating: avgRating ? Number(avgRating).toFixed(2) : "0",
          ratingTotal: sumRating ? Number(sumRating).toString() : "0",
          noOfRatings: totalRatings || 0,
        })
        .where(eq(drivers.id, request.driverId));

      return res.json({
        message: "Avaliação registrada com sucesso",
        rating: newRating,
      });
    } catch (error) {
      console.error("Erro ao avaliar motorista:", error);
      return res.status(500).json({ message: "Erro ao registrar avaliação" });
    }
  });

  // GET /api/empresa/deliveries/:requestId/rating - Buscar avaliação da entrega
  app.get("/api/empresa/deliveries/:requestId/rating", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { requestId } = req.params;

      // Verificar se a entrega pertence à empresa
      const [request] = await db
        .select()
        .from(requests)
        .where(
          and(
            eq(requests.id, requestId),
            eq(requests.companyId, req.session.companyId)
          )
        )
        .limit(1);

      if (!request) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      // Buscar avaliação
      const [rating] = await db
        .select()
        .from(companyDriverRatings)
        .where(
          and(
            eq(companyDriverRatings.requestId, requestId),
            eq(companyDriverRatings.companyId, req.session.companyId)
          )
        )
        .limit(1);

      return res.json(rating || null);
    } catch (error) {
      console.error("Erro ao buscar avaliação:", error);
      return res.status(500).json({ message: "Erro ao buscar avaliação" });
    }
  });

  // POST /api/empresa/calculate-price - Calcular preço da entrega
  app.post("/api/empresa/calculate-price", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { vehicleTypeId, distanceKm, durationMinutes, needsReturn } = req.body;

      if (!vehicleTypeId || distanceKm === undefined || durationMinutes === undefined) {
        return res.status(400).json({
          message: "vehicleTypeId, distanceKm e durationMinutes são obrigatórios"
        });
      }

      // Buscar dados da empresa para pegar cidade/estado e nome
      const [company] = await db
        .select({
          name: companies.name,
          city: companies.city,
          state: companies.state,
        })
        .from(companies)
        .where(eq(companies.id, req.session.companyId))
        .limit(1);

      if (!company || !company.city || !company.state) {
        return res.status(400).json({
          message: "Empresa não possui cidade/estado cadastrado"
        });
      }

      // Buscar serviceLocation correspondente à cidade/estado da empresa
      const [serviceLocation] = await db
        .select({ id: serviceLocations.id })
        .from(serviceLocations)
        .where(
          and(
            eq(serviceLocations.name, company.city),
            eq(serviceLocations.state, company.state)
          )
        )
        .limit(1);

      if (!serviceLocation) {
        return res.status(400).json({
          message: `Cidade ${company.city}/${company.state} não está cadastrada no sistema`
        });
      }

      // Buscar configuração de preço
      const [pricing] = await db
        .select()
        .from(cityPrices)
        .where(
          and(
            eq(cityPrices.serviceLocationId, serviceLocation.id),
            eq(cityPrices.vehicleTypeId, vehicleTypeId),
            eq(cityPrices.active, true)
          )
        )
        .limit(1);

      if (!pricing) {
        return res.status(400).json({
          message: "Não há configuração de preço para esta categoria nesta cidade"
        });
      }

      // Converter para números
      const basePrice = parseFloat(pricing.basePrice);
      const pricePerDistance = parseFloat(pricing.pricePerDistance);
      const pricePerTime = parseFloat(pricing.pricePerTime);
      const baseDistance = parseFloat(pricing.baseDistance);
      const stopPrice = parseFloat(pricing.stopPrice || "0");
      const returnPrice = parseFloat(pricing.returnPrice || "0");

      // Calcular preço base
      let totalPrice = basePrice;

      // Calcular preço por distância (apenas se exceder a distância base)
      const extraDistance = Math.max(0, distanceKm - baseDistance);
      const distancePrice = extraDistance * pricePerDistance;
      totalPrice += distancePrice;

      // Calcular preço por tempo
      const timePrice = durationMinutes * pricePerTime;
      totalPrice += timePrice;

      // Adicionar valor de retorno se o checkbox estiver marcado
      if (needsReturn === true) {
        totalPrice += returnPrice;
      }

      // Buscar comissão da tabela settings
      const [systemSettings] = await db
        .select({ adminCommissionPercentage: settings.adminCommissionPercentage })
        .from(settings)
        .limit(1);

      const adminCommissionPercentage = systemSettings
        ? parseFloat(systemSettings.adminCommissionPercentage)
        : 20; // Fallback para 20% se não houver configuração

      // Calcular comissão admin (sempre em porcentagem)
      const adminCommission = totalPrice * (adminCommissionPercentage / 100);
      const driverAmount = totalPrice - adminCommission;

      // Retornar breakdown completo do preço
      return res.json({
        totalPrice: totalPrice.toFixed(2),
        driverAmount: driverAmount.toFixed(2),
        adminCommission: adminCommission.toFixed(2),
        breakdown: {
          basePrice: basePrice.toFixed(2),
          baseDistance: baseDistance.toFixed(2),
          distancePrice: distancePrice.toFixed(2),
          pricePerKm: pricePerDistance.toFixed(2),
          extraKm: extraDistance.toFixed(2),
          timePrice: timePrice.toFixed(2),
          pricePerMinute: pricePerTime.toFixed(2),
          durationMinutes: durationMinutes,
          returnPrice: returnPrice.toFixed(2),
          needsReturn: needsReturn === true,
          returnPriceApplied: needsReturn === true ? returnPrice.toFixed(2) : "0",
        },
        pricing: {
          stopPrice: stopPrice.toFixed(2),
          returnPrice: returnPrice.toFixed(2),
          cancellationFee: pricing.cancellationFee,
          waitingChargePerMinute: pricing.waitingChargePerMinute,
          freeWaitingTimeMins: pricing.freeWaitingTimeMins,
        }
      });
    } catch (error) {
      console.error("Erro ao calcular preço:", error);
      return res.status(500).json({ message: "Erro ao calcular preço da entrega" });
    }
  });

  // POST /api/empresa/deliveries - Criar nova entrega
  app.post("/api/empresa/deliveries", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const {
        pickupAddress,
        dropoffAddress,
        vehicleTypeId,
        serviceLocationId,
        estimatedAmount,
        distance,
        estimatedTime,
        customerName,
        customerWhatsapp,
        deliveryReference,
        needsReturn,
        scheduledAt,
      } = req.body;

      if (!pickupAddress || !dropoffAddress || !vehicleTypeId) {
        return res.status(400).json({
          message: "Endereços de retirada, entrega e categoria são obrigatórios"
        });
      }

      // Generate unique request number
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const requestNumber = `REQ-${timestamp}-${random}`;

      // Buscar dados da empresa para pegar cidade/estado e nome
      const [company] = await db
        .select({
          name: companies.name,
          city: companies.city,
          state: companies.state,
        })
        .from(companies)
        .where(eq(companies.id, req.session.companyId))
        .limit(1);

      if (!company || !company.city || !company.state) {
        return res.status(400).json({
          message: "Empresa não possui cidade/estado cadastrado"
        });
      }

      // Buscar serviceLocation correspondente
      const [serviceLocation] = await db
        .select({ id: serviceLocations.id })
        .from(serviceLocations)
        .where(
          and(
            eq(serviceLocations.name, company.city),
            eq(serviceLocations.state, company.state)
          )
        )
        .limit(1);

      if (!serviceLocation && !serviceLocationId) {
        return res.status(400).json({
          message: `Cidade ${company.city}/${company.state} não está cadastrada no sistema`
        });
      }

      const resolvedServiceLocationId = serviceLocationId || serviceLocation?.id || null;

      if (!resolvedServiceLocationId) {
        return res.status(400).json({
          message: "Não foi possível determinar a cidade da entrega"
        });
      }

      // Buscar configuração de preço da city_prices
      const [pricing] = await db
        .select()
        .from(cityPrices)
        .where(
          and(
            eq(cityPrices.serviceLocationId, resolvedServiceLocationId),
            eq(cityPrices.vehicleTypeId, vehicleTypeId),
            eq(cityPrices.active, true)
          )
        )
        .limit(1);

      if (!pricing) {
        return res.status(400).json({
          message: "Não há configuração de preço para esta categoria nesta cidade"
        });
      }

      // Buscar comissão da tabela settings
      const [systemSettings] = await db
        .select({ adminCommissionPercentage: settings.adminCommissionPercentage })
        .from(settings)
        .limit(1);

      const adminCommissionPercentage = systemSettings
        ? parseFloat(systemSettings.adminCommissionPercentage)
        : 20; // Fallback para 20% se não houver configuração

      // Calcular preço baseado na configuração
      const basePrice = parseFloat(pricing.basePrice);
      const pricePerDistance = parseFloat(pricing.pricePerDistance);
      const pricePerTime = parseFloat(pricing.pricePerTime);
      const baseDistance = parseFloat(pricing.baseDistance);
      const returnPrice = parseFloat(pricing.returnPrice || "0");

      // Calcular preço base
      let totalPrice = basePrice;

      // Calcular preço por distância (apenas se exceder a distância base)
      const distanceInKm = distance ? parseFloat(distance) : 0;
      const extraDistance = Math.max(0, distanceInKm - baseDistance);
      const distancePrice = extraDistance * pricePerDistance;
      totalPrice += distancePrice;

      // Calcular preço por tempo
      const timeInMinutes = estimatedTime ? parseFloat(estimatedTime) : 0;
      const timePrice = timeInMinutes * pricePerTime;
      totalPrice += timePrice;

      // Adicionar valor de retorno se o checkbox estiver marcado
      if (needsReturn === true) {
        totalPrice += returnPrice;
        console.log(`✅ Valor de retorno adicionado: R$ ${returnPrice.toFixed(2)}`);
      }

      // Calcular comissão usando a configuração de settings
      let driverAmount = null;
      let adminCommission = null;
      if (totalPrice > 0) {
        adminCommission = (totalPrice * (adminCommissionPercentage / 100)).toFixed(2);
        driverAmount = (totalPrice - parseFloat(adminCommission)).toFixed(2);
      }

      console.log(`💰 Cálculo do preço:
  - Preço base: R$ ${basePrice.toFixed(2)}
  - Distância: ${distanceInKm.toFixed(2)} km (extra: ${extraDistance.toFixed(2)} km)
  - Preço por distância: R$ ${distancePrice.toFixed(2)}
  - Tempo: ${timeInMinutes} min
  - Preço por tempo: R$ ${timePrice.toFixed(2)}
  - Retorno: ${needsReturn ? 'SIM' : 'NÃO'} (R$ ${returnPrice.toFixed(2)})
  - Preço total: R$ ${totalPrice.toFixed(2)}
  - Comissão admin (${adminCommissionPercentage}%): R$ ${adminCommission}
  - Valor motorista: R$ ${driverAmount}`);

      // Create request
      // IMPORTANTE: O frontend envia distance em KM, mas o banco espera em METROS
      const totalDistanceInMeters = distance ? parseFloat(distance) * 1000 : null;

      console.log(`💾 Salvando entrega no banco:
  - distance enviado pelo frontend: ${distance} km
  - totalDistanceInMeters (salvo no banco): ${totalDistanceInMeters} metros
  - estimatedTime (salvo no banco): ${estimatedTime} min
  - estimatedAmount (salvo no banco): R$ ${totalPrice.toFixed(2)}`);

      // Determinar se é uma entrega agendada
      const isScheduledDelivery = scheduledAt ? true : false;
      // scheduledAt agora vem como string no formato "YYYY-MM-DD HH:MM:SS" (hora local de São Paulo)
      // Vamos salvar diretamente como a hora que o usuário selecionou, sem conversão
      let scheduledAtDate: Date | null = null;
      let scheduledAtString: string | null = null;

      if (scheduledAt && typeof scheduledAt === 'string') {
        // Guardar a string original para inserir diretamente no banco
        scheduledAtString = scheduledAt;
        // Criar Date object apenas para validação/logs (será UTC internamente, mas o banco receberá a string)
        scheduledAtDate = new Date(scheduledAt.replace(' ', 'T'));
        console.log(`📅 Entrega agendada para: ${scheduledAt} (hora local BR)`);
      } else if (scheduledAt && typeof scheduledAt === 'number') {
        scheduledAtDate = new Date(scheduledAt);
        console.log(`📅 Entrega agendada para: ${scheduledAtDate.toISOString()} (UTC)`);
      }

      const request = await storage.createRequest({
        requestNumber,
        companyId: req.session.companyId,
        userId: null, // Company requests don't have userId
        customerName: customerName || null,
        customerWhatsapp: customerWhatsapp || null,
        deliveryReference: deliveryReference || null,
        serviceLocationId: resolvedServiceLocationId,
        zoneTypeId: vehicleTypeId,
        totalDistance: totalDistanceInMeters, // Convertido de km para metros
        totalTime: estimatedTime || null,
        requestEtaAmount: driverAmount, // Valor líquido para o motorista (após comissão)
        needsReturn: needsReturn || false, // Salva informação sobre retorno ao ponto de origem
        isLater: isScheduledDelivery, // Marcado como "para depois" se agendado
        scheduledAt: null, // Será atualizado via SQL direto para evitar conversão de timezone
        isDriverStarted: false,
        isDriverArrived: false,
        isTripStart: false,
        isCompleted: false,
        isCancelled: false,
      });

      // Se for entrega agendada, atualizar o scheduledAt via SQL direto para evitar conversão de timezone
      if (scheduledAtString) {
        await pool.query(
          `UPDATE requests SET scheduled_at = $1::timestamp WHERE id = $2`,
          [scheduledAtString, request.id]
        );
        console.log(`📅 scheduledAt salvo diretamente no banco: ${scheduledAtString}`);
      }

      // Create request places
      await pool.query(
        `INSERT INTO request_places (id, request_id, pick_address, drop_address, pick_lat, pick_lng, drop_lat, drop_lng, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          request.id,
          pickupAddress.address,
          dropoffAddress.address,
          pickupAddress.lat || null,
          pickupAddress.lng || null,
          dropoffAddress.lat || null,
          dropoffAddress.lng || null,
        ]
      );

      // Se o endereço de entrega contém múltiplos pontos, salvar na tabela delivery_stops
      if (dropoffAddress.address && dropoffAddress.address.includes(" | ")) {
        const addresses = dropoffAddress.address.split(" | ");
        console.log(`\n🔍 ====== DEBUG MÚLTIPLOS STOPS ======`);
        console.log(`📍 Detectados ${addresses.length} pontos de entrega`);
        console.log(`📦 ENDEREÇO COMPLETO RECEBIDO:`, dropoffAddress.address);
        console.log(`📦 ARRAY DE ENDEREÇOS APÓS SPLIT:`, addresses);

        for (let i = 0; i < addresses.length; i++) {
          const fullAddress = addresses[i];
          console.log(`\n📍 Processando Stop ${i + 1}/${addresses.length}`);
          console.log(`   String original completa: "${fullAddress}"`);
          let remainingAddress = fullAddress;

          // Extrair nome do cliente no formato [Nome]
          const customerNameMatch = remainingAddress.match(/^\[([^\]]+)\]\s*/);
          const extractedCustomerName = customerNameMatch ? customerNameMatch[1] : null;
          console.log(`   🔍 Nome Match:`, customerNameMatch);
          console.log(`   ✅ Nome extraído: "${extractedCustomerName}"`);
          if (extractedCustomerName) {
            remainingAddress = remainingAddress.replace(/^\[([^\]]+)\]\s*/, '');
          }
          console.log(`   ➡️ String restante após remover nome: "${remainingAddress}"`);

          // Extrair WhatsApp no formato [WhatsApp: xxx]
          const whatsappMatch = remainingAddress.match(/^\[WhatsApp:\s*([^\]]+)\]\s*/);
          const extractedWhatsapp = whatsappMatch ? whatsappMatch[1] : null;
          console.log(`   🔍 WhatsApp Match:`, whatsappMatch);
          console.log(`   ✅ WhatsApp extraído: "${extractedWhatsapp}"`);
          if (extractedWhatsapp) {
            remainingAddress = remainingAddress.replace(/^\[WhatsApp:\s*([^\]]+)\]\s*/, '');
          }
          console.log(`   ➡️ String restante após remover WhatsApp: "${remainingAddress}"`);

          // Extrair Referência no formato [Ref: xxx]
          const referenceMatch = remainingAddress.match(/^\[Ref:\s*([^\]]+)\]\s*/);
          const extractedReference = referenceMatch ? referenceMatch[1] : null;
          console.log(`   🔍 Referência Match:`, referenceMatch);
          console.log(`   ✅ Referência extraída: "${extractedReference}"`);
          if (extractedReference) {
            remainingAddress = remainingAddress.replace(/^\[Ref:\s*([^\]]+)\]\s*/, '');
          }
          console.log(`   ➡️ Endereço final: "${remainingAddress}"`);

          console.log(`\n   📋 RESUMO Stop ${i + 1}:`, {
            customerName: extractedCustomerName,
            whatsapp: extractedWhatsapp,
            reference: extractedReference,
            address: remainingAddress
          });

          // Inserir na tabela delivery_stops
          const insertValues = [
            request.id,
            i + 1, // stop_order (1, 2, 3...)
            extractedCustomerName,
            extractedWhatsapp,
            extractedReference,
            remainingAddress
          ];
          console.log(`   💾 Valores que serão inseridos no banco:`, {
            request_id: insertValues[0],
            stop_order: insertValues[1],
            customer_name: insertValues[2],
            customer_whatsapp: insertValues[3],
            delivery_reference: insertValues[4],
            address: insertValues[5]
          });

          await pool.query(
            `INSERT INTO delivery_stops (
              id, request_id, stop_order, stop_type,
              customer_name, customer_whatsapp, delivery_reference, address,
              lat, lng, status,
              created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $2, 'delivery',
              $3, $4, $5, $6,
              NULL, NULL, 'pending',
              NOW(), NOW()
            )`,
            insertValues
          );
          console.log(`   ✅ Stop ${i + 1} inserido no banco com sucesso!`);
        }

        console.log(`\n✅ ${addresses.length} stops salvos na tabela delivery_stops`);
        console.log(`🔍 ====== FIM DEBUG ======\n`);
      }

      // Create request bill
      await pool.query(
        `INSERT INTO request_bills (
          request_id,
          total_amount,
          admin_commision,
          admin_commision_type,
          base_price,
          base_distance,
          price_per_distance,
          distance_price,
          price_per_time,
          time_price
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          request.id,
          totalPrice.toFixed(2),
          adminCommission || "0.00",

          "percentage",
          basePrice.toFixed(2),
          baseDistance.toFixed(2),
          pricePerDistance.toFixed(2),
          distancePrice.toFixed(2),
          pricePerTime.toFixed(2),
          timePrice.toFixed(2)
        ]
      );

      // Buscar configurações de busca e timeout
      const settingsResult = await pool.query(
        `SELECT driver_search_radius, min_time_to_find_driver, driver_acceptance_timeout
         FROM settings LIMIT 1`
      );
      const searchRadius = settingsResult.rows[0]?.driver_search_radius
        ? parseFloat(settingsResult.rows[0].driver_search_radius)
        : 10; // Default 10km
      const minTimeToFindDriver = settingsResult.rows[0]?.min_time_to_find_driver || 120; // Default 120s
      const driverAcceptanceTimeout = settingsResult.rows[0]?.driver_acceptance_timeout || 30; // Default 30s

      // Buscar motoristas disponíveis e online com localização
      // Excluir motoristas que têm entregas não retiradas
      const availableDrivers = await pool.query(`
        SELECT id, name, fcm_token, latitude, longitude
        FROM drivers
        WHERE available = true
          AND approve = true
          AND active = true
          AND fcm_token IS NOT NULL
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM requests
            WHERE requests.driver_id = drivers.id
              AND requests.is_completed = false
              AND requests.is_cancelled = false
              AND requests.is_trip_start = false
          )
      `);

      // Log de motoristas excluídos por terem entregas não retiradas
      const allDriversCount = await pool.query(`
        SELECT COUNT(*) as total
        FROM drivers
        WHERE available = true
          AND approve = true
          AND active = true
          AND fcm_token IS NOT NULL
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
      `);
      const excludedByDelivery = parseInt(allDriversCount.rows[0].total) - availableDrivers.rows.length;
      if (excludedByDelivery > 0) {
        console.log(`🚫 ${excludedByDelivery} motorista(s) excluído(s) por ter entrega não retirada`);
      }

      // Filtrar motoristas dentro do raio de pesquisa
      console.log('📦 pickupAddress recebido:', JSON.stringify(pickupAddress, null, 2));
      console.log('📦 dropoffAddress recebido:', JSON.stringify(dropoffAddress, null, 2));

      const pickupLat = parseFloat(pickupAddress.lat);
      const pickupLng = parseFloat(pickupAddress.lng);

      console.log(`📍 Local de retirada: ${pickupLat}, ${pickupLng}`);
      console.log(`🔍 Raio configurado: ${searchRadius} km`);
      console.log(`👥 Verificando ${availableDrivers.rows.length} motoristas disponíveis:`);

      const driversWithinRadius = availableDrivers.rows.filter(driver => {
        const driverLat = parseFloat(driver.latitude);
        const driverLng = parseFloat(driver.longitude);

        if (isNaN(driverLat) || isNaN(driverLng)) {
          console.log(`  ⚠️  Motorista ${driver.name} (${driver.mobile}) - sem coordenadas válidas`);
          return false;
        }

        const distanceToPickup = calculateDistance(
          pickupLat,
          pickupLng,
          driverLat,
          driverLng
        );

        const withinRadius = distanceToPickup <= searchRadius;
        console.log(`  ${withinRadius ? '✅' : '❌'} Motorista ${driver.name} (${driver.mobile}) - Distância: ${distanceToPickup.toFixed(2)} km ${withinRadius ? '(DENTRO do raio)' : '(FORA do raio)'}`);

        return withinRadius;
      });

      console.log(`✓ ${driversWithinRadius.length} de ${availableDrivers.rows.length} motoristas estão dentro do raio de ${searchRadius} km`);

      // Se a entrega é agendada, não enviar notificações agora
      if (isScheduledDelivery) {
        console.log(`📅 Entrega agendada para ${scheduledAtDate}. Notificações serão enviadas na data/hora programada.`);
        return res.status(201).json({
          message: "Entrega agendada com sucesso",
          delivery: request,
          totalPrice: totalPrice.toFixed(2),
          driverAmount: driverAmount,
          needsReturn: needsReturn || false,
          returnPrice: needsReturn ? returnPrice.toFixed(2) : "0.00",
          scheduledAt: scheduledAtDate,
          isScheduled: true,
        });
      }

      // Enviar notificação push para motoristas dentro do raio
      if (driversWithinRadius.length > 0) {
        const fcmTokens = driversWithinRadius
          .map(driver => driver.fcm_token)
          .filter(token => token);

        if (fcmTokens.length > 0) {
          const notificationTitle = "Nova Entrega Disponível!";
          const notificationBody = `${company?.name || 'Cliente'} solicitou uma entrega. ${pickupAddress.address} → ${dropoffAddress.address}`;

          // Calcular tempo estimado com margem de 5 minutos
          const timeFromGoogleMaps = estimatedTime ? parseInt(estimatedTime) : 0;
          const estimatedTimeWithMargin = timeFromGoogleMaps + 5; // Adiciona 5 minutos de margem

          // Firebase requer que todos os valores sejam strings
          const totalAmountStr = totalPrice.toFixed(2);
          const driverAmountStr = driverAmount || "0";

          const notificationData = {
            type: "new_delivery",
            deliveryId: request.id,
            requestNumber: requestNumber,
            pickupAddress: pickupAddress.address,
            dropoffAddress: dropoffAddress.address,
            estimatedAmount: totalAmountStr, // VALOR TOTAL DA ENTREGA (mesmo que o painel da empresa mostra)
            totalAmount: totalAmountStr, // Valor total da entrega (para referência)
            driverAmount: driverAmountStr, // Valor que o motorista receberá após comissão
            distance: distance?.toString() || "0",
            estimatedTime: estimatedTimeWithMargin.toString(), // Google Maps + 5 min
            companyName: company?.name || "", // Nome da empresa que solicitou a entrega
            customerName: customerName || "", // Nome do cliente final (destinatário)
            acceptanceTimeout: driverAcceptanceTimeout.toString(), // Tempo para aceitar (segundos)
            searchTimeout: minTimeToFindDriver.toString(), // Tempo total de busca (segundos)
            needs_return: (needsReturn || false).toString(), // Se o motorista precisa retornar ao ponto de origem
          };

          console.log(`📱 [NOTIFICAÇÃO] Enviando para ${fcmTokens.length} motoristas`);
          console.log(`📦 [NOTIFICAÇÃO] needs_return = ${notificationData.needs_return}`);
          console.log(`📦 [NOTIFICAÇÃO] Dados completos:`, JSON.stringify(notificationData, null, 2));

          // Enviar notificação para motoristas dentro do raio
          await sendPushToMultipleDevices(
            fcmTokens,
            notificationTitle,
            notificationBody,
            notificationData
          );

          // Salvar notificações na tabela driver_notifications
          const expiresAt = new Date(Date.now() + driverAcceptanceTimeout * 1000); // Tempo para aceitar
          for (const driver of driversWithinRadius) {
            await db.insert(driverNotifications).values({
              requestId: request.id,
              driverId: driver.id,
              status: 'notified',
              notifiedAt: new Date(),
              expiresAt: expiresAt,
            });
          }

          console.log(`✓ Notificação enviada para ${fcmTokens.length} motoristas dentro do raio`);
        }
      } else {
        console.log(`⚠️ Nenhum motorista disponível dentro do raio de ${searchRadius} km`);
      }

      return res.status(201).json({
        message: "Entrega criada com sucesso",
        delivery: request,
        totalPrice: totalPrice.toFixed(2),
        driverAmount: driverAmount,
        needsReturn: needsReturn || false,
        returnPrice: needsReturn ? returnPrice.toFixed(2) : "0.00",
        scheduledAt: null,
        isScheduled: false,
      });
    } catch (error) {
      console.error("Erro ao criar entrega:", error);
      return res.status(500).json({ message: "Erro ao criar entrega" });
    }
  });

  // GET /api/empresa/deliveries/:id - Obter detalhes de uma entrega
  app.get("/api/empresa/deliveries/:id", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const request = await storage.getRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      // Verify request belongs to company
      if (request.companyId !== req.session.companyId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Get additional details from request_places
      const { rows: places } = await pool.query(
        `SELECT * FROM request_places WHERE request_id = $1`,
        [id]
      );

      // Get driver details if assigned
      let driverInfo = null;
      if (request.driverId) {
        const driver = await storage.getDriver(request.driverId);
        if (driver) {
          driverInfo = {
            id: driver.id,
            name: driver.name,
            mobile: driver.mobile,
            carModel: driver.carModel,
            carNumber: driver.carNumber,
            rating: driver.rating,
          };
        }
      }

      return res.json({
        ...request,
        places: places[0] || null,
        driver: driverInfo,
      });
    } catch (error) {
      console.error("Erro ao buscar detalhes da entrega:", error);
      return res.status(500).json({ message: "Erro ao buscar detalhes da entrega" });
    }
  });

  // POST /api/empresa/deliveries/:id/relaunch - Relançar entrega cancelada
  app.post("/api/empresa/deliveries/:id/relaunch", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      // Buscar entrega original
      const originalRequest = await storage.getRequest(id);

      if (!originalRequest) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      // Verificar se pertence à empresa
      if (originalRequest.companyId !== req.session.companyId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Verificar se está cancelada
      if (!originalRequest.isCancelled) {
        return res.status(400).json({
          message: "Apenas entregas canceladas podem ser relançadas"
        });
      }

      // Buscar dados de endereços
      const { rows: places } = await pool.query(
        `SELECT * FROM request_places WHERE request_id = $1`,
        [id]
      );

      if (!places || places.length === 0) {
        return res.status(400).json({
          message: "Dados de endereços não encontrados"
        });
      }

      const place = places[0];

      // Buscar dados de cobrança
      const { rows: bills } = await pool.query(
        `SELECT * FROM request_bills WHERE request_id = $1`,
        [id]
      );

      // Generate novo request number
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const requestNumber = `REQ-${timestamp}-${random}`;

      // Calcular valor líquido para o motorista (após comissão)
      let driverAmount = null;
      let adminCommission = null;
      if (bills && bills.length > 0) {
        const bill = bills[0];
        const settings = await storage.getSettings();
        const adminCommissionPercentage = settings?.adminCommissionPercentage || 20;
        const totalAmount = parseFloat(bill.total_amount);
        adminCommission = (totalAmount * (adminCommissionPercentage / 100)).toFixed(2);
        driverAmount = (totalAmount - parseFloat(adminCommission)).toFixed(2);
      }

      // Criar nova entrega
      const newRequest = await storage.createRequest({
        requestNumber,
        companyId: req.session.companyId,
        userId: null,
        customerName: originalRequest.customerName,
        customerWhatsapp: originalRequest.customerWhatsapp,
        deliveryReference: originalRequest.deliveryReference,
        serviceLocationId: originalRequest.serviceLocationId,
        zoneTypeId: originalRequest.zoneTypeId,
        totalDistance: originalRequest.totalDistance,
        totalTime: originalRequest.totalTime,
        estimatedTime: originalRequest.estimatedTime,
        requestEtaAmount: driverAmount,
        needsReturn: originalRequest.needsReturn || false,
        isLater: false,
        isDriverStarted: false,
        isDriverArrived: false,
        isTripStart: false,
        isCompleted: false,
        isCancelled: false,
      });

      // Criar request places
      await pool.query(
        `INSERT INTO request_places (id, request_id, pick_address, drop_address, pick_lat, pick_lng, drop_lat, drop_lng, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          newRequest.id,
          place.pick_address,
          place.drop_address,
          place.pick_lat,
          place.pick_lng,
          place.drop_lat,
          place.drop_lng,
        ]
      );

      // Criar request bill se houver
      if (bills && bills.length > 0) {
        const bill = bills[0];
        await pool.query(
          `INSERT INTO request_bills (
            request_id,
            total_amount,
            admin_commision,
            admin_commision_type,
            base_price,
            base_distance,
            price_per_distance,
            distance_price,
            price_per_time,
            time_price
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            newRequest.id,
            bill.total_amount,
            adminCommission,
            bill.admin_commision_type || 'percentage',
            bill.base_price,
            bill.base_distance,
            bill.price_per_distance,
            bill.distance_price,
            bill.price_per_time,
            bill.time_price
          ]
        );
      }

      // Copiar delivery_stops se houver (para entregas com múltiplas paradas)
      const { rows: deliveryStops } = await pool.query(
        `SELECT * FROM delivery_stops WHERE request_id = $1 ORDER BY stop_order`,
        [id]
      );

      if (deliveryStops && deliveryStops.length > 0) {
        console.log(`🔄 Copiando ${deliveryStops.length} paradas múltiplas para a nova entrega`);

        for (const stop of deliveryStops) {
          await pool.query(
            `INSERT INTO delivery_stops (
              id,
              request_id,
              stop_order,
              stop_type,
              customer_name,
              customer_whatsapp,
              delivery_reference,
              address,
              lat,
              lng,
              status,
              notes,
              created_at,
              updated_at
            )
            VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, NOW(), NOW())`,
            [
              newRequest.id,
              stop.stop_order,
              stop.stop_type,
              stop.customer_name,
              stop.customer_whatsapp,
              stop.delivery_reference,
              stop.address,
              stop.lat,
              stop.lng,
              stop.notes
            ]
          );
        }
      }

      // Buscar configurações de busca e timeout
      const settingsResult = await pool.query(
        `SELECT driver_search_radius, min_time_to_find_driver, driver_acceptance_timeout
         FROM settings LIMIT 1`
      );
      const searchRadius = settingsResult.rows[0]?.driver_search_radius
        ? parseFloat(settingsResult.rows[0].driver_search_radius)
        : 10;
      const minTimeToFindDriver = settingsResult.rows[0]?.min_time_to_find_driver || 120;
      const driverAcceptanceTimeout = settingsResult.rows[0]?.driver_acceptance_timeout || 30;

      // Buscar motoristas disponíveis
      // Excluir motoristas que têm entregas NÃO retiradas
      // Motoristas com entregas retiradas PODEM receber novas notificações
      const availableDrivers = await pool.query(`
        SELECT id, name, fcm_token, latitude, longitude
        FROM drivers
        WHERE available = true
          AND approve = true
          AND active = true
          AND fcm_token IS NOT NULL
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM requests
            WHERE requests.driver_id = drivers.id
              AND requests.is_completed = false
              AND requests.is_cancelled = false
              AND requests.is_trip_start = false
          )
      `);

      // Buscar dados da empresa
      const company = await storage.getCompany(req.session.companyId);

      // Filtrar motoristas dentro do raio
      const pickupLat = parseFloat(place.pick_lat);
      const pickupLng = parseFloat(place.pick_lng);

      console.log(`🔄 Relançando entrega #${originalRequest.requestNumber} como #${requestNumber}`);
      console.log(`📍 Local de retirada: ${pickupLat}, ${pickupLng}`);
      console.log(`🔍 Raio configurado: ${searchRadius} km`);

      const driversWithinRadius = availableDrivers.rows.filter(driver => {
        const driverLat = parseFloat(driver.latitude);
        const driverLng = parseFloat(driver.longitude);

        if (isNaN(driverLat) || isNaN(driverLng)) {
          return false;
        }

        const distance = calculateDistance(
          pickupLat,
          pickupLng,
          driverLat,
          driverLng
        );

        return distance <= searchRadius;
      });

      console.log(`✅ ${driversWithinRadius.length} motoristas dentro do raio de ${searchRadius} km`);

      // Enviar notificações
      if (driversWithinRadius.length > 0) {
        // Calcular estimatedTime (totalTime + 5 minutos)
        const totalTimeMinutes = originalRequest.totalTime ? parseInt(originalRequest.totalTime) : 0;
        const calculatedEstimatedTime = totalTimeMinutes + 5;

        const notificationData = {
          requestId: newRequest.id,
          requestNumber: newRequest.requestNumber,
          companyName: company?.name || 'Empresa',
          customerName: newRequest.customerName || 'Cliente',
          customerWhatsapp: newRequest.customerWhatsapp || '',
          deliveryReference: newRequest.deliveryReference || '',
          pickupAddress: place.pick_address,
          dropoffAddress: place.drop_address,
          distance: originalRequest.totalDistance ? (parseFloat(originalRequest.totalDistance) / 1000).toFixed(1) : '0',
          estimatedTime: calculatedEstimatedTime.toString(),
          estimatedAmount: driverAmount || '0', // Valor do motorista, não o total
          totalAmount: bills && bills.length > 0 ? bills[0].total_amount : '0',
          driverAmount: driverAmount || '0',
          pickupLat: pickupLat.toString(),
          pickupLng: pickupLng.toString(),
          dropLat: place.drop_lat?.toString() || '0',
          dropLng: place.drop_lng?.toString() || '0',
          acceptanceTimeout: driverAcceptanceTimeout.toString(),
          searchTimeout: minTimeToFindDriver.toString(),
          needs_return: (originalRequest.needsReturn || false).toString(),
        };

        console.log(`📤 Enviando notificações para ${driversWithinRadius.length} motoristas`);
        console.log(`📦 Dados da notificação:`, notificationData);

        for (const driver of driversWithinRadius) {
          if (driver.fcm_token) {
            await sendPushNotification(
              driver.fcm_token,
              'Nova Entrega Disponível!',
              `Cliente solicitou uma entrega. ${place.pick_address.substring(0, 40)}... → ${place.drop_address.substring(0, 40)}...`,
              {
                ...notificationData,
                type: 'new_delivery',
              }
            );
          }

          console.log(`⏰ Criando notificação com timeout de ${driverAcceptanceTimeout} segundos`);

          await pool.query(
            `INSERT INTO driver_notifications (id, driver_id, request_id, status, notified_at, expires_at, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'notified',
                     CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
                     (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + ($3 || ' seconds')::INTERVAL,
                     CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
                     CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`,
            [driver.id, newRequest.id, driverAcceptanceTimeout.toString()]
          );
        }

        console.log(`✅ Notificações enviadas para ${driversWithinRadius.length} motoristas`);
      }

      return res.json({
        message: "Entrega relançada com sucesso",
        delivery: newRequest,
      });
    } catch (error) {
      console.error("❌ Erro ao relançar entrega:", error);
      return res.status(500).json({ message: "Erro ao relançar entrega" });
    }
  });

  // POST /api/empresa/deliveries/:id/cancel - Cancelar entrega (Company)
  app.post("/api/empresa/deliveries/:id/cancel", async (req, res) => {
    try {
      if (!req.session.companyId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;
      const { cancelReason } = req.body;

      // Buscar entrega
      const request = await storage.getRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      // Verificar se pertence à empresa
      if (request.companyId !== req.session.companyId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Verificar se já está cancelada
      if (request.isCancelled) {
        return res.status(400).json({ message: "Esta entrega já está cancelada" });
      }

      // Verificar se já foi completada
      if (request.isCompleted) {
        return res.status(400).json({ message: "Não é possível cancelar uma entrega já completada" });
      }

      const feeInfo = await calculateCancellationFeeForRequest(request);
      const cancellationFeeAmount = feeInfo.amount ?? 0;
      const configuredCancellationFeePercentage = feeInfo.configuredPercentage ?? 0;
      const appliedCancellationFeePercentage = feeInfo.appliedPercentage ?? 0;

      // Cancelar a entrega
      await pool.query(
        `UPDATE requests
         SET is_cancelled = true,
             cancelled_at = NOW(),
             cancel_reason = $2,
             cancel_method = 'company'
         WHERE id = $1`,
        [id, cancelReason || null]
      );

      console.log(`🚫 Entrega ${request.requestNumber} cancelada pela empresa ${req.session.companyId}`);

      // Se a entrega foi aceita, notificar APENAS o motorista responsável
      // Se ainda não foi aceita, notificar todos que foram notificados
      let notifiedDrivers = [];

      if (request.driverId) {
        // Entrega em andamento - notificar APENAS o motorista responsável
        const { rows } = await pool.query(
          `SELECT id as driver_id, fcm_token, name
           FROM drivers
           WHERE id = $1 AND fcm_token IS NOT NULL`,
          [request.driverId]
        );
        notifiedDrivers = rows;
        console.log(`📍 Entrega aceita - notificando apenas motorista responsável: ${rows[0]?.name || request.driverId}`);
      } else {
        // Entrega ainda não aceita - notificar todos os motoristas que foram notificados
        const { rows } = await pool.query(
          `SELECT DISTINCT dn.driver_id, d.fcm_token, d.name
           FROM driver_notifications dn
           JOIN drivers d ON d.id = dn.driver_id
           WHERE dn.request_id = $1 AND d.fcm_token IS NOT NULL`,
          [id]
        );
        notifiedDrivers = rows;
        console.log(`📍 Entrega não aceita - notificando todos os motoristas que receberam notificação`);
      }

      // Enviar notificação de cancelamento
      if (notifiedDrivers.length > 0) {
        console.log(`📤 Enviando notificação de cancelamento para ${notifiedDrivers.length} motoristas`);

        // Obter instância do Socket.IO
        const io = (app as any).io;

        for (const driver of notifiedDrivers) {
          try {
            // Enviar notificação Firebase
            await sendPushNotification(
              driver.fcm_token,
              "Entrega Cancelada",
              "A entrega foi cancelada pela empresa.",
              {
                type: "delivery_cancelled",
                requestId: id,
                deliveryId: id,
                message: cancelReason || "Esta entrega foi cancelada pela empresa"
              }
            );
            console.log(`🔔 Notificação de cancelamento enviada para ${driver.name}`);

            // Enviar notificação Socket.IO em tempo real
            if (io) {
              io.to(`driver-${driver.driver_id}`).emit('delivery-cancelled', {
                requestId: id,
                deliveryId: id,
                requestNumber: request.requestNumber,
                message: cancelReason || "Esta entrega foi cancelada pela empresa"
              });
              console.log(`🔌 Socket.IO: Notificação enviada para driver-${driver.driver_id}`);
            }
          } catch (error) {
            console.error(`❌ Erro ao enviar notificação para ${driver.name}:`, error);
          }
        }

        // Atualizar status das notificações para 'cancelled'
        await pool.query(
          `UPDATE driver_notifications
           SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
           WHERE request_id = $1`,
          [id]
        );
      } else {
        console.log(`ℹ️ Nenhum motorista foi notificado sobre esta entrega ainda`);
      }

      return res.json({
        message: "Entrega cancelada com sucesso",
        cancellationFee: cancellationFeeAmount > 0 ? cancellationFeeAmount.toFixed(2) : null,
        cancellationFeePercentage: appliedCancellationFeePercentage > 0 ? appliedCancellationFeePercentage : null,
        cancellationFeeConfiguredPercentage: configuredCancellationFeePercentage > 0 ? configuredCancellationFeePercentage : null,
      });
    } catch (error) {
      console.error("❌ Erro ao cancelar entrega:", error);
      return res.status(500).json({ message: "Erro ao cancelar entrega" });
    }
  });

  // ========================================
  // DRIVER API ROUTES (Mobile App)
  // ========================================

  // GET /api/v1/driver/service-locations - Listar cidades disponíveis
  app.get("/api/v1/driver/service-locations", async (req, res) => {
    try {
      const locations = await db
        .select({
          id: serviceLocations.id,
          name: serviceLocations.name,
        })
        .from(serviceLocations)
        .where(eq(serviceLocations.active, true))
        .orderBy(serviceLocations.name);

      return res.json({
        success: true,
        data: locations
      });
    } catch (error) {
      console.error("Erro ao buscar cidades:", error);
      return res.status(500).json({ message: "Erro ao buscar cidades" });
    }
  });

  // ============================================
  // ADMIN DELIVERY ENDPOINTS
  // ============================================

  // GET /api/admin/deliveries/in-progress - Listar entregas em andamento
  app.get("/api/admin/deliveries/in-progress", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { rows } = await pool.query(`
        SELECT
          r.id,
          r.request_number AS "requestNumber",
          r.customer_name AS "customerName",
          (r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "createdAt",
          r.driver_id AS "driverId",
          r.is_driver_started AS "isDriverStarted",
          r.is_driver_arrived AS "isDriverArrived",
          r.is_trip_start AS "isTripStart",
          r.is_completed AS "isCompleted",
          r.is_cancelled AS "isCancelled",
          r.cancel_reason AS "cancelReason",
          r.total_distance AS "totalDistance",
          r.total_time AS "totalTime",
          (r.accepted_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "acceptedAt",
          (r.arrived_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "arrivedAt",
          (r.trip_started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "tripStartedAt",
          (r.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "completedAt",
          r.needs_return AS "needsReturn",
          rp.pick_address AS "pickupAddress",
          rp.drop_address AS "dropoffAddress",
          rb.total_amount AS "totalPrice",
          vt.name AS "vehicleTypeName",
          c.name AS "companyName",
          d.name AS "driverName",
          CASE
            WHEN r.is_driver_arrived = true AND r.is_trip_start = false THEN 'arrived_pickup'
            WHEN r.is_trip_start = true AND r.is_completed = false THEN 'in_progress'
            WHEN r.driver_id IS NOT NULL THEN 'accepted'
            ELSE 'pending'
          END AS status
        FROM requests r
        LEFT JOIN request_places rp ON r.id = rp.request_id
        LEFT JOIN request_bills rb ON r.id = rb.request_id
        LEFT JOIN vehicle_types vt ON r.zone_type_id = vt.id
        LEFT JOIN companies c ON r.company_id = c.id
        LEFT JOIN drivers d ON r.driver_id = d.id
        WHERE r.is_cancelled = false
          AND r.is_completed = false
        ORDER BY r.created_at DESC
      `);

      return res.json(rows);
    } catch (error) {
      console.error("Erro ao listar entregas em andamento:", error);
      return res.status(500).json({ message: "Erro ao buscar entregas" });
    }
  });

  // GET /api/admin/deliveries/completed - Listar entregas concluídas
  app.get("/api/admin/deliveries/completed", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { rows } = await pool.query(`
        SELECT
          r.id,
          r.request_number AS "requestNumber",
          r.customer_name AS "customerName",
          (r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "createdAt",
          r.total_distance AS "totalDistance",
          r.total_time AS "totalTime",
          (r.accepted_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "acceptedAt",
          (r.arrived_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "arrivedAt",
          (r.trip_started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "tripStartedAt",
          (r.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "completedAt",
          r.needs_return AS "needsReturn",
          rp.pick_address AS "pickupAddress",
          rp.drop_address AS "dropoffAddress",
          rb.total_amount AS "totalPrice",
          vt.name AS "vehicleTypeName",
          c.name AS "companyName",
          r.driver_id AS "driverId",
          d.name AS "driverName",
          d.rating AS "driverRating",
          d.no_of_ratings AS "driverRatingCount",
          r.company_rated AS "companyRated",
          'completed' AS status
        FROM requests r
        LEFT JOIN request_places rp ON r.id = rp.request_id
        LEFT JOIN request_bills rb ON r.id = rb.request_id
        LEFT JOIN vehicle_types vt ON r.zone_type_id = vt.id
        LEFT JOIN companies c ON r.company_id = c.id
        LEFT JOIN drivers d ON r.driver_id = d.id
        WHERE r.is_completed = true
          AND r.is_cancelled = false
        ORDER BY r.completed_at DESC NULLS LAST, r.created_at DESC
      `);

      console.log(`📋 Entregas concluídas retornadas: ${rows.length}`);
      if (rows.length > 0) {
        console.log(`📋 Primeiras 3 entregas: ${JSON.stringify(rows.slice(0, 3).map(r => ({ id: r.id, requestNumber: r.requestNumber, completedAt: r.completedAt })))}`);
      }
      return res.json(rows);
    } catch (error) {
      console.error("Erro ao listar entregas concluídas:", error);
      return res.status(500).json({ message: "Erro ao buscar entregas" });
    }
  });

  // GET /api/admin/deliveries/cancelled - Listar entregas canceladas
  app.get("/api/admin/deliveries/cancelled", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { rows } = await pool.query(`
        SELECT
          r.id,
          r.request_number AS "requestNumber",
          r.customer_name AS "customerName",
          (r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "createdAt",
          (r.cancelled_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "cancelledAt",
          r.is_cancelled AS "isCancelled",
          r.cancel_reason AS "cancelReason",
          r.total_distance AS "totalDistance",
          r.total_time AS "totalTime",
          (r.accepted_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "acceptedAt",
          (r.arrived_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "arrivedAt",
          (r.trip_started_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "tripStartedAt",
          (r.completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS "completedAt",
          r.needs_return AS "needsReturn",
          rp.pick_address AS "pickupAddress",
          rp.drop_address AS "dropoffAddress",
          rb.total_amount AS "totalPrice",
          vt.name AS "vehicleTypeName",
          c.name AS "companyName",
          'cancelled' AS status
        FROM requests r
        LEFT JOIN request_places rp ON r.id = rp.request_id
        LEFT JOIN request_bills rb ON r.id = rb.request_id
        LEFT JOIN vehicle_types vt ON r.zone_type_id = vt.id
        LEFT JOIN companies c ON r.company_id = c.id
        WHERE r.is_cancelled = true
        ORDER BY r.cancelled_at DESC NULLS LAST, r.created_at DESC
      `);

      console.log(`📋 Entregas canceladas retornadas: ${rows.length}`);
      return res.json(rows);
    } catch (error) {
      console.error("Erro ao listar entregas canceladas:", error);
      return res.status(500).json({ message: "Erro ao buscar entregas" });
    }
  });

  // POST /api/admin/deliveries/:id/cancel - Cancelar entrega (Admin)
  app.post("/api/admin/deliveries/:id/cancel", async (req, res) => {
    try {
      if (!req.session.userId || !req.session.isAdmin) {
        return res.status(401).json({ message: "Acesso negado. Apenas administradores podem cancelar entregas." });
      }

      const { id } = req.params;
      const { cancelReason } = req.body;

      // Buscar entrega
      const request = await storage.getRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      // Verificar se já está cancelada
      if (request.isCancelled) {
        return res.status(400).json({ message: "Esta entrega já está cancelada" });
      }

      // Verificar se já foi completada
      if (request.isCompleted) {
        return res.status(400).json({ message: "Não é possível cancelar uma entrega já completada" });
      }

      // Cancelar a entrega e salvar observações
      await pool.query(
        `UPDATE requests SET is_cancelled = true, cancelled_at = NOW(), cancel_reason = $2, cancel_method = 'admin' WHERE id = $1`,
        [id, cancelReason || null]
      );

      // Se havia um motorista, notificar via Firebase
      if (request.driverId) {
        // Buscar dados do motorista para obter o FCM token
        const driver = await storage.getDriver(request.driverId);

        if (driver && driver.fcmToken) {
          // Enviar notificação push via Firebase
          await sendPushNotification(
            driver.fcmToken,
            "Entrega Cancelada",
            "A entrega foi cancelada pelo administrador.",
            {
              type: "delivery_cancelled",
              requestId: id,
              deliveryId: id,
              message: cancelReason || "Esta entrega foi cancelada pelo administrador"
            }
          );

          console.log(`📱 Notificação Firebase enviada ao motorista ${driver.name} sobre cancelamento da entrega ${id}`);
        } else {
          console.warn(`⚠️  Motorista ${request.driverId} não possui FCM token registrado`);
        }

        // Também enviar via Socket.IO como fallback
        io.emit(`delivery_cancelled_${request.driverId}`, {
          requestId: id,
          deliveryId: id,
          message: "Esta entrega foi cancelada pelo administrador"
        });
      }

      console.log(`❌ Entrega ${id} cancelada pelo admin ${req.session.userName}`);

      return res.json({
        message: "Entrega cancelada com sucesso",
        requestId: id
      });
    } catch (error) {
      console.error("Erro ao cancelar entrega:", error);
      return res.status(500).json({ message: "Erro ao cancelar entrega" });
    }
  });

  // POST /api/admin/deliveries/:id/force-cancel-notification - Forçar notificação de cancelamento (Admin)
  app.post("/api/admin/deliveries/:id/force-cancel-notification", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      // Buscar entrega
      const request = await storage.getRequest(id);

      if (!request) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      // Verificar se está cancelada
      if (!request.isCancelled) {
        return res.status(400).json({
          message: "Esta entrega não está cancelada. Use o endpoint de cancelamento normal."
        });
      }

      // Verificar se tinha motorista atribuído
      if (!request.driverId) {
        return res.status(400).json({
          message: "Esta entrega não tinha motorista atribuído."
        });
      }

      // Buscar dados do motorista para obter o FCM token
      const driver = await storage.getDriver(request.driverId);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      let notificationSent = false;

      // Enviar notificação push via Firebase se o motorista tiver FCM token
      if (driver.fcmToken) {
        const result = await sendPushNotification(
          driver.fcmToken,
          "Entrega Cancelada",
          "Esta entrega foi cancelada pelo administrador.",
          {
            type: "delivery_cancelled",
            requestId: id,
            deliveryId: id,
            message: request.cancelReason || "Esta entrega foi cancelada pelo administrador"
          }
        );

        if (result) {
          notificationSent = true;
          console.log(`📱 Notificação Firebase FORÇADA enviada ao motorista ${driver.name} sobre cancelamento da entrega ${id}`);
        }
      } else {
        console.warn(`⚠️  Motorista ${driver.name} não possui FCM token registrado`);
      }

      // Também enviar via Socket.IO como fallback
      io.emit(`delivery_cancelled_${request.driverId}`, {
        requestId: id,
        deliveryId: id,
        message: request.cancelReason || "Esta entrega foi cancelada pelo administrador"
      });

      console.log(`🔔 Socket.IO enviado para delivery_cancelled_${request.driverId}`);

      return res.json({
        message: notificationSent
          ? "Notificação de cancelamento enviada com sucesso via Firebase e Socket.IO"
          : "Notificação enviada via Socket.IO (motorista sem FCM token)",
        requestId: id,
        driverId: request.driverId,
        driverName: driver.name,
        fcmTokenPresent: !!driver.fcmToken,
        firebaseNotificationSent: notificationSent
      });
    } catch (error) {
      console.error("Erro ao enviar notificação de cancelamento:", error);
      return res.status(500).json({ message: "Erro ao enviar notificação de cancelamento" });
    }
  });

  // POST /api/admin/deliveries/:id/relaunch - Relançar entrega cancelada (Admin)
  app.post("/api/admin/deliveries/:id/relaunch", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { id } = req.params;

      // Buscar entrega original
      const originalRequest = await storage.getRequest(id);

      if (!originalRequest) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      // Verificar se está cancelada
      if (!originalRequest.isCancelled) {
        return res.status(400).json({
          message: "Apenas entregas canceladas podem ser relançadas"
        });
      }

      // Buscar dados de endereços
      const { rows: places } = await pool.query(
        `SELECT * FROM request_places WHERE request_id = $1`,
        [id]
      );

      if (!places || places.length === 0) {
        return res.status(400).json({
          message: "Dados de endereços não encontrados"
        });
      }

      const place = places[0];

      // Buscar dados de cobrança
      const { rows: bills } = await pool.query(
        `SELECT * FROM request_bills WHERE request_id = $1`,
        [id]
      );

      // Generate novo request number
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      const requestNumber = `REQ-${timestamp}-${random}`;

      // Calcular valor líquido para o motorista (após comissão)
      let driverAmount = null;
      let adminCommission = null;
      if (bills && bills.length > 0) {
        const bill = bills[0];
        const settings = await storage.getSettings();
        const adminCommissionPercentage = settings?.adminCommissionPercentage || 20;
        const totalAmount = parseFloat(bill.total_amount);
        adminCommission = (totalAmount * (adminCommissionPercentage / 100)).toFixed(2);
        driverAmount = (totalAmount - parseFloat(adminCommission)).toFixed(2);
      }

      // Criar nova entrega
      const newRequest = await storage.createRequest({
        requestNumber,
        companyId: originalRequest.companyId,
        userId: null,
        customerName: originalRequest.customerName,
        customerWhatsapp: originalRequest.customerWhatsapp,
        deliveryReference: originalRequest.deliveryReference,
        serviceLocationId: originalRequest.serviceLocationId,
        zoneTypeId: originalRequest.zoneTypeId,
        totalDistance: originalRequest.totalDistance,
        totalTime: originalRequest.totalTime,
        estimatedTime: originalRequest.estimatedTime,
        requestEtaAmount: driverAmount,
        isLater: false,
        isDriverStarted: false,
        isDriverArrived: false,
        isTripStart: false,
        isCompleted: false,
        isCancelled: false,
      });

      // Criar request places
      await pool.query(
        `INSERT INTO request_places (id, request_id, pick_address, drop_address, pick_lat, pick_lng, drop_lat, drop_lng, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          newRequest.id,
          place.pick_address,
          place.drop_address,
          place.pick_lat,
          place.pick_lng,
          place.drop_lat,
          place.drop_lng,
        ]
      );

      // Criar request bill se houver
      if (bills && bills.length > 0) {
        const bill = bills[0];
        await pool.query(
          `INSERT INTO request_bills (id, request_id, base_price, distance_price, time_price, total_amount, admin_commission, driver_amount, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            newRequest.id,
            bill.base_price,
            bill.distance_price,
            bill.time_price,
            bill.total_amount,
            adminCommission,
            driverAmount,
          ]
        );
      }

      // Buscar configurações de raio
      const settingsResult = await pool.query(
        `SELECT driver_search_radius, min_time_to_find_driver, driver_acceptance_timeout FROM settings LIMIT 1`
      );
      const searchRadius = settingsResult.rows[0]?.driver_search_radius
        ? parseFloat(settingsResult.rows[0].driver_search_radius)
        : 10;

      // Buscar motoristas disponíveis
      // Excluir motoristas que têm entregas NÃO retiradas
      // Motoristas com entregas retiradas PODEM receber novas notificações
      const availableDrivers = await pool.query(`
        SELECT id, name, fcm_token, latitude, longitude
        FROM drivers
        WHERE available = true
          AND approve = true
          AND active = true
          AND fcm_token IS NOT NULL
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM requests
            WHERE requests.driver_id = drivers.id
              AND requests.is_completed = false
              AND requests.is_cancelled = false
              AND requests.is_trip_start = false
          )
      `);

      // Buscar dados da empresa se houver
      let company = null;
      if (originalRequest.companyId) {
        company = await storage.getCompany(originalRequest.companyId);
      }

      // Filtrar motoristas dentro do raio
      const pickupLat = parseFloat(place.pick_lat);
      const pickupLng = parseFloat(place.pick_lng);

      console.log(`🔄 Relançando entrega #${originalRequest.requestNumber} como #${requestNumber} (Admin)`);
      console.log(`📍 Local de retirada: ${pickupLat}, ${pickupLng}`);
      console.log(`🔍 Raio configurado: ${searchRadius} km`);

      const driversWithinRadius = availableDrivers.rows.filter(driver => {
        const driverLat = parseFloat(driver.latitude);
        const driverLng = parseFloat(driver.longitude);

        if (isNaN(driverLat) || isNaN(driverLng)) {
          return false;
        }

        const distance = calculateDistance(
          pickupLat,
          pickupLng,
          driverLat,
          driverLng
        );

        return distance <= searchRadius;
      });

      console.log(`✅ ${driversWithinRadius.length} motoristas dentro do raio de ${searchRadius} km`);

      // Enviar notificações para motoristas próximos
      if (driversWithinRadius.length > 0) {
        const minTimeToFindDriver = settingsResult.rows[0]?.min_time_to_find_driver || 120;
        const driverAcceptanceTimeout = settingsResult.rows[0]?.driver_acceptance_timeout || 30;

        // Calcular estimatedTime (totalTime + 5 minutos)
        const totalTimeMinutes = originalRequest.totalTime ? parseInt(originalRequest.totalTime) : 0;
        const calculatedEstimatedTime = totalTimeMinutes + 5;

        const notificationData = {
          requestId: newRequest.id,
          requestNumber: newRequest.requestNumber,
          companyName: company?.name || 'Empresa',
          customerName: newRequest.customerName || 'Cliente',
          customerWhatsapp: newRequest.customerWhatsapp || '',
          deliveryReference: newRequest.deliveryReference || '',
          pickupAddress: place.pick_address,
          dropoffAddress: place.drop_address,
          distance: originalRequest.totalDistance ? (parseFloat(originalRequest.totalDistance) / 1000).toFixed(1) : '0',
          estimatedTime: calculatedEstimatedTime.toString(),
          estimatedAmount: driverAmount || '0', // Valor do motorista, não o total
          totalAmount: bills && bills.length > 0 ? bills[0].total_amount : '0',
          driverAmount: driverAmount || '0',
          pickupLat: pickupLat.toString(),
          pickupLng: pickupLng.toString(),
          dropLat: place.drop_lat?.toString() || '0',
          dropLng: place.drop_lng?.toString() || '0',
          acceptanceTimeout: driverAcceptanceTimeout.toString(),
          searchTimeout: minTimeToFindDriver.toString(),
          needs_return: (originalRequest.needsReturn || false).toString(),
          type: 'new_delivery',
        };

        console.log(`📤 Enviando notificações para ${driversWithinRadius.length} motoristas`);
        console.log(`📦 Dados da notificação:`, notificationData);

        for (const driver of driversWithinRadius) {
          if (driver.fcm_token) {
            await sendPushNotification(
              driver.fcm_token,
              'Nova Entrega Disponível!',
              `Cliente solicitou uma entrega. ${place.pick_address.substring(0, 40)}... → ${place.drop_address.substring(0, 40)}...`,
              notificationData
            );
          }

          await pool.query(
            `INSERT INTO driver_notifications (id, driver_id, request_id, status, notified_at, expires_at, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'notified',
                     CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
                     (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + ($3 || ' seconds')::INTERVAL,
                     CURRENT_TIMESTAMP AT TIME ZONE 'UTC',
                     CURRENT_TIMESTAMP AT TIME ZONE 'UTC')`,
            [driver.id, newRequest.id, driverAcceptanceTimeout.toString()]
          );
        }

        console.log(`✅ Notificações enviadas para ${driversWithinRadius.length} motoristas`);
      }

      return res.json({
        message: "Entrega relançada com sucesso",
        requestId: newRequest.id,
        requestNumber: newRequest.requestNumber,
        driversNotified: driversWithinRadius.length
      });
    } catch (error) {
      console.error("❌ Erro ao relançar entrega:", error);
      return res.status(500).json({ message: "Erro ao relançar entrega" });
    }
  });

  // GET /api/v1/driver/vehicle-types - Listar tipos de veículos
  app.get("/api/v1/driver/vehicle-types", async (req, res) => {
    try {
      const types = await db
        .select({
          id: vehicleTypes.id,
          name: vehicleTypes.name,
          icon: vehicleTypes.icon,
          capacity: vehicleTypes.capacity,
        })
        .from(vehicleTypes)
        .where(eq(vehicleTypes.active, true))
        .orderBy(vehicleTypes.name);

      return res.json({
        success: true,
        data: types
      });
    } catch (error) {
      console.error("Erro ao buscar tipos de veículos:", error);
      return res.status(500).json({ message: "Erro ao buscar tipos de veículos" });
    }
  });

  // GET /api/v1/driver/brands - Listar marcas de veículos
  app.get("/api/v1/driver/brands", async (req, res) => {
    try {
      const brandsList = await db
        .select({
          id: brands.id,
          name: brands.name,
        })
        .from(brands)
        .where(eq(brands.active, true))
        .orderBy(brands.name);

      return res.json({
        success: true,
        data: brandsList
      });
    } catch (error) {
      console.error("Erro ao buscar marcas:", error);
      return res.status(500).json({ message: "Erro ao buscar marcas" });
    }
  });

  // GET /api/v1/driver/models/:brandId - Listar modelos por marca
  app.get("/api/v1/driver/models/:brandId", async (req, res) => {
    try {
      const { brandId } = req.params;

      const models = await db
        .select({
          id: vehicleModels.id,
          name: vehicleModels.name,
          brandId: vehicleModels.brandId,
        })
        .from(vehicleModels)
        .where(
          and(
            eq(vehicleModels.brandId, brandId),
            eq(vehicleModels.active, true)
          )
        )
        .orderBy(vehicleModels.name);

      return res.json({
        success: true,
        data: models
      });
    } catch (error) {
      console.error("Erro ao buscar modelos:", error);
      return res.status(500).json({ message: "Erro ao buscar modelos" });
    }
  });

  // GET /api/v1/driver/document-types - Listar tipos de documentos obrigatórios
  app.get("/api/v1/driver/document-types", async (req, res) => {
    try {
      const documentTypes = await db
        .select({
          id: driverDocumentTypes.id,
          name: driverDocumentTypes.name,
          description: driverDocumentTypes.description,
          required: driverDocumentTypes.required,
        })
        .from(driverDocumentTypes)
        .where(eq(driverDocumentTypes.active, true))
        .orderBy(driverDocumentTypes.name);

      return res.json({
        success: true,
        data: documentTypes
      });
    } catch (error) {
      console.error("Erro ao buscar tipos de documentos:", error);
      return res.status(500).json({ message: "Erro ao buscar tipos de documentos" });
    }
  });

  // POST /api/v1/driver/register - Registro de motorista
  app.post("/api/v1/driver/register", async (req, res) => {
    try {
      // Import das funções de indicação
      const { generateReferralCode, validateReferralCode } = await import("./utils/referralUtils");

      const {
        name,
        cpf,
        mobile,
        email,
        password,
        serviceLocationId,
        vehicleTypeId,
        carMake,
        carModel,
        carNumber,
        carColor,
        carYear,
        deviceToken,
        loginBy,
        referralCode // Código de indicação (opcional)
      } = req.body;

      // Log dos dados recebidos
      console.log("📝 Cadastro de motorista recebido:");
      console.log("   Nome:", name || "FALTANDO");
      console.log("   CPF:", cpf || "FALTANDO");
      console.log("   Mobile:", mobile || "FALTANDO");
      console.log("   Email:", email || "FALTANDO");
      console.log("   Cidade:", serviceLocationId || "FALTANDO");
      console.log("   Tipo Veículo:", vehicleTypeId || "FALTANDO");
      console.log("   Marca:", carMake || "FALTANDO");
      console.log("   Modelo:", carModel || "FALTANDO");
      console.log("   Placa:", carNumber || "FALTANDO");
      console.log("   Cor:", carColor || "FALTANDO");
      console.log("   Ano:", carYear || "FALTANDO");
      console.log("   Código Indicação:", referralCode || "NÃO FORNECIDO");

      // Validação completa - todos os campos são obrigatórios
      if (!name || !mobile || !password || !cpf || !email || !serviceLocationId ||
          !vehicleTypeId || !carMake || !carModel || !carNumber || !carColor || !carYear) {
        const missingFields = [];
        if (!name) missingFields.push("nome");
        if (!cpf) missingFields.push("CPF");
        if (!mobile) missingFields.push("telefone");
        if (!email) missingFields.push("email");
        if (!password) missingFields.push("senha");
        if (!serviceLocationId) missingFields.push("cidade");
        if (!vehicleTypeId) missingFields.push("tipo de veículo");
        if (!carMake) missingFields.push("marca");
        if (!carModel) missingFields.push("modelo");
        if (!carNumber) missingFields.push("placa");
        if (!carColor) missingFields.push("cor");
        if (!carYear) missingFields.push("ano");

        console.log("❌ Campos faltando:", missingFields.join(", "));

        return res.status(400).json({
          success: false,
          message: `Campos obrigatórios faltando: ${missingFields.join(", ")}`,
          missingFields: missingFields
        });
      }

      // Validação: carMake e carModel devem ser UUIDs (IDs das tabelas brands e vehicle_models)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(carMake)) {
        console.log(`❌ carMake inválido: '${carMake}' - deve ser UUID`);
        return res.status(400).json({
          success: false,
          message: `O campo 'carMake' deve conter o ID (UUID) da marca, não o nome. Valor inválido recebido: '${carMake}'. Use o endpoint GET /api/v1/driver/brands para obter a lista de marcas com seus IDs.`
        });
      }

      if (!uuidPattern.test(carModel)) {
        console.log(`❌ carModel inválido: '${carModel}' - deve ser UUID`);
        return res.status(400).json({
          success: false,
          message: `O campo 'carModel' deve conter o ID (UUID) do modelo, não o nome. Valor inválido recebido: '${carModel}'. Use o endpoint GET /api/v1/driver/models/:brandId para obter a lista de modelos com seus IDs.`
        });
      }

      // Verifica se já existe motorista com esse telefone
      const existingDriver = await storage.getDriverByMobile(mobile);
      if (existingDriver) {
        console.log(`❌ Telefone já cadastrado: ${mobile}`);
        return res.status(400).json({
          success: false,
          message: "Esse telefone já esta cadastrado."
        });
      }

      // Processar código de indicação (se fornecido)
      let referrerDriver = null;
      if (referralCode) {
        console.log(`🔍 Validando código de indicação: ${referralCode}`);
        // Validar e buscar motorista que indicou
        const referralValidation = await validateReferralCode(referralCode);
        console.log(`📋 Resultado da validação:`, referralValidation);
        if (!referralValidation.valid) {
          console.log(`❌ Código de indicação inválido: ${referralValidation.message}`);
          return res.status(400).json({
            success: false,
            message: referralValidation.message
          });
        }
        referrerDriver = referralValidation.driver;
        console.log(`✅ Código de indicação válido: ${referralCode} (${referrerDriver.name})`);
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // Gerar código único para o novo motorista
      const newDriverReferralCode = await generateReferralCode(name);

      // Cria motorista (todos campos obrigatórios)
      // carMake e carModel vêm do app como IDs, então devem ir para brandId e modelId
      const driver = await storage.createDriver({
        name,
        cpf,
        mobile,
        email,
        password: hashedPassword,
        serviceLocationId,
        vehicleTypeId,
        brandId: carMake,  // O app envia o ID da marca no campo carMake
        modelId: carModel, // O app envia o ID do modelo no campo carModel
        carNumber,
        carColor,
        carYear,
        fcmToken: deviceToken || null,
        active: true,
        approve: false, // Precisa ser aprovado pelo admin
        available: false,
        uploadedDocuments: false,
        referralCode: newDriverReferralCode, // Código único do novo motorista
        referredByCode: referrerDriver ? referralCode : null, // Código de quem indicou
        referredById: referrerDriver ? referrerDriver.id : null, // ID de quem indicou
      });

      // Se foi indicado por alguém, criar registro na tabela de indicações
      if (referrerDriver) {
        try {
          // Buscar configurações de indicação
          const [settings] = await db.select().from(referralSettings).limit(1);
          const minimumDeliveries = settings?.minimumDeliveries || 10;
          const commissionAmount = settings?.commissionAmount || "50.00";

          // Criar registro na tabela driver_referrals
          await db.insert(driverReferrals).values({
            referrerDriverId: referrerDriver.id,
            referredDriverId: driver.id,
            referralCode: referralCode,
            status: "registered",
            registeredAt: new Date(),
            deliveriesCompleted: 0,
            commissionEarned: "0",
            commissionPaid: false,
          });

          // Criar também registro na tabela referral_commissions (necessário para tracking)
          await db.insert(referralCommissions).values({
            referrerDriverId: referrerDriver.id,
            referredDriverId: driver.id,
            requiredDeliveries: minimumDeliveries,
            completedDeliveries: 0,
            commissionAmount: commissionAmount,
            status: "pending",
          });

          console.log(`✅ Indicação registrada: ${referrerDriver.name} → ${driver.name}`);
        } catch (error) {
          console.error("❌ Erro ao registrar indicação:", error);
          // Não bloqueia o cadastro, apenas loga o erro
        }
      }

      // Consultar processos criminais automaticamente se o CPF foi fornecido
      if (cpf && process.env.CELLEREIT_API_TOKEN) {
        try {
          const cleanCpf = cpf.replace(/[^\d]/g, "");
          if (cleanCpf.length === 11) {
            console.log(`🔍 Consultando CPF ${cleanCpf} automaticamente para novo motorista ${driver.id}`);

            const apiUrl = `https://api.gw.cellereit.com.br/consultas/validacao-fiscal-pj?cpf=${cleanCpf}`;
            const criminalResponse = await fetch(apiUrl, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${process.env.CELLEREIT_API_TOKEN}`,
              },
            });

            if (criminalResponse.ok) {
              const apiData = await criminalResponse.json();
              const criminalRecords: Array<{ tipo: string; assunto: string; tribunalTipo: string }> = [];

              if (apiData.Processos && Array.isArray(apiData.Processos)) {
                for (const processo of apiData.Processos) {
                  if (processo.TribunalTipo === "CRIMINAL") {
                    criminalRecords.push({
                      tipo: processo.Tipo || "Não informado",
                      assunto: processo.Assunto || "Não informado",
                      tribunalTipo: processo.TribunalTipo,
                    });
                  }
                }
              }

              const hasCriminalRecords = criminalRecords.length > 0;

              await db
                .update(drivers)
                .set({
                  hasCriminalRecords,
                  criminalRecords: hasCriminalRecords ? criminalRecords : null,
                  criminalCheckDate: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(drivers.id, driver.id));

              console.log(`✅ Consulta criminal automática concluída para motorista ${driver.id}. Processos: ${criminalRecords.length}`);
            } else {
              console.log(`⚠️ Erro na API de consulta criminal: ${criminalResponse.status}`);
            }
          }
        } catch (criminalError) {
          console.error("Erro ao consultar processos criminais automaticamente:", criminalError);
          // Não bloqueia o cadastro se a consulta falhar
        }
      } else {
        if (!cpf) {
          console.log("⚠️ CPF não fornecido, pulando consulta criminal automática");
        }
        if (!process.env.CELLEREIT_API_TOKEN) {
          console.log("⚠️ CELLEREIT_API_TOKEN não configurado, pulando consulta criminal automática");
        }
      }

      return res.status(201).json({
        success: true,
        message: "Motorista registrado com sucesso. Agora envie seus documentos e aguarde a aprovação do administrador.",
        data: {
          id: driver.id,
          name: driver.name,
          mobile: driver.mobile,
          email: driver.email,
          approve: driver.approve,
          referralCode: driver.referralCode, // Retorna o código do novo motorista
          statusEndpoint: `/api/v1/driver/status/${driver.id}`
        }
      });
    } catch (error) {
      console.error("Erro ao registrar motorista:", error);
      return res.status(500).json({ message: "Erro ao registrar motorista" });
    }
  });

  // POST /api/v1/driver/validate-mobile-for-login - Validar email do motorista
  app.post("/api/v1/driver/validate-mobile-for-login", async (req, res) => {
    try {
      const { email } = req.body;

      console.log("🔍 Validando motorista:", { email });

      // Verificar se forneceu email
      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email é obrigatório"
        });
      }

      // Buscar por email
      const driver = await storage.getDriverByEmail(email);

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Motorista não encontrado. Verifique o email ou cadastre-se."
        });
      }

      console.log("✅ Motorista encontrado:", driver.name);

      // Retornar dados básicos do motorista
      return res.json({
        success: true,
        message: "Motorista encontrado",
        data: {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          mobile: driver.mobile,
          profilePicture: driver.profilePicture,
          requirePassword: true, // Sempre requer senha
          active: driver.active,
          approve: driver.approve,
        }
      });
    } catch (error) {
      console.error("❌ Erro ao validar motorista:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao validar motorista"
      });
    }
  });

  // POST /api/v1/driver/login - Login de motorista
  app.post("/api/v1/driver/login", async (req, res) => {
    try {
      const { email, password, deviceToken } = req.body;

      console.log("🔐 Tentativa de login:", { email, hasPassword: !!password });

      // Validar que tem email e senha
      if (!email || !password) {
        return res.status(400).json({
          message: "Email e senha são obrigatórios"
        });
      }

      // Busca motorista por email
      const driver = await storage.getDriverByEmail(email);

      if (!driver) {
        return res.status(401).json({
          message: "Email ou senha incorretos"
        });
      }

      // Verifica senha
      if (!driver.password) {
        return res.status(401).json({
          message: "Email ou senha incorretos"
        });
      }

      const validPassword = await bcrypt.compare(password, driver.password);
      if (!validPassword) {
        return res.status(401).json({
          message: "Email ou senha incorretos"
        });
      }

      // Verifica se está ativo (mas permite login mesmo sem aprovação)
      if (!driver.active) {
        return res.status(403).json({
          message: "Sua conta foi desativada. Entre em contato com o suporte."
        });
      }

      // Atualiza FCM token se fornecido
      if (deviceToken) {
        await storage.updateDriver(driver.id, {
          fcmToken: deviceToken
        });
      }

      // Cria sessão
      req.session.driverId = driver.id;
      req.session.driverName = driver.name;
      req.session.driverMobile = driver.mobile;
      req.session.isDriver = true;

      // Gera token simples (em produção use JWT)
      const accessToken = Buffer.from(JSON.stringify({
        id: driver.id,
        type: 'driver',
        timestamp: Date.now()
      })).toString('base64');

      return res.json({
        success: true,
        message: "Login realizado com sucesso",
        accessToken: accessToken, // Token para apps mobile
        data: {
          id: driver.id,
          name: driver.name,
          mobile: driver.mobile,
          email: driver.email,
          profilePicture: driver.profilePicture,
          active: driver.active,
          approve: driver.approve,
          available: driver.available,
          rating: driver.rating,
          vehicleTypeId: driver.vehicleTypeId,
          carMake: driver.carMake,
          carModel: driver.carModel,
          carNumber: driver.carNumber,
          carColor: driver.carColor,
          uploadedDocuments: driver.uploadedDocuments,
          referralCode: driver.referralCode, // Código de indicação do motorista
          totalDeliveries: driver.totalDeliveries, // Total de entregas completadas
        }
      });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      return res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  // GET /api/v1/driver - Obter dados do motorista logado
  app.get("/api/v1/driver", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      return res.json({
        success: true,
        data: {
          id: driver.id,
          name: driver.name,
          mobile: driver.mobile,
          email: driver.email,
          cpf: driver.cpf,
          profilePicture: driver.profilePicture,
          active: driver.active,
          approve: driver.approve,
          available: driver.available,
          rating: driver.rating,
          ratingTotal: driver.ratingTotal,
          noOfRatings: driver.noOfRatings,
          serviceLocationId: driver.serviceLocationId,
          vehicleTypeId: driver.vehicleTypeId,
          carMake: driver.carMake,
          carModel: driver.carModel,
          carNumber: driver.carNumber,
          carColor: driver.carColor,
          carYear: driver.carYear,
          uploadedDocuments: driver.uploadedDocuments,
          latitude: driver.latitude,
          longitude: driver.longitude,
        }
      });
    } catch (error) {
      console.error("Erro ao buscar dados do motorista:", error);
      return res.status(500).json({ message: "Erro ao buscar dados do motorista" });
    }
  });

  // GET /api/v1/driver/me - Buscar perfil completo do motorista (com nomes, não só IDs)
  app.get("/api/v1/driver/me", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      // Debug: Verificar se as tabelas estão definidas
      console.log("📋 Verificando imports das tabelas:");
      console.log("drivers:", typeof drivers, drivers ? "✓" : "✗");
      console.log("serviceLocations:", typeof serviceLocations, serviceLocations ? "✓" : "✗");
      console.log("vehicleTypes:", typeof vehicleTypes, vehicleTypes ? "✓" : "✗");
      console.log("brands:", typeof brands, brands ? "✓" : "✗");
      console.log("vehicleModels:", typeof vehicleModels, vehicleModels ? "✓" : "✗");

      // Buscar motorista - query simplificada para debug
      console.log("🔍 Tentando buscar motorista...");
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, driverId))
        .limit(1);

      console.log("✅ Motorista encontrado:", driver ? "SIM" : "NÃO");

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      // Buscar documentos do motorista - query simplificada
      console.log("📄 Tentando buscar documentos...");
      const documents = await db
        .select()
        .from(driverDocuments)
        .where(eq(driverDocuments.driverId, driverId));

      console.log("📄 Documentos encontrados:", documents?.length || 0);

      return res.json({
        success: true,
        data: driver, // Retornando dados simplificados para teste
      });
    } catch (error) {
      console.error("Erro ao buscar perfil completo do motorista:", error);
      return res.status(500).json({ message: "Erro ao buscar perfil do motorista" });
    }
  });

  // GET /api/v1/driver/commission-stats - Obter estatísticas de comissão do motorista
  app.get("/api/v1/driver/commission-stats", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      // Buscar driver
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      // Obter dados de comissão
      const currentMonthDeliveries = driver.monthlyDeliveryCount || 0;
      const currentCommissionPercentage = await storage.getDriverCommissionPercentage(driverId);

      // Calcular início da semana atual (domingo)
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Volta para o domingo
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sábado
      endOfWeek.setHours(23, 59, 59, 999);

      // Contar entregas da semana atual
      const weeklyResult = await db.execute(sql`
        SELECT COUNT(*) as count
        FROM requests
        WHERE driver_id = ${driverId}
          AND is_completed = true
          AND completed_at >= ${startOfWeek.toISOString()}
          AND completed_at <= ${endOfWeek.toISOString()}
      `);

      const currentWeekDeliveries = weeklyResult.rows[0]?.count
        ? parseInt(weeklyResult.rows[0].count as string)
        : 0;

      // Buscar todas as faixas ativas ordenadas
      const allTiers = await storage.getAllCommissionTiers();
      const activeTiers = allTiers
        .filter(tier => tier.active)
        .sort((a, b) => a.minDeliveries - b.minDeliveries);

      // Encontrar próxima faixa
      let nextTier = null;
      for (const tier of activeTiers) {
        if (currentMonthDeliveries < tier.minDeliveries) {
          nextTier = {
            minDeliveries: tier.minDeliveries,
            maxDeliveries: tier.maxDeliveries,
            commissionPercentage: parseFloat(tier.commissionPercentage),
            deliveriesNeeded: tier.minDeliveries - currentMonthDeliveries
          };
          break;
        }
      }

      // Formatar todas as faixas para o retorno
      const formattedTiers = activeTiers.map(tier => ({
        minDeliveries: tier.minDeliveries,
        maxDeliveries: tier.maxDeliveries,
        commissionPercentage: parseFloat(tier.commissionPercentage),
        active: tier.active
      }));

      return res.json({
        success: true,
        data: {
          currentWeekDeliveries,
          currentMonthDeliveries,
          currentCommissionPercentage,
          nextTier,
          allTiers: formattedTiers
        }
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas de comissão:", error);
      return res.status(500).json({ message: "Erro ao buscar estatísticas de comissão" });
    }
  });

  // GET /api/v1/driver/promotions - Obter promoções ativas
  app.get("/api/v1/driver/promotions", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      // Buscar todas as promoções ativas
      const activePromotions = await db
        .select()
        .from(promotions)
        .where(eq(promotions.active, true));

      // Data de hoje no formato YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = today.substring(0, 7); // YYYY-MM

      // Filtrar promoções válidas do mês atual (qualquer data do mês)
      const validPromotions = activePromotions.filter(promo => {
        const validDates = promo.validDates.split(',');
        // Retorna true se pelo menos uma data for do mês atual
        return validDates.some(date => date.substring(0, 7) === currentMonth);
      });

      // Formatar resposta para o app
      const formattedPromotions = validPromotions.map(promo => ({
        id: promo.id,
        type: promo.type,
        name: promo.name,
        description: promo.rule,
        validDates: promo.validDates, // Enviar como string, não array
        goal: promo.deliveryQuantity,
        prize: promo.prize
      }));

      return res.json({
        success: true,
        data: formattedPromotions
      });
    } catch (error) {
      console.error("Erro ao buscar promoções:", error);
      return res.status(500).json({ message: "Erro ao buscar promoções" });
    }
  });

  // GET /api/v1/driver/my-referrals - Buscar minhas indicações (para o app)
  app.get("/api/v1/driver/my-referrals", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { driverReferrals, referralCommissions, referralSettings, drivers } = await import("@shared/schema");

      // Buscar configurações de indicação
      const [settings] = await db
        .select()
        .from(referralSettings)
        .where(eq(referralSettings.enabled, true))
        .limit(1);

      // Buscar todas as indicações feitas por este motorista
      const rawReferrals = await db
        .select({
          id: driverReferrals.id,
          referredDriverId: driverReferrals.referredDriverId,
          referredName: driverReferrals.referredName,
          referredPhone: driverReferrals.referredPhone,
          status: driverReferrals.status,
          registeredAt: driverReferrals.registeredAt,
          deliveriesCompleted: driverReferrals.deliveriesCompleted,
          commissionEarned: driverReferrals.commissionEarned,
          commissionPaid: driverReferrals.commissionPaid,
          createdAt: driverReferrals.createdAt,
        })
        .from(driverReferrals)
        .where(eq(driverReferrals.referrerDriverId, driverId))
        .orderBy(desc(driverReferrals.createdAt));

      // Buscar nome do motorista indicado se já estiver cadastrado
      const referrals = await Promise.all(rawReferrals.map(async (referral) => {
        let referredName = referral.referredName;

        // Se tiver referredDriverId, buscar nome atualizado da tabela drivers
        if (referral.referredDriverId) {
          const [referred] = await db
            .select({ name: drivers.name })
            .from(drivers)
            .where(eq(drivers.id, referral.referredDriverId))
            .limit(1);

          if (referred?.name) {
            referredName = referred.name;
          }
        }

        return {
          ...referral,
          referredName: referredName || 'N/A'
        };
      }));

      // Buscar comissões
      const commissions = await db
        .select()
        .from(referralCommissions)
        .where(eq(referralCommissions.referrerDriverId, driverId));

      // Calcular totais
      const totals = {
        totalReferrals: referrals.length,
        activeReferrals: referrals.filter(r => r.status === 'active').length,
        pendingCommissions: commissions.filter(c => c.status === 'pending').length,
        qualifiedCommissions: commissions.filter(c => c.status === 'qualified').length,
        paidCommissions: commissions.filter(c => c.status === 'paid').length,
        totalEarned: commissions
          .filter(c => c.status === 'qualified' || c.status === 'paid')
          .reduce((sum, c) => sum + parseFloat(c.commissionAmount || '0'), 0),
        totalPaid: commissions
          .filter(c => c.status === 'paid')
          .reduce((sum, c) => sum + parseFloat(c.commissionAmount || '0'), 0),
      };

      // Buscar o código do motorista
      const [driver] = await db
        .select({ referralCode: drivers.referralCode })
        .from(drivers)
        .where(eq(drivers.id, driverId))
        .limit(1);

      return res.json({
        success: true,
        data: {
          myReferralCode: driver?.referralCode || null,
          settings: settings ? {
            minimumDeliveries: settings.minimumDeliveries,
            commissionAmount: settings.commissionAmount,
          } : null,
          referrals,
          totals,
        }
      });
    } catch (error) {
      console.error("Erro ao buscar indicações:", error);
      return res.status(500).json({ message: "Erro ao buscar indicações" });
    }
  });

  // GET /api/v1/driver/profile - Buscar perfil do motorista logado
  app.get("/api/v1/driver/profile", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      // Buscar dados do motorista
      const driver = await storage.getDriver(driverId);

      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      return res.json({
        success: true,
        data: {
          id: driver.id,
          name: driver.name,
          mobile: driver.mobile,
          email: driver.email,
          cpf: driver.cpf,
          profilePicture: driver.profilePicture,
          active: driver.active,
          approve: driver.approve,
          available: driver.available,
          rating: driver.rating,
          noOfRatings: driver.noOfRatings,
          vehicleTypeId: driver.vehicleTypeId,
          carMake: driver.carMake,
          carModel: driver.carModel,
          carNumber: driver.carNumber,
          carColor: driver.carColor,
          carYear: driver.carYear,
          uploadedDocuments: driver.uploadedDocuments,
          referralCode: driver.referralCode, // Código de indicação do motorista
          totalDeliveries: driver.totalDeliveries, // Total de entregas completadas
          referredByCode: driver.referredByCode, // Código de quem indicou (se houver)
        }
      });
    } catch (error) {
      console.error("Erro ao buscar perfil do motorista:", error);
      return res.status(500).json({ message: "Erro ao buscar perfil" });
    }
  });

  // POST /api/v1/driver/profile - Atualizar perfil do motorista
  app.post("/api/v1/driver/profile", upload.single("profile_picture"), async (req, res) => {
    try {
      if (!req.session.driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const {
        name,
        email,
        carMake,
        carModel,
        carNumber,
        carColor,
        carYear,
      } = req.body;

      const updateData: any = {};

      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (carMake) updateData.carMake = carMake;
      if (carModel) updateData.carModel = carModel;
      if (carNumber) updateData.carNumber = carNumber;
      if (carColor) updateData.carColor = carColor;
      if (carYear) updateData.carYear = carYear;

      // Se houver upload de imagem
      if (req.file) {
        updateData.profilePicture = `/uploads/${req.file.filename}`;
      }

      const updatedDriver = await storage.updateDriver(req.session.driverId, updateData);

      if (!updatedDriver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      return res.json({
        success: true,
        message: "Perfil atualizado com sucesso",
        data: {
          id: updatedDriver.id,
          name: updatedDriver.name,
          email: updatedDriver.email,
          profilePicture: updatedDriver.profilePicture,
          carMake: updatedDriver.carMake,
          carModel: updatedDriver.carModel,
          carNumber: updatedDriver.carNumber,
          carColor: updatedDriver.carColor,
          carYear: updatedDriver.carYear,
        }
      });
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      return res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });

  // POST /api/v1/driver/documents - Enviar documento do motorista (com R2)
  app.post("/api/v1/driver/documents", (req, res, next) => {
    console.log("\n🚀 POST /api/v1/driver/documents - Requisição recebida");
    console.log("  - Content-Type:", req.headers["content-type"]);
    console.log("  - Session exists:", !!req.session);
    console.log("  - Session driverId:", req.session?.driverId);
    next();
  }, uploadR2.single("document"), async (req, res) => {
    try {
      // Debug: verificar o que está vindo no body
      console.log("\n📤 Após multer processamento:");
      console.log("  - req.body:", req.body);
      console.log("  - req.session.driverId:", req.session.driverId);
      console.log("  - req.file:", req.file ? "✓ arquivo presente" : "✗ sem arquivo");

      // Permitir envio com sessão OU com driverId no body (para uploads após cadastro)
      const driverId = req.session.driverId || req.body.driverId;

      if (!driverId) {
        return res.status(401).json({
          message: "Driver ID é obrigatório. Forneça via sessão ou no corpo da requisição.",
          debug: {
            hasSession: !!req.session.driverId,
            hasBodyDriverId: !!req.body.driverId,
            body: req.body
          }
        });
      }

      const { documentTypeId } = req.body;

      if (!documentTypeId) {
        return res.status(400).json({
          message: "O tipo de documento é obrigatório"
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Nenhum arquivo foi enviado"
        });
      }

      // Verificar se o motorista existe
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, driverId))
        .limit(1);

      if (!driver) {
        return res.status(404).json({
          message: "Motorista não encontrado"
        });
      }

      // Fazer upload para R2
      console.log("☁️  Fazendo upload para R2...");
      const documentUrl = await uploadToR2(
        req.file.buffer,
        "documentos_entregadores",
        req.file.originalname
      );

      // Verificar se já existe um documento deste tipo para o motorista
      const existingDoc = await db
        .select()
        .from(driverDocuments)
        .where(
          and(
            eq(driverDocuments.driverId, driverId),
            eq(driverDocuments.documentTypeId, documentTypeId)
          )
        )
        .limit(1);

      let document;

      if (existingDoc.length > 0) {
        // Deletar arquivo antigo do R2 se existir
        if (existingDoc[0].documentUrl && existingDoc[0].documentUrl.includes('r2.dev')) {
          try {
            console.log(`🗑️  Deletando arquivo antigo do R2...`);
            await deleteFromR2(existingDoc[0].documentUrl);
          } catch (error) {
            console.error("Erro ao deletar arquivo antigo:", error);
          }
        }

        // Atualizar documento existente (reenvio)
        console.log(`📝 Atualizando documento existente (tipo: ${documentTypeId})`);
        const [updated] = await db
          .update(driverDocuments)
          .set({
            documentUrl: documentUrl,
            status: "pending", // Resetar status para pendente
            rejectionReason: null, // Limpar motivo de rejeição anterior
            updatedAt: new Date(),
          })
          .where(eq(driverDocuments.id, existingDoc[0].id))
          .returning();
        document = updated;
      } else {
        // Inserir novo documento (primeiro envio)
        console.log(`✨ Inserindo novo documento (tipo: ${documentTypeId})`);
        const [inserted] = await db
          .insert(driverDocuments)
          .values({
            driverId: driverId,
            documentTypeId: documentTypeId,
            documentUrl: documentUrl,
            status: "pending",
          })
          .returning();
        document = inserted;
      }

      // 📸 Se o documento for uma selfie, atualizar a foto de perfil do motorista
      const [documentType] = await db
        .select()
        .from(driverDocumentTypes)
        .where(eq(driverDocumentTypes.id, documentTypeId))
        .limit(1);

      if (documentType && documentType.name.toLowerCase() === 'selfie') {
        console.log(`📸 Atualizando foto de perfil do motorista com a selfie`);
        await db
          .update(drivers)
          .set({
            profilePicture: documentUrl,
          })
          .where(eq(drivers.id, driverId));

        console.log(`✅ Foto de perfil atualizada: ${documentUrl}`);
      }

      // 🔍 Se o documento for CNH, validar data de validade automaticamente
      if (documentType && documentType.name.toLowerCase().includes('cnh') && process.env.CELLEREIT_API_TOKEN) {
        try {
          console.log(`🔍 Validando CNH automaticamente...`);

          // Converter imagem para base64
          const imageBase64 = req.file.buffer.toString('base64');

          // Chamar API Cellereit para extrair dados da CNH
          const cnhResponse = await fetch('https://api.gw.cellereit.com.br/contextus/cnh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CELLEREIT_API_TOKEN}`,
            },
            body: JSON.stringify({
              image: imageBase64
            }),
          });

          if (cnhResponse.ok) {
            const cnhData = await cnhResponse.json();
            console.log(`📋 Dados da CNH extraídos:`, cnhData);

            // Verificar se a API retornou erro interno (status.code != 200)
            if (cnhData.status && cnhData.status.code !== 200) {
              console.log(`⚠️ API retornou erro interno: ${cnhData.status.code} - ${cnhData.status.message || 'Sem mensagem'}`);
              if (cnhData.result && cnhData.result[0] && cnhData.result[0].docQualityScore === 0) {
                console.log(`⚠️ Imagem não reconhecida como CNH válida (qualidade: 0). Verifique se a imagem está clara e é uma CNH.`);
              }
            }

            // Procurar campo data_validade na resposta
            let expirationDateStr = null;
            let validationData: Record<string, string> = {};

            // A resposta pode vir em diferentes formatos, vamos tentar encontrar a data de validade
            if (Array.isArray(cnhData)) {
              // Se for array de campos
              for (const field of cnhData) {
                if (field.name && field.value) {
                  validationData[field.name] = field.value;
                  if (field.name === 'data_validade' || field.name === 'validade') {
                    expirationDateStr = field.value;
                  }
                }
              }
            } else if (cnhData.result && Array.isArray(cnhData.result) && cnhData.result.length > 0) {
              // Formato: { result: [{ fields: [...] }] }
              const firstResult = cnhData.result[0];

              // Verificar qualidade do documento
              if (firstResult.docQualityScore) {
                console.log(`📊 Qualidade do documento: ${(firstResult.docQualityScore * 100).toFixed(1)}%`);
              }
              if (firstResult.docType) {
                console.log(`📄 Tipo de documento detectado: ${firstResult.docType}`);
              }

              if (firstResult.fields && Array.isArray(firstResult.fields) && firstResult.fields.length > 0) {
                console.log(`📋 Campos encontrados (${firstResult.fields.length}):`, firstResult.fields.map((f: any) => f.name).join(', '));
                for (const field of firstResult.fields) {
                  if (field.name && field.value) {
                    validationData[field.name] = field.value;
                    if (field.name === 'data_validade' || field.name === 'validade') {
                      expirationDateStr = field.value;
                    }
                  }
                }
              } else {
                console.log(`⚠️ Nenhum campo extraído da imagem. A qualidade pode estar muito baixa ou não é uma CNH válida.`);
              }
            } else if (cnhData.data_validade) {
              expirationDateStr = cnhData.data_validade;
              validationData = cnhData;
            } else if (cnhData.fields && Array.isArray(cnhData.fields)) {
              for (const field of cnhData.fields) {
                if (field.name && field.value) {
                  validationData[field.name] = field.value;
                  if (field.name === 'data_validade' || field.name === 'validade') {
                    expirationDateStr = field.value;
                  }
                }
              }
            }

            if (expirationDateStr) {
              console.log(`📅 Data de validade encontrada: ${expirationDateStr}`);

              // Converter data de validade (formato DD/MM/YYYY) para Date
              const dateParts = expirationDateStr.split('/');
              let expirationDate: Date | null = null;

              if (dateParts.length === 3) {
                const day = parseInt(dateParts[0], 10);
                const month = parseInt(dateParts[1], 10) - 1; // Mês em JS é 0-indexed
                const year = parseInt(dateParts[2], 10);
                expirationDate = new Date(year, month, day);
              }

              if (expirationDate && !isNaN(expirationDate.getTime())) {
                // Verificar se está vencido
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isExpired = expirationDate < today;

                console.log(`📅 Data de validade: ${expirationDate.toLocaleDateString('pt-BR')}`);
                console.log(`${isExpired ? '⚠️ DOCUMENTO VENCIDO!' : '✅ Documento válido'}`);

                // Atualizar documento com informações de validade
                await db
                  .update(driverDocuments)
                  .set({
                    expirationDate: expirationDate,
                    isExpired: isExpired,
                    validationData: validationData,
                    updatedAt: new Date(),
                  })
                  .where(eq(driverDocuments.id, document.id));

                // Atualizar variável document para retornar na resposta
                document = {
                  ...document,
                  expirationDate: expirationDate,
                  isExpired: isExpired,
                  validationData: validationData,
                };
              }
            } else {
              console.log(`⚠️ Data de validade não encontrada na resposta da API`);
            }
          } else {
            console.log(`⚠️ Erro na API de validação CNH: ${cnhResponse.status}`);
          }
        } catch (cnhError) {
          console.error("Erro ao validar CNH automaticamente:", cnhError);
          // Não bloqueia o upload se a validação falhar
        }
      }

      // 🔍 Se o documento for CRLV, validar data de validade automaticamente
      if (documentType && documentType.name.toLowerCase().includes('crlv') && process.env.CELLEREIT_API_TOKEN) {
        try {
          console.log(`🔍 Validando CRLV-Digital automaticamente...`);

          // Criar FormData para enviar o arquivo
          const FormData = (await import('form-data')).default;
          const formData = new FormData();
          formData.append('file', req.file.buffer, {
            filename: req.file.originalname || 'crlv.pdf',
            contentType: req.file.mimetype || 'application/pdf',
          });

          console.log(`📦 Tamanho do arquivo: ${req.file.buffer.length} bytes`);

          // Chamar API Cellereit para extrair dados do CRLV
          // A API do CRLV usa multipart/form-data
          const crlvResponse = await fetch('https://api.gw.cellereit.com.br/contextus/crlv-digital', {
            method: 'POST',
            headers: {
              ...formData.getHeaders(),
              'Authorization': `Bearer ${process.env.CELLEREIT_API_TOKEN}`,
            },
            body: formData,
          });

          console.log(`📡 Status da resposta CRLV: ${crlvResponse.status}`);

          if (crlvResponse.ok) {
            const crlvData = await crlvResponse.json();
            console.log(`📋 Dados do CRLV extraídos:`, crlvData);

            // Verificar se a API retornou erro interno
            if (crlvData.status && crlvData.status.code !== 200) {
              console.log(`⚠️ API retornou erro interno: ${crlvData.status.code} - ${crlvData.status.message || 'Sem mensagem'}`);
              if (crlvData.result && crlvData.result[0] && crlvData.result[0].docQualityScore === 0) {
                console.log(`⚠️ Imagem não reconhecida como CRLV válido (qualidade: 0). Verifique se a imagem está clara e é um CRLV.`);
              }
            }

            // Procurar campo data_validade na resposta
            let expirationDateStr = null;
            let validationData: Record<string, string> = {};

            if (crlvData.result && Array.isArray(crlvData.result) && crlvData.result.length > 0) {
              const firstResult = crlvData.result[0];

              // Verificar qualidade do documento
              if (firstResult.docQualityScore) {
                console.log(`📊 Qualidade do documento: ${(firstResult.docQualityScore * 100).toFixed(1)}%`);
              }
              if (firstResult.docType) {
                console.log(`📄 Tipo de documento detectado: ${firstResult.docType}`);
              }

              if (firstResult.fields && Array.isArray(firstResult.fields) && firstResult.fields.length > 0) {
                console.log(`📋 Campos encontrados (${firstResult.fields.length}):`, firstResult.fields.map((f: any) => f.name).join(', '));
                for (const field of firstResult.fields) {
                  if (field.name && field.value) {
                    validationData[field.name] = field.value;
                    // CRLV pode ter diferentes nomes para data de validade
                    if (field.name === 'data_validade' || field.name === 'validade' || field.name === 'exercicio' || field.name === 'ano_exercicio') {
                      expirationDateStr = field.value;
                    }
                  }
                }
              } else {
                console.log(`⚠️ Nenhum campo extraído da imagem. A qualidade pode estar muito baixa ou não é um CRLV válido.`);
              }
            }

            if (expirationDateStr) {
              console.log(`📅 Data de validade/exercício encontrada: ${expirationDateStr}`);

              let expirationDate: Date | null = null;

              // CRLV pode vir como data (DD/MM/YYYY) ou apenas ano (YYYY)
              if (expirationDateStr.includes('/')) {
                // Formato DD/MM/YYYY
                const dateParts = expirationDateStr.split('/');
                if (dateParts.length === 3) {
                  const day = parseInt(dateParts[0], 10);
                  const month = parseInt(dateParts[1], 10) - 1;
                  const year = parseInt(dateParts[2], 10);
                  expirationDate = new Date(year, month, day);
                }
              } else if (/^\d{4}$/.test(expirationDateStr)) {
                // Apenas ano (YYYY) - considerar vencido se ano < ano atual
                const year = parseInt(expirationDateStr, 10);
                expirationDate = new Date(year, 11, 31); // Fim do ano de exercício
              }

              if (expirationDate && !isNaN(expirationDate.getTime())) {
                // Verificar se está vencido
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isExpired = expirationDate < today;

                console.log(`📅 Data de validade: ${expirationDate.toLocaleDateString('pt-BR')}`);
                console.log(`${isExpired ? '⚠️ DOCUMENTO VENCIDO!' : '✅ Documento válido'}`);

                // Atualizar documento com informações de validade
                await db
                  .update(driverDocuments)
                  .set({
                    expirationDate: expirationDate,
                    isExpired: isExpired,
                    validationData: validationData,
                    updatedAt: new Date(),
                  })
                  .where(eq(driverDocuments.id, document.id));

                // Atualizar variável document para retornar na resposta
                document = {
                  ...document,
                  expirationDate: expirationDate,
                  isExpired: isExpired,
                  validationData: validationData,
                };
              }
            } else {
              console.log(`⚠️ Data de validade não encontrada na resposta da API`);
            }
          } else {
            console.log(`⚠️ Erro na API de validação CRLV: ${crlvResponse.status}`);
            try {
              const errorBody = await crlvResponse.text();
              console.log(`📋 Corpo do erro:`, errorBody);
            } catch (e) {
              console.log(`Não foi possível ler o corpo do erro`);
            }
          }
        } catch (crlvError) {
          console.error("Erro ao validar CRLV automaticamente:", crlvError);
          // Não bloqueia o upload se a validação falhar
        }
      }

      // Verificar se todos os documentos obrigatórios foram enviados
      const requiredDocs = await db
        .select()
        .from(driverDocumentTypes)
        .where(
          and(
            eq(driverDocumentTypes.required, true),
            eq(driverDocumentTypes.active, true)
          )
        );

      const uploadedDocs = await db
        .select()
        .from(driverDocuments)
        .where(eq(driverDocuments.driverId, driverId));

      const allRequiredUploaded = requiredDocs.every(reqDoc =>
        uploadedDocs.some(upDoc => upDoc.documentTypeId === reqDoc.id)
      );

      // Se todos os documentos obrigatórios foram enviados, atualizar motorista
      if (allRequiredUploaded) {
        await storage.updateDriver(driverId, {
          uploadedDocuments: true
        });
      }

      return res.status(201).json({
        success: true,
        message: "Documento enviado com sucesso",
        data: {
          id: document.id,
          documentTypeId: document.documentTypeId,
          documentUrl: document.documentUrl,
          status: document.status,
          allRequiredUploaded: allRequiredUploaded
        }
      });
    } catch (error) {
      console.error("Erro ao enviar documento:", error);
      return res.status(500).json({ message: "Erro ao enviar documento" });
    }
  });

  // GET /api/v1/driver/documents - Listar documentos enviados pelo motorista
  app.get("/api/v1/driver/documents", async (req, res) => {
    try {
      if (!req.session.driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const documents = await db
        .select({
          id: driverDocuments.id,
          documentTypeId: driverDocuments.documentTypeId,
          documentTypeName: driverDocumentTypes.name,
          documentUrl: driverDocuments.documentUrl,
          status: driverDocuments.status,
          rejectionReason: driverDocuments.rejectionReason,
          createdAt: driverDocuments.createdAt,
        })
        .from(driverDocuments)
        .leftJoin(
          driverDocumentTypes,
          eq(driverDocuments.documentTypeId, driverDocumentTypes.id)
        )
        .where(eq(driverDocuments.driverId, req.session.driverId))
        .orderBy(driverDocuments.createdAt);

      return res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      console.error("Erro ao buscar documentos:", error);
      return res.status(500).json({ message: "Erro ao buscar documentos" });
    }
  });

  // ========================================
  // DELIVERY REQUESTS (MOTORISTA)
  // ========================================

  // GET /api/v1/driver/pending-requests - Listar solicitações pendentes
  app.get("/api/v1/driver/pending-requests", async (req, res) => {
    try {
      if (!req.session.driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const driverId = req.session.driverId;

      // Buscar notificações do motorista que ainda não expiraram
      const notifications = await db
        .select({
          notificationId: driverNotifications.id,
          requestId: requests.id,
          requestNumber: requests.requestNumber,
          status: driverNotifications.status,
          expiresAt: driverNotifications.expiresAt,
          companyId: requests.companyId,
          customerName: requests.customerName,
          customerWhatsapp: requests.customerWhatsapp,
          deliveryReference: requests.deliveryReference,
          zoneTypeId: requests.zoneTypeId,
          notes: requests.notes,
        })
        .from(driverNotifications)
        .innerJoin(requests, eq(driverNotifications.requestId, requests.id))
        .where(
          and(
            eq(driverNotifications.driverId, driverId),
            eq(driverNotifications.status, "notified")
          )
        )
        .orderBy(driverNotifications.notifiedAt);

      // Buscar detalhes completos de cada solicitação
      const pendingRequests = await Promise.all(
        notifications.map(async (notification) => {
          // Buscar dados da solicitação (request)
          const [request] = await db
            .select({
              totalDistance: requests.totalDistance,
              totalTime: requests.totalTime,
              estimatedTime: requests.estimatedTime,
            })
            .from(requests)
            .where(eq(requests.id, notification.requestId))
            .limit(1);

          // Buscar dados da empresa
          const [company] = await db
            .select({
              name: companies.name,
            })
            .from(companies)
            .where(eq(companies.id, notification.companyId!))
            .limit(1);

          // Buscar localizações
          const [place] = await db
            .select()
            .from(requestPlaces)
            .where(eq(requestPlaces.requestId, notification.requestId))
            .limit(1);

          // Buscar cobrança
          const [bill] = await db
            .select()
            .from(requestBills)
            .where(eq(requestBills.requestId, notification.requestId))
            .limit(1);

          if (!place || !request) {
            return null;
          }

          // Usar distância e tempo do Google Maps (salvos no banco)
          const distanceInKm = request.totalDistance
            ? (parseFloat(request.totalDistance) / 1000).toFixed(2)
            : "0";

          // Adicionar margem de 5 minutos ao tempo
          const googleMapsTime = request.totalTime ? parseInt(request.totalTime) : 0;
          const timeWithMargin = googleMapsTime + 5;

          // Obter valores da bill (já inclui comissão calculada)
          const totalAmount = bill ? parseFloat(bill.totalAmount) : 0;
          const adminCommission = bill ? parseFloat(bill.adminCommision) : 0;
          const driverAmount = totalAmount - adminCommission;

          return {
            notificationId: notification.notificationId,
            requestId: notification.requestId,
            requestNumber: notification.requestNumber,
            companyName: company?.name || "Empresa",
            customerName: notification.customerName,
            customerWhatsapp: notification.customerWhatsapp,
            deliveryReference: notification.deliveryReference,
            pickupAddress: place.pickAddress,
            pickupLat: parseFloat(place.pickLat),
            pickupLng: parseFloat(place.pickLng),
            deliveryAddress: place.dropAddress,
            deliveryLat: parseFloat(place.dropLat),
            deliveryLng: parseFloat(place.dropLng),
            distance: distanceInKm,
            estimatedTime: timeWithMargin.toString(), // Google Maps + 5 min
            estimatedAmount: driverAmount.toFixed(2), // VALOR DO MOTORISTA - app lê este campo
            totalAmount: totalAmount.toFixed(2),
            driverAmount: driverAmount.toFixed(2),
            adminCommission: adminCommission.toFixed(2),
            notes: notification.notes,
            expiresAt: notification.expiresAt?.toISOString(),
            status: notification.status,
          };
        })
      );

      // Filtrar nulls (caso alguma solicitação não tenha lugar)
      const validRequests = pendingRequests.filter((r) => r !== null);

      return res.json({
        success: true,
        data: validRequests,
      });
    } catch (error) {
      console.error("Erro ao buscar solicitações pendentes:", error);
      return res.status(500).json({
        message: "Erro ao buscar solicitações pendentes",
      });
    }
  });

  // POST /api/v1/driver/requests/:id/accept - Aceitar solicitação
  app.post("/api/v1/driver/requests/:id/accept", async (req, res) => {
    try {
      // Permitir autenticação via sessão OU Bearer token
      let driverId = req.session.driverId;

      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Erro ao decodificar token:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const requestId = req.params.id;
      console.log(`✅ Motorista ${driverId} aceitando solicitação ${requestId}`);

      // 🔒 NOVA VALIDAÇÃO: Verificar se o motorista já tem uma entrega em andamento
      const [activeDelivery] = await db
        .select()
        .from(requests)
        .where(
          and(
            eq(requests.driverId, driverId),
            eq(requests.isCompleted, false),
            eq(requests.isCancelled, false)
          )
        )
        .limit(1);

      if (activeDelivery) {
        // Se tiver uma entrega ativa, verificar se já foi retirada
        if (!activeDelivery.isTripStart) {
          console.log(`❌ Motorista ${driverId} tentou aceitar nova entrega sem ter retirado a anterior (${activeDelivery.requestNumber})`);
          return res.status(409).json({
            message: "Você já possui uma entrega em andamento. Retire o pedido antes de aceitar uma nova entrega.",
            code: "DELIVERY_IN_PROGRESS_NOT_PICKED_UP",
            activeDeliveryId: activeDelivery.id,
            activeDeliveryNumber: activeDelivery.requestNumber
          });
        }

        // Se já retirou, pode aceitar nova entrega (mas ainda não pode abrir a nova até finalizar a atual)
        console.log(`⚠️ Motorista ${driverId} já tem entrega retirada (${activeDelivery.requestNumber}), mas pode aceitar nova`);
      }

      // Verificar se a solicitação ainda está disponível
      const [request] = await db
        .select()
        .from(requests)
        .where(eq(requests.id, requestId))
        .limit(1);

      if (!request) {
        return res.status(404).json({
          message: "Solicitação não encontrada",
        });
      }

      if (request.driverId) {
        return res.status(409).json({
          message: "Esta solicitação já foi aceita por outro motorista",
        });
      }

      // Verificar se a notificação do motorista ainda está válida
      const [notification] = await db
        .select()
        .from(driverNotifications)
        .where(
          and(
            eq(driverNotifications.requestId, requestId),
            eq(driverNotifications.driverId, driverId)
          )
        )
        .limit(1);

      if (!notification) {
        return res.status(404).json({
          message: "Notificação não encontrada",
        });
      }

      if (notification.status !== "notified") {
        return res.status(409).json({
          message: "Esta notificação já foi respondida",
        });
      }

      // Verificar se expirou
      const now = new Date();
      const expiresAt = notification.expiresAt ? new Date(notification.expiresAt) : null;
      console.log(`🕐 Verificando expiração:
  - Agora: ${now.toISOString()}
  - Expira em: ${expiresAt ? expiresAt.toISOString() : 'null'}
  - notification.expiresAt (raw): ${notification.expiresAt}
  - Expirou? ${expiresAt && expiresAt < now}`);

      if (expiresAt && expiresAt < now) {
        return res.status(410).json({
          message: "Esta solicitação expirou",
        });
      }

      // Calcular previsão: tempo do Google Maps + 5 minutos de margem
      const googleMapsTime = request.totalTime ? parseFloat(request.totalTime) : 0;
      const estimatedTimeWithMargin = googleMapsTime + 5;

      console.log(`📝 Atualizando entrega aceita:
  - totalDistance no banco: ${request.totalDistance} metros (${request.totalDistance ? (parseFloat(request.totalDistance) / 1000).toFixed(2) : 0} km)
  - totalTime no banco: ${request.totalTime} min
  - estimatedTime (será salvo): ${estimatedTimeWithMargin} min (${googleMapsTime} + 5)`);

      // Atualizar a solicitação com o motorista
      await db
        .update(requests)
        .set({
          driverId: driverId,
          acceptedAt: new Date(),
          isDriverStarted: true, // Marcar como aceito para o status visual
          estimatedTime: estimatedTimeWithMargin.toString(), // Google Maps + 5 min
        })
        .where(eq(requests.id, requestId));

      // Atualizar status do motorista para "em entrega" (marcador vermelho no mapa)
      await db
        .update(drivers)
        .set({ onDelivery: true })
        .where(eq(drivers.id, driverId));

      // Atualizar a notificação do motorista como aceita
      await db
        .update(driverNotifications)
        .set({
          status: "accepted",
          respondedAt: new Date(),
        })
        .where(eq(driverNotifications.id, notification.id));

      console.log(`✅ Solicitação aceita pelo motorista`);

      // Marcar todas as outras notificações como expiradas
      await db
        .update(driverNotifications)
        .set({
          status: "expired",
        })
        .where(
          and(
            eq(driverNotifications.requestId, requestId),
            eq(driverNotifications.status, "notified")
          )
        );

      console.log(`✅ Outras notificações marcadas como expiradas`);

      // Buscar os outros motoristas que receberam notificação
      const otherNotifications = await db
        .select({
          driverId: driverNotifications.driverId,
          fcmToken: drivers.fcmToken,
        })
        .from(driverNotifications)
        .innerJoin(drivers, eq(driverNotifications.driverId, drivers.id))
        .where(
          and(
            eq(driverNotifications.requestId, requestId),
            eq(driverNotifications.status, "expired")
          )
        );

      // Enviar notificação para outros motoristas informando que foi aceita
      const otherFcmTokens = otherNotifications
        .map((n) => n.fcmToken)
        .filter((token): token is string => token !== null);

      if (otherFcmTokens.length > 0) {
        await sendPushToMultipleDevices(
          otherFcmTokens,
          "Entrega Aceita",
          "A entrega foi aceita por outro entregador",
          {
            type: "delivery_taken",
            requestId: requestId,
            requestNumber: request.requestNumber,
          }
        );

        console.log(`✅ Notificação FCM enviada para ${otherFcmTokens.length} motorista(s)`);
      }

      // Emitir evento Socket.IO para TODOS os motoristas removerem a entrega da lista
      const io = (app as any).io;
      if (io) {
        io.emit("delivery-taken", {
          requestId: requestId,
          requestNumber: request.requestNumber,
          takenBy: driverId,
          timestamp: new Date().toISOString()
        });
        console.log(`✅ Evento Socket.IO "delivery-taken" emitido para todos os motoristas`);
      }

      // Buscar dados completos da entrega para retornar
      const [place] = await db
        .select()
        .from(requestPlaces)
        .where(eq(requestPlaces.requestId, requestId))
        .limit(1);

      const [bill] = await db
        .select()
        .from(requestBills)
        .where(eq(requestBills.requestId, requestId))
        .limit(1);

      // ✅ USAR VALORES DO BANCO em vez de recalcular
      // Distância: converter de metros para km
      const distanceInKm = request.totalDistance
        ? (parseFloat(request.totalDistance) / 1000).toFixed(2)
        : "0.00";

      // Tempo estimado: usar o estimatedTime que já foi calculado com margem de 5 min
      const estimatedTimeMin = request.estimatedTime
        ? request.estimatedTime
        : "0";

      console.log(`📤 Resposta da aceitação sendo enviada ao app:
  - Request Number: ${request.requestNumber}
  - distance (app receberá): ${distanceInKm} km
  - estimatedTime (app receberá): ${estimatedTimeMin} min
  - totalDistance (banco): ${request.totalDistance} metros
  - estimatedTime (banco): ${request.estimatedTime} min`);

      // Usar valor já calculado de requestEtaAmount (valor líquido para o motorista)
      const driverAmount = request.requestEtaAmount ? parseFloat(request.requestEtaAmount) : 0;

      // Buscar dados da empresa
      const company = request.companyId ? await storage.getCompany(request.companyId) : null;

      return res.json({
        success: true,
        message: "Entrega aceita com sucesso!",
        data: {
          requestId: request.id,
          requestNumber: request.requestNumber,
          companyName: company?.name || null, // Nome da empresa
          companyPhone: company?.phone || null, // Telefone da empresa
          customerName: request.customerName || null, // Nome do cliente final
          pickupAddress: place?.pickAddress,
          pickupLat: place ? parseFloat(place.pickLat) : null,
          pickupLng: place ? parseFloat(place.pickLng) : null,
          deliveryAddress: place?.dropAddress,
          deliveryLat: place ? parseFloat(place.dropLat) : null,
          deliveryLng: place ? parseFloat(place.dropLng) : null,
          distance: distanceInKm, // ✅ Valor do banco (2.00 km)
          estimatedTime: estimatedTimeMin, // ✅ Valor do banco (9 min)
          driverAmount: driverAmount.toFixed(2),
        },
      });
    } catch (error) {
      console.error("❌ Erro ao aceitar solicitação:", error);
      return res.status(500).json({
        message: "Erro ao aceitar solicitação",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // POST /api/v1/driver/requests/:id/reject - Rejeitar solicitação
  app.post("/api/v1/driver/requests/:id/reject", async (req, res) => {
    try {
      if (!req.session.driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const requestId = req.params.id;
      const driverId = req.session.driverId;

      console.log(`❌ Motorista ${driverId} rejeitando solicitação ${requestId}`);

      // Verificar se a notificação existe
      const [notification] = await db
        .select()
        .from(driverNotifications)
        .where(
          and(
            eq(driverNotifications.requestId, requestId),
            eq(driverNotifications.driverId, driverId)
          )
        )
        .limit(1);

      if (!notification) {
        return res.status(404).json({
          message: "Notificação não encontrada",
        });
      }

      if (notification.status !== "notified") {
        return res.status(409).json({
          message: "Esta notificação já foi respondida",
        });
      }

      // Atualizar a notificação como rejeitada
      await db
        .update(driverNotifications)
        .set({
          status: "rejected",
          respondedAt: new Date(),
        })
        .where(eq(driverNotifications.id, notification.id));

      console.log(`✅ Solicitação rejeitada pelo motorista`);

      return res.json({
        success: true,
        message: "Solicitação rejeitada",
      });
    } catch (error) {
      console.error("❌ Erro ao rejeitar solicitação:", error);
      return res.status(500).json({
        message: "Erro ao rejeitar solicitação",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  // POST /api/v1/driver/location - Atualizar localização do motorista
  app.post("/api/v1/driver/location", async (req, res) => {
    try {
      console.log("📍 Requisição de localização recebida");
      console.log("📍 Headers:", req.headers);
      console.log("📍 Body:", req.body);

      // Permitir autenticação via sessão OU Bearer token
      let driverId = req.session.driverId;
      console.log("📍 Session driverId:", driverId);

      if (!driverId) {
        const authHeader = req.headers.authorization;
        console.log("📍 Authorization header:", authHeader);

        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          console.log("📍 Token extraído:", token.substring(0, 50) + "...");

          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            console.log("📍 Token decodificado:", decoded);

            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
              console.log("📍 DriverId do token:", driverId);
            } else {
              console.log("📍 Token não contém type=driver ou id");
            }
          } catch (e) {
            console.error("📍 Erro ao decodificar token:", e);
          }
        } else {
          console.log("📍 Sem Bearer token no header");
        }
      }

      if (!driverId) {
        console.log("📍 ERRO: Não autenticado - retornando 401");
        return res.status(401).json({ message: "Não autenticado" });
      }

      console.log("📍 Motorista autenticado:", driverId);

      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          message: "Latitude e longitude são obrigatórias"
        });
      }

      await storage.updateDriverLocation(
        driverId,
        latitude.toString(),
        longitude.toString()
      );

      console.log(`📍 Localização atualizada para motorista ${driverId}: ${latitude}, ${longitude}`);

      return res.json({
        success: true,
        message: "Localização atualizada com sucesso"
      });
    } catch (error) {
      console.error("Erro ao atualizar localização:", error);
      return res.status(500).json({ message: "Erro ao atualizar localização" });
    }
  });

  // POST /api/v1/driver/update-fcm-token - Atualizar token FCM do motorista
  app.post("/api/v1/driver/update-fcm-token", async (req, res) => {
    try {
      // Permitir autenticação via sessão OU Bearer token
      let driverId = req.session.driverId;

      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Erro ao decodificar token:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { fcmToken } = req.body;

      if (!fcmToken) {
        return res.status(400).json({
          message: "Token FCM é obrigatório"
        });
      }

      // Atualizar token FCM no banco
      await db.update(drivers)
        .set({ fcmToken: fcmToken })
        .where(eq(drivers.id, driverId));

      console.log(`🔔 Token FCM atualizado para motorista ${driverId}`);

      return res.json({
        success: true,
        message: "Token FCM atualizado com sucesso"
      });
    } catch (error) {
      console.error("Erro ao atualizar token FCM:", error);
      return res.status(500).json({ message: "Erro ao atualizar token FCM" });
    }
  });

  // POST /api/v1/driver/online-offline - Toggle status online/offline
  app.post("/api/v1/driver/online-offline", async (req, res) => {
    try {
      // Permitir autenticação via sessão OU Bearer token
      let driverId = req.session.driverId;

      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { availability } = req.body;

      // Busca motorista
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Motorista não encontrado" });
      }

      // Verifica se está aprovado
      if (!driver.approve) {
        return res.status(403).json({
          message: "Você precisa ser aprovado pelo administrador antes de ficar online"
        });
      }

      // Verifica se tem documentos
      if (!driver.uploadedDocuments) {
        return res.status(403).json({
          message: "Você precisa enviar os documentos necessários antes de ficar online"
        });
      }

      // Atualiza disponibilidade
      const newAvailability = availability === 1 || availability === true;
      await storage.updateDriver(driverId, {
        available: newAvailability
      });

      // 🔴 Emitir evento Socket.IO para o painel em tempo real
      const { io } = await import('./index');
      io.emit('driver-status-changed', {
        driverId: driverId,
        driverName: driver.name,
        available: newAvailability,
        timestamp: new Date().toISOString(),
      });

      console.log(`📡 Evento emitido: driver-status-changed - ${driver.name} → ${newAvailability ? 'ONLINE' : 'OFFLINE'}`);

      return res.json({
        success: true,
        message: newAvailability ? "Você está online" : "Você está offline",
        data: {
          available: newAvailability
        }
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      return res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  // GET /api/v1/driver/status/:id - Consultar status de aprovação do motorista
  app.get("/api/v1/driver/status/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Buscar motorista
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, id))
        .limit(1);

      if (!driver) {
        return res.status(404).json({
          message: "Motorista não encontrado"
        });
      }

      // Buscar documentos enviados
      const uploadedDocs = await db
        .select({
          id: driverDocuments.id,
          documentTypeId: driverDocuments.documentTypeId,
          status: driverDocuments.status,
          createdAt: driverDocuments.createdAt,
        })
        .from(driverDocuments)
        .where(eq(driverDocuments.driverId, id));

      // Buscar tipos de documentos obrigatórios
      const requiredDocTypes = await db
        .select()
        .from(driverDocumentTypes)
        .where(and(
          eq(driverDocumentTypes.required, true),
          eq(driverDocumentTypes.active, true)
        ));

      // Calcular status de cada etapa
      const registrationDate = driver.createdAt ? new Date(driver.createdAt).toISOString() : new Date().toISOString();

      // Step 1: Cadastro (sempre completed após registro)
      const registrationStep = {
        step: "registration",
        title: "Cadastro Realizado",
        description: "Seus dados foram enviados com sucesso",
        status: "completed" as const,
        date: registrationDate
      };

      // Step 2: Envio de documentos (completed quando todos documentos obrigatórios foram enviados)
      const allRequiredDocsUploaded = requiredDocTypes.every(reqDocType =>
        uploadedDocs.some(upDoc => upDoc.documentTypeId === reqDocType.id)
      );

      const documentsUploadDate = allRequiredDocsUploaded && uploadedDocs.length > 0
        ? uploadedDocs[uploadedDocs.length - 1].createdAt
        : null;

      const dataReviewStep = {
        step: "data_review",
        title: "Envio de Documentos",
        description: allRequiredDocsUploaded
          ? "Todos os documentos foram enviados"
          : `Aguardando envio de ${requiredDocTypes.length - uploadedDocs.length} documento(s)`,
        status: allRequiredDocsUploaded ? "completed" as const : "in_progress" as const,
        date: documentsUploadDate
      };

      // Step 3: Análise de documentos (completed quando TODOS documentos obrigatórios estão aprovados)
      const allRequiredDocsApproved = requiredDocTypes.every(reqDocType => {
        const doc = uploadedDocs.find(upDoc => upDoc.documentTypeId === reqDocType.id);
        return doc && doc.status === "approved";
      });

      const hasRejectedDocs = uploadedDocs.some(doc => doc.status === "rejected");

      let documentReviewStatus: "pending" | "in_progress" | "completed" | "rejected" = "pending";
      let documentReviewDescription = "Aguardando envio dos documentos";

      if (!allRequiredDocsUploaded) {
        documentReviewStatus = "pending";
      } else if (hasRejectedDocs) {
        documentReviewStatus = "rejected";
        documentReviewDescription = "Alguns documentos foram rejeitados. Envie novamente.";
      } else if (allRequiredDocsApproved) {
        documentReviewStatus = "completed";
        documentReviewDescription = "Todos os documentos foram aprovados";
      } else {
        documentReviewStatus = "in_progress";
        documentReviewDescription = "Documentos em análise pela equipe";
      }

      const documentReviewStep = {
        step: "document_review",
        title: "Análise de Documentos",
        description: documentReviewDescription,
        status: documentReviewStatus,
        date: allRequiredDocsApproved ? new Date().toISOString() : null
      };

      // Step 4: Cadastro aprovado (completed quando approve = true)
      const approvalStep = {
        step: "approved",
        title: "Cadastro Aprovado",
        description: driver.approve
          ? "Seu cadastro foi aprovado! Você já pode fazer login."
          : "Aguardando aprovação final do administrador",
        status: driver.approve ? "completed" as const : "pending" as const,
        date: driver.approve ? new Date().toISOString() : null
      };

      // Determinar status geral
      let overallStatus: "pending_approval" | "under_review" | "approved" | "rejected" = "pending_approval";

      if (driver.approve) {
        overallStatus = "approved";
      } else if (hasRejectedDocs) {
        overallStatus = "rejected";
      } else if (allRequiredDocsUploaded) {
        overallStatus = "under_review";
      } else {
        overallStatus = "pending_approval";
      }

      return res.json({
        success: true,
        data: {
          driverId: driver.id,
          driverName: driver.name,
          status: overallStatus,
          canLogin: driver.approve,
          timeline: [
            registrationStep,
            dataReviewStep,
            documentReviewStep,
            approvalStep
          ],
          statistics: {
            totalDocuments: requiredDocTypes.length,
            uploadedDocuments: uploadedDocs.length,
            approvedDocuments: uploadedDocs.filter(d => d.status === "approved").length,
            rejectedDocuments: uploadedDocs.filter(d => d.status === "rejected").length,
            pendingDocuments: uploadedDocs.filter(d => d.status === "pending").length,
          }
        }
      });
    } catch (error) {
      console.error("Erro ao consultar status do motorista:", error);
      return res.status(500).json({
        message: "Erro ao consultar status"
      });
    }
  });

  // POST /api/v1/driver/logout - Logout do motorista
  app.post("/api/v1/driver/logout", async (req, res) => {
    try {
      if (!req.session.driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      // Marca motorista como offline antes de fazer logout
      await storage.updateDriver(req.session.driverId, {
        available: false
      });

      req.session.destroy((err) => {
        if (err) {
          console.error("Erro ao fazer logout:", err);
          return res.status(500).json({ message: "Erro ao fazer logout" });
        }
        return res.json({
          success: true,
          message: "Logout realizado com sucesso"
        });
      });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      return res.status(500).json({ message: "Erro ao fazer logout" });
    }
  });

  // ========================================
  // DRIVER DELIVERY MANAGEMENT ROUTES
  // ========================================

  // GET /api/v1/driver/deliveries/available - Listar entregas disponíveis para o motorista
  app.get("/api/v1/driver/deliveries/available", async (req, res) => {
    try {
      if (!req.session.driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      // Busca motorista para verificar aprovação
      const driver = await storage.getDriver(req.session.driverId);
      if (!driver || !driver.approve) {
        return res.status(403).json({
          message: "Você precisa estar aprovado para ver entregas"
        });
      }

      // Busca entregas pendentes (sem motorista atribuído)
      const deliveries = await pool.query(`
        SELECT
          r.id,
          r.request_number,
          r.customer_name,
          r.total_distance,
          r.total_time,
          r.needs_return,
          r.created_at,
          rp.pick_address,
          rp.drop_address,
          rp.pick_lat,
          rp.pick_lng,
          rp.drop_lat,
          rp.drop_lng,
          c.name as company_name,
          vt.name as vehicle_type_name,
          rb.total_amount,
          rb.admin_commision
        FROM requests r
        LEFT JOIN request_places rp ON r.id = rp.request_id
        LEFT JOIN request_bills rb ON r.id = rb.request_id
        LEFT JOIN companies c ON r.company_id = c.id
        LEFT JOIN vehicle_types vt ON r.zone_type_id = vt.id
        WHERE r.driver_id IS NULL
          AND r.is_cancelled = false
          AND r.is_completed = false
        ORDER BY r.created_at DESC
        LIMIT 50
      `);

      // Formatar dados para incluir valor total da entrega
      const formattedDeliveries = deliveries.rows.map(delivery => {
        const totalAmount = delivery.total_amount ? parseFloat(delivery.total_amount) : 0;
        const adminCommission = delivery.admin_commision ? parseFloat(delivery.admin_commision) : 0;
        const driverAmount = totalAmount - adminCommission;

        console.log(`[DEBUG] Delivery ${delivery.id}: total=${totalAmount}, commission=${adminCommission}, driver_will_receive=${driverAmount}`);

        return {
          ...delivery,
          request_eta_amount: totalAmount.toFixed(2) // Enviar valor total, não o valor após comissão
        };
      });

      return res.json({
        success: true,
        data: formattedDeliveries
      });
    } catch (error) {
      console.error("Erro ao listar entregas disponíveis:", error);
      return res.status(500).json({ message: "Erro ao listar entregas" });
    }
  });

  // POST /api/v1/driver/deliveries/:id/accept - Aceitar entrega
  app.post("/api/v1/driver/deliveries/:id/accept", async (req, res) => {
    try {
      if (!req.session.driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const deliveryId = req.params.id;

      // Busca entrega
      const request = await storage.getRequest(deliveryId);
      if (!request) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      // Verifica se já tem motorista
      if (request.driverId) {
        return res.status(400).json({ message: "Esta entrega já foi aceita por outro motorista" });
      }

      // Calcular previsão: tempo do Google Maps + 5 minutos de margem
      const googleMapsTime = request.totalTime ? parseFloat(request.totalTime) : 0;
      const estimatedTimeWithMargin = googleMapsTime + 5;

      // Atualiza entrega com motorista e status
      await storage.updateRequest(deliveryId, {
        driverId: req.session.driverId,
        isDriverStarted: true,
        acceptedAt: new Date(),
        estimatedTime: estimatedTimeWithMargin.toString(), // Google Maps + 5 min
      });

      // Busca dados do motorista
      const driver = await storage.getDriver(req.session.driverId);

      // Emitir evento via Socket.IO para a empresa
      const io = (app as any).io;
      if (request.companyId) {
        io.to(`company-${request.companyId}`).emit("delivery-accepted", {
          deliveryId,
          requestNumber: request.requestNumber,
          driverId: req.session.driverId,
          driverName: driver?.name,
          driverMobile: driver?.mobile,
          status: "Aceita pelo motorista",
          timestamp: new Date().toISOString()
        });
      }

      // Emitir evento para TODOS os motoristas removerem a entrega da lista deles
      io.emit("delivery-taken", {
        deliveryId,
        takenBy: req.session.driverId,
        timestamp: new Date().toISOString()
      });

      return res.json({
        success: true,
        message: "Entrega aceita com sucesso",
        data: {
          deliveryId,
          status: "accepted"
        }
      });
    } catch (error) {
      console.error("Erro ao aceitar entrega:", error);
      return res.status(500).json({ message: "Erro ao aceitar entrega" });
    }
  });

  // POST /api/v1/driver/deliveries/:id/reject - Rejeitar entrega
  app.post("/api/v1/driver/deliveries/:id/reject", async (req, res) => {
    try {
      if (!req.session.driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const deliveryId = req.params.id;
      const { reason } = req.body;

      const request = await storage.getRequest(deliveryId);
      if (!request) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      // Aqui você pode registrar a rejeição em uma tabela de log se quiser
      // Para não oferecer a mesma entrega novamente para este motorista

      return res.json({
        success: true,
        message: "Entrega rejeitada"
      });
    } catch (error) {
      console.error("Erro ao rejeitar entrega:", error);
      return res.status(500).json({ message: "Erro ao rejeitar entrega" });
    }
  });

  // GET /api/v1/driver/deliveries/:id/stops - Listar stops da entrega
  app.get("/api/v1/driver/deliveries/:id/stops", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const deliveryId = req.params.id;

      // Verificar se a entrega pertence ao motorista
      const request = await storage.getRequest(deliveryId);
      if (!request) {
        return res.status(404).json({ message: "Entrega não encontrada" });
      }

      if (request.driverId !== driverId) {
        return res.status(403).json({ message: "Esta entrega não pertence a você" });
      }

      // Buscar stops da entrega com TODOS os campos
      const stopsResult = await pool.query(
        `SELECT
          id,
          request_id,
          stop_order,
          stop_type,
          customer_name,
          customer_whatsapp,
          delivery_reference,
          address,
          lat,
          lng,
          status,
          to_char(completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS completed_at,
          to_char(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS created_at,
          to_char(updated_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS"-03:00"') AS updated_at
        FROM delivery_stops
        WHERE request_id = $1
        ORDER BY stop_order ASC`,
        [deliveryId]
      );

      const stops = stopsResult.rows;
      const completedStops = stops.filter((s: any) => s.status === 'completed');
      const nextStop = stops.find((s: any) => s.status === 'pending' || s.status === 'arrived');

      console.log(`📍 Stops da entrega ${deliveryId}:
  - Total: ${stops.length}
  - Completos: ${completedStops.length}
  - Próximo: ${nextStop ? `Stop ${nextStop.stop_order}` : 'Nenhum'}`);

      return res.json({
        success: true,
        data: {
          hasMultipleStops: stops.length > 0,
          totalStops: stops.length,
          completedStops: completedStops.length,
          remainingStops: stops.length - completedStops.length,
          stops: stops,
          nextStop: nextStop || null
        }
      });
    } catch (error) {
      console.error("Erro ao buscar stops:", error);
      return res.status(500).json({ message: "Erro ao buscar stops da entrega" });
    }
  });

  // POST /api/v1/driver/deliveries/:id/arrived-pickup - Motorista chegou para retirada
  app.post("/api/v1/driver/deliveries/:id/arrived-pickup", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        console.error("❌ Tentativa de atualizar status sem autenticação");
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      const deliveryId = req.params.id;

      // Validar que o ID foi fornecido
      if (!deliveryId || deliveryId.trim() === '') {
        console.error("❌ ID da entrega não fornecido");
        return res.status(400).json({
          success: false,
          message: "ID da entrega não fornecido"
        });
      }

      console.log(`📍 Motorista ${driverId} chegou no local de retirada da entrega ${deliveryId}`);

      const request = await storage.getRequest(deliveryId);
      if (!request) {
        console.error(`❌ Entrega ${deliveryId} não encontrada`);
        return res.status(404).json({
          success: false,
          message: "Entrega não encontrada"
        });
      }

      if (request.driverId !== driverId) {
        console.error(`❌ Entrega ${deliveryId} não pertence ao motorista ${driverId}`);
        return res.status(403).json({
          success: false,
          message: "Esta entrega não pertence a você"
        });
      }

      // Verificar se tem múltiplos stops
      const stopsResult = await pool.query(
        `SELECT COUNT(*) as count FROM delivery_stops WHERE request_id = $1`,
        [deliveryId]
      );
      const hasMultipleStops = parseInt(stopsResult.rows[0].count) > 0;
      console.log(`📦 Entrega tem múltiplos stops? ${hasMultipleStops ? 'SIM' : 'NÃO'} (${stopsResult.rows[0].count} stops)`);

      const updateResult = await storage.updateRequest(deliveryId, {
        isDriverArrived: true,
        arrivedAt: new Date(),
      });

      console.log(`✅ Status atualizado: motorista chegou para retirada. Update result:`, updateResult ? 'SUCCESS' : 'FAILED');

      // Emitir evento via Socket.IO
      const io = (app as any).io;
      if (request.companyId) {
        io.to(`company-${request.companyId}`).emit("delivery-status-updated", {
          deliveryId,
          requestNumber: request.requestNumber,
          status: "Motorista chegou para retirada",
          timestamp: new Date().toISOString()
        });
      }

      return res.json({
        success: true,
        message: "Status atualizado",
        data: { status: "Chegou no local" }
      });
    } catch (error) {
      console.error("❌ Erro ao atualizar status (arrived-pickup):", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar status"
      });
    }
  });

  // POST /api/v1/driver/deliveries/:id/picked-up - Motorista retirou o pedido
  app.post("/api/v1/driver/deliveries/:id/picked-up", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        console.error("❌ Tentativa de atualizar status sem autenticação");
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      const deliveryId = req.params.id;

      // Validar que o ID foi fornecido
      if (!deliveryId || deliveryId.trim() === '') {
        console.error("❌ ID da entrega não fornecido");
        return res.status(400).json({
          success: false,
          message: "ID da entrega não fornecido"
        });
      }

      console.log(`📦 Motorista ${driverId} retirou o pedido da entrega ${deliveryId}`);

      const request = await storage.getRequest(deliveryId);
      if (!request) {
        console.error(`❌ Entrega ${deliveryId} não encontrada`);
        return res.status(404).json({
          success: false,
          message: "Entrega não encontrada"
        });
      }

      if (request.driverId !== driverId) {
        console.error(`❌ Entrega ${deliveryId} não pertence ao motorista ${driverId}`);
        return res.status(403).json({
          success: false,
          message: "Esta entrega não pertence a você"
        });
      }

      // Verificar se tem múltiplos stops
      const stopsResult = await pool.query(
        `SELECT COUNT(*) as count FROM delivery_stops WHERE request_id = $1`,
        [deliveryId]
      );
      const hasMultipleStops = parseInt(stopsResult.rows[0].count) > 0;
      console.log(`📦 Entrega tem múltiplos stops? ${hasMultipleStops ? 'SIM' : 'NÃO'} (${stopsResult.rows[0].count} stops)`);

      const updateResult = await storage.updateRequest(deliveryId, {
        isTripStart: true,
        tripStartedAt: new Date(),
      });

      console.log(`✅ Status atualizado: pedido retirado. Update result:`, updateResult ? 'SUCCESS' : 'FAILED');

      // Emitir evento via Socket.IO
      const io = (app as any).io;
      if (request.companyId) {
        io.to(`company-${request.companyId}`).emit("delivery-status-updated", {
          deliveryId,
          requestNumber: request.requestNumber,
          status: "Pedido retirado - Indo para entrega",
          timestamp: new Date().toISOString()
        });
      }

      return res.json({
        success: true,
        message: "Status atualizado",
        data: { status: "Retirado" }
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      return res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  // POST /api/v1/driver/deliveries/:id/delivered - Pedido entregue
  app.post("/api/v1/driver/deliveries/:id/delivered", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        console.error("❌ Tentativa de atualizar status sem autenticação");
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      const deliveryId = req.params.id;

      // Validar que o ID foi fornecido
      if (!deliveryId || deliveryId.trim() === '') {
        console.error("❌ ID da entrega não fornecido");
        return res.status(400).json({
          success: false,
          message: "ID da entrega não fornecido"
        });
      }

      console.log(`✅ Motorista ${driverId} entregou o pedido da entrega ${deliveryId}`);

      const request = await storage.getRequest(deliveryId);
      if (!request) {
        console.error(`❌ Entrega ${deliveryId} não encontrada`);
        return res.status(404).json({
          success: false,
          message: "Entrega não encontrada"
        });
      }

      if (request.driverId !== driverId) {
        console.error(`❌ Entrega ${deliveryId} não pertence ao motorista ${driverId}`);
        return res.status(403).json({
          success: false,
          message: "Esta entrega não pertence a você"
        });
      }

      // Verificar se existem múltiplos stops para esta entrega
      const stopsResult = await pool.query(
        `SELECT * FROM delivery_stops
         WHERE request_id = $1
         ORDER BY stop_order ASC`,
        [deliveryId]
      );

      // Se tem múltiplos stops, usar lógica de stops
      if (stopsResult.rows.length > 0) {
        console.log(`📍 Entrega com ${stopsResult.rows.length} stops encontrados`);

        // Encontrar o próximo stop pendente ou em progresso
        const currentStop = stopsResult.rows.find(
          (stop: any) => stop.status === 'pending' || stop.status === 'arrived'
        );

        if (!currentStop) {
          console.log(`⚠️ Nenhum stop pendente encontrado, todos já foram completados`);
          return res.status(400).json({
            success: false,
            message: "Todos os stops já foram completados"
          });
        }

        // Marcar o stop atual como completo
        await pool.query(
          `UPDATE delivery_stops
           SET status = 'completed', completed_at = NOW()
           WHERE id = $1`,
          [currentStop.id]
        );

        console.log(`✅ Stop ${currentStop.stop_order} marcado como completo`);

        // Verificar se ainda há stops pendentes
        const remainingStops = stopsResult.rows.filter(
          (stop: any) => stop.status === 'pending' ||
                        (stop.id !== currentStop.id && stop.status !== 'completed')
        );

        const allStopsCompleted = remainingStops.length === 0;

        if (allStopsCompleted) {
          console.log(`✅ Todos os stops completos! Finalizando entrega...`);

          // Verificar se precisa retornar ao ponto de origem
          if (request.needsReturn) {
            // Se precisa retornar, apenas marca como entregue mas não finaliza
            await storage.updateRequest(deliveryId, {
              deliveredAt: new Date(),
            });

            console.log(`✅ Todos os stops entregues, aguardando retorno`);

            // Emitir evento via Socket.IO
            const io = (app as any).io;
            if (request.companyId) {
              io.to(`company-${request.companyId}`).emit("delivery-status-updated", {
                deliveryId,
                requestNumber: request.requestNumber,
                status: "delivered_awaiting_return",
                statusLabel: "Entregue, aguardando retorno",
                timestamp: new Date().toISOString()
              });
            }

            return res.json({
              success: true,
              message: "Todas as entregas concluídas! Retorne ao ponto de origem para finalizar.",
              data: {
                status: "delivered_awaiting_return",
                allStopsCompleted: true,
                needsReturn: true
              }
            });
          } else {
            // Se não precisa retornar, finaliza a entrega
            await storage.updateRequest(deliveryId, {
              deliveredAt: new Date(),
              isCompleted: true,
              completedAt: new Date(),
            });

            // Incrementar contador mensal de entregas do motorista
            await storage.incrementDriverMonthlyDeliveries(driverId);

            // Incrementar total de entregas do motorista e verificar comissões de indicação
            const [driver] = await db
              .select()
              .from(drivers)
              .where(eq(drivers.id, driverId))
              .limit(1);

            if (driver) {
              const newTotalDeliveries = (driver.totalDeliveries || 0) + 1;

              // Atualizar total de entregas
              await db
                .update(drivers)
                .set({
                  totalDeliveries: newTotalDeliveries,
                  updatedAt: new Date()
                })
                .where(eq(drivers.id, driverId));

              // Verificar e processar comissão de indicação se aplicável
              const { checkAndProcessReferralCommission } = await import("./utils/referralUtils");
              const commissionResult = await checkAndProcessReferralCommission(driverId, newTotalDeliveries);

              // Atualizar tabela de indicações SEMPRE (não apenas quando qualificado)
              const { driverReferrals } = await import("@shared/schema");

              // Verificar se existe uma indicação para este motorista
              const [referral] = await db
                .select()
                .from(driverReferrals)
                .where(eq(driverReferrals.referredDriverId, driverId))
                .limit(1);

              if (referral) {
                if (commissionResult.processed) {
                  console.log(`🎉 Comissão de indicação qualificada para o motorista ${commissionResult.referrerId}`);

                  // Atualizar com comissão qualificada
                  await db
                    .update(driverReferrals)
                    .set({
                      deliveriesCompleted: newTotalDeliveries,
                      commissionEarned: commissionResult.commission,
                      updatedAt: new Date()
                    })
                    .where(eq(driverReferrals.referredDriverId, driverId));
                } else {
                  // Atualizar apenas o contador de entregas (sem qualificar comissão)
                  await db
                    .update(driverReferrals)
                    .set({
                      deliveriesCompleted: newTotalDeliveries,
                      updatedAt: new Date()
                    })
                    .where(eq(driverReferrals.referredDriverId, driverId));

                  console.log(`📊 Contador de entregas atualizado para indicado ${driverId}: ${newTotalDeliveries}`);
                }
              }
            }

            // Marcar motorista como disponível
            await db
              .update(drivers)
              .set({ onDelivery: false })
              .where(eq(drivers.id, driverId));

            console.log(`✅ Entrega finalizada completamente`);

            // Emitir evento via Socket.IO
            const io = (app as any).io;
            if (request.companyId) {
              io.to(`company-${request.companyId}`).emit("delivery-status-updated", {
                deliveryId,
                requestNumber: request.requestNumber,
                status: "completed",
                statusLabel: "Concluída",
                timestamp: new Date().toISOString()
              });
            }

            return res.json({
              success: true,
              message: "Entrega finalizada com sucesso",
              data: {
                status: "completed",
                allStopsCompleted: true,
                needsReturn: false
              }
            });
          }
        } else {
          // Ainda há stops pendentes, retornar informação do próximo
          const nextStop = remainingStops[0];

          console.log(`📍 Próximo stop: ${nextStop.stop_order} - ${nextStop.address}`);

          // Emitir evento via Socket.IO
          const io = (app as any).io;
          if (request.companyId) {
            io.to(`company-${request.companyId}`).emit("delivery-stop-completed", {
              deliveryId,
              requestNumber: request.requestNumber,
              stopOrder: currentStop.stop_order,
              completedStops: stopsResult.rows.length - remainingStops.length,
              totalStops: stopsResult.rows.length,
              timestamp: new Date().toISOString()
            });
          }

          return res.json({
            success: true,
            message: `Ponto ${currentStop.stop_order} entregue! Siga para o próximo ponto.`,
            data: {
              status: "in_progress",
              completedStop: {
                order: currentStop.stop_order,
                address: currentStop.address
              },
              nextStop: {
                id: nextStop.id,
                order: nextStop.stop_order,
                customerName: nextStop.customer_name,
                address: nextStop.address,
                lat: nextStop.lat,
                lng: nextStop.lng,
                notes: nextStop.notes
              },
              progress: {
                completed: stopsResult.rows.length - remainingStops.length,
                total: stopsResult.rows.length
              },
              allStopsCompleted: false
            }
          });
        }
      }

      // Lógica antiga para entregas sem múltiplos stops (compatibilidade)
      // Verificar se precisa retornar ao ponto de origem
      if (request.needsReturn) {
        // Se precisa retornar, apenas marca como entregue mas não finaliza
        await storage.updateRequest(deliveryId, {
          deliveredAt: new Date(),
        });

        console.log(`✅ Status atualizado: pedido entregue, aguardando retorno`);

        // Emitir evento via Socket.IO
        const io = (app as any).io;
        if (request.companyId) {
          io.to(`company-${request.companyId}`).emit("delivery-status-updated", {
            deliveryId,
            requestNumber: request.requestNumber,
            status: "delivered_awaiting_return",
            statusLabel: "Entregue, aguardando retorno",
            timestamp: new Date().toISOString()
          });
        }

        return res.json({
          success: true,
          message: "Produto entregue. Retorne ao ponto de origem para finalizar.",
          data: {
            status: "delivered_awaiting_return",
            needsReturn: true
          }
        });
      } else {
        // Se não precisa retornar, finaliza a entrega normalmente
        await storage.updateRequest(deliveryId, {
          deliveredAt: new Date(),
          isCompleted: true,
          completedAt: new Date(),
        });

        // Incrementar contador mensal de entregas do motorista
        await storage.incrementDriverMonthlyDeliveries(driverId);

        // Incrementar total de entregas do motorista e verificar comissões de indicação
        const [driver] = await db
          .select()
          .from(drivers)
          .where(eq(drivers.id, driverId))
          .limit(1);

        if (driver) {
          const newTotalDeliveries = (driver.totalDeliveries || 0) + 1;

          // Atualizar total de entregas
          await db
            .update(drivers)
            .set({
              totalDeliveries: newTotalDeliveries,
              updatedAt: new Date()
            })
            .where(eq(drivers.id, driverId));

          // Atualizar progresso de indicações ativas
          const { updateDriverReferralProgress } = await import("./utils/referralUtils");
          const referralResult = await updateDriverReferralProgress(driverId, newTotalDeliveries);

          if (referralResult.updated && referralResult.qualifiedCount && referralResult.qualifiedCount > 0) {
            console.log(`🎉 ${referralResult.qualifiedCount} indicação(ões) qualificada(s) (aguardando pagamento) para o motorista ${driverId}`);
          } else if (referralResult.updated) {
            console.log(`📊 Progresso de indicação atualizado para indicado ${driverId}: ${newTotalDeliveries} entregas`);
          }

          // Manter compatibilidade com sistema antigo de comissões
          const { checkAndProcessReferralCommission } = await import("./utils/referralUtils");
          await checkAndProcessReferralCommission(driverId, newTotalDeliveries);
        }

        // Marcar motorista como disponível (não mais em entrega)
        await db
          .update(drivers)
          .set({ onDelivery: false })
          .where(eq(drivers.id, driverId));

        console.log(`✅ Status atualizado: pedido entregue e finalizado`);

        // Emitir evento via Socket.IO
        const io = (app as any).io;
        if (request.companyId) {
          io.to(`company-${request.companyId}`).emit("delivery-status-updated", {
            deliveryId,
            requestNumber: request.requestNumber,
            status: "completed",
            statusLabel: "Concluída",
            timestamp: new Date().toISOString()
          });
        }

        return res.json({
          success: true,
          message: "Entrega finalizada com sucesso",
          data: {
            status: "completed",
            needsReturn: false
          }
        });
      }
    } catch (error) {
      console.error("❌ Erro ao atualizar status (delivered):", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar status"
      });
    }
  });

  // POST /api/v1/driver/deliveries/:id/start-return - Iniciar retorno ao ponto de origem
  app.post("/api/v1/driver/deliveries/:id/start-return", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        console.error("❌ Tentativa de atualizar status sem autenticação");
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      const deliveryId = req.params.id;

      if (!deliveryId || deliveryId.trim() === '') {
        console.error("❌ ID da entrega não fornecido");
        return res.status(400).json({
          success: false,
          message: "ID da entrega não fornecido"
        });
      }

      console.log(`🔄 Motorista ${driverId} iniciou retorno para entrega ${deliveryId}`);

      const request = await storage.getRequest(deliveryId);
      if (!request) {
        console.error(`❌ Entrega ${deliveryId} não encontrada`);
        return res.status(404).json({
          success: false,
          message: "Entrega não encontrada"
        });
      }

      if (request.driverId !== driverId) {
        console.error(`❌ Entrega ${deliveryId} não pertence ao motorista ${driverId}`);
        return res.status(403).json({
          success: false,
          message: "Esta entrega não pertence a você"
        });
      }

      if (!request.needsReturn) {
        return res.status(400).json({
          success: false,
          message: "Esta entrega não requer retorno"
        });
      }

      if (!request.deliveredAt) {
        return res.status(400).json({
          success: false,
          message: "Você precisa entregar o produto primeiro"
        });
      }

      await storage.updateRequest(deliveryId, {
        returningAt: new Date(),
      });

      console.log(`✅ Status atualizado: voltando ao ponto de origem`);

      // Emitir evento via Socket.IO
      const io = (app as any).io;
      if (request.companyId) {
        io.to(`company-${request.companyId}`).emit("delivery-status-updated", {
          deliveryId,
          requestNumber: request.requestNumber,
          status: "returning",
          statusLabel: "Retornando ao ponto de origem",
          timestamp: new Date().toISOString()
        });
      }

      return res.json({
        success: true,
        message: "Retorno iniciado",
        data: { status: "returning" }
      });
    } catch (error) {
      console.error("❌ Erro ao atualizar status (start-return):", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar status"
      });
    }
  });

  // POST /api/v1/driver/deliveries/:id/complete-return - Marcar chegada no ponto de origem
  app.post("/api/v1/driver/deliveries/:id/complete-return", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        console.error("❌ Tentativa de atualizar status sem autenticação");
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      const deliveryId = req.params.id;

      if (!deliveryId || deliveryId.trim() === '') {
        console.error("❌ ID da entrega não fornecido");
        return res.status(400).json({
          success: false,
          message: "ID da entrega não fornecido"
        });
      }

      console.log(`✅ Motorista ${driverId} chegou de volta ao ponto de origem - entrega ${deliveryId}`);

      const request = await storage.getRequest(deliveryId);
      if (!request) {
        console.error(`❌ Entrega ${deliveryId} não encontrada`);
        return res.status(404).json({
          success: false,
          message: "Entrega não encontrada"
        });
      }

      if (request.driverId !== driverId) {
        console.error(`❌ Entrega ${deliveryId} não pertence ao motorista ${driverId}`);
        return res.status(403).json({
          success: false,
          message: "Esta entrega não pertence a você"
        });
      }

      if (!request.needsReturn) {
        return res.status(400).json({
          success: false,
          message: "Esta entrega não requer retorno"
        });
      }

      if (!request.returningAt) {
        return res.status(400).json({
          success: false,
          message: "Você precisa iniciar o retorno primeiro"
        });
      }

      // Verificar se já foi completada (previne dupla contagem)
      const wasAlreadyCompleted = request.isCompleted;

      // Marcar como retornado e completado
      await storage.updateRequest(deliveryId, {
        returnedAt: new Date(),
        isCompleted: true,
        completedAt: new Date(),
      });

      // Incrementar contador APENAS se não estava completada antes
      if (!wasAlreadyCompleted) {
        await storage.incrementDriverMonthlyDeliveries(driverId);
        console.log(`✅ Contador mensal incrementado para motorista ${driverId}`);
      } else {
        console.log(`⚠️ Entrega já estava completa, contador não incrementado`);
      }

      // Marcar motorista como disponível (não mais em entrega)
      await db
        .update(drivers)
        .set({ onDelivery: false })
        .where(eq(drivers.id, driverId));

      console.log(`✅ Status atualizado: retornou ao ponto de origem e entrega finalizada`);

      // Emitir evento via Socket.IO
      const io = (app as any).io;
      if (request.companyId) {
        io.to(`company-${request.companyId}`).emit("delivery-status-updated", {
          deliveryId,
          requestNumber: request.requestNumber,
          status: "completed",
          statusLabel: "Concluída",
          timestamp: new Date().toISOString()
        });
      }

      return res.json({
        success: true,
        message: "Entrega finalizada com sucesso",
        data: { status: "completed" }
      });
    } catch (error) {
      console.error("❌ Erro ao atualizar status (complete-return):", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar status"
      });
    }
  });

  // POST /api/v1/driver/deliveries/:id/complete - Finalizar entrega
  app.post("/api/v1/driver/deliveries/:id/complete", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        console.error("❌ Tentativa de finalizar entrega sem autenticação");
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      const deliveryId = req.params.id;

      // Validar que o ID foi fornecido
      if (!deliveryId || deliveryId.trim() === '') {
        console.error("❌ ID da entrega não fornecido");
        return res.status(400).json({
          success: false,
          message: "ID da entrega não fornecido"
        });
      }

      console.log(`🏁 Motorista ${driverId} finalizou a entrega ${deliveryId}`);

      const request = await storage.getRequest(deliveryId);
      if (!request) {
        console.error(`❌ Entrega ${deliveryId} não encontrada`);
        return res.status(404).json({
          success: false,
          message: "Entrega não encontrada"
        });
      }

      if (request.driverId !== driverId) {
        console.error(`❌ Entrega ${deliveryId} não pertence ao motorista ${driverId}`);
        return res.status(403).json({
          success: false,
          message: "Esta entrega não pertence a você"
        });
      }

      // Verificar se já foi completada (previne dupla contagem)
      const wasAlreadyCompleted = request.isCompleted;

      await storage.updateRequest(deliveryId, {
        isCompleted: true,
        completedAt: new Date(),
      });

      // Incrementar contador APENAS se não estava completada antes
      if (!wasAlreadyCompleted) {
        await storage.incrementDriverMonthlyDeliveries(driverId);
        console.log(`✅ Contador mensal incrementado para motorista ${driverId}`);

        // Incrementar total de entregas do motorista e verificar comissões de indicação
        const [driver] = await db
          .select()
          .from(drivers)
          .where(eq(drivers.id, driverId))
          .limit(1);

        if (driver) {
          const newTotalDeliveries = (driver.totalDeliveries || 0) + 1;

          // Atualizar total de entregas
          await db
            .update(drivers)
            .set({
              totalDeliveries: newTotalDeliveries,
              updatedAt: new Date()
            })
            .where(eq(drivers.id, driverId));

          // Atualizar progresso de indicações ativas
          const { updateDriverReferralProgress } = await import("./utils/referralUtils");
          const referralResult = await updateDriverReferralProgress(driverId, newTotalDeliveries);

          if (referralResult.updated && referralResult.qualifiedCount && referralResult.qualifiedCount > 0) {
            console.log(`🎉 ${referralResult.qualifiedCount} indicação(ões) qualificada(s) (aguardando pagamento) para o motorista ${driverId}`);
          } else if (referralResult.updated) {
            console.log(`📊 Progresso de indicação atualizado para indicado ${driverId}: ${newTotalDeliveries} entregas`);
          }

          // Manter compatibilidade com sistema antigo de comissões
          const { checkAndProcessReferralCommission } = await import("./utils/referralUtils");
          await checkAndProcessReferralCommission(driverId, newTotalDeliveries);
        }
      } else {
        console.log(`⚠️ Entrega já estava completa, contador não incrementado`);
      }

      // Atualizar status do motorista para disponível novamente (marcador verde no mapa)
      await db
        .update(drivers)
        .set({ onDelivery: false })
        .where(eq(drivers.id, driverId));

      // Emitir evento via Socket.IO
      const io = (app as any).io;
      if (request.companyId) {
        io.to(`company-${request.companyId}`).emit("delivery-status-updated", {
          deliveryId,
          requestNumber: request.requestNumber,
          status: "Entrega concluída",
          timestamp: new Date().toISOString()
        });
      }

      return res.json({
        success: true,
        message: "Entrega finalizada com sucesso",
        data: { status: "Concluída" }
      });
    } catch (error) {
      console.error("Erro ao finalizar entrega:", error);
      return res.status(500).json({ message: "Erro ao finalizar entrega" });
    }
  });

  // POST /api/v1/driver/deliveries/:id/rate - Motorista avaliar empresa
  app.post("/api/v1/driver/deliveries/:id/rate", async (req, res) => {
    try {
      let driverId = req.session.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({
          success: false,
          message: "Não autenticado"
        });
      }

      const deliveryId = req.params.id;
      const { rating } = req.body;

      // Validar dados
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Avaliação deve ser entre 1 e 5 estrelas"
        });
      }

      // Verificar se a entrega existe e pertence ao motorista
      const [request] = await db
        .select()
        .from(requests)
        .where(
          and(
            eq(requests.id, deliveryId),
            eq(requests.driverId, driverId)
          )
        )
        .limit(1);

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Entrega não encontrada"
        });
      }

      if (!request.isCompleted) {
        return res.status(400).json({
          success: false,
          message: "Apenas entregas concluídas podem ser avaliadas"
        });
      }

      if (!request.companyId) {
        return res.status(400).json({
          success: false,
          message: "Esta entrega não possui empresa"
        });
      }

      if (request.driverRated) {
        return res.status(400).json({
          success: false,
          message: "Você já avaliou esta entrega"
        });
      }

      // Criar avaliação
      const [newRating] = await db
        .insert(driverCompanyRatings)
        .values({
          requestId: deliveryId,
          driverId: driverId,
          companyId: request.companyId,
          rating,
        })
        .returning();

      // Marcar entrega como avaliada pelo motorista
      await db
        .update(requests)
        .set({ driverRated: true })
        .where(eq(requests.id, deliveryId));

      // Atualizar avaliação média da empresa
      const ratingsResult = await db
        .select({
          avgRating: sql<number>`AVG(${driverCompanyRatings.rating})`,
          totalRatings: sql<number>`COUNT(*)`,
          sumRating: sql<number>`SUM(${driverCompanyRatings.rating})`,
        })
        .from(driverCompanyRatings)
        .where(eq(driverCompanyRatings.companyId, request.companyId));

      const { avgRating, totalRatings, sumRating } = ratingsResult[0];

      await db
        .update(companies)
        .set({
          rating: avgRating ? Number(avgRating).toFixed(2) : "0",
          ratingTotal: sumRating ? Number(sumRating).toString() : "0",
          noOfRatings: totalRatings || 0,
        })
        .where(eq(companies.id, request.companyId));

      return res.json({
        success: true,
        message: "Avaliação registrada com sucesso",
        data: { rating: newRating },
      });
    } catch (error) {
      console.error("Erro ao avaliar empresa:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao registrar avaliação"
      });
    }
  });

  // GET /api/v1/driver/deliveries/current - Obter entrega atual do motorista
  app.get("/api/v1/driver/deliveries/current", async (req, res) => {
    try {
      // Permitir autenticação via sessão OU Bearer token
      let driverId = req.session.driverId;

      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Erro ao decodificar token:", e);
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      // ✅ CORRIGIDO: Remover LIMIT 1 para retornar TODAS as entregas ativas
      const result = await pool.query(`
        SELECT
          r.id,
          r.request_number,
          r.customer_name,
          r.customer_whatsapp,
          r.delivery_reference,
          r.is_driver_started,
          r.is_driver_arrived,
          r.is_trip_start,
          r.is_completed,
          r.needs_return,
          r.delivered_at,
          r.returning_at,
          r.returned_at,
          r.total_distance,
          r.total_time,
          r.estimated_time,
          r.created_at,
          r.accepted_at,
          rp.pick_address,
          rp.drop_address,
          rp.pick_lat,
          rp.pick_lng,
          rp.drop_lat,
          rp.drop_lng,
          c.name as company_name,
          c.phone as company_phone,
          vt.name as vehicle_type_name,
          rb.total_amount,
          rb.admin_commision
        FROM requests r
        LEFT JOIN request_places rp ON r.id = rp.request_id
        LEFT JOIN companies c ON r.company_id = c.id
        LEFT JOIN vehicle_types vt ON r.zone_type_id = vt.id
        LEFT JOIN request_bills rb ON r.id = rb.request_id
        WHERE r.driver_id = $1
          AND r.is_completed = false
          AND r.is_cancelled = false
        ORDER BY r.accepted_at ASC
      `, [driverId]);

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: "Nenhuma entrega em andamento"
        });
      }

      console.log(`📱 ${result.rows.length} entrega(s) ativa(s) encontrada(s) para o motorista ${driverId}`);

      // Formatar cada entrega
      const formattedDeliveries = result.rows.map(delivery => {
        console.log(`📦 Entrega ${delivery.request_number}:
  - total_distance (banco): ${delivery.total_distance} metros
  - total_time (banco): ${delivery.total_time} min
  - estimated_time (banco): ${delivery.estimated_time} min
  - is_trip_start: ${delivery.is_trip_start}`);

        return {
          ...delivery,
          // Converter distância de metros para km e arredondar
          total_distance: delivery.total_distance ? (parseFloat(delivery.total_distance) / 1000).toFixed(2) : "0",
          // Tempo estimado: usar estimated_time se existir, senão calcular total_time + 5
          estimated_time: delivery.estimated_time
            ? delivery.estimated_time
            : (delivery.total_time ? (parseInt(delivery.total_time) + 5).toString() : "5"),
          // Tempo original do Google Maps
          total_time: delivery.total_time || "0",
          // Valores financeiros
          total_amount: delivery.total_amount ? parseFloat(delivery.total_amount).toFixed(2) : "0",
          admin_commision: delivery.admin_commision ? parseFloat(delivery.admin_commision).toFixed(2) : "0",
          driver_amount: delivery.total_amount && delivery.admin_commision
            ? (parseFloat(delivery.total_amount) - parseFloat(delivery.admin_commision)).toFixed(2)
            : "0",
          estimated_amount: delivery.total_amount && delivery.admin_commision
            ? (parseFloat(delivery.total_amount) - parseFloat(delivery.admin_commision)).toFixed(2)
            : "0" // VALOR DO MOTORISTA - app lê este campo
        };
      });

      return res.json({
        success: true,
        data: formattedDeliveries,
        count: formattedDeliveries.length
      });
    } catch (error) {
      console.error("Erro ao buscar entrega atual:", error);
      return res.status(500).json({ message: "Erro ao buscar entrega atual" });
    }
  });

  // ===========================================
  // GET /api/v1/driver/notifications - Listar notificações do motorista
  // ===========================================
  app.get("/api/v1/driver/notifications", async (req, res) => {
    console.log("📬 Buscando notificações do motorista...");
    try {
      let driverId = req.session?.driverId;

      // Se não tiver sessão, tenta obter do token Bearer
      if (!driverId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          try {
            const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
            if (decoded.type === 'driver' && decoded.id) {
              driverId = decoded.id;
            }
          } catch (e) {
            console.error("Token inválido:", e);
            return res.status(401).json({
              success: false,
              message: "Token inválido"
            });
          }
        }
      }

      if (!driverId) {
        return res.status(401).json({
          success: false,
          message: "Token não fornecido"
        });
      }

      // Buscar o driver pelo ID
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, driverId))
        .limit(1);

      if (!driver) {
        return res.status(401).json({
          success: false,
          message: "Motorista não encontrado"
        });
      }

      // Buscar notificações enviadas para este motorista ou para a cidade dele
      const notifications = await db
        .select({
          id: pushNotifications.id,
          title: pushNotifications.title,
          body: pushNotifications.body,
          data: pushNotifications.data,
          targetType: pushNotifications.targetType,
          status: pushNotifications.status,
          createdAt: pushNotifications.createdAt,
          sentAt: pushNotifications.sentAt
        })
        .from(pushNotifications)
        .where(
          and(
            eq(pushNotifications.status, 'sent'),
            or(
              // Notificações específicas para este motorista
              and(
                eq(pushNotifications.targetType, 'driver'),
                eq(pushNotifications.targetId, driver.id)
              ),
              // Notificações para a cidade do motorista
              and(
                eq(pushNotifications.targetType, 'city'),
                eq(pushNotifications.targetCityId, driver.serviceLocationId)
              )
            )
          )
        )
        .orderBy(sql`${pushNotifications.createdAt} DESC`)
        .limit(50); // Limitar a 50 notificações mais recentes

      // Formatar as notificações para o app
      const formattedNotifications = notifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        data: notification.data ? JSON.parse(notification.data) : null,
        type: notification.targetType,
        date: notification.sentAt || notification.createdAt,
        createdAt: notification.createdAt
      }));

      return res.json({
        success: true,
        data: formattedNotifications,
        count: formattedNotifications.length
      });

    } catch (error) {
      console.error("Erro ao buscar notificações do motorista:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar notificações"
      });
    }
  });

  // ========================================
  // SETTINGS ROUTES
  // ========================================

  // GET /api/settings/google-maps-key - Obter chave da API do Google Maps
  app.get("/api/settings/google-maps-key", async (req, res) => {
    try {
      if (!req.session.companyId && !req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const settings = await storage.getSettings();

      if (!settings || !settings.googleMapsApiKey) {
        return res.status(404).json({
          message: "Chave da API do Google Maps não configurada"
        });
      }

      return res.json({
        apiKey: settings.googleMapsApiKey
      });
    } catch (error) {
      console.error("Erro ao buscar chave da API:", error);
      return res.status(500).json({ message: "Erro ao buscar chave da API" });
    }
  });

  // Error handling middleware - deve vir após todas as rotas
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Erros do Multer
    if (err instanceof multer.MulterError) {
      console.error("❌ Erro do Multer:", err.message);

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Arquivo muito grande. O tamanho máximo é 10MB",
          error: err.message
        });
      }

      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          message: "Campo de arquivo inválido. Use o campo 'document' para enviar o arquivo",
          error: err.message
        });
      }

      return res.status(400).json({
        message: "Erro ao processar arquivo",
        error: err.message
      });
    }

    // Outros erros do multer (fileFilter)
    if (err.message && err.message.includes("Apenas imagens")) {
      console.error("❌ Tipo de arquivo inválido:", err.message);
      return res.status(400).json({
        message: err.message,
        error: "Tipo de arquivo não permitido"
      });
    }

    // Outros erros
    console.error("❌ Erro não tratado:", err);
    return res.status(500).json({
      message: "Erro interno do servidor",
      error: process.env.NODE_ENV === "development" ? err.message : "Erro desconhecido"
    });
  });

  const httpServer = createServer(app);

  // ===========================================
  // ROTAS DE NOTIFICAÇÕES PUSH
  // ===========================================

  // GET /api/notifications - Listar notificações enviadas
  app.get("/api/notifications", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado - Apenas administradores" });
    }

    try {
      const { pushNotifications } = await import("@shared/schema");
      const notifications = await db
        .select({
          id: pushNotifications.id,
          title: pushNotifications.title,
          body: pushNotifications.body,
          targetType: pushNotifications.targetType,
          targetId: pushNotifications.targetId,
          targetCityId: pushNotifications.targetCityId,
          status: pushNotifications.status,
          errorMessage: pushNotifications.errorMessage,
          totalRecipients: pushNotifications.totalRecipients,
          successCount: pushNotifications.successCount,
          failureCount: pushNotifications.failureCount,
          createdAt: pushNotifications.createdAt,
          sentAt: pushNotifications.sentAt,
          cityName: serviceLocations.name,
          driverName: drivers.name
        })
        .from(pushNotifications)
        .leftJoin(serviceLocations, eq(pushNotifications.targetCityId, serviceLocations.id))
        .leftJoin(drivers, eq(pushNotifications.targetId, drivers.id))
        .orderBy(sql`${pushNotifications.createdAt} DESC`);

      res.json(notifications);
    } catch (error) {
      console.error("Erro ao buscar notificações:", error);
      res.status(500).json({ message: "Erro ao buscar notificações" });
    }
  });

  // POST /api/notifications/send - Enviar notificação
  app.post("/api/notifications/send", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado - Apenas administradores" });
    }

    try {
      const { title, body, targetType, targetId, targetCityId } = req.body;

      if (!title || !body || !targetType) {
        return res.status(400).json({
          message: "Título, mensagem e tipo de destino são obrigatórios"
        });
      }

      if (targetType === 'driver' && !targetId) {
        return res.status(400).json({
          message: "ID do motorista é obrigatório para notificação individual"
        });
      }

      if (targetType === 'city' && !targetCityId) {
        return res.status(400).json({
          message: "ID da cidade é obrigatório para notificação por cidade"
        });
      }

      // Importar pushNotifications do schema
      const { pushNotifications } = await import("@shared/schema");

      // Criar registro da notificação
      const [notification] = await db.insert(pushNotifications).values({
        title,
        body,
        targetType,
        targetId: targetType === 'driver' ? targetId : null,
        targetCityId: targetType === 'city' ? targetCityId : null,
        status: 'pending',
        sentBy: req.session.userId
      }).returning();

      // Buscar tokens dos destinatários
      let tokens: string[] = [];
      let driversToNotify = [];

      if (targetType === 'driver') {
        // Notificação individual
        const driver = await db
          .select()
          .from(drivers)
          .where(eq(drivers.id, targetId))
          .limit(1);

        if (driver[0]?.fcmToken) {
          tokens.push(driver[0].fcmToken);
          driversToNotify.push(driver[0]);
        }
      } else if (targetType === 'city') {
        // Notificação para todos os motoristas da cidade
        const cityDrivers = await db
          .select()
          .from(drivers)
          .where(
            and(
              eq(drivers.serviceLocationId, targetCityId),
              eq(drivers.active, true)
            )
          );

        driversToNotify = cityDrivers;
        tokens = cityDrivers
          .filter(d => d.fcmToken)
          .map(d => d.fcmToken!);
      }

      if (tokens.length === 0) {
        await db.update(pushNotifications)
          .set({
            status: 'failed',
            errorMessage: 'Nenhum token FCM encontrado para os destinatários',
            sentAt: new Date()
          })
          .where(eq(pushNotifications.id, notification.id));

        return res.status(200).json({
          success: false,
          message: "Nenhum dispositivo registrado para receber notificações",
          notification
        });
      }

      // Enviar notificações via Firebase
      try {
        const results = await sendPushToMultipleDevices(tokens, title, body, {
          notificationId: notification.id,
          timestamp: new Date().toISOString()
        });

        if (!results) {
          throw new Error("Falha ao enviar notificações - Firebase não retornou resposta");
        }

        const successCount = results.responses.filter(r => r.success).length;
        const failureCount = results.responses.filter(r => !r.success).length;

        // Atualizar status da notificação
        await db.update(pushNotifications)
          .set({
            status: successCount > 0 ? 'sent' : 'failed',
            totalRecipients: tokens.length,
            successCount,
            failureCount,
            sentAt: new Date(),
            errorMessage: failureCount > 0 ? `${failureCount} falhas ao enviar` : null
          })
          .where(eq(pushNotifications.id, notification.id));

        res.json({
          success: true,
          message: `Notificação enviada com sucesso para ${successCount} dispositivo(s)`,
          notification: {
            ...notification,
            totalRecipients: tokens.length,
            successCount,
            failureCount
          }
        });
      } catch (error) {
        console.error("Erro ao enviar push notifications:", error);

        await db.update(pushNotifications)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
            sentAt: new Date()
          })
          .where(eq(pushNotifications.id, notification.id));

        throw error;
      }
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      res.status(500).json({
        message: "Erro ao enviar notificação",
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  // GET /api/notifications/cities - Listar cidades para seleção
  app.get("/api/notifications/cities", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    try {
      // Buscar cidades com contagem de motoristas ativos
      const cities = await db
        .select({
          id: serviceLocations.id,
          name: serviceLocations.name,
          state: serviceLocations.state,
          driverCount: sql<number>`COUNT(DISTINCT ${drivers.id})::int`
        })
        .from(serviceLocations)
        .leftJoin(
          drivers,
          and(
            eq(drivers.serviceLocationId, serviceLocations.id),
            eq(drivers.active, true)
          )
        )
        .where(eq(serviceLocations.active, true))
        .groupBy(serviceLocations.id, serviceLocations.name, serviceLocations.state)
        .orderBy(serviceLocations.name);

      res.json(cities);
    } catch (error) {
      console.error("Erro ao buscar cidades:", error);
      res.status(500).json({ message: "Erro ao buscar cidades" });
    }
  });

  // GET /api/notifications/drivers/:cityId - Listar motoristas de uma cidade
  app.get("/api/notifications/drivers/:cityId", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { cityId } = req.params;

    try {
      const cityDrivers = await db
        .select({
          id: drivers.id,
          name: drivers.name,
          mobile: drivers.mobile,
          carModel: drivers.carModel,
          carNumber: drivers.carNumber,
          hasToken: sql<boolean>`${drivers.fcmToken} IS NOT NULL`
        })
        .from(drivers)
        .where(
          and(
            eq(drivers.serviceLocationId, cityId),
            eq(drivers.active, true)
          )
        )
        .orderBy(drivers.name);

      res.json(cityDrivers);
    } catch (error) {
      console.error("Erro ao buscar motoristas:", error);
      res.status(500).json({ message: "Erro ao buscar motoristas" });
    }
  });

  // ========================
  // FAQ ENDPOINTS
  // ========================

  // GET /api/faqs - Listar FAQs
  app.get("/api/faqs", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    try {
      const faqList = await db
        .select({
          id: faqs.id,
          question: faqs.question,
          answer: faqs.answer,
          category: faqs.category,
          target: faqs.target,
          displayOrder: faqs.displayOrder,
          active: faqs.active,
          createdAt: faqs.createdAt,
          updatedAt: faqs.updatedAt
        })
        .from(faqs)
        .orderBy(faqs.category, faqs.displayOrder, faqs.createdAt);

      res.json(faqList);
    } catch (error) {
      console.error("Erro ao buscar FAQs:", error);
      res.status(500).json({ message: "Erro ao buscar FAQs" });
    }
  });

  // GET /api/faqs/:id - Obter FAQ específico
  app.get("/api/faqs/:id", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { id } = req.params;

    try {
      const faq = await db
        .select()
        .from(faqs)
        .where(eq(faqs.id, id))
        .limit(1);

      if (faq.length === 0) {
        return res.status(404).json({ message: "FAQ não encontrado" });
      }

      res.json(faq[0]);
    } catch (error) {
      console.error("Erro ao buscar FAQ:", error);
      res.status(500).json({ message: "Erro ao buscar FAQ" });
    }
  });

  // POST /api/faqs - Criar novo FAQ
  app.post("/api/faqs", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const validation = insertFaqSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.issues
      });
    }

    try {
      const newFaq = await db
        .insert(faqs)
        .values({
          ...validation.data,
          createdBy: req.session.userId,
          updatedBy: req.session.userId
        })
        .returning();

      res.status(201).json({
        message: "FAQ criado com sucesso",
        faq: newFaq[0]
      });
    } catch (error) {
      console.error("Erro ao criar FAQ:", error);
      res.status(500).json({ message: "Erro ao criar FAQ" });
    }
  });

  // PUT /api/faqs/:id - Atualizar FAQ
  app.put("/api/faqs/:id", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { id } = req.params;
    const validation = insertFaqSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.issues
      });
    }

    try {
      const updatedFaq = await db
        .update(faqs)
        .set({
          ...validation.data,
          updatedBy: req.session.userId,
          updatedAt: new Date()
        })
        .where(eq(faqs.id, id))
        .returning();

      if (updatedFaq.length === 0) {
        return res.status(404).json({ message: "FAQ não encontrado" });
      }

      res.json({
        message: "FAQ atualizado com sucesso",
        faq: updatedFaq[0]
      });
    } catch (error) {
      console.error("Erro ao atualizar FAQ:", error);
      res.status(500).json({ message: "Erro ao atualizar FAQ" });
    }
  });

  // DELETE /api/faqs/:id - Deletar FAQ
  app.delete("/api/faqs/:id", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { id } = req.params;

    try {
      const deletedFaq = await db
        .delete(faqs)
        .where(eq(faqs.id, id))
        .returning();

      if (deletedFaq.length === 0) {
        return res.status(404).json({ message: "FAQ não encontrado" });
      }

      res.json({ message: "FAQ deletado com sucesso" });
    } catch (error) {
      console.error("Erro ao deletar FAQ:", error);
      res.status(500).json({ message: "Erro ao deletar FAQ" });
    }
  });

  // ========================
  // FAQ PUBLIC ENDPOINTS (Para Apps)
  // ========================

  // GET /api/v1/driver/faqs - FAQs para motoristas
  app.get("/api/v1/driver/faqs", async (req, res) => {
    try {
      const faqList = await db
        .select({
          id: faqs.id,
          question: faqs.question,
          answer: faqs.answer,
          category: faqs.category,
          displayOrder: faqs.displayOrder
        })
        .from(faqs)
        .where(
          and(
            eq(faqs.target, "driver"),
            eq(faqs.active, true)
          )
        )
        .orderBy(faqs.category, faqs.displayOrder, faqs.createdAt);

      // Agrupar por categoria para melhor apresentação
      const groupedFaqs = faqList.reduce((acc, faq) => {
        if (!acc[faq.category]) {
          acc[faq.category] = {
            category: faq.category,
            items: []
          };
        }
        acc[faq.category].items.push({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          displayOrder: faq.displayOrder
        });
        return acc;
      }, {} as Record<string, any>);

      // Converter para array
      const result = Object.values(groupedFaqs);

      res.json({
        success: true,
        faqs: result,
        total: faqList.length
      });
    } catch (error) {
      console.error("Erro ao buscar FAQs de motoristas:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar FAQs"
      });
    }
  });

  // GET /api/v1/company/faqs - FAQs para empresas
  app.get("/api/v1/company/faqs", async (req, res) => {
    try {
      const faqList = await db
        .select({
          id: faqs.id,
          question: faqs.question,
          answer: faqs.answer,
          category: faqs.category,
          displayOrder: faqs.displayOrder
        })
        .from(faqs)
        .where(
          and(
            eq(faqs.target, "company"),
            eq(faqs.active, true)
          )
        )
        .orderBy(faqs.category, faqs.displayOrder, faqs.createdAt);

      // Agrupar por categoria para melhor apresentação
      const groupedFaqs = faqList.reduce((acc, faq) => {
        if (!acc[faq.category]) {
          acc[faq.category] = {
            category: faq.category,
            items: []
          };
        }
        acc[faq.category].items.push({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          displayOrder: faq.displayOrder
        });
        return acc;
      }, {} as Record<string, any>);

      // Converter para array
      const result = Object.values(groupedFaqs);

      res.json({
        success: true,
        faqs: result,
        total: faqList.length
      });
    } catch (error) {
      console.error("Erro ao buscar FAQs de empresas:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar FAQs"
      });
    }
  });

  // GET /api/public/faqs/:target - Endpoint genérico para FAQs
  app.get("/api/public/faqs/:target", async (req, res) => {
    const { target } = req.params;

    // Validar target
    if (target !== "driver" && target !== "company") {
      return res.status(400).json({
        success: false,
        message: "Tipo de FAQ inválido. Use 'driver' ou 'company'"
      });
    }

    try {
      const faqList = await db
        .select({
          id: faqs.id,
          question: faqs.question,
          answer: faqs.answer,
          category: faqs.category,
          displayOrder: faqs.displayOrder
        })
        .from(faqs)
        .where(
          and(
            eq(faqs.target, target),
            eq(faqs.active, true)
          )
        )
        .orderBy(faqs.category, faqs.displayOrder, faqs.createdAt);

      // Agrupar por categoria para melhor apresentação
      const groupedFaqs = faqList.reduce((acc, faq) => {
        if (!acc[faq.category]) {
          acc[faq.category] = {
            category: faq.category,
            items: []
          };
        }
        acc[faq.category].items.push({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          displayOrder: faq.displayOrder
        });
        return acc;
      }, {} as Record<string, any>);

      // Converter para array e ordenar por nome da categoria
      const result = Object.values(groupedFaqs).sort((a: any, b: any) =>
        a.category.localeCompare(b.category)
      );

      res.json({
        success: true,
        target: target,
        faqs: result,
        total: faqList.length
      });
    } catch (error) {
      console.error(`Erro ao buscar FAQs de ${target}:`, error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar FAQs"
      });
    }
  });

  // GET /api/public/faqs - Listar todas as FAQs públicas (sem filtro)
  app.get("/api/public/faqs", async (req, res) => {
    try {
      const faqList = await db
        .select({
          id: faqs.id,
          question: faqs.question,
          answer: faqs.answer,
          category: faqs.category,
          target: faqs.target,
          displayOrder: faqs.displayOrder
        })
        .from(faqs)
        .where(eq(faqs.active, true))
        .orderBy(faqs.target, faqs.category, faqs.displayOrder, faqs.createdAt);

      // Agrupar primeiro por target, depois por categoria
      const groupedByTarget = {
        driver: [] as any[],
        company: [] as any[]
      };

      faqList.forEach(faq => {
        const targetGroup = groupedByTarget[faq.target as keyof typeof groupedByTarget];
        let categoryGroup = targetGroup.find((g: any) => g.category === faq.category);

        if (!categoryGroup) {
          categoryGroup = {
            category: faq.category,
            items: []
          };
          targetGroup.push(categoryGroup);
        }

        categoryGroup.items.push({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          displayOrder: faq.displayOrder
        });
      });

      res.json({
        success: true,
        faqs: {
          driver: groupedByTarget.driver,
          company: groupedByTarget.company
        },
        totals: {
          driver: groupedByTarget.driver.reduce((sum: number, cat: any) => sum + cat.items.length, 0),
          company: groupedByTarget.company.reduce((sum: number, cat: any) => sum + cat.items.length, 0)
        }
      });
    } catch (error) {
      console.error("Erro ao buscar todas as FAQs:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar FAQs"
      });
    }
  });

  // ========================
  // SUPPORT TICKETS - ADMIN ENDPOINTS
  // ========================

  // GET /api/ticket-subjects - Listar assuntos de tickets
  app.get("/api/ticket-subjects", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    try {
      const subjects = await db
        .select()
        .from(ticketSubjects)
        .orderBy(desc(ticketSubjects.createdAt));

      res.json(subjects);
    } catch (error) {
      console.error("Erro ao listar assuntos de tickets:", error);
      res.status(500).json({ message: "Erro ao listar assuntos de tickets" });
    }
  });

  // POST /api/ticket-subjects - Criar assunto de ticket
  app.post("/api/ticket-subjects", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const validation = insertTicketSubjectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.errors,
      });
    }

    try {
      const newSubject = await db
        .insert(ticketSubjects)
        .values(validation.data)
        .returning();

      res.status(201).json(newSubject[0]);
    } catch (error) {
      console.error("Erro ao criar assunto de ticket:", error);
      res.status(500).json({ message: "Erro ao criar assunto de ticket" });
    }
  });

  // PUT /api/ticket-subjects/:id - Atualizar assunto de ticket
  app.put("/api/ticket-subjects/:id", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { id } = req.params;
    const validation = insertTicketSubjectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Dados inválidos",
        errors: validation.error.errors,
      });
    }

    try {
      const updatedSubject = await db
        .update(ticketSubjects)
        .set({ ...validation.data, updatedAt: new Date() })
        .where(eq(ticketSubjects.id, id))
        .returning();

      if (updatedSubject.length === 0) {
        return res.status(404).json({ message: "Assunto não encontrado" });
      }

      res.json(updatedSubject[0]);
    } catch (error) {
      console.error("Erro ao atualizar assunto de ticket:", error);
      res.status(500).json({ message: "Erro ao atualizar assunto de ticket" });
    }
  });

  // DELETE /api/ticket-subjects/:id - Deletar assunto de ticket
  app.delete("/api/ticket-subjects/:id", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { id } = req.params;

    try {
      const deletedSubject = await db
        .delete(ticketSubjects)
        .where(eq(ticketSubjects.id, id))
        .returning();

      if (deletedSubject.length === 0) {
        return res.status(404).json({ message: "Assunto não encontrado" });
      }

      res.json({ message: "Assunto deletado com sucesso" });
    } catch (error) {
      console.error("Erro ao deletar assunto de ticket:", error);
      res.status(500).json({ message: "Erro ao deletar assunto de ticket" });
    }
  });

  // GET /api/support-tickets - Listar tickets de suporte (Admin)
  app.get("/api/support-tickets", async (req, res) => {
    console.log("📋 Listagem de tickets - Admin");
    console.log("  Session:", req.session);

    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { status, driverId, subjectId } = req.query;
    console.log("  Filtros:", { status, driverId, subjectId });

    try {
      let query = db
        .select({
          ticket: supportTickets,
          subject: ticketSubjects,
        })
        .from(supportTickets)
        .leftJoin(ticketSubjects, eq(supportTickets.subjectId, ticketSubjects.id));

      // Aplicar filtros
      const conditions = [];
      if (status) {
        conditions.push(eq(supportTickets.status, status as string));
      }
      if (driverId) {
        conditions.push(eq(supportTickets.driverId, driverId as string));
      }
      if (subjectId) {
        conditions.push(eq(supportTickets.subjectId, subjectId as string));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const tickets = await query.orderBy(desc(supportTickets.createdAt));

      res.json(tickets);
    } catch (error) {
      console.error("Erro ao listar tickets:", error);
      res.status(500).json({ message: "Erro ao listar tickets" });
    }
  });

  // GET /api/support-tickets/:id - Ver ticket específico com respostas
  app.get("/api/support-tickets/:id", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { id } = req.params;

    try {
      const ticket = await db
        .select({
          ticket: supportTickets,
          subject: ticketSubjects,
        })
        .from(supportTickets)
        .leftJoin(ticketSubjects, eq(supportTickets.subjectId, ticketSubjects.id))
        .where(eq(supportTickets.id, id));

      if (ticket.length === 0) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      // Buscar respostas
      const replies = await db
        .select()
        .from(ticketReplies)
        .where(eq(ticketReplies.ticketId, id))
        .orderBy(ticketReplies.createdAt);

      // Marcar respostas como lidas pelo admin
      await db
        .update(ticketReplies)
        .set({ readByAdmin: true })
        .where(
          and(
            eq(ticketReplies.ticketId, id),
            eq(ticketReplies.authorType, "driver")
          )
        );

      res.json({
        ...ticket[0],
        replies,
      });
    } catch (error) {
      console.error("Erro ao buscar ticket:", error);
      res.status(500).json({ message: "Erro ao buscar ticket" });
    }
  });

  // PUT /api/support-tickets/:id/status - Atualizar status do ticket
  app.put("/api/support-tickets/:id/status", async (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
      return res.status(400).json({ message: "Status inválido" });
    }

    try {
      const updateData: any = { status, updatedAt: new Date() };
      if (status === "resolved") {
        updateData.resolvedAt = new Date();
      } else if (status === "closed") {
        updateData.closedAt = new Date();
      }

      const updatedTicket = await db
        .update(supportTickets)
        .set(updateData)
        .where(eq(supportTickets.id, id))
        .returning();

      if (updatedTicket.length === 0) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      res.json(updatedTicket[0]);
    } catch (error) {
      console.error("Erro ao atualizar status do ticket:", error);
      res.status(500).json({ message: "Erro ao atualizar status do ticket" });
    }
  });

  // POST /api/support-tickets/:id/reply - Responder ticket (Admin) com R2
  app.post("/api/support-tickets/:id/reply", uploadR2.single("attachment"), async (req, res) => {
    console.log("🎫 [ADMIN REPLY] Recebendo resposta de ticket:");
    console.log("  - Body:", req.body);
    console.log("  - File:", req.file ? req.file.originalname : "Nenhum arquivo");

    if (!req.session.userId || !req.session.isAdmin) {
      return res.status(401).json({ message: "Não autorizado" });
    }

    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Mensagem é obrigatória" });
    }

    try {
      // Verificar se o ticket existe
      const ticket = await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.id, id));

      if (ticket.length === 0) {
        return res.status(404).json({ message: "Ticket não encontrado" });
      }

      // Fazer upload para R2 se houver arquivo
      let attachmentUrl = null;
      if (req.file) {
        console.log("☁️  Fazendo upload da imagem da resposta do admin para R2...");
        attachmentUrl = await uploadToR2(
          req.file.buffer,
          "imagens_tickets",
          req.file.originalname
        );
        console.log("✅ Arquivo salvo no R2:", attachmentUrl);
      } else {
        console.log("ℹ️  Nenhum arquivo enviado");
      }

      // Criar resposta
      const replyData = {
        ticketId: id,
        authorType: "admin" as const,
        authorId: req.session.userId,
        authorName: req.session.userName || "Admin",
        message,
        attachmentUrl,
      };

      const validation = insertTicketReplySchema.safeParse(replyData);
      if (!validation.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: validation.error.errors,
        });
      }

      const newReply = await db
        .insert(ticketReplies)
        .values({ ...validation.data, readByAdmin: true })
        .returning();

      // Atualizar ticket
      await db
        .update(supportTickets)
        .set({
          repliesCount: sql`${supportTickets.repliesCount} + 1`,
          lastReplyAt: new Date(),
          unreadByDriver: true,
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, id));

      // TODO: Enviar notificação push para o motorista
      const driverId = ticket[0].driverId;
      const driver = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, driverId));

      if (driver.length > 0 && driver[0].fcmToken) {
        await sendPushNotification(
          driver[0].fcmToken,
          "Nova resposta no ticket",
          `Ticket #${ticket[0].ticketNumber}: ${message.substring(0, 100)}`,
          {
            type: "ticket_reply",
            ticketId: id,
            ticketNumber: ticket[0].ticketNumber,
          }
        );
      }

      res.status(201).json(newReply[0]);
    } catch (error) {
      console.error("Erro ao responder ticket:", error);
      res.status(500).json({ message: "Erro ao responder ticket" });
    }
  });

  // ========================
  // SUPPORT TICKETS - DRIVER APP ENDPOINTS
  // ========================

  // GET /api/v1/driver/ticket-subjects - Listar assuntos ativos
  app.get("/api/v1/driver/ticket-subjects", async (req, res) => {
    try {
      const subjects = await db
        .select({
          id: ticketSubjects.id,
          name: ticketSubjects.name,
          description: ticketSubjects.description,
        })
        .from(ticketSubjects)
        .where(eq(ticketSubjects.active, true))
        .orderBy(ticketSubjects.name);

      res.json({
        success: true,
        subjects,
      });
    } catch (error) {
      console.error("Erro ao buscar assuntos:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar assuntos",
      });
    }
  });

  // POST /api/v1/driver/support-tickets - Criar ticket (Driver App) com R2
  app.post("/api/v1/driver/support-tickets", uploadR2.single("images"), async (req, res) => {
    console.log("📝 Criação de ticket - Dados recebidos:");
    console.log("  Body:", req.body);
    console.log("  File:", req.file ? req.file.originalname : "Nenhum arquivo");

    const { subjectId, message } = req.body;

    if (!subjectId || !message) {
      console.log("  ❌ Dados incompletos!");
      return res.status(400).json({
        success: false,
        message: "Dados incompletos - subjectId e message são obrigatórios",
      });
    }

    try {
      // Extrair driverId do token de autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Token de autenticação não fornecido",
        });
      }

      const token = authHeader.substring(7);
      const decodedToken = JSON.parse(Buffer.from(token, "base64").toString());
      const driverId = decodedToken.id;

      if (!driverId) {
        return res.status(401).json({
          success: false,
          message: "Token inválido",
        });
      }

      // Buscar dados do motorista no banco
      const driverData = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, driverId))
        .limit(1);

      if (driverData.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Motorista não encontrado",
        });
      }

      const driver = driverData[0];

      console.log("  ✅ Motorista autenticado:", driver.name);

      // Gerar número único do ticket
      const count = await db
        .select({ count: sql<number>`count(*)` })
        .from(supportTickets);
      const ticketNumber = `TKT-${String(Number(count[0].count) + 1).padStart(5, "0")}`;

      // Fazer upload para R2 se houver arquivo
      let attachmentUrl = null;
      if (req.file) {
        console.log("☁️  Fazendo upload da imagem do ticket para R2...");
        attachmentUrl = await uploadToR2(
          req.file.buffer,
          "imagens_tickets",
          req.file.originalname
        );
      }

      const ticketData = {
        ticketNumber,
        driverId: driver.id,
        driverName: driver.name,
        driverEmail: driver.email || null,
        driverWhatsapp: driver.mobile,
        subjectId,
        message,
        attachmentUrl,
        status: "open" as const,
      };

      console.log("  📋 Dados preparados para validação:", JSON.stringify(ticketData, null, 2));

      const validation = insertSupportTicketSchema.safeParse(ticketData);
      if (!validation.success) {
        console.log("  ❌ Erro de validação:", JSON.stringify(validation.error.errors, null, 2));
        return res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: validation.error.errors,
        });
      }

      // Adicionar ticketNumber aos dados validados
      const dataToInsert = {
        ...validation.data,
        ticketNumber,
      };

      const newTicket = await db
        .insert(supportTickets)
        .values(dataToInsert)
        .returning();

      res.status(201).json({
        success: true,
        ticket: newTicket[0],
      });
    } catch (error) {
      console.error("Erro ao criar ticket:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao criar ticket",
      });
    }
  });

  // GET /api/v1/driver/support-tickets - Listar tickets do motorista logado
  app.get("/api/v1/driver/support-tickets", async (req, res) => {
    const { status } = req.query;

    try {
      // Extrair driverId do token de autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "Token de autenticação não fornecido",
        });
      }

      const token = authHeader.substring(7);
      const decodedToken = JSON.parse(Buffer.from(token, "base64").toString());
      const driverId = decodedToken.id;

      if (!driverId) {
        return res.status(401).json({
          success: false,
          message: "Token inválido",
        });
      }

      let query = db
        .select({
          ticket: supportTickets,
          subject: ticketSubjects,
        })
        .from(supportTickets)
        .leftJoin(ticketSubjects, eq(supportTickets.subjectId, ticketSubjects.id))
        .where(eq(supportTickets.driverId, driverId));

      if (status) {
        query = query.where(
          and(
            eq(supportTickets.driverId, driverId),
            eq(supportTickets.status, status as string)
          )
        ) as any;
      }

      const tickets = await query.orderBy(desc(supportTickets.createdAt));

      // Converter URLs de imagens para URLs completas
      const ticketsWithFullUrls = tickets.map(item => ({
        ...item,
        ticket: {
          ...item.ticket,
          attachmentUrl: getFullImageUrl(req, item.ticket.attachmentUrl),
        },
      }));

      res.json({
        success: true,
        tickets: ticketsWithFullUrls,
      });
    } catch (error) {
      console.error("Erro ao listar tickets:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao listar tickets",
      });
    }
  });

  // GET /api/v1/driver/:driverId/support-tickets - Listar tickets do motorista (deprecated - usar endpoint sem driverId)
  app.get("/api/v1/driver/:driverId/support-tickets", async (req, res) => {
    const { driverId } = req.params;
    const { status } = req.query;

    try {
      let query = db
        .select({
          ticket: supportTickets,
          subject: ticketSubjects,
        })
        .from(supportTickets)
        .leftJoin(ticketSubjects, eq(supportTickets.subjectId, ticketSubjects.id))
        .where(eq(supportTickets.driverId, driverId));

      if (status) {
        query = query.where(
          and(
            eq(supportTickets.driverId, driverId),
            eq(supportTickets.status, status as string)
          )
        ) as any;
      }

      const tickets = await query.orderBy(desc(supportTickets.createdAt));

      res.json({
        success: true,
        tickets,
      });
    } catch (error) {
      console.error("Erro ao listar tickets:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao listar tickets",
      });
    }
  });

  // GET /api/v1/driver/support-tickets/:id - Ver ticket específico com respostas
  app.get("/api/v1/driver/support-tickets/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const ticket = await db
        .select({
          ticket: supportTickets,
          subject: ticketSubjects,
        })
        .from(supportTickets)
        .leftJoin(ticketSubjects, eq(supportTickets.subjectId, ticketSubjects.id))
        .where(eq(supportTickets.id, id));

      if (ticket.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Ticket não encontrado",
        });
      }

      // Buscar respostas
      const replies = await db
        .select()
        .from(ticketReplies)
        .where(eq(ticketReplies.ticketId, id))
        .orderBy(ticketReplies.createdAt);

      // Marcar ticket e respostas como lidas pelo motorista
      await db
        .update(supportTickets)
        .set({ unreadByDriver: false })
        .where(eq(supportTickets.id, id));

      await db
        .update(ticketReplies)
        .set({ readByDriver: true })
        .where(
          and(
            eq(ticketReplies.ticketId, id),
            eq(ticketReplies.authorType, "admin")
          )
        );

      // Converter URLs de imagens para URLs completas
      const ticketWithFullUrl = {
        ...ticket[0],
        ticket: {
          ...ticket[0].ticket,
          attachmentUrl: getFullImageUrl(req, ticket[0].ticket.attachmentUrl),
        },
      };

      const repliesWithFullUrls = replies.map(reply => ({
        ...reply,
        attachmentUrl: getFullImageUrl(req, reply.attachmentUrl),
      }));

      res.json({
        success: true,
        ticket: ticketWithFullUrl,
        replies: repliesWithFullUrls,
      });
    } catch (error) {
      console.error("Erro ao buscar ticket:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar ticket",
      });
    }
  });

  // POST /api/v1/driver/support-tickets/:id/reply - Responder ticket (Driver App) com R2
  app.post("/api/v1/driver/support-tickets/:id/reply",
    (req, res, next) => {
      console.log("🌐 [PRE-MULTER] Requisição recebida:");
      console.log("  - Content-Type:", req.headers['content-type']);
      console.log("  - Method:", req.method);
      console.log("  - URL:", req.url);
      next();
    },
    uploadR2.single("images"),
    async (req, res) => {
    console.log("📱 [DRIVER REPLY] Recebendo resposta de motorista:");
    console.log("  - Params:", req.params);
    console.log("  - Body:", req.body);
    console.log("  - File:", req.file ? req.file.originalname : "Nenhum arquivo");

    const { id } = req.params;
    const { driverId, driverName, message } = req.body;

    if (!driverId || !driverName || !message) {
      console.log("❌ Dados incompletos:", { driverId, driverName, message: message ? "OK" : "MISSING" });
      return res.status(400).json({
        success: false,
        message: "Dados incompletos",
      });
    }

    try {
      // Verificar se o ticket existe e pertence ao motorista
      const ticket = await db
        .select()
        .from(supportTickets)
        .where(
          and(
            eq(supportTickets.id, id),
            eq(supportTickets.driverId, driverId)
          )
        );

      if (ticket.length === 0) {
        console.log("❌ Ticket não encontrado:", { id, driverId });
        return res.status(404).json({
          success: false,
          message: "Ticket não encontrado",
        });
      }

      // Fazer upload para R2 se houver arquivo
      let attachmentUrl = null;
      if (req.file) {
        console.log("☁️  Fazendo upload da imagem da resposta para R2...");
        attachmentUrl = await uploadToR2(
          req.file.buffer,
          "imagens_tickets",
          req.file.originalname
        );
        console.log("✅ Arquivo do motorista salvo no R2:", attachmentUrl);
      } else {
        console.log("ℹ️  Motorista não enviou arquivo");
      }

      const replyData = {
        ticketId: id,
        authorType: "driver" as const,
        authorId: driverId,
        authorName: driverName,
        message,
        attachmentUrl,
      };

      const validation = insertTicketReplySchema.safeParse(replyData);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "Dados inválidos",
          errors: validation.error.errors,
        });
      }

      const newReply = await db
        .insert(ticketReplies)
        .values({ ...validation.data, readByDriver: true })
        .returning();

      // Atualizar ticket
      await db
        .update(supportTickets)
        .set({
          repliesCount: sql`${supportTickets.repliesCount} + 1`,
          lastReplyAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(supportTickets.id, id));

      res.status(201).json({
        success: true,
        reply: newReply[0],
      });
    } catch (error) {
      console.error("Erro ao responder ticket:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao responder ticket",
      });
    }
  });

  // ========================
  // Driver App Endpoints
  // ========================

  // GET /api/driver/:driverId/deliveries - Buscar entregas do motorista com filtros
  app.get("/api/driver/:driverId/deliveries", async (req, res) => {
    try {
      const { driverId } = req.params;
      const {
        startDate,
        endDate,
        companyId,
        groupBy = "day" // day | week | month
      } = req.query;

      // Validar groupBy
      if (!["day", "week", "month"].includes(groupBy as string)) {
        return res.status(400).json({
          success: false,
          message: "Parâmetro groupBy inválido. Use: day, week ou month"
        });
      }

      // Montar query base
      let query = db
        .select({
          // Dados da entrega
          id: requests.id,
          requestNumber: requests.requestNumber,
          createdAt: requests.createdAt,
          completedAt: requests.completedAt,
          cancelledAt: requests.cancelledAt,
          isCompleted: requests.isCompleted,
          isCancelled: requests.isCancelled,
          cancelReason: requests.cancelReason,

          // Distância e tempo
          totalDistance: requests.totalDistance,
          totalTime: requests.totalTime,
          estimatedTime: requests.estimatedTime,

          // Empresa
          companyId: requests.companyId,
          companyName: companies.name,
          companyPhone: companies.phone,

          // Valores (do requestBills)
          driverEarnings: sql<number>`
            CASE
              WHEN ${requestBills.totalAmount} IS NOT NULL THEN
                ROUND(
                  ${requestBills.totalAmount}::numeric *
                  (1 - COALESCE(${requestBills.adminCommision}::numeric, 0) / 100),
                  2
                )
              ELSE 0
            END
          `.as('driver_earnings'),
          totalAmount: requestBills.totalAmount,
          adminCommission: requestBills.adminCommision,

          // Endereços
          pickAddress: requestPlaces.pickAddress,
          dropAddress: requestPlaces.dropAddress,

          // Cliente
          customerName: requests.customerName,
          customerWhatsapp: requests.customerWhatsapp,
        })
        .from(requests)
        .leftJoin(companies, eq(requests.companyId, companies.id))
        .leftJoin(requestBills, eq(requests.id, requestBills.requestId))
        .leftJoin(requestPlaces, eq(requests.id, requestPlaces.requestId))
        .where(
          and(
            eq(requests.driverId, driverId),
            sql`(${requests.isCompleted} = true OR ${requests.isCancelled} = true)`
          )
        );

      // Aplicar filtros de data
      const filters: any[] = [
        eq(requests.driverId, driverId),
        sql`(${requests.isCompleted} = true OR ${requests.isCancelled} = true)`
      ];

      if (startDate) {
        filters.push(sql`DATE(${requests.createdAt}) >= ${startDate}`);
      }

      if (endDate) {
        filters.push(sql`DATE(${requests.createdAt}) <= ${endDate}`);
      }

      // Filtro por empresa
      if (companyId) {
        filters.push(eq(requests.companyId, companyId as string));
      }

      query = query.where(and(...filters));

      // Executar query
      const deliveries = await query;

      // Calcular estatísticas
      const stats = {
        totalDeliveries: 0,
        completedDeliveries: 0,
        cancelledDeliveries: 0,
        totalEarnings: 0,
        totalDistance: 0,
        totalTime: 0,
        averageDistance: 0,
        averageTime: 0,
        averageEarnings: 0,
      };

      // Agrupar por período
      const groupedDeliveries: Record<string, any> = {};

      deliveries.forEach((delivery) => {
        // Atualizar estatísticas gerais
        stats.totalDeliveries++;

        if (delivery.isCompleted) {
          stats.completedDeliveries++;
          stats.totalEarnings += Number(delivery.driverEarnings) || 0;
          stats.totalDistance += Number(delivery.totalDistance) || 0;
          stats.totalTime += Number(delivery.totalTime) || 0;
        } else if (delivery.isCancelled) {
          stats.cancelledDeliveries++;
        }

        // Determinar a chave de agrupamento
        const date = new Date(delivery.createdAt);
        let groupKey: string;

        if (groupBy === "day") {
          groupKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (groupBy === "week") {
          // Obter o número da semana
          const weekNumber = getWeekNumber(date);
          const year = date.getFullYear();
          groupKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
        } else { // month
          groupKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        }

        // Inicializar grupo se não existir
        if (!groupedDeliveries[groupKey]) {
          groupedDeliveries[groupKey] = {
            period: groupKey,
            deliveries: [],
            stats: {
              total: 0,
              completed: 0,
              cancelled: 0,
              earnings: 0,
              distance: 0,
              time: 0,
            }
          };
        }

        // Adicionar entrega ao grupo
        groupedDeliveries[groupKey].deliveries.push({
          id: delivery.id,
          requestNumber: delivery.requestNumber,
          createdAt: delivery.createdAt,
          completedAt: delivery.completedAt,
          cancelledAt: delivery.cancelledAt,
          status: delivery.isCompleted ? "completed" : "cancelled",
          cancelReason: delivery.cancelReason,
          earnings: Number(delivery.driverEarnings) || 0,
          distance: Number(delivery.totalDistance) || 0,
          time: Number(delivery.totalTime) || 0,
          estimatedTime: Number(delivery.estimatedTime) || 0,
          company: {
            id: delivery.companyId,
            name: delivery.companyName,
            phone: delivery.companyPhone,
          },
          customer: {
            name: delivery.customerName,
            whatsapp: delivery.customerWhatsapp,
          },
          addresses: {
            pickup: delivery.pickAddress,
            dropoff: delivery.dropAddress,
          }
        });

        // Atualizar estatísticas do grupo
        groupedDeliveries[groupKey].stats.total++;
        if (delivery.isCompleted) {
          groupedDeliveries[groupKey].stats.completed++;
          groupedDeliveries[groupKey].stats.earnings += Number(delivery.driverEarnings) || 0;
          groupedDeliveries[groupKey].stats.distance += Number(delivery.totalDistance) || 0;
          groupedDeliveries[groupKey].stats.time += Number(delivery.totalTime) || 0;
        } else if (delivery.isCancelled) {
          groupedDeliveries[groupKey].stats.cancelled++;
        }
      });

      // Calcular médias
      if (stats.completedDeliveries > 0) {
        stats.averageDistance = Math.round((stats.totalDistance / stats.completedDeliveries) * 100) / 100;
        stats.averageTime = Math.round((stats.totalTime / stats.completedDeliveries) * 100) / 100;
        stats.averageEarnings = Math.round((stats.totalEarnings / stats.completedDeliveries) * 100) / 100;
      }

      // Converter objeto agrupado em array e ordenar
      const groupedArray = Object.values(groupedDeliveries).sort((a: any, b: any) =>
        b.period.localeCompare(a.period)
      );

      res.json({
        success: true,
        driverId,
        filters: {
          startDate,
          endDate,
          companyId,
          groupBy,
        },
        stats,
        grouped: groupedArray,
        total: deliveries.length,
      });

    } catch (error) {
      console.error("Erro ao buscar entregas do motorista:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao buscar entregas do motorista"
      });
    }
  });

  // Função auxiliar para obter o número da semana
  function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // ========================
  // R2 UPLOAD ENDPOINTS
  // ========================

  // POST /api/r2/upload/driver-document - Upload de documento de entregador para R2
  app.post("/api/r2/upload/driver-document", uploadR2.single("document"), async (req, res) => {
    try {
      console.log("📤 Upload de documento de entregador para R2");
      console.log("  - Body:", req.body);
      console.log("  - File:", req.file ? req.file.originalname : "Nenhum arquivo");

      // Permitir envio com sessão OU com driverId no body
      const driverId = req.session?.driverId || req.body.driverId;

      if (!driverId) {
        return res.status(401).json({
          message: "Driver ID é obrigatório. Forneça via sessão ou no corpo da requisição.",
        });
      }

      const { documentTypeId } = req.body;

      if (!documentTypeId) {
        return res.status(400).json({
          message: "O tipo de documento é obrigatório",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Nenhum arquivo foi enviado",
        });
      }

      // Validar tamanho do arquivo
      if (!isValidFileSize(req.file.size, 10)) {
        return res.status(400).json({
          message: "Arquivo muito grande. Tamanho máximo: 10MB",
        });
      }

      // Verificar se o motorista existe
      const [driver] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, driverId))
        .limit(1);

      if (!driver) {
        return res.status(404).json({
          message: "Motorista não encontrado",
        });
      }

      // Fazer upload para R2
      const documentUrl = await uploadToR2(
        req.file.buffer,
        "documentos_entregadores",
        req.file.originalname
      );

      // Verificar se já existe um documento deste tipo para o motorista
      const existingDoc = await db
        .select()
        .from(driverDocuments)
        .where(
          and(
            eq(driverDocuments.driverId, driverId),
            eq(driverDocuments.documentTypeId, documentTypeId)
          )
        )
        .limit(1);

      let document;

      if (existingDoc.length > 0) {
        // Deletar arquivo antigo do R2
        if (existingDoc[0].documentUrl) {
          try {
            await deleteFromR2(existingDoc[0].documentUrl);
          } catch (error) {
            console.error("Erro ao deletar arquivo antigo do R2:", error);
          }
        }

        // Atualizar documento existente
        console.log(`📝 Atualizando documento existente (tipo: ${documentTypeId})`);
        const [updated] = await db
          .update(driverDocuments)
          .set({
            documentUrl: documentUrl,
            status: "pending",
            rejectionReason: null,
            updatedAt: new Date(),
          })
          .where(eq(driverDocuments.id, existingDoc[0].id))
          .returning();
        document = updated;
      } else {
        // Inserir novo documento
        console.log(`✨ Inserindo novo documento (tipo: ${documentTypeId})`);
        const [inserted] = await db
          .insert(driverDocuments)
          .values({
            driverId: driverId,
            documentTypeId: documentTypeId,
            documentUrl: documentUrl,
            status: "pending",
          })
          .returning();
        document = inserted;
      }

      res.status(201).json({
        message: "Documento enviado com sucesso",
        document,
      });
    } catch (error) {
      console.error("Erro ao fazer upload do documento:", error);
      res.status(500).json({
        message: "Erro ao fazer upload do documento",
      });
    }
  });

  // POST /api/r2/upload/ticket-image - Upload de imagem de ticket para R2
  app.post("/api/r2/upload/ticket-image", uploadR2.single("image"), async (req, res) => {
    try {
      console.log("📤 Upload de imagem de ticket para R2");
      console.log("  - Body:", req.body);
      console.log("  - File:", req.file ? req.file.originalname : "Nenhum arquivo");

      if (!req.file) {
        return res.status(400).json({
          message: "Nenhum arquivo foi enviado",
        });
      }

      // Validar se é uma imagem
      if (!isValidImage(req.file.mimetype)) {
        return res.status(400).json({
          message: "Apenas imagens são permitidas (JPEG, PNG, GIF, WEBP)",
        });
      }

      // Validar tamanho do arquivo
      if (!isValidFileSize(req.file.size, 5)) {
        return res.status(400).json({
          message: "Imagem muito grande. Tamanho máximo: 5MB",
        });
      }

      // Fazer upload para R2
      const imageUrl = await uploadToR2(
        req.file.buffer,
        "imagens_tickets",
        req.file.originalname
      );

      res.status(201).json({
        message: "Imagem enviada com sucesso",
        url: imageUrl,
      });
    } catch (error) {
      console.error("Erro ao fazer upload da imagem:", error);
      res.status(500).json({
        message: "Erro ao fazer upload da imagem",
      });
    }
  });

  // DELETE /api/r2/delete - Deletar arquivo do R2
  app.delete("/api/r2/delete", async (req, res) => {
    try {
      const { fileUrl } = req.body;

      if (!fileUrl) {
        return res.status(400).json({
          message: "URL do arquivo é obrigatória",
        });
      }

      await deleteFromR2(fileUrl);

      res.json({
        message: "Arquivo deletado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao deletar arquivo:", error);
      res.status(500).json({
        message: "Erro ao deletar arquivo",
      });
    }
  });

  // ========================
  // Sentry Test Endpoints (Development Only)
  // ========================
  if (process.env.NODE_ENV !== "production") {
    // Test endpoint for Sentry error capture
    app.get("/api/test/sentry-error", (req, res) => {
      throw new Error("Teste de erro do Sentry - Backend API");
    });

    // Test endpoint for Sentry message
    app.get("/api/test/sentry-message", async (req, res) => {
      const Sentry = await import("@sentry/node");
      Sentry.captureMessage("Teste de mensagem do Sentry - Backend API", "info");
      res.json({ message: "Mensagem de teste enviada ao Sentry" });
    });

    // Test endpoint for async error
    app.get("/api/test/sentry-async-error", async (req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      throw new Error("Teste de erro assíncrono do Sentry - Backend API");
    });

    // Test endpoint with custom context
    app.get("/api/test/sentry-context", async (req, res) => {
      const Sentry = await import("@sentry/node");
      Sentry.withScope((scope) => {
        scope.setContext("test_context", {
          testId: Date.now(),
          testType: "manual",
          environment: process.env.NODE_ENV
        });
        scope.setLevel("warning");
        Sentry.captureException(new Error("Teste de erro com contexto customizado"));
      });
      res.json({ message: "Erro com contexto enviado ao Sentry" });
    });

    console.log("🐛 Sentry test endpoints enabled (development mode)");
  }

  // Configurar Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Armazenar io globalmente para usar nas rotas
  (app as any).io = io;

  // Socket.IO connection handling
  io.on("connection", (socket) => {
    console.log("✓ Cliente conectado:", socket.id);

    // Empresa entra em uma sala específica
    socket.on("join-company", (companyId: string) => {
      socket.join(`company-${companyId}`);
      console.log(`Empresa ${companyId} entrou na sala`);
    });

    // Motorista entra em uma sala específica
    socket.on("join-driver", (driverId: string) => {
      socket.join(`driver-${driverId}`);
      console.log(`Motorista ${driverId} entrou na sala`);
    });

    socket.on("disconnect", () => {
      console.log("Cliente desconectado:", socket.id);
    });
  });

  // Inicializar Firebase
  initializeFirebase().catch(console.error);

  return httpServer;
}
