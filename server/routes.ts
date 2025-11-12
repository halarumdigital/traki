import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { loginSchema, insertSettingsSchema, serviceLocations, vehicleTypes, brands, vehicleModels, driverDocumentTypes, driverDocuments, drivers, companies, requests, requestPlaces, requestBills, driverNotifications, cityPrices, settings, companyCancellationTypes, insertCompanyCancellationTypeSchema, promotions, insertPromotionSchema, companyDriverRatings, driverCompanyRatings } from "@shared/schema";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool, db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import { initializeFirebase, sendPushNotification, sendPushToMultipleDevices } from "./firebase";

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

export async function registerRoutes(app: Express): Promise<Server> {
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

  // POST /api/drivers - Criar novo motorista
  app.post("/api/drivers", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const { name, email, password, cpf, mobile } = req.body;

      if (!name || !mobile) {
        return res.status(400).json({
          message: "Nome e WhatsApp são obrigatórios"
        });
      }

      // Hash da senha se foi fornecida
      let hashedPassword = null;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // Criar motorista diretamente (sem criar usuário)
      const newDriver = await storage.createDriver({
        ...req.body,
        password: hashedPassword,
        active: true,
        approve: false,
        available: false,
      });

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
        isLater: false,
        isDriverStarted: false,
        isDriverArrived: false,
        isTripStart: false,
        isCompleted: false,
        isCancelled: false,
      });

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

      // Create request bill
      await pool.query(
        `INSERT INTO request_bills (
          request_id,
          total_amount,
          admin_commision,
          base_price,
          base_distance,
          price_per_distance,
          distance_price,
          price_per_time,
          time_price
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          request.id,
          totalPrice.toFixed(2),
          adminCommission,
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
        returnPrice: needsReturn ? returnPrice.toFixed(2) : "0.00"
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
            base_price,
            base_distance,
            price_per_distance,
            distance_price,
            price_per_time,
            time_price
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            newRequest.id,
            bill.total_amount,
            adminCommission,
            bill.base_price,
            bill.base_distance,
            bill.price_per_distance,
            bill.distance_price,
            bill.price_per_time,
            bill.time_price
          ]
        );
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
        loginBy
      } = req.body;

      // Validação completa - todos os campos são obrigatórios
      if (!name || !mobile || !password || !cpf || !email || !serviceLocationId ||
          !vehicleTypeId || !carMake || !carModel || !carNumber || !carColor || !carYear) {
        return res.status(400).json({
          message: "Todos os campos são obrigatórios: nome, CPF, telefone, email, senha, cidade, tipo de veículo, marca, modelo, placa, cor e ano"
        });
      }

      // Validação: carMake e carModel devem ser UUIDs (IDs das tabelas brands e vehicle_models)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidPattern.test(carMake)) {
        return res.status(400).json({
          message: `O campo 'carMake' deve conter o ID (UUID) da marca, não o nome. Valor inválido recebido: '${carMake}'. Use o endpoint GET /api/v1/driver/brands para obter a lista de marcas com seus IDs.`
        });
      }

      if (!uuidPattern.test(carModel)) {
        return res.status(400).json({
          message: `O campo 'carModel' deve conter o ID (UUID) do modelo, não o nome. Valor inválido recebido: '${carModel}'. Use o endpoint GET /api/v1/driver/models/:brandId para obter a lista de modelos com seus IDs.`
        });
      }

      // Verifica se já existe motorista com esse telefone
      const existingDriver = await storage.getDriverByMobile(mobile);
      if (existingDriver) {
        return res.status(400).json({
          message: "Já existe um motorista cadastrado com este telefone"
        });
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

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
      });

      return res.status(201).json({
        success: true,
        message: "Motorista registrado com sucesso. Agora envie seus documentos e aguarde a aprovação do administrador.",
        data: {
          id: driver.id,
          name: driver.name,
          mobile: driver.mobile,
          email: driver.email,
          approve: driver.approve,
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

  // POST /api/v1/driver/documents - Enviar documento do motorista
  app.post("/api/v1/driver/documents", (req, res, next) => {
    console.log("\n🚀 POST /api/v1/driver/documents - Requisição recebida");
    console.log("  - Content-Type:", req.headers["content-type"]);
    console.log("  - Session exists:", !!req.session);
    console.log("  - Session driverId:", req.session?.driverId);
    next();
  }, uploadDocument.single("document"), async (req, res) => {
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

      // Salvar documento no banco
      const documentPath = `/uploads/documents_driver/${req.file.filename}`;

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
        // Atualizar documento existente (reenvio)
        console.log(`📝 Atualizando documento existente (tipo: ${documentTypeId})`);
        const [updated] = await db
          .update(driverDocuments)
          .set({
            documentUrl: documentPath,
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
            documentUrl: documentPath,
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
            profilePicture: documentPath,
          })
          .where(eq(drivers.id, driverId));

        console.log(`✅ Foto de perfil atualizada: ${documentPath}`);
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

      await storage.updateRequest(deliveryId, {
        isDriverArrived: true,
        arrivedAt: new Date(),
      });

      console.log(`✅ Status atualizado: motorista chegou para retirada`);

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

      await storage.updateRequest(deliveryId, {
        isTripStart: true,
        tripStartedAt: new Date(),
      });

      console.log(`✅ Status atualizado: pedido retirado`);

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
        ORDER BY r.accepted_at DESC
        LIMIT 1
      `, [driverId]);

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: null,
          message: "Nenhuma entrega em andamento"
        });
      }

      const delivery = result.rows[0];

      console.log(`📱 Dados da entrega em andamento do banco:
  - Request Number: ${delivery.request_number}
  - total_distance (banco): ${delivery.total_distance} metros
  - total_time (banco): ${delivery.total_time} min
  - estimated_time (banco): ${delivery.estimated_time} min`);

      // Formatar dados para o app
      const formattedDelivery = {
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

      console.log(`📱 Dados formatados enviados ao app:
  - total_distance (app): ${formattedDelivery.total_distance} km
  - estimated_time (app): ${formattedDelivery.estimated_time} min`);

      return res.json({
        success: true,
        data: formattedDelivery
      });
    } catch (error) {
      console.error("Erro ao buscar entrega atual:", error);
      return res.status(500).json({ message: "Erro ao buscar entrega atual" });
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
