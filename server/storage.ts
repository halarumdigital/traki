import {
  users,
  serviceLocations,
  vehicleTypes,
  brands,
  vehicleModels,
  driverDocumentTypes,
  driverDocuments,
  driverNotes,
  companies,
  cityPrices,
  drivers,
  requests,
  requestPlaces,
  requestBills,
  cancellationReasons,
  favouriteLocations,
  requestRatings,
  settings,
  commissionTiers,
  type User,
  type InsertUser,
  type ServiceLocation,
  type InsertServiceLocation,
  type VehicleType,
  type InsertVehicleType,
  type Brand,
  type InsertBrand,
  type VehicleModel,
  type InsertVehicleModel,
  type DriverDocumentType,
  type InsertDriverDocumentType,
  type DriverDocument,
  type InsertDriverDocument,
  type DriverNote,
  type InsertDriverNote,
  type Company,
  type InsertCompany,
  type CityPrice,
  type InsertCityPrice,
  type Driver,
  type InsertDriver,
  type Request,
  type InsertRequest,
  type RequestPlace,
  type RequestBill,
  type CancellationReason,
  type FavouriteLocation,
  type RequestRating,
  type Settings,
  type InsertSettings,
  type CommissionTier,
  type InsertCommissionTier,
  rotasIntermunicipais,
  type RotaIntermunicipal,
  type InsertRotaIntermunicipal,
  entregasIntermunicipais,
  type EntregaIntermunicipal,
  type InsertEntregaIntermunicipal,
  entregasIntermunicipalParadas,
  type EntregaIntermunicipalParada,
  type InsertEntregaIntermunicipalParada,
  viagensIntermunicipais,
  type ViagemIntermunicipal,
  type InsertViagemIntermunicipal,
  viagemColetas,
  type ViagemColeta,
  type InsertViagemColeta,
  viagemEntregas,
  type ViagemEntrega,
  type InsertViagemEntrega,
  entregadorRotas,
  type EntregadorRota,
  type InsertEntregadorRota,
  npsSurveys,
  npsSurveyItems,
  npsResponses,
  npsResponseItems,
  type NpsSurvey,
  type InsertNpsSurvey,
  type NpsSurveyItem,
  type InsertNpsSurveyItem,
  type NpsResponse,
  type InsertNpsResponse,
  type NpsResponseItem,
  type InsertNpsResponseItem,
  passwordResetTokens,
  promotions,
  promotionProgress,
  type Promotion,
  type PromotionProgress,
  type InsertPromotionProgress,
  // Wallet System
  wallets,
  walletTransactions,
  charges,
  deliveryFinancials,
  withdrawals,
  webhooksLog,
  type Wallet,
  type InsertWallet,
  type WalletTransaction,
  type InsertWalletTransaction,
  type Charge,
  type InsertCharge,
  type DeliveryFinancial,
  type InsertDeliveryFinancial,
  type Withdrawal,
  type InsertWithdrawal,
  type WebhookLog,
  type InsertWebhookLog,
  // App Version
  appVersion,
  type AppVersion,
  type InsertAppVersion,
  // Allocation System
  allocationTimeSlots,
  allocations,
  allocationAlerts,
  type AllocationTimeSlot,
  type InsertAllocationTimeSlot,
  type Allocation,
  type InsertAllocation,
  type AllocationAlert,
  type InsertAllocationAlert,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray, gt, ne, or, isNull } from "drizzle-orm";

export interface IStorage {
  // ===== USERS =====
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: string): Promise<void>;

  // ===== SERVICE LOCATIONS (Cidades) =====
  getAllServiceLocations(): Promise<ServiceLocation[]>;
  getServiceLocation(id: string): Promise<ServiceLocation | undefined>;
  createServiceLocation(data: InsertServiceLocation): Promise<ServiceLocation>;
  updateServiceLocation(id: string, data: Partial<InsertServiceLocation>): Promise<ServiceLocation | undefined>;
  deleteServiceLocation(id: string): Promise<void>;

  // ===== VEHICLE TYPES (Categorias) =====
  getAllVehicleTypes(): Promise<VehicleType[]>;
  getVehicleType(id: string): Promise<VehicleType | undefined>;
  createVehicleType(data: InsertVehicleType): Promise<VehicleType>;
  updateVehicleType(id: string, data: Partial<InsertVehicleType>): Promise<VehicleType | undefined>;
  deleteVehicleType(id: string): Promise<void>;

  // ===== BRANDS (Marcas) =====
  getAllBrands(): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  createBrand(data: InsertBrand): Promise<Brand>;
  updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined>;
  deleteBrand(id: string): Promise<void>;

  // ===== VEHICLE MODELS (Modelos) =====
  getAllVehicleModels(): Promise<any[]>;
  getVehicleModel(id: string): Promise<VehicleModel | undefined>;
  getVehicleModelsByBrand(brandId: string): Promise<VehicleModel[]>;
  createVehicleModel(data: InsertVehicleModel): Promise<VehicleModel>;
  updateVehicleModel(id: string, data: Partial<InsertVehicleModel>): Promise<VehicleModel | undefined>;
  deleteVehicleModel(id: string): Promise<void>;

  // ===== DRIVER DOCUMENT TYPES (Tipos de Documentos) =====
  getAllDriverDocumentTypes(): Promise<DriverDocumentType[]>;
  getDriverDocumentType(id: string): Promise<DriverDocumentType | undefined>;
  createDriverDocumentType(data: InsertDriverDocumentType): Promise<DriverDocumentType>;
  updateDriverDocumentType(id: string, data: Partial<InsertDriverDocumentType>): Promise<DriverDocumentType | undefined>;
  deleteDriverDocumentType(id: string): Promise<void>;

  // ===== DRIVER DOCUMENTS (Documentos Enviados) =====
  getDriverDocuments(driverId: string): Promise<any[]>;
  createDriverDocument(data: InsertDriverDocument): Promise<DriverDocument>;
  updateDriverDocument(id: string, data: Partial<InsertDriverDocument>): Promise<DriverDocument | undefined>;
  deleteDriverDocument(id: string): Promise<void>;

  // ===== DRIVER NOTES (Comentários/Notas) =====
  getDriverNotes(driverId: string): Promise<any[]>;
  createDriverNote(data: InsertDriverNote): Promise<DriverNote>;
  deleteDriverNote(id: string): Promise<void>;

  // ===== COMPANIES (Empresas) =====
  getAllCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByCnpj(cnpj: string): Promise<Company | undefined>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;

  // ===== CITY PRICES (Preços) =====
  getAllCityPrices(): Promise<any[]>;
  getCityPricesByLocation(serviceLocationId: string): Promise<CityPrice[]>;
  getCityPrice(id: string): Promise<CityPrice | undefined>;
  getCityPriceByLocationAndVehicle(serviceLocationId: string, vehicleTypeId: string): Promise<CityPrice | undefined>;
  createCityPrice(data: InsertCityPrice): Promise<CityPrice>;
  updateCityPrice(id: string, data: Partial<InsertCityPrice>): Promise<CityPrice | undefined>;
  deleteCityPrice(id: string): Promise<void>;

  // ===== DRIVERS =====
  getAllDrivers(): Promise<Driver[]>;
  getDriver(id: string): Promise<Driver | undefined>;
  getDriverByUserId(userId: string): Promise<Driver | undefined>;
  getDriverByMobile(mobile: string): Promise<Driver | undefined>;
  getDriverByEmail(email: string): Promise<Driver | undefined>;
  getDriversByLocation(serviceLocationId: string): Promise<Driver[]>;
  getAvailableDrivers(serviceLocationId: string, vehicleTypeId: string): Promise<Driver[]>;
  createDriver(data: InsertDriver): Promise<Driver>;
  updateDriver(id: string, data: Partial<InsertDriver>): Promise<Driver | undefined>;
  updateDriverLocation(id: string, latitude: string, longitude: string): Promise<void>;
  deleteDriver(id: string): Promise<void>;

  // ===== REQUESTS (Corridas) =====
  getAllRequests(): Promise<Request[]>;
  getRequest(id: string): Promise<Request | undefined>;
  getRequestByNumber(requestNumber: string): Promise<Request | undefined>;
  getUserRequests(userId: string): Promise<Request[]>;
  getDriverRequests(driverId: string): Promise<Request[]>;
  getActiveUserRequest(userId: string): Promise<Request | undefined>;
  getActiveDriverRequest(driverId: string): Promise<Request | undefined>;
  createRequest(data: InsertRequest): Promise<Request>;
  updateRequest(id: string, data: Partial<InsertRequest>): Promise<Request | undefined>;

  // ===== CANCELLATION REASONS =====
  getCancellationReasons(userType: string): Promise<CancellationReason[]>;

  // ===== COMPANY TRIPS =====
  getCompanyTrips(companyId: string): Promise<any[]>;

  // ===== SETTINGS =====
  getSettings(): Promise<Settings | undefined>;
  updateSettings(data: Partial<InsertSettings>): Promise<Settings | undefined>;

  // ===== PASSWORD RESET =====
  createPasswordResetToken(userId: string, token: string, expiresAt: Date, userType?: string): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ id: string; userId: string; userType: string; expiresAt: Date; used: boolean } | undefined>;
  markPasswordResetTokenAsUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;

  // ===== COMMISSION TIERS =====
  getAllCommissionTiers(): Promise<CommissionTier[]>;
  getCommissionTier(id: string): Promise<CommissionTier | undefined>;
  createCommissionTier(data: InsertCommissionTier): Promise<CommissionTier>;
  updateCommissionTier(id: string, data: Partial<InsertCommissionTier>): Promise<CommissionTier | undefined>;
  deleteCommissionTier(id: string): Promise<void>;
  getDriverCommissionPercentage(driverId: string): Promise<number>;
  incrementDriverMonthlyDeliveries(driverId: string): Promise<void>;
  resetMonthlyDeliveryCounters(): Promise<void>;

  // ===== ROTAS INTERMUNICIPAIS =====
  getAllRotasIntermunicipais(): Promise<any[]>;
  getRotasComEntregadoresAtivos(): Promise<any[]>;
  getRotaIntermunicipal(id: string): Promise<RotaIntermunicipal | undefined>;
  createRotaIntermunicipal(data: InsertRotaIntermunicipal): Promise<RotaIntermunicipal>;
  updateRotaIntermunicipal(id: string, data: Partial<InsertRotaIntermunicipal>): Promise<RotaIntermunicipal | undefined>;
  deleteRotaIntermunicipal(id: string): Promise<void>;

  // ===== ENTREGAS INTERMUNICIPAIS =====
  getAllEntregasIntermunicipais(): Promise<any[]>;
  getEntregasIntermunicipasByEmpresa(empresaId: string): Promise<any[]>;
  getEntregasIntermunicipasByRota(rotaId: string, dataAgendada: string): Promise<any[]>;
  getEntregaIntermunicipal(id: string): Promise<EntregaIntermunicipal | undefined>;
  createEntregaIntermunicipal(data: InsertEntregaIntermunicipal): Promise<EntregaIntermunicipal>;
  updateEntregaIntermunicipal(id: string, data: Partial<InsertEntregaIntermunicipal>): Promise<EntregaIntermunicipal | undefined>;
  deleteEntregaIntermunicipal(id: string): Promise<void>;

  // ===== PARADAS DE ENTREGA INTERMUNICIPAL =====
  getParadasByEntrega(entregaId: string): Promise<any[]>;
  createParadaEntrega(data: any): Promise<any>;
  createParadasEntrega(paradas: any[]): Promise<any[]>;

  // ===== VIAGENS INTERMUNICIPAIS =====
  getAllViagensIntermunicipais(): Promise<any[]>;
  getViagensIntermunicipasByEntregador(entregadorId: string): Promise<any[]>;
  getViagensIntermunicipasByRota(rotaId: string, dataViagem: string): Promise<any[]>;
  getViagemIntermunicipal(id: string): Promise<ViagemIntermunicipal | undefined>;
  createViagemIntermunicipal(data: InsertViagemIntermunicipal): Promise<ViagemIntermunicipal>;
  updateViagemIntermunicipal(id: string, data: Partial<InsertViagemIntermunicipal>): Promise<ViagemIntermunicipal | undefined>;
  deleteViagemIntermunicipal(id: string): Promise<void>;
  getMotoristasComRotaConfigurada(rotaId: string, dataViagem: string): Promise<any[]>;

  // ===== VIAGEM COLETAS =====
  createViagemColeta(data: InsertViagemColeta): Promise<ViagemColeta>;

  // ===== VIAGEM ENTREGAS =====
  createViagemEntrega(data: InsertViagemEntrega): Promise<ViagemEntrega>;

  // ===== NPS SURVEYS =====
  getAllNpsSurveys(): Promise<NpsSurvey[]>;
  getNpsSurvey(id: string): Promise<NpsSurvey | undefined>;
  getNpsSurveyBySlug(slug: string): Promise<NpsSurvey | undefined>;
  createNpsSurvey(data: InsertNpsSurvey): Promise<NpsSurvey>;
  updateNpsSurvey(id: string, data: Partial<InsertNpsSurvey>): Promise<NpsSurvey | undefined>;
  deleteNpsSurvey(id: string): Promise<void>;

  // ===== NPS SURVEY ITEMS =====
  getNpsSurveyItems(surveyId: string): Promise<NpsSurveyItem[]>;
  getNpsSurveyItem(id: string): Promise<NpsSurveyItem | undefined>;
  createNpsSurveyItem(data: InsertNpsSurveyItem): Promise<NpsSurveyItem>;
  updateNpsSurveyItem(id: string, data: Partial<InsertNpsSurveyItem>): Promise<NpsSurveyItem | undefined>;
  deleteNpsSurveyItem(id: string): Promise<void>;

  // ===== NPS RESPONSES =====
  getNpsResponsesBySurvey(surveyId: string): Promise<NpsResponse[]>;
  createNpsResponse(data: InsertNpsResponse, ipAddress?: string, userAgent?: string): Promise<NpsResponse>;

  // ===== NPS RESPONSE ITEMS =====
  getNpsResponseItems(responseId: string): Promise<NpsResponseItem[]>;
  createNpsResponseItem(data: InsertNpsResponseItem): Promise<NpsResponseItem>;
  createNpsResponseItems(items: InsertNpsResponseItem[]): Promise<NpsResponseItem[]>;

  // ===== NPS STATISTICS =====
  getNpsSurveyStats(surveyId: string): Promise<{
    totalResponses: number;
    promoters: number;
    passives: number;
    detractors: number;
    npsScore: number;
    averageScores: { itemId: string; label: string; average: number }[];
    textResponses: { itemId: string; label: string; responses: string[] }[];
  }>;

  // ===== PROMOTION PROGRESS =====
  getPromotionProgress(promotionId: string, driverId: string): Promise<PromotionProgress | undefined>;
  getDriverPromotionProgress(driverId: string): Promise<PromotionProgress[]>;
  incrementPromotionProgress(driverId: string, deliveryDate: Date): Promise<void>;
  getActivePromotions(): Promise<Promotion[]>;
  getPromotionRanking(promotionId: string): Promise<{ driverId: string; deliveryCount: number; rank: number }[]>;

  // ===== WALLETS =====
  getWallet(id: string): Promise<Wallet | undefined>;
  getWalletByOwner(ownerId: string, ownerType: string): Promise<Wallet | undefined>;
  createWallet(data: InsertWallet): Promise<Wallet>;
  updateWalletBalance(walletId: string, availableBalance: string, blockedBalance?: string): Promise<Wallet | undefined>;
  getPlatformWallet(): Promise<Wallet | undefined>;

  // ===== WALLET TRANSACTIONS =====
  getWalletTransactions(walletId: string, limit?: number, offset?: number): Promise<WalletTransaction[]>;
  getWalletTransaction(id: string): Promise<WalletTransaction | undefined>;
  createWalletTransaction(data: InsertWalletTransaction): Promise<WalletTransaction>;
  updateWalletTransaction(id: string, data: Partial<WalletTransaction>): Promise<WalletTransaction | undefined>;

  // ===== CHARGES =====
  getCharge(id: string): Promise<Charge | undefined>;
  getChargeByAsaasId(asaasId: string): Promise<Charge | undefined>;
  getChargesByCompany(companyId: string, limit?: number): Promise<Charge[]>;
  getPendingWeeklyCharges(): Promise<Charge[]>;
  getAllWeeklyCharges(limit?: number): Promise<(Charge & { companyName: string })[]>;
  createCharge(data: InsertCharge): Promise<Charge>;
  updateCharge(id: string, data: Partial<Charge>): Promise<Charge | undefined>;

  // ===== DELIVERY FINANCIALS =====
  getDeliveryFinancial(id: string): Promise<DeliveryFinancial | undefined>;
  getDeliveryFinancialByRequest(requestId: string): Promise<DeliveryFinancial | undefined>;
  getUnprocessedDeliveryFinancials(companyId: string): Promise<DeliveryFinancial[]>;
  createDeliveryFinancial(data: InsertDeliveryFinancial): Promise<DeliveryFinancial>;
  updateDeliveryFinancial(id: string, data: Partial<DeliveryFinancial>): Promise<DeliveryFinancial | undefined>;

  // ===== WITHDRAWALS =====
  getWithdrawal(id: string): Promise<Withdrawal | undefined>;
  getWithdrawalsByDriver(driverId: string, limit?: number): Promise<Withdrawal[]>;
  getDriverLastWithdrawal(driverId: string): Promise<Withdrawal | undefined>;
  createWithdrawal(data: InsertWithdrawal): Promise<Withdrawal>;
  updateWithdrawal(id: string, data: Partial<Withdrawal>): Promise<Withdrawal | undefined>;

  // ===== WEBHOOKS LOG =====
  createWebhookLog(data: InsertWebhookLog): Promise<WebhookLog>;
  updateWebhookLog(id: string, data: Partial<WebhookLog>): Promise<WebhookLog | undefined>;

  // ===== APP VERSION =====
  getAppVersion(): Promise<AppVersion | undefined>;
  createAppVersion(data: InsertAppVersion): Promise<AppVersion>;
  updateAppVersion(id: string, data: Partial<AppVersion>): Promise<AppVersion | undefined>;

  // ===== ALLOCATION TIME SLOTS (Faixas de Horário) =====
  getAllAllocationTimeSlots(): Promise<AllocationTimeSlot[]>;
  getAllocationTimeSlot(id: string): Promise<AllocationTimeSlot | undefined>;
  getActiveAllocationTimeSlots(serviceLocationId?: string): Promise<AllocationTimeSlot[]>;
  createAllocationTimeSlot(data: InsertAllocationTimeSlot): Promise<AllocationTimeSlot>;
  updateAllocationTimeSlot(id: string, data: Partial<InsertAllocationTimeSlot>): Promise<AllocationTimeSlot | undefined>;
  deleteAllocationTimeSlot(id: string): Promise<void>;

  // ===== ALLOCATIONS (Alocações) =====
  getAllocation(id: string): Promise<Allocation | undefined>;
  getAllocationsByCompany(companyId: string, date?: string): Promise<Allocation[]>;
  getAllocationsByDriver(driverId: string, date?: string): Promise<Allocation[]>;
  getActiveAllocationForDriver(driverId: string): Promise<Allocation | undefined>;
  getActiveAllocationsForCompany(companyId: string): Promise<Allocation[]>;
  getPendingAllocations(): Promise<Allocation[]>;
  createAllocation(data: InsertAllocation): Promise<Allocation>;
  updateAllocation(id: string, data: Partial<Allocation>): Promise<Allocation | undefined>;

  // ===== ALLOCATION ALERTS (Alertas) =====
  createAllocationAlert(data: InsertAllocationAlert): Promise<AllocationAlert>;
  getActiveAllocationAlerts(allocationId: string): Promise<AllocationAlert[]>;
  getAllocationAlertForDriver(allocationId: string, driverId: string): Promise<AllocationAlert | undefined>;
  updateAllocationAlert(id: string, data: Partial<AllocationAlert>): Promise<AllocationAlert | undefined>;
  expireAllocationAlerts(allocationId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ========================================
  // USERS
  // ========================================
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.mobile, mobile));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    // Retorna apenas usuários que NÃO são motoristas (não têm registro em drivers)
    const allUsers = await db
      .select({
        id: users.id,
        nome: users.nome,
        email: users.email,
        mobile: users.mobile,
        password: users.password,
        profilePicture: users.profilePicture,
        active: users.active,
        emailConfirmed: users.emailConfirmed,
        mobileConfirmed: users.mobileConfirmed,
        rating: users.rating,
        ratingTotal: users.ratingTotal,
        noOfRatings: users.noOfRatings,
        fcmToken: users.fcmToken,
        apnToken: users.apnToken,
        loginBy: users.loginBy,
        refferalCode: users.refferalCode,
        referredBy: users.referredBy,
        timezone: users.timezone,
        lang: users.lang,
        gender: users.gender,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        driverId: drivers.id,
      })
      .from(users)
      .leftJoin(drivers, eq(drivers.userId, users.id))
      .orderBy(desc(users.createdAt));

    // Filtrar apenas usuários que não são motoristas
    return allUsers.filter(user => user.driverId === null).map(({ driverId, ...user }) => user);
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ========================================
  // SERVICE LOCATIONS (Cidades)
  // ========================================
  async getAllServiceLocations(): Promise<ServiceLocation[]> {
    return await db.select().from(serviceLocations).orderBy(serviceLocations.name);
  }

  async getServiceLocation(id: string): Promise<ServiceLocation | undefined> {
    const [location] = await db.select().from(serviceLocations).where(eq(serviceLocations.id, id));
    return location || undefined;
  }

  async createServiceLocation(data: InsertServiceLocation): Promise<ServiceLocation> {
    const [location] = await db
      .insert(serviceLocations)
      .values(data)
      .returning();
    return location;
  }

  async updateServiceLocation(id: string, data: Partial<InsertServiceLocation>): Promise<ServiceLocation | undefined> {
    const [updated] = await db
      .update(serviceLocations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(serviceLocations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteServiceLocation(id: string): Promise<void> {
    await db.delete(serviceLocations).where(eq(serviceLocations.id, id));
  }

  // ========================================
  // VEHICLE TYPES (Categorias)
  // ========================================
  async getAllVehicleTypes(): Promise<VehicleType[]> {
    return await db.select().from(vehicleTypes).orderBy(vehicleTypes.name);
  }

  async getVehicleType(id: string): Promise<VehicleType | undefined> {
    const [type] = await db.select().from(vehicleTypes).where(eq(vehicleTypes.id, id));
    return type || undefined;
  }

  async createVehicleType(data: InsertVehicleType): Promise<VehicleType> {
    const [type] = await db
      .insert(vehicleTypes)
      .values(data)
      .returning();
    return type;
  }

  async updateVehicleType(id: string, data: Partial<InsertVehicleType>): Promise<VehicleType | undefined> {
    const [updated] = await db
      .update(vehicleTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vehicleTypes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteVehicleType(id: string): Promise<void> {
    await db.delete(vehicleTypes).where(eq(vehicleTypes.id, id));
  }

  // ========================================
  // BRANDS (Marcas)
  // ========================================
  async getAllBrands(): Promise<Brand[]> {
    return await db.select().from(brands).orderBy(brands.name);
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand || undefined;
  }

  async createBrand(data: InsertBrand): Promise<Brand> {
    const [brand] = await db
      .insert(brands)
      .values(data)
      .returning();
    return brand;
  }

  async updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined> {
    const [updated] = await db
      .update(brands)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(brands.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBrand(id: string): Promise<void> {
    await db.delete(brands).where(eq(brands.id, id));
  }

  // ========================================
  // VEHICLE MODELS (Modelos)
  // ========================================
  async getAllVehicleModels(): Promise<any[]> {
    const result = await db
      .select({
        id: vehicleModels.id,
        brandId: vehicleModels.brandId,
        brandName: brands.name,
        name: vehicleModels.name,
        active: vehicleModels.active,
        createdAt: vehicleModels.createdAt,
        updatedAt: vehicleModels.updatedAt,
      })
      .from(vehicleModels)
      .leftJoin(brands, eq(vehicleModels.brandId, brands.id))
      .orderBy(brands.name, vehicleModels.name);

    return result;
  }

  async getVehicleModel(id: string): Promise<VehicleModel | undefined> {
    const [model] = await db.select().from(vehicleModels).where(eq(vehicleModels.id, id));
    return model || undefined;
  }

  async getVehicleModelsByBrand(brandId: string): Promise<VehicleModel[]> {
    return await db
      .select()
      .from(vehicleModels)
      .where(eq(vehicleModels.brandId, brandId))
      .orderBy(vehicleModels.name);
  }

  async createVehicleModel(data: InsertVehicleModel): Promise<VehicleModel> {
    const [model] = await db
      .insert(vehicleModels)
      .values(data)
      .returning();
    return model;
  }

  async updateVehicleModel(id: string, data: Partial<InsertVehicleModel>): Promise<VehicleModel | undefined> {
    const [updated] = await db
      .update(vehicleModels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vehicleModels.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteVehicleModel(id: string): Promise<void> {
    await db.delete(vehicleModels).where(eq(vehicleModels.id, id));
  }

  // ========================================
  // DRIVER DOCUMENT TYPES (Tipos de Documentos)
  // ========================================
  async getAllDriverDocumentTypes(): Promise<DriverDocumentType[]> {
    return await db.select().from(driverDocumentTypes).orderBy(driverDocumentTypes.name);
  }

  async getDriverDocumentType(id: string): Promise<DriverDocumentType | undefined> {
    const [docType] = await db.select().from(driverDocumentTypes).where(eq(driverDocumentTypes.id, id));
    return docType || undefined;
  }

  async createDriverDocumentType(data: InsertDriverDocumentType): Promise<DriverDocumentType> {
    const [docType] = await db
      .insert(driverDocumentTypes)
      .values(data)
      .returning();
    return docType;
  }

  async updateDriverDocumentType(id: string, data: Partial<InsertDriverDocumentType>): Promise<DriverDocumentType | undefined> {
    const [updated] = await db
      .update(driverDocumentTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(driverDocumentTypes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDriverDocumentType(id: string): Promise<void> {
    await db.delete(driverDocumentTypes).where(eq(driverDocumentTypes.id, id));
  }

  // ========================================
  // DRIVER DOCUMENTS (Documentos Enviados)
  // ========================================
  async getDriverDocuments(driverId: string): Promise<any[]> {
    const documents = await db
      .select({
        id: driverDocuments.id,
        driverId: driverDocuments.driverId,
        documentTypeId: driverDocuments.documentTypeId,
        documentTypeName: driverDocumentTypes.name,
        documentUrl: driverDocuments.documentUrl,
        status: driverDocuments.status,
        rejectionReason: driverDocuments.rejectionReason,
        // Campos de validação de documento (CNH)
        expirationDate: driverDocuments.expirationDate,
        isExpired: driverDocuments.isExpired,
        validationData: driverDocuments.validationData,
        // Campos de validação FaceMatch (Selfie)
        faceMatchScore: driverDocuments.faceMatchScore,
        faceMatchValidated: driverDocuments.faceMatchValidated,
        createdAt: driverDocuments.createdAt,
      })
      .from(driverDocuments)
      .leftJoin(driverDocumentTypes, eq(driverDocuments.documentTypeId, driverDocumentTypes.id))
      .where(eq(driverDocuments.driverId, driverId))
      .orderBy(driverDocuments.createdAt);

    return documents;
  }

  async createDriverDocument(data: InsertDriverDocument): Promise<DriverDocument> {
    const [document] = await db.insert(driverDocuments).values(data).returning();
    return document;
  }

  async updateDriverDocument(id: string, data: Partial<InsertDriverDocument>): Promise<DriverDocument | undefined> {
    const [updated] = await db
      .update(driverDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(driverDocuments.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDriverDocument(id: string): Promise<void> {
    await db.delete(driverDocuments).where(eq(driverDocuments.id, id));
  }

  // ========================================
  // DRIVER NOTES (Comentários/Notas)
  // ========================================
  async getDriverNotes(driverId: string): Promise<any[]> {
    const notes = await db
      .select({
        id: driverNotes.id,
        driverId: driverNotes.driverId,
        userId: driverNotes.userId,
        userName: users.nome,
        note: driverNotes.note,
        noteType: driverNotes.noteType,
        createdAt: driverNotes.createdAt,
      })
      .from(driverNotes)
      .leftJoin(users, eq(driverNotes.userId, users.id))
      .where(eq(driverNotes.driverId, driverId))
      .orderBy(desc(driverNotes.createdAt));

    return notes;
  }

  async createDriverNote(data: InsertDriverNote): Promise<DriverNote> {
    const [note] = await db.insert(driverNotes).values(data).returning();
    return note;
  }

  async deleteDriverNote(id: string): Promise<void> {
    await db.delete(driverNotes).where(eq(driverNotes.id, id));
  }

  async getDriverTrips(driverId: string): Promise<any[]> {
    const trips = await db
      .select({
        id: requests.id,
        requestNumber: requests.requestNumber,
        userId: requests.userId,
        driverId: requests.driverId,
        status: sql<string>`
          CASE
            WHEN ${requests.isCompleted} THEN 'completed'
            WHEN ${requests.isCancelled} THEN 'cancelled'
            WHEN ${requests.isTripStart} THEN 'in_progress'
            WHEN ${requests.isDriverArrived} THEN 'arrived'
            WHEN ${requests.isDriverStarted} THEN 'accepted'
            ELSE 'pending'
          END
        `,
        pickupAddress: requestPlaces.pickAddress,
        dropoffAddress: requestPlaces.dropAddress,
        distance: requests.totalDistance,
        totalTime: requests.totalTime,
        totalPrice: requests.requestEtaAmount, // Valor LÍQUIDO para o motorista (após comissão)
        // Ganho do motorista é o mesmo que totalPrice (já é o valor líquido)
        driverEarnings: requests.requestEtaAmount,
        // Comissão do app vem da tabela request_bills
        appCommission: requestBills.adminCommision,
        createdAt: requests.createdAt,
        completedAt: requests.completedAt,
        cancelledAt: requests.cancelledAt,
      })
      .from(requests)
      .leftJoin(requestPlaces, eq(requests.id, requestPlaces.requestId))
      .leftJoin(requestBills, eq(requests.id, requestBills.requestId))
      .leftJoin(serviceLocations, eq(requests.serviceLocationId, serviceLocations.id))
      .where(eq(requests.driverId, driverId))
      .orderBy(desc(requests.createdAt));

    return trips;
  }

  async getCompanyTrips(companyId: string): Promise<any[]> {
    const trips = await db
      .select({
        id: requests.id,
        requestNumber: requests.requestNumber,
        customerName: requests.customerName,
        userId: requests.userId,
        driverId: requests.driverId,
        driverName: drivers.name,
        status: sql<string>`
          CASE
            WHEN ${requests.isCompleted} THEN 'completed'
            WHEN ${requests.isCancelled} THEN 'cancelled'
            WHEN ${requests.isTripStart} THEN 'in_progress'
            WHEN ${requests.isDriverArrived} THEN 'arrived'
            WHEN ${requests.isDriverStarted} THEN 'accepted'
            ELSE 'pending'
          END
        `,
        pickupAddress: requestPlaces.pickAddress,
        dropoffAddress: requestPlaces.dropAddress,
        distance: requests.totalDistance,
        totalTime: requests.totalTime,
        totalPrice: requestBills.totalAmount, // Valor BRUTO (antes da comissão) para empresa
        appCommission: requestBills.adminCommision, // Comissão do app
        createdAt: requests.createdAt,
        completedAt: requests.completedAt,
        cancelledAt: requests.cancelledAt,
        cancelReason: requests.cancelReason,
      })
      .from(requests)
      .leftJoin(requestPlaces, eq(requests.id, requestPlaces.requestId))
      .leftJoin(requestBills, eq(requests.id, requestBills.requestId))
      .leftJoin(serviceLocations, eq(requests.serviceLocationId, serviceLocations.id))
      .leftJoin(drivers, eq(requests.driverId, drivers.id))
      .where(eq(requests.companyId, companyId))
      .orderBy(desc(requests.createdAt));

    return trips;
  }

  // ========================================
  // COMPANIES (Empresas)
  // ========================================
  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies).orderBy(companies.name);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByCnpj(cnpj: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.cnpj, cnpj));
    return company || undefined;
  }

  async getCompanyByEmail(email: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.email, email));
    return company || undefined;
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values(data)
      .returning();
    return company;
  }

  async updateCompany(id: string, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updated] = await db
      .update(companies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  // ========================================
  // CITY PRICES (Preços)
  // ========================================
  async getAllCityPrices(): Promise<any[]> {
    const result = await db
      .select({
        id: cityPrices.id,
        serviceLocationId: cityPrices.serviceLocationId,
        serviceLocationName: serviceLocations.name,
        vehicleTypeId: cityPrices.vehicleTypeId,
        vehicleTypeName: vehicleTypes.name,
        basePrice: cityPrices.basePrice,
        pricePerDistance: cityPrices.pricePerDistance,
        pricePerTime: cityPrices.pricePerTime,
        baseDistance: cityPrices.baseDistance,
        waitingChargePerMinute: cityPrices.waitingChargePerMinute,
        freeWaitingTimeMins: cityPrices.freeWaitingTimeMins,
        cancellationFee: cityPrices.cancellationFee,
        stopPrice: cityPrices.stopPrice,
        returnPrice: cityPrices.returnPrice,
        dynamicPrice: cityPrices.dynamicPrice,
        dynamicPriceActive: cityPrices.dynamicPriceActive,
        tipo: cityPrices.tipo,
        rotaIntermunicipalId: cityPrices.rotaIntermunicipalId,
        rotaIntermunicipalNome: rotasIntermunicipais.nomeRota,
        active: cityPrices.active,
        createdAt: cityPrices.createdAt,
        updatedAt: cityPrices.updatedAt,
      })
      .from(cityPrices)
      .leftJoin(serviceLocations, eq(cityPrices.serviceLocationId, serviceLocations.id))
      .leftJoin(vehicleTypes, eq(cityPrices.vehicleTypeId, vehicleTypes.id))
      .leftJoin(rotasIntermunicipais, eq(cityPrices.rotaIntermunicipalId, rotasIntermunicipais.id));

    return result;
  }

  async getCityPricesByLocation(serviceLocationId: string): Promise<CityPrice[]> {
    return await db.select().from(cityPrices).where(eq(cityPrices.serviceLocationId, serviceLocationId));
  }

  async getCityPrice(id: string): Promise<CityPrice | undefined> {
    const [price] = await db.select().from(cityPrices).where(eq(cityPrices.id, id));
    return price || undefined;
  }

  async getCityPriceByLocationAndVehicle(serviceLocationId: string, vehicleTypeId: string): Promise<CityPrice | undefined> {
    const [price] = await db
      .select()
      .from(cityPrices)
      .where(
        and(
          eq(cityPrices.serviceLocationId, serviceLocationId),
          eq(cityPrices.vehicleTypeId, vehicleTypeId)
        )
      );
    return price || undefined;
  }

  async createCityPrice(data: InsertCityPrice): Promise<CityPrice> {
    const [price] = await db
      .insert(cityPrices)
      .values(data)
      .returning();
    return price;
  }

  async updateCityPrice(id: string, data: Partial<InsertCityPrice>): Promise<CityPrice | undefined> {
    const [updated] = await db
      .update(cityPrices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cityPrices.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCityPrice(id: string): Promise<void> {
    await db.delete(cityPrices).where(eq(cityPrices.id, id));
  }

  // ========================================
  // DRIVERS
  // ========================================
  async getAllDrivers(): Promise<any[]> {
    const result = await db
      .select({
        id: drivers.id,
        userId: drivers.userId,
        name: drivers.name,
        cpf: drivers.cpf,
        email: drivers.email,
        mobile: drivers.mobile,
        phone: drivers.mobile, // Alias para compatibilidade com o mapa
        carModel: drivers.carModel,
        carNumber: drivers.carNumber,
        carColor: drivers.carColor,
        carYear: drivers.carYear,
        brandId: drivers.brandId,
        modelId: drivers.modelId,
        serviceLocationId: drivers.serviceLocationId,
        cityId: drivers.serviceLocationId, // Alias para compatibilidade com o mapa
        serviceLocationName: serviceLocations.name,
        vehicleTypeId: drivers.vehicleTypeId,
        vehicleTypeName: vehicleTypes.name,
        active: drivers.active,
        approve: drivers.approve,
        available: drivers.available,
        onDelivery: drivers.onDelivery,
        rating: drivers.rating,
        latitude: drivers.latitude,
        longitude: drivers.longitude,
        createdAt: drivers.createdAt,
        updatedAt: drivers.updatedAt,
        // Campos de antecedentes criminais
        hasCriminalRecords: drivers.hasCriminalRecords,
        criminalRecords: drivers.criminalRecords,
        criminalCheckDate: drivers.criminalCheckDate,
        // Campo de bloqueio de entregas
        deliveriesBlocked: drivers.deliveriesBlocked,
      })
      .from(drivers)
      .leftJoin(serviceLocations, eq(drivers.serviceLocationId, serviceLocations.id))
      .leftJoin(vehicleTypes, eq(drivers.vehicleTypeId, vehicleTypes.id))
      .orderBy(desc(drivers.createdAt));

    // Converter latitude/longitude de string para number para compatibilidade com o mapa
    return result.map(driver => ({
      ...driver,
      currentLatitude: driver.latitude ? parseFloat(driver.latitude) : null,
      currentLongitude: driver.longitude ? parseFloat(driver.longitude) : null,
    }));
  }

  async getDriver(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver || undefined;
  }

  async getDriverByUserId(userId: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId));
    return driver || undefined;
  }

  async getDriverByMobile(mobile: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.mobile, mobile));
    return driver || undefined;
  }

  async getDriverByEmail(email: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.email, email));
    return driver || undefined;
  }

  async getDriversByLocation(serviceLocationId: string): Promise<Driver[]> {
    return await db.select().from(drivers).where(eq(drivers.serviceLocationId, serviceLocationId));
  }

  async getAvailableDrivers(serviceLocationId: string, vehicleTypeId: string): Promise<Driver[]> {
    return await db
      .select()
      .from(drivers)
      .where(
        and(
          eq(drivers.serviceLocationId, serviceLocationId),
          eq(drivers.vehicleTypeId, vehicleTypeId),
          eq(drivers.available, true),
          eq(drivers.approve, true),
          eq(drivers.active, true),
          or(eq(drivers.deliveriesBlocked, false), isNull(drivers.deliveriesBlocked))
        )
      );
  }

  async createDriver(data: InsertDriver): Promise<Driver> {
    const [driver] = await db
      .insert(drivers)
      .values(data)
      .returning();
    return driver;
  }

  async updateDriver(id: string, data: Partial<InsertDriver>): Promise<Driver | undefined> {
    const [updated] = await db
      .update(drivers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(drivers.id, id))
      .returning();
    return updated || undefined;
  }

  async updateDriverLocation(id: string, latitude: string, longitude: string): Promise<void> {
    await db
      .update(drivers)
      .set({ latitude, longitude, lastHeartbeat: new Date(), updatedAt: new Date() })
      .where(eq(drivers.id, id));
  }

  async deleteDriver(id: string): Promise<void> {
    await db.delete(drivers).where(eq(drivers.id, id));
  }

  // ========================================
  // REQUESTS (Corridas)
  // ========================================
  async getAllRequests(): Promise<Request[]> {
    return await db.select().from(requests).orderBy(desc(requests.createdAt));
  }

  async getRequest(id: string): Promise<Request | undefined> {
    const [request] = await db.select().from(requests).where(eq(requests.id, id));
    return request || undefined;
  }

  async getRequestByNumber(requestNumber: string): Promise<Request | undefined> {
    const [request] = await db.select().from(requests).where(eq(requests.requestNumber, requestNumber));
    return request || undefined;
  }

  async getUserRequests(userId: string): Promise<Request[]> {
    return await db
      .select()
      .from(requests)
      .where(eq(requests.userId, userId))
      .orderBy(desc(requests.createdAt));
  }

  async getDriverRequests(driverId: string): Promise<Request[]> {
    return await db
      .select()
      .from(requests)
      .where(eq(requests.driverId, driverId))
      .orderBy(desc(requests.createdAt));
  }

  async getActiveUserRequest(userId: string): Promise<Request | undefined> {
    const [request] = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.userId, userId),
          eq(requests.isCompleted, false),
          eq(requests.isCancelled, false)
        )
      )
      .orderBy(desc(requests.createdAt))
      .limit(1);
    return request || undefined;
  }

  async getActiveDriverRequest(driverId: string): Promise<Request | undefined> {
    const [request] = await db
      .select()
      .from(requests)
      .where(
        and(
          eq(requests.driverId, driverId),
          eq(requests.isCompleted, false),
          eq(requests.isCancelled, false)
        )
      )
      .orderBy(desc(requests.createdAt))
      .limit(1);
    return request || undefined;
  }

  async createRequest(data: InsertRequest): Promise<Request> {
    const [request] = await db
      .insert(requests)
      .values(data)
      .returning();
    return request;
  }

  async updateRequest(id: string, data: Partial<InsertRequest>): Promise<Request | undefined> {
    const [updated] = await db
      .update(requests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(requests.id, id))
      .returning();
    return updated || undefined;
  }

  // ========================================
  // CANCELLATION REASONS
  // ========================================
  async getCancellationReasons(userType: string): Promise<CancellationReason[]> {
    return await db
      .select()
      .from(cancellationReasons)
      .where(
        and(
          eq(cancellationReasons.userType, userType),
          eq(cancellationReasons.active, true)
        )
      );
  }

  // ========================================
  // SETTINGS
  // ========================================
  async getSettings(): Promise<Settings | undefined> {
    const [settingsRow] = await db.select().from(settings).limit(1);
    return settingsRow || undefined;
  }

  async updateSettings(data: Partial<InsertSettings>): Promise<Settings | undefined> {
    // Get the current settings first
    const currentSettings = await this.getSettings();

    if (!currentSettings) {
      // If no settings exist, create them
      const [newSettings] = await db.insert(settings).values({
        ...data,
        updatedAt: new Date(),
      }).returning();
      return newSettings;
    }

    // Update existing settings
    const [updated] = await db
      .update(settings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(settings.id, currentSettings.id))
      .returning();
    return updated || undefined;
  }

  // ========================================
  // PASSWORD RESET
  // ========================================
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date, userType: string = "user"): Promise<void> {
    await db.insert(passwordResetTokens).values({
      userId,
      userType,
      token,
      expiresAt,
      used: false,
    });
  }

  async getPasswordResetToken(token: string): Promise<{ id: string; userId: string; userType: string; expiresAt: Date; used: boolean } | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);

    return resetToken || undefined;
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    const now = new Date();
    await db
      .delete(passwordResetTokens)
      .where(
        sql`${passwordResetTokens.expiresAt} < ${now} OR ${passwordResetTokens.used} = true`
      );
  }

  // ========================================
  // COMMISSION TIERS
  // ========================================
  async getAllCommissionTiers(): Promise<CommissionTier[]> {
    return await db
      .select()
      .from(commissionTiers)
      .orderBy(commissionTiers.minDeliveries);
  }

  async getCommissionTier(id: string): Promise<CommissionTier | undefined> {
    const [tier] = await db
      .select()
      .from(commissionTiers)
      .where(eq(commissionTiers.id, id));
    return tier || undefined;
  }

  async createCommissionTier(data: InsertCommissionTier): Promise<CommissionTier> {
    const [tier] = await db
      .insert(commissionTiers)
      .values(data)
      .returning();
    return tier;
  }

  async updateCommissionTier(id: string, data: Partial<InsertCommissionTier>): Promise<CommissionTier | undefined> {
    const [updated] = await db
      .update(commissionTiers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(commissionTiers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCommissionTier(id: string): Promise<void> {
    await db.delete(commissionTiers).where(eq(commissionTiers.id, id));
  }

  async getDriverCommissionPercentage(driverId: string): Promise<number> {
    // Buscar driver
    const driver = await this.getDriver(driverId);
    if (!driver) return 20; // Default fallback

    // Buscar configurações
    const settings = await this.getSettings();

    // Se comissão está desabilitada, retorna 0
    if (settings && !settings.enableCommission) {
      return 0;
    }

    const monthlyCount = driver.monthlyDeliveryCount || 0;

    // Buscar todas as faixas ativas ordenadas por minDeliveries
    const tiers = await db
      .select()
      .from(commissionTiers)
      .where(eq(commissionTiers.active, true))
      .orderBy(commissionTiers.minDeliveries);

    // Se não há faixas, usar comissão padrão
    if (tiers.length === 0) {
      return settings?.adminCommissionPercentage
        ? parseFloat(settings.adminCommissionPercentage)
        : 20;
    }

    // Encontrar a faixa apropriada
    let applicableTier = null;
    for (const tier of tiers) {
      if (monthlyCount >= tier.minDeliveries) {
        // Se não tem máximo OU está dentro do máximo
        if (tier.maxDeliveries === null || monthlyCount <= tier.maxDeliveries) {
          applicableTier = tier;
          break;
        }
      }
    }

    // Se encontrou uma faixa, usa ela, senão usa a última faixa ou default
    if (applicableTier) {
      return parseFloat(applicableTier.commissionPercentage);
    }

    // Se passou de todas as faixas, usa a última
    const lastTier = tiers[tiers.length - 1];
    return parseFloat(lastTier.commissionPercentage);
  }

  async incrementDriverMonthlyDeliveries(driverId: string): Promise<void> {
    await db
      .update(drivers)
      .set({
        monthlyDeliveryCount: sql`${drivers.monthlyDeliveryCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(drivers.id, driverId));
  }

  async resetMonthlyDeliveryCounters(): Promise<void> {
    console.log("🔄 Resetando contadores mensais de entregas...");

    await db
      .update(drivers)
      .set({
        monthlyDeliveryCount: 0,
        lastMonthlyReset: new Date(),
        updatedAt: new Date(),
      });

    console.log("✅ Contadores mensais resetados com sucesso!");
  }

  // ========================================
  // ROTAS INTERMUNICIPAIS
  // ========================================
  async getAllRotasIntermunicipais(): Promise<any[]> {
    const result = await db
      .select({
        id: rotasIntermunicipais.id,
        nomeRota: rotasIntermunicipais.nomeRota,
        cidadeOrigemId: rotasIntermunicipais.cidadeOrigemId,
        cidadeDestinoId: rotasIntermunicipais.cidadeDestinoId,
        cidadeOrigemNome: sql<string>`origem.name`,
        cidadeDestinoNome: sql<string>`destino.name`,
        distanciaKm: rotasIntermunicipais.distanciaKm,
        tempoEstimadoMinutos: rotasIntermunicipais.tempoMedioMinutos, // Mapeado para compatibilidade com app mobile
        ativo: rotasIntermunicipais.ativa, // Mapeado: ativa -> ativo
        createdAt: rotasIntermunicipais.createdAt,
        updatedAt: rotasIntermunicipais.updatedAt,
      })
      .from(rotasIntermunicipais)
      .leftJoin(
        sql`service_locations as origem`,
        sql`${rotasIntermunicipais.cidadeOrigemId} = origem.id`
      )
      .leftJoin(
        sql`service_locations as destino`,
        sql`${rotasIntermunicipais.cidadeDestinoId} = destino.id`
      )
      .orderBy(rotasIntermunicipais.nomeRota);

    return result;
  }

  async getRotasComEntregadoresAtivos(): Promise<any[]> {
    // Buscar rotas que têm pelo menos um entregador ativo configurado
    const result = await db
      .select({
        id: rotasIntermunicipais.id,
        nomeRota: rotasIntermunicipais.nomeRota,
        cidadeOrigemId: rotasIntermunicipais.cidadeOrigemId,
        cidadeDestinoId: rotasIntermunicipais.cidadeDestinoId,
        cidadeOrigemNome: sql<string>`origem.name`,
        cidadeDestinoNome: sql<string>`destino.name`,
        distanciaKm: rotasIntermunicipais.distanciaKm,
        tempoMedioMinutos: rotasIntermunicipais.tempoMedioMinutos, // ✅ Nome do campo conforme esperado no frontend entregas-intermunicipais
        ativa: rotasIntermunicipais.ativa, // ✅ Retorna como "ativa" (consistente com frontend)
        // Contar quantos entregadores ativos têm nessa rota
        totalEntregadores: sql<number>`COUNT(DISTINCT ${entregadorRotas.entregadorId})::int`,
        // Agregar todos os dias da semana disponíveis (união de todos os entregadores)
        diasSemana: sql<number[]>`ARRAY(SELECT DISTINCT unnest(array_agg(${entregadorRotas.diasSemana})) ORDER BY 1)`,
      })
      .from(rotasIntermunicipais)
      .leftJoin(
        sql`service_locations as origem`,
        sql`${rotasIntermunicipais.cidadeOrigemId} = origem.id`
      )
      .leftJoin(
        sql`service_locations as destino`,
        sql`${rotasIntermunicipais.cidadeDestinoId} = destino.id`
      )
      .innerJoin(
        entregadorRotas,
        and(
          eq(entregadorRotas.rotaId, rotasIntermunicipais.id),
          eq(entregadorRotas.ativa, true)
        )
      )
      .where(eq(rotasIntermunicipais.ativa, true))
      .groupBy(
        rotasIntermunicipais.id,
        rotasIntermunicipais.nomeRota,
        rotasIntermunicipais.cidadeOrigemId,
        rotasIntermunicipais.cidadeDestinoId,
        rotasIntermunicipais.distanciaKm,
        rotasIntermunicipais.tempoMedioMinutos,
        rotasIntermunicipais.ativa,
        sql`origem.name`,
        sql`destino.name`
      )
      .orderBy(rotasIntermunicipais.nomeRota);

    return result;
  }

  async getRotaIntermunicipal(id: string): Promise<RotaIntermunicipal | undefined> {
    const [rota] = await db
      .select()
      .from(rotasIntermunicipais)
      .where(eq(rotasIntermunicipais.id, id));
    return rota || undefined;
  }

  async createRotaIntermunicipal(data: InsertRotaIntermunicipal): Promise<RotaIntermunicipal> {
    const [rota] = await db
      .insert(rotasIntermunicipais)
      .values(data)
      .returning();
    return rota;
  }

  async updateRotaIntermunicipal(id: string, data: Partial<InsertRotaIntermunicipal>): Promise<RotaIntermunicipal | undefined> {
    const [updated] = await db
      .update(rotasIntermunicipais)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rotasIntermunicipais.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRotaIntermunicipal(id: string): Promise<void> {
    await db.delete(rotasIntermunicipais).where(eq(rotasIntermunicipais.id, id));
  }

  // ========================================
  // ENTREGAS INTERMUNICIPAIS
  // ========================================
  async getAllEntregasIntermunicipais(): Promise<any[]> {
    const result = await db
      .select({
        id: entregasIntermunicipais.id,
        empresaId: entregasIntermunicipais.empresaId,
        empresaNome: companies.name,
        rotaId: entregasIntermunicipais.rotaId,
        rotaNome: rotasIntermunicipais.nomeRota,
        precoId: entregasIntermunicipais.precoId,
        numeroPedido: entregasIntermunicipais.numeroPedido,
        dataAgendada: entregasIntermunicipais.dataAgendada,
        enderecoColetaCompleto: entregasIntermunicipais.enderecoColetaCompleto,
        enderecoEntregaCompleto: entregasIntermunicipais.enderecoEntregaCompleto,
        destinatarioNome: entregasIntermunicipais.destinatarioNome,
        destinatarioTelefone: entregasIntermunicipais.destinatarioTelefone,
        quantidadePacotes: entregasIntermunicipais.quantidadePacotes,
        pesoTotalKg: entregasIntermunicipais.pesoTotalKg,
        valorTotal: entregasIntermunicipais.valorTotal,
        status: entregasIntermunicipais.status,
        viagemId: entregasIntermunicipais.viagemId,
        createdAt: entregasIntermunicipais.createdAt,
        updatedAt: entregasIntermunicipais.updatedAt,
      })
      .from(entregasIntermunicipais)
      .leftJoin(companies, eq(entregasIntermunicipais.empresaId, companies.id))
      .leftJoin(rotasIntermunicipais, eq(entregasIntermunicipais.rotaId, rotasIntermunicipais.id))
      .orderBy(desc(entregasIntermunicipais.createdAt));

    return result;
  }

  async getEntregasIntermunicipasByEmpresa(empresaId: string): Promise<any[]> {
    const result = await db
      .select({
        id: entregasIntermunicipais.id,
        empresaId: entregasIntermunicipais.empresaId,
        rotaId: entregasIntermunicipais.rotaId,
        rotaNome: rotasIntermunicipais.nomeRota,
        numeroPedido: entregasIntermunicipais.numeroPedido,
        dataAgendada: entregasIntermunicipais.dataAgendada,
        enderecoColetaCompleto: entregasIntermunicipais.enderecoColetaCompleto,
        enderecoEntregaCompleto: entregasIntermunicipais.enderecoEntregaCompleto,
        destinatarioNome: entregasIntermunicipais.destinatarioNome,
        destinatarioTelefone: entregasIntermunicipais.destinatarioTelefone,
        quantidadePacotes: entregasIntermunicipais.quantidadePacotes,
        pesoTotalKg: entregasIntermunicipais.pesoTotalKg,
        valorTotal: entregasIntermunicipais.valorTotal,
        status: entregasIntermunicipais.status,
        viagemId: entregasIntermunicipais.viagemId,
        motoristaName: drivers.name,
        createdAt: entregasIntermunicipais.createdAt,
        updatedAt: entregasIntermunicipais.updatedAt,
      })
      .from(entregasIntermunicipais)
      .leftJoin(rotasIntermunicipais, eq(entregasIntermunicipais.rotaId, rotasIntermunicipais.id))
      .leftJoin(viagensIntermunicipais, eq(entregasIntermunicipais.viagemId, viagensIntermunicipais.id))
      .leftJoin(drivers, eq(viagensIntermunicipais.entregadorId, drivers.id))
      .where(eq(entregasIntermunicipais.empresaId, empresaId))
      .orderBy(desc(entregasIntermunicipais.createdAt));

    return result;
  }

  async getEntregasIntermunicipasByRota(rotaId: string, dataAgendada: string): Promise<any[]> {
    const result = await db
      .select()
      .from(entregasIntermunicipais)
      .where(
        and(
          eq(entregasIntermunicipais.rotaId, rotaId),
          eq(entregasIntermunicipais.dataAgendada, dataAgendada)
        )
      )
      .orderBy(entregasIntermunicipais.createdAt);

    return result;
  }

  async getEntregaIntermunicipal(id: string): Promise<EntregaIntermunicipal | undefined> {
    const [entrega] = await db
      .select()
      .from(entregasIntermunicipais)
      .where(eq(entregasIntermunicipais.id, id));
    return entrega || undefined;
  }

  async createEntregaIntermunicipal(data: InsertEntregaIntermunicipal): Promise<EntregaIntermunicipal> {
    const [entrega] = await db
      .insert(entregasIntermunicipais)
      .values(data)
      .returning();
    return entrega;
  }

  async updateEntregaIntermunicipal(id: string, data: Partial<InsertEntregaIntermunicipal>): Promise<EntregaIntermunicipal | undefined> {
    const [updated] = await db
      .update(entregasIntermunicipais)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(entregasIntermunicipais.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEntregaIntermunicipal(id: string): Promise<void> {
    await db.delete(entregasIntermunicipais).where(eq(entregasIntermunicipais.id, id));
  }

  // ========================================
  // PARADAS DE ENTREGA INTERMUNICIPAL
  // ========================================
  async getParadasByEntrega(entregaId: string): Promise<any[]> {
    const result = await db
      .select()
      .from(entregasIntermunicipalParadas)
      .where(eq(entregasIntermunicipalParadas.entregaId, entregaId))
      .orderBy(entregasIntermunicipalParadas.ordem);
    return result;
  }

  async createParadaEntrega(data: any): Promise<any> {
    const [parada] = await db
      .insert(entregasIntermunicipalParadas)
      .values(data)
      .returning();
    return parada;
  }

  async createParadasEntrega(paradas: any[]): Promise<any[]> {
    const result = await db
      .insert(entregasIntermunicipalParadas)
      .values(paradas)
      .returning();
    return result;
  }

  // ========================================
  // VIAGENS INTERMUNICIPAIS
  // ========================================
  async getAllViagensIntermunicipais(): Promise<any[]> {
    const result = await db
      .select({
        id: viagensIntermunicipais.id,
        entregadorId: viagensIntermunicipais.entregadorId,
        entregadorNome: drivers.name,
        rotaId: viagensIntermunicipais.rotaId,
        rotaNome: rotasIntermunicipais.nomeRota,
        dataViagem: viagensIntermunicipais.dataViagem,
        status: viagensIntermunicipais.status,
        capacidadePacotesTotal: viagensIntermunicipais.capacidadePacotesTotal,
        capacidadePesoKgTotal: viagensIntermunicipais.capacidadePesoKgTotal,
        pacotesAceitos: viagensIntermunicipais.pacotesAceitos,
        pesoAceitoKg: viagensIntermunicipais.pesoAceitoKg,
        horarioSaidaPlanejado: viagensIntermunicipais.horarioSaidaPlanejado,
        horarioSaidaReal: viagensIntermunicipais.horarioSaidaReal,
        horarioChegadaPrevisto: viagensIntermunicipais.horarioChegadaPrevisto,
        horarioChegadaReal: viagensIntermunicipais.horarioChegadaReal,
        createdAt: viagensIntermunicipais.createdAt,
        updatedAt: viagensIntermunicipais.updatedAt,
      })
      .from(viagensIntermunicipais)
      .leftJoin(drivers, eq(viagensIntermunicipais.entregadorId, drivers.id))
      .leftJoin(rotasIntermunicipais, eq(viagensIntermunicipais.rotaId, rotasIntermunicipais.id))
      .orderBy(desc(viagensIntermunicipais.dataViagem));

    return result;
  }

  async getViagensIntermunicipasByEntregador(entregadorId: string): Promise<any[]> {
    const result = await db
      .select({
        id: viagensIntermunicipais.id,
        rotaId: viagensIntermunicipais.rotaId,
        rotaNome: rotasIntermunicipais.nomeRota,
        distanciaKm: rotasIntermunicipais.distanciaKm,
        tempoEstimadoMinutos: rotasIntermunicipais.tempoMedioMinutos,
        dataViagem: viagensIntermunicipais.dataViagem,
        status: viagensIntermunicipais.status,
        capacidadePacotesTotal: viagensIntermunicipais.capacidadePacotesTotal,
        capacidadePesoKgTotal: viagensIntermunicipais.capacidadePesoKgTotal,
        pacotesAceitos: viagensIntermunicipais.pacotesAceitos,
        pesoAceitoKg: viagensIntermunicipais.pesoAceitoKg,
        horarioSaidaPlanejado: viagensIntermunicipais.horarioSaidaPlanejado,
        horarioSaidaReal: viagensIntermunicipais.horarioSaidaReal,
        createdAt: viagensIntermunicipais.createdAt,
        updatedAt: viagensIntermunicipais.updatedAt,
      })
      .from(viagensIntermunicipais)
      .leftJoin(rotasIntermunicipais, eq(viagensIntermunicipais.rotaId, rotasIntermunicipais.id))
      .where(
        and(
          eq(viagensIntermunicipais.entregadorId, entregadorId),
          sql`${viagensIntermunicipais.status} != 'cancelada'`
        )
      )
      .orderBy(desc(viagensIntermunicipais.dataViagem));

    return result;
  }

  async getViagensIntermunicipasByRota(rotaId: string, dataViagem: string): Promise<any[]> {
    const result = await db
      .select()
      .from(viagensIntermunicipais)
      .where(
        and(
          eq(viagensIntermunicipais.rotaId, rotaId),
          sql`${viagensIntermunicipais.dataViagem}::text = ${dataViagem}`
        )
      )
      .orderBy(viagensIntermunicipais.horarioSaidaPlanejado);

    return result;
  }

  async getViagemIntermunicipal(id: string): Promise<ViagemIntermunicipal | undefined> {
    const [viagem] = await db
      .select()
      .from(viagensIntermunicipais)
      .where(eq(viagensIntermunicipais.id, id));
    return viagem || undefined;
  }

  async createViagemIntermunicipal(data: InsertViagemIntermunicipal): Promise<ViagemIntermunicipal> {
    const [viagem] = await db
      .insert(viagensIntermunicipais)
      .values(data)
      .returning();
    return viagem;
  }

  async updateViagemIntermunicipal(id: string, data: Partial<InsertViagemIntermunicipal>): Promise<ViagemIntermunicipal | undefined> {
    const [updated] = await db
      .update(viagensIntermunicipais)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(viagensIntermunicipais.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteViagemIntermunicipal(id: string): Promise<void> {
    await db.delete(viagensIntermunicipais).where(eq(viagensIntermunicipais.id, id));
  }

  async getMotoristasComRotaConfigurada(rotaId: string, dataViagem: string): Promise<any[]> {
    // Calcular dia da semana da data (1=Segunda, 7=Domingo)
    const dateParts = dataViagem.split('-');
    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const diaSemana = date.getDay() === 0 ? 7 : date.getDay(); // Converter domingo de 0 para 7

    const result = await db
      .select({
        id: drivers.id,
        name: drivers.name,
        fcmToken: drivers.fcmToken,
      })
      .from(entregadorRotas)
      .innerJoin(drivers, eq(entregadorRotas.entregadorId, drivers.id))
      .where(
        and(
          eq(entregadorRotas.rotaId, rotaId),
          eq(entregadorRotas.ativa, true), // Rota ativa
          sql`${diaSemana} = ANY(${entregadorRotas.diasSemana})`, // Dia da semana configurado
          eq(drivers.approve, true), // Motorista aprovado
          eq(drivers.available, true), // Motorista disponível
          or(eq(drivers.deliveriesBlocked, false), isNull(drivers.deliveriesBlocked)) // Entregas não bloqueadas
        )
      );

    return result;
  }

  // ========================================
  // VIAGEM COLETAS
  // ========================================
  async getViagemColetas(viagemId: string): Promise<any[]> {
    console.log(`🔍 [storage.getViagemColetas] Buscando coletas para viagem ${viagemId}`);

    // Buscar coletas da tabela viagem_coletas com join de entrega e empresa
    // IMPORTANTE: Filtrar apenas entregas NÃO canceladas (inclui entregas entregues para cálculo de valor)
    const coletas = await db
      .select({
        coleta: viagemColetas,
        entrega: entregasIntermunicipais,
        empresa: companies
      })
      .from(viagemColetas)
      .leftJoin(entregasIntermunicipais, eq(viagemColetas.entregaId, entregasIntermunicipais.id))
      .leftJoin(companies, eq(entregasIntermunicipais.empresaId, companies.id))
      .where(
        and(
          eq(viagemColetas.viagemId, viagemId),
          sql`${entregasIntermunicipais.status} != 'cancelada'`
        )
      )
      .orderBy(viagemColetas.ordemColeta);

    console.log(`📦 [storage.getViagemColetas] Coletas encontradas: ${coletas.length}`);

    // Montar estrutura de retorno
    const coletasFormatadas = coletas.map(({ coleta, entrega, empresa }) => ({
      id: coleta.id, // ← ID correto da coleta na tabela viagem_coletas
      ordem_coleta: coleta.ordemColeta,
      viagem_id: coleta.viagemId,
      entrega_id: coleta.entregaId,
      empresa_id: entrega?.empresaId,
      empresa_nome: empresa?.name || 'Empresa não encontrada',
      empresa_endereco_completo: empresa ? `${empresa.street}, ${empresa.number} - ${empresa.neighborhood}, ${empresa.city} - CEP: ${empresa.cep}` : null,
      empresa_logradouro: empresa?.street,
      empresa_numero: empresa?.number,
      empresa_bairro: empresa?.neighborhood,
      empresa_cidade: empresa?.city,
      empresa_cep: empresa?.cep,
      empresa_telefone: empresa?.phone,
      empresa_responsavel: empresa?.responsibleName,
      empresa_whatsapp: empresa?.responsibleWhatsapp,
      numero_pedido: entrega?.numeroPedido,
      endereco_completo: coleta.enderecoColeta,
      logradouro: coleta.enderecoColeta?.split(',')[0]?.trim(),
      quantidade_pacotes: entrega?.quantidadePacotes || 0,
      status: coleta.status, // ← STATUS REAL da tabela viagem_coletas
      horario_previsto: coleta.horarioPrevisto,
      horario_chegada: coleta.horarioChegada,
      horario_coleta: coleta.horarioColeta,
      observacoes: coleta.observacoes,
      motivo_falha: coleta.motivoFalha,
      foto_comprovante_url: coleta.fotoComprovanteUrl
    }));

    console.log(`✅ [storage.getViagemColetas] Coletas formatadas: ${coletasFormatadas.length}`);
    if (coletasFormatadas.length > 0) {
      console.log(`📋 [storage.getViagemColetas] Primeira coleta:`, {
        id: coletasFormatadas[0].id,
        empresa_nome: coletasFormatadas[0].empresa_nome,
        numero_pedido: coletasFormatadas[0].numero_pedido,
        status: coletasFormatadas[0].status
      });
    }
    return coletasFormatadas;
  }

  async getViagemColeta(id: string): Promise<ViagemColeta | undefined> {
    const [coleta] = await db
      .select()
      .from(viagemColetas)
      .where(eq(viagemColetas.id, id));
    return coleta || undefined;
  }

  async getViagemColetaByEntregaId(entregaId: string): Promise<ViagemColeta | undefined> {
    const [coleta] = await db
      .select()
      .from(viagemColetas)
      .where(eq(viagemColetas.entregaId, entregaId));
    return coleta || undefined;
  }

  async updateViagemColeta(id: string, data: Partial<InsertViagemColeta>): Promise<ViagemColeta | undefined> {
    const [updated] = await db
      .update(viagemColetas)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(viagemColetas.id, id))
      .returning();
    return updated || undefined;
  }

  async createViagemColeta(data: InsertViagemColeta): Promise<ViagemColeta> {
    const [coleta] = await db
      .insert(viagemColetas)
      .values(data)
      .returning();
    return coleta;
  }

  // ========================================
  // VIAGEM ENTREGAS
  // ========================================
  async getViagemEntregas(viagemId: string): Promise<any[]> {
    console.log(`🔍 [storage.getViagemEntregas] Buscando entregas para viagem ${viagemId}`);

    // Buscar entregas da tabela viagem_entregas com join de entrega intermunicipal
    // IMPORTANTE: Filtrar apenas entregas NÃO canceladas (inclui entregas entregues para cálculo de valor)
    const entregas = await db
      .select({
        viagemEntrega: viagemEntregas,
        entregaIntermu: entregasIntermunicipais
      })
      .from(viagemEntregas)
      .leftJoin(entregasIntermunicipais, eq(viagemEntregas.entregaId, entregasIntermunicipais.id))
      .where(
        and(
          eq(viagemEntregas.viagemId, viagemId),
          sql`${entregasIntermunicipais.status} != 'cancelada'`
        )
      )
      .orderBy(viagemEntregas.ordemEntrega);

    console.log(`📦 [storage.getViagemEntregas] Entregas encontradas: ${entregas.length}`);

    // Montar estrutura de retorno
    const entregasFormatadas = entregas.map(({ viagemEntrega, entregaIntermu }) => ({
      id: viagemEntrega.id, // ← ID correto da entrega na tabela viagem_entregas
      ordem_entrega: viagemEntrega.ordemEntrega,
      viagem_id: viagemEntrega.viagemId,
      entrega_id: viagemEntrega.entregaId,
      parada_id: viagemEntrega.paradaId,
      numero_pedido: entregaIntermu?.numeroPedido || '',
      endereco_completo: viagemEntrega.enderecoEntrega,
      logradouro: viagemEntrega.enderecoEntrega?.split(',')[0]?.trim(),
      destinatario_nome: viagemEntrega.destinatarioNome,
      destinatario_telefone: viagemEntrega.destinatarioTelefone,
      status: viagemEntrega.status, // ← STATUS REAL da tabela viagem_entregas
      horario_previsto: viagemEntrega.horarioPrevisto,
      horario_chegada: viagemEntrega.horarioChegada,
      horario_entrega: viagemEntrega.horarioEntrega,
      nome_recebedor: viagemEntrega.nomeRecebedor,
      cpf_recebedor: viagemEntrega.cpfRecebedor,
      observacoes: viagemEntrega.observacoes,
      motivo_falha: viagemEntrega.motivoFalha,
      foto_comprovante_url: viagemEntrega.fotoComprovanteUrl,
      assinatura_url: viagemEntrega.assinaturaUrl
    }));

    console.log(`✅ [storage.getViagemEntregas] Entregas formatadas: ${entregasFormatadas.length}`);
    if (entregasFormatadas.length > 0) {
      console.log(`📋 [storage.getViagemEntregas] Primeira entrega:`, {
        id: entregasFormatadas[0].id,
        numero_pedido: entregasFormatadas[0].numero_pedido,
        destinatario: entregasFormatadas[0].destinatario_nome,
        status: entregasFormatadas[0].status
      });
    }
    return entregasFormatadas;
  }

  async getViagemEntrega(id: string): Promise<ViagemEntrega | undefined> {
    const [entrega] = await db
      .select()
      .from(viagemEntregas)
      .where(eq(viagemEntregas.id, id));
    return entrega || undefined;
  }

  async getViagemEntregaByEntregaId(entregaId: string): Promise<ViagemEntrega | undefined> {
    const [entrega] = await db
      .select()
      .from(viagemEntregas)
      .where(eq(viagemEntregas.entregaId, entregaId));
    return entrega || undefined;
  }

  async updateViagemEntrega(id: string, data: Partial<InsertViagemEntrega>): Promise<ViagemEntrega | undefined> {
    const [updated] = await db
      .update(viagemEntregas)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(viagemEntregas.id, id))
      .returning();
    return updated || undefined;
  }

  async createViagemEntrega(data: InsertViagemEntrega): Promise<ViagemEntrega> {
    const [entrega] = await db
      .insert(viagemEntregas)
      .values(data)
      .returning();
    return entrega;
  }

  // ========================================
  // ENTREGADOR ROTAS (Configuração de rotas do motorista)
  // ========================================
  async getAllEntregadorRotas(): Promise<any[]> {
    const result = await db
      .select({
        id: entregadorRotas.id,
        entregadorId: entregadorRotas.entregadorId,
        entregadorNome: drivers.name,
        rotaId: entregadorRotas.rotaId,
        rotaNome: rotasIntermunicipais.nomeRota,
        capacidadePacotes: entregadorRotas.capacidadePacotes,
        capacidadePesoKg: entregadorRotas.capacidadePesoKg,
        horarioSaidaPadrao: entregadorRotas.horarioSaida,
        ativo: entregadorRotas.ativa, // Mapeado: ativa -> ativo
        createdAt: entregadorRotas.createdAt,
        updatedAt: entregadorRotas.updatedAt,
      })
      .from(entregadorRotas)
      .leftJoin(drivers, eq(entregadorRotas.entregadorId, drivers.id))
      .leftJoin(rotasIntermunicipais, eq(entregadorRotas.rotaId, rotasIntermunicipais.id))
      .orderBy(desc(entregadorRotas.createdAt));
    return result;
  }

  async getEntregadorRotasByEntregador(entregadorId: string): Promise<any[]> {
    const result = await db
      .select({
        id: entregadorRotas.id,
        rotaId: entregadorRotas.rotaId,
        rotaNome: rotasIntermunicipais.nomeRota,
        cidadeOrigemId: rotasIntermunicipais.cidadeOrigemId,
        cidadeDestinoId: rotasIntermunicipais.cidadeDestinoId,
        cidadeOrigemNome: sql<string>`cidade_origem.name`,
        cidadeDestinoNome: sql<string>`cidade_destino.name`,
        distanciaKm: rotasIntermunicipais.distanciaKm,
        tempoEstimadoMinutos: rotasIntermunicipais.tempoMedioMinutos,

        // Campos da configuração do entregador
        capacidadePacotes: entregadorRotas.capacidadePacotes,
        capacidadePesoKg: entregadorRotas.capacidadePesoKg,
        diasSemana: entregadorRotas.diasSemana, // ✅ Campo adicionado
        horarioSaidaPadrao: entregadorRotas.horarioSaida,
        horarioChegada: entregadorRotas.horarioChegada,
        ativo: entregadorRotas.ativa, // Mapeado: ativa -> ativo (para o app mobile)
      })
      .from(entregadorRotas)
      .leftJoin(rotasIntermunicipais, eq(entregadorRotas.rotaId, rotasIntermunicipais.id))
      .leftJoin(sql`service_locations AS cidade_origem`, sql`${rotasIntermunicipais.cidadeOrigemId} = cidade_origem.id`)
      .leftJoin(sql`service_locations AS cidade_destino`, sql`${rotasIntermunicipais.cidadeDestinoId} = cidade_destino.id`)
      .where(eq(entregadorRotas.entregadorId, entregadorId))
      .orderBy(rotasIntermunicipais.nomeRota);
    return result;
  }

  async getEntregadorRota(id: string): Promise<EntregadorRota | undefined> {
    const [rota] = await db
      .select()
      .from(entregadorRotas)
      .where(eq(entregadorRotas.id, id));
    return rota || undefined;
  }

  async createEntregadorRota(data: InsertEntregadorRota): Promise<EntregadorRota> {
    const [rota] = await db
      .insert(entregadorRotas)
      .values(data)
      .returning();
    return rota;
  }

  async updateEntregadorRota(id: string, data: Partial<InsertEntregadorRota>): Promise<EntregadorRota | undefined> {
    const [updated] = await db
      .update(entregadorRotas)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(entregadorRotas.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteEntregadorRota(id: string): Promise<void> {
    await db.delete(entregadorRotas).where(eq(entregadorRotas.id, id));
  }

  // Buscar entregas disponíveis para um motorista (baseado nas suas rotas configuradas)
  async getEntregasDisponiveisParaEntregador(entregadorId: string, dataViagem: string): Promise<any[]> {
    // Primeiro buscar as rotas do motorista
    const rotasDoMotorista = await db
      .select({ rotaId: entregadorRotas.rotaId })
      .from(entregadorRotas)
      .where(
        and(
          eq(entregadorRotas.entregadorId, entregadorId),
          eq(entregadorRotas.ativa, true)
        )
      );

    if (rotasDoMotorista.length === 0) {
      return [];
    }

    const rotaIds = rotasDoMotorista.map(r => r.rotaId);

    // Buscar entregas disponíveis nessas rotas
    const result = await db
      .select({
        id: entregasIntermunicipais.id,
        numeroPedido: entregasIntermunicipais.numeroPedido,
        empresaId: entregasIntermunicipais.empresaId,
        empresaNome: companies.name,
        rotaId: entregasIntermunicipais.rotaId,
        rotaNome: rotasIntermunicipais.nomeRota,
        dataAgendada: entregasIntermunicipais.dataAgendada,
        enderecoColetaCompleto: entregasIntermunicipais.enderecoColetaCompleto,
        enderecoEntregaCompleto: entregasIntermunicipais.enderecoEntregaCompleto,
        destinatarioNome: entregasIntermunicipais.destinatarioNome,
        destinatarioTelefone: entregasIntermunicipais.destinatarioTelefone,
        quantidadePacotes: entregasIntermunicipais.quantidadePacotes,
        pesoTotalKg: entregasIntermunicipais.pesoTotalKg,
        valorTotal: entregasIntermunicipais.valorTotal,
        status: entregasIntermunicipais.status,
        descricaoConteudo: entregasIntermunicipais.descricaoConteudo,
        createdAt: entregasIntermunicipais.createdAt,
      })
      .from(entregasIntermunicipais)
      .leftJoin(companies, eq(entregasIntermunicipais.empresaId, companies.id))
      .leftJoin(rotasIntermunicipais, eq(entregasIntermunicipais.rotaId, rotasIntermunicipais.id))
      .where(
        and(
          sql`${entregasIntermunicipais.rotaId} = ANY(${rotaIds})`,
          sql`${entregasIntermunicipais.dataAgendada}::text = ${dataViagem}`,
          eq(entregasIntermunicipais.status, "aguardando_motorista")
        )
      )
      .orderBy(entregasIntermunicipais.createdAt);

    return result;
  }

  // Limpar token FCM inválido de motoristas e usuários
  async clearInvalidFcmToken(fcmToken: string): Promise<void> {
    // Limpar de motoristas
    await db
      .update(drivers)
      .set({ fcmToken: null })
      .where(eq(drivers.fcmToken, fcmToken));

    // Limpar de usuários
    await db
      .update(users)
      .set({ fcmToken: null })
      .where(eq(users.fcmToken, fcmToken));
  }

  // ========================================
  // NPS SURVEYS
  // ========================================
  async getAllNpsSurveys(): Promise<NpsSurvey[]> {
    return await db.select().from(npsSurveys).orderBy(desc(npsSurveys.createdAt));
  }

  async getNpsSurvey(id: string): Promise<NpsSurvey | undefined> {
    const [survey] = await db.select().from(npsSurveys).where(eq(npsSurveys.id, id));
    return survey || undefined;
  }

  async getNpsSurveyBySlug(slug: string): Promise<NpsSurvey | undefined> {
    const [survey] = await db.select().from(npsSurveys).where(eq(npsSurveys.publicSlug, slug));
    return survey || undefined;
  }

  async createNpsSurvey(data: InsertNpsSurvey): Promise<NpsSurvey> {
    const [survey] = await db.insert(npsSurveys).values(data).returning();
    return survey;
  }

  async updateNpsSurvey(id: string, data: Partial<InsertNpsSurvey>): Promise<NpsSurvey | undefined> {
    const [survey] = await db
      .update(npsSurveys)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(npsSurveys.id, id))
      .returning();
    return survey || undefined;
  }

  async deleteNpsSurvey(id: string): Promise<void> {
    await db.delete(npsSurveys).where(eq(npsSurveys.id, id));
  }

  // ========================================
  // NPS SURVEY ITEMS
  // ========================================
  async getNpsSurveyItems(surveyId: string): Promise<NpsSurveyItem[]> {
    return await db
      .select()
      .from(npsSurveyItems)
      .where(eq(npsSurveyItems.surveyId, surveyId))
      .orderBy(npsSurveyItems.displayOrder);
  }

  async getNpsSurveyItem(id: string): Promise<NpsSurveyItem | undefined> {
    const [item] = await db.select().from(npsSurveyItems).where(eq(npsSurveyItems.id, id));
    return item || undefined;
  }

  async createNpsSurveyItem(data: InsertNpsSurveyItem): Promise<NpsSurveyItem> {
    const [item] = await db.insert(npsSurveyItems).values(data).returning();
    return item;
  }

  async updateNpsSurveyItem(id: string, data: Partial<InsertNpsSurveyItem>): Promise<NpsSurveyItem | undefined> {
    const [item] = await db
      .update(npsSurveyItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(npsSurveyItems.id, id))
      .returning();
    return item || undefined;
  }

  async deleteNpsSurveyItem(id: string): Promise<void> {
    await db.delete(npsSurveyItems).where(eq(npsSurveyItems.id, id));
  }

  // ========================================
  // NPS RESPONSES
  // ========================================
  async getNpsResponsesBySurvey(surveyId: string): Promise<NpsResponse[]> {
    return await db
      .select()
      .from(npsResponses)
      .where(eq(npsResponses.surveyId, surveyId))
      .orderBy(desc(npsResponses.createdAt));
  }

  async createNpsResponse(data: InsertNpsResponse, ipAddress?: string, userAgent?: string): Promise<NpsResponse> {
    const [response] = await db
      .insert(npsResponses)
      .values({
        ...data,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      })
      .returning();
    return response;
  }

  // ========================================
  // NPS RESPONSE ITEMS
  // ========================================
  async getNpsResponseItems(responseId: string): Promise<NpsResponseItem[]> {
    return await db
      .select()
      .from(npsResponseItems)
      .where(eq(npsResponseItems.responseId, responseId));
  }

  async createNpsResponseItem(data: InsertNpsResponseItem): Promise<NpsResponseItem> {
    const [item] = await db.insert(npsResponseItems).values(data).returning();
    return item;
  }

  async createNpsResponseItems(items: InsertNpsResponseItem[]): Promise<NpsResponseItem[]> {
    if (items.length === 0) return [];
    return await db.insert(npsResponseItems).values(items).returning();
  }

  // ========================================
  // NPS STATISTICS
  // ========================================
  async getNpsSurveyStats(surveyId: string): Promise<{
    totalResponses: number;
    promoters: number;
    passives: number;
    detractors: number;
    npsScore: number;
    averageScores: { itemId: string; label: string; average: number }[];
    textResponses: { itemId: string; label: string; responses: string[] }[];
  }> {
    // Buscar todas as respostas da pesquisa
    const responses = await db
      .select()
      .from(npsResponses)
      .where(eq(npsResponses.surveyId, surveyId));

    const totalResponses = responses.length;

    // Buscar itens da pesquisa
    const surveyItems = await db
      .select()
      .from(npsSurveyItems)
      .where(eq(npsSurveyItems.surveyId, surveyId))
      .orderBy(npsSurveyItems.displayOrder);

    // Buscar todas as respostas de itens
    const responseIds = responses.map(r => r.id);
    let allResponseItems: NpsResponseItem[] = [];

    if (responseIds.length > 0) {
      allResponseItems = await db
        .select()
        .from(npsResponseItems)
        .where(inArray(npsResponseItems.responseId, responseIds));
    }

    // Calcular promotores, passivos e detratores (baseado no primeiro item NPS)
    let promoters = 0;
    let passives = 0;
    let detractors = 0;

    const npsItems = surveyItems.filter(item => item.type === "nps");
    if (npsItems.length > 0) {
      const firstNpsItemId = npsItems[0].id;
      const firstNpsResponses = allResponseItems.filter(ri => ri.surveyItemId === firstNpsItemId && ri.scoreValue !== null);

      for (const ri of firstNpsResponses) {
        const score = ri.scoreValue!;
        if (score >= 9) promoters++;
        else if (score >= 7) passives++;
        else detractors++;
      }
    }

    const npsScore = totalResponses > 0
      ? Math.round(((promoters - detractors) / totalResponses) * 100)
      : 0;

    // Calcular médias por item NPS
    const averageScores = surveyItems
      .filter(item => item.type === "nps")
      .map(item => {
        const itemResponses = allResponseItems.filter(
          ri => ri.surveyItemId === item.id && ri.scoreValue !== null
        );
        const sum = itemResponses.reduce((acc, ri) => acc + (ri.scoreValue || 0), 0);
        const average = itemResponses.length > 0 ? sum / itemResponses.length : 0;
        return {
          itemId: item.id,
          label: item.label,
          average: Math.round(average * 10) / 10,
        };
      });

    // Coletar respostas de texto
    const textResponses = surveyItems
      .filter(item => item.type === "text")
      .map(item => {
        const itemResponses = allResponseItems.filter(
          ri => ri.surveyItemId === item.id && ri.textValue
        );
        return {
          itemId: item.id,
          label: item.label,
          responses: itemResponses.map(ri => ri.textValue!).filter(Boolean),
        };
      });

    return {
      totalResponses,
      promoters,
      passives,
      detractors,
      npsScore,
      averageScores,
      textResponses,
    };
  }

  // ========================================
  // PROMOTION PROGRESS
  // ========================================
  async getPromotionProgress(promotionId: string, driverId: string): Promise<PromotionProgress | undefined> {
    const [progress] = await db
      .select()
      .from(promotionProgress)
      .where(
        and(
          eq(promotionProgress.promotionId, promotionId),
          eq(promotionProgress.driverId, driverId)
        )
      );
    return progress || undefined;
  }

  async getDriverPromotionProgress(driverId: string): Promise<PromotionProgress[]> {
    return db
      .select()
      .from(promotionProgress)
      .where(eq(promotionProgress.driverId, driverId));
  }

  async getActivePromotions(): Promise<Promotion[]> {
    return db
      .select()
      .from(promotions)
      .where(eq(promotions.active, true));
  }

  async getPromotionRanking(promotionId: string): Promise<{ driverId: string; deliveryCount: number; rank: number }[]> {
    const results = await db
      .select({
        driverId: promotionProgress.driverId,
        deliveryCount: promotionProgress.deliveryCount,
      })
      .from(promotionProgress)
      .where(eq(promotionProgress.promotionId, promotionId))
      .orderBy(desc(promotionProgress.deliveryCount));

    return results.map((r, index) => ({
      driverId: r.driverId,
      deliveryCount: r.deliveryCount,
      rank: index + 1,
    }));
  }

  async incrementPromotionProgress(driverId: string, deliveryDate: Date): Promise<void> {
    // Converter data para string no formato YYYY-MM-DD (timezone São Paulo)
    const spDate = new Date(deliveryDate.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dateString = spDate.toISOString().split('T')[0];

    // Buscar promoções ativas
    const activePromotions = await this.getActivePromotions();

    for (const promotion of activePromotions) {
      // Verificar se a data da entrega está nos dias válidos da promoção
      const validDates = promotion.validDates.split(',').map(d => d.trim());

      if (!validDates.includes(dateString)) {
        continue;
      }

      // Buscar ou criar registro de progresso
      let [progress] = await db
        .select()
        .from(promotionProgress)
        .where(
          and(
            eq(promotionProgress.promotionId, promotion.id),
            eq(promotionProgress.driverId, driverId)
          )
        );

      if (!progress) {
        // Criar novo registro
        [progress] = await db
          .insert(promotionProgress)
          .values({
            promotionId: promotion.id,
            driverId: driverId,
            deliveryCount: 1,
            goalReached: promotion.type === 'complete_and_win' && promotion.deliveryQuantity === 1,
            goalReachedAt: promotion.type === 'complete_and_win' && promotion.deliveryQuantity === 1 ? new Date() : null,
          })
          .returning();
      } else {
        // Incrementar contador existente
        const newCount = progress.deliveryCount + 1;
        const goalReached = promotion.type === 'complete_and_win'
          && promotion.deliveryQuantity !== null
          && newCount >= promotion.deliveryQuantity;

        await db
          .update(promotionProgress)
          .set({
            deliveryCount: newCount,
            goalReached: goalReached,
            goalReachedAt: goalReached && !progress.goalReached ? new Date() : progress.goalReachedAt,
            updatedAt: new Date(),
          })
          .where(eq(promotionProgress.id, progress.id));
      }
    }
  }

  // ========================================
  // WALLETS
  // ========================================

  // ID fixo da plataforma
  private PLATFORM_WALLET_OWNER_ID = "00000000-0000-0000-0000-000000000001";

  async getWallet(id: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id));
    return wallet || undefined;
  }

  async getWalletByOwner(ownerId: string, ownerType: string): Promise<Wallet | undefined> {
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.ownerId, ownerId), eq(wallets.ownerType, ownerType)));
    return wallet || undefined;
  }

  async createWallet(data: InsertWallet): Promise<Wallet> {
    const [wallet] = await db.insert(wallets).values(data).returning();
    return wallet;
  }

  async updateWalletBalance(walletId: string, availableBalance: string, blockedBalance?: string): Promise<Wallet | undefined> {
    const updateData: Partial<Wallet> = {
      availableBalance,
      updatedAt: new Date(),
    };
    if (blockedBalance !== undefined) {
      updateData.blockedBalance = blockedBalance;
    }
    const [wallet] = await db
      .update(wallets)
      .set(updateData)
      .where(eq(wallets.id, walletId))
      .returning();
    return wallet || undefined;
  }

  async getPlatformWallet(): Promise<Wallet | undefined> {
    return this.getWalletByOwner(this.PLATFORM_WALLET_OWNER_ID, "platform");
  }

  // ========================================
  // WALLET TRANSACTIONS
  // ========================================

  async getWalletTransactions(walletId: string, limit = 50, offset = 0): Promise<WalletTransaction[]> {
    return db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, walletId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getWalletTransaction(id: string): Promise<WalletTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.id, id));
    return transaction || undefined;
  }

  async createWalletTransaction(data: InsertWalletTransaction): Promise<WalletTransaction> {
    const [transaction] = await db.insert(walletTransactions).values(data).returning();
    return transaction;
  }

  async updateWalletTransaction(id: string, data: Partial<WalletTransaction>): Promise<WalletTransaction | undefined> {
    const [transaction] = await db
      .update(walletTransactions)
      .set(data)
      .where(eq(walletTransactions.id, id))
      .returning();
    return transaction || undefined;
  }

  // ========================================
  // CHARGES
  // ========================================

  async getCharge(id: string): Promise<Charge | undefined> {
    const [charge] = await db.select().from(charges).where(eq(charges.id, id));
    return charge || undefined;
  }

  async getChargeByAsaasId(asaasId: string): Promise<Charge | undefined> {
    // Primeiro busca pelo asaasId principal
    const [charge] = await db
      .select()
      .from(charges)
      .where(eq(charges.asaasId, asaasId));

    if (charge) return charge;

    // Se não encontrou, busca pelo pixAsaasId na metadata (para cobranças semanais pagas via PIX)
    const [chargeByPix] = await db
      .select()
      .from(charges)
      .where(sql`${charges.metadata}->>'pixAsaasId' = ${asaasId}`);

    return chargeByPix || undefined;
  }

  async getChargesByCompany(companyId: string, limit = 50): Promise<Charge[]> {
    return db
      .select()
      .from(charges)
      .where(eq(charges.companyId, companyId))
      .orderBy(desc(charges.createdAt))
      .limit(limit);
  }

  async getPendingWeeklyCharges(): Promise<Charge[]> {
    return db
      .select()
      .from(charges)
      .where(
        and(
          eq(charges.chargeType, "weekly"),
          eq(charges.status, "waiting_payment")
        )
      );
  }

  async getAllWeeklyCharges(limit = 100): Promise<(Charge & { companyName: string })[]> {
    const result = await db
      .select({
        id: charges.id,
        companyId: charges.companyId,
        walletId: charges.walletId,
        asaasId: charges.asaasId,
        asaasCustomerId: charges.asaasCustomerId,
        chargeType: charges.chargeType,
        paymentMethod: charges.paymentMethod,
        amount: charges.amount,
        netAmount: charges.netAmount,
        dueDate: charges.dueDate,
        paidAt: charges.paidAt,
        status: charges.status,
        pixCopyPaste: charges.pixCopyPaste,
        pixQrCodeUrl: charges.pixQrCodeUrl,
        boletoUrl: charges.boletoUrl,
        boletoBarcode: charges.boletoBarcode,
        boletoDigitableLine: charges.boletoDigitableLine,
        periodStart: charges.periodStart,
        periodEnd: charges.periodEnd,
        metadata: charges.metadata,
        createdAt: charges.createdAt,
        updatedAt: charges.updatedAt,
        companyName: companies.name,
      })
      .from(charges)
      .innerJoin(companies, eq(charges.companyId, companies.id))
      .where(eq(charges.chargeType, "weekly"))
      .orderBy(desc(charges.createdAt))
      .limit(limit);
    return result;
  }

  async createCharge(data: InsertCharge): Promise<Charge> {
    const [charge] = await db.insert(charges).values(data).returning();
    return charge;
  }

  async updateCharge(id: string, data: Partial<Charge>): Promise<Charge | undefined> {
    const [charge] = await db
      .update(charges)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(charges.id, id))
      .returning();
    return charge || undefined;
  }

  // ========================================
  // DELIVERY FINANCIALS
  // ========================================

  async getDeliveryFinancial(id: string): Promise<DeliveryFinancial | undefined> {
    const [financial] = await db
      .select()
      .from(deliveryFinancials)
      .where(eq(deliveryFinancials.id, id));
    return financial || undefined;
  }

  async getDeliveryFinancialByRequest(requestId: string): Promise<DeliveryFinancial | undefined> {
    const [financial] = await db
      .select()
      .from(deliveryFinancials)
      .where(eq(deliveryFinancials.requestId, requestId));
    return financial || undefined;
  }

  async getUnprocessedDeliveryFinancials(companyId: string): Promise<DeliveryFinancial[]> {
    return db
      .select()
      .from(deliveryFinancials)
      .where(
        and(
          eq(deliveryFinancials.companyId, companyId),
          eq(deliveryFinancials.processed, false)
        )
      );
  }

  async createDeliveryFinancial(data: InsertDeliveryFinancial): Promise<DeliveryFinancial> {
    const [financial] = await db.insert(deliveryFinancials).values(data).returning();
    return financial;
  }

  async updateDeliveryFinancial(id: string, data: Partial<DeliveryFinancial>): Promise<DeliveryFinancial | undefined> {
    const [financial] = await db
      .update(deliveryFinancials)
      .set(data)
      .where(eq(deliveryFinancials.id, id))
      .returning();
    return financial || undefined;
  }

  // ========================================
  // WITHDRAWALS
  // ========================================

  async getWithdrawal(id: string): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.id, id));
    return withdrawal || undefined;
  }

  async getWithdrawalsByDriver(driverId: string, limit = 50): Promise<Withdrawal[]> {
    return db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.driverId, driverId))
      .orderBy(desc(withdrawals.createdAt))
      .limit(limit);
  }

  async getDriverLastWithdrawal(driverId: string): Promise<Withdrawal | undefined> {
    // Busca último saque COMPLETADO (ignora failed e processing)
    const [withdrawal] = await db
      .select()
      .from(withdrawals)
      .where(
        and(
          eq(withdrawals.driverId, driverId),
          eq(withdrawals.status, "completed")
        )
      )
      .orderBy(desc(withdrawals.createdAt))
      .limit(1);
    return withdrawal || undefined;
  }

  async createWithdrawal(data: InsertWithdrawal): Promise<Withdrawal> {
    const [withdrawal] = await db.insert(withdrawals).values(data).returning();
    return withdrawal;
  }

  async updateWithdrawal(id: string, data: Partial<Withdrawal>): Promise<Withdrawal | undefined> {
    const [withdrawal] = await db
      .update(withdrawals)
      .set(data)
      .where(eq(withdrawals.id, id))
      .returning();
    return withdrawal || undefined;
  }

  // ========================================
  // WEBHOOKS LOG
  // ========================================

  async createWebhookLog(data: InsertWebhookLog): Promise<WebhookLog> {
    const [log] = await db.insert(webhooksLog).values(data).returning();
    return log;
  }

  async updateWebhookLog(id: string, data: Partial<WebhookLog>): Promise<WebhookLog | undefined> {
    const [log] = await db
      .update(webhooksLog)
      .set(data)
      .where(eq(webhooksLog.id, id))
      .returning();
    return log || undefined;
  }

  // ========================================
  // APP VERSION (Controle de Versão)
  // ========================================

  async getAppVersion(): Promise<AppVersion | undefined> {
    const [version] = await db
      .select()
      .from(appVersion)
      .where(eq(appVersion.active, true))
      .limit(1);
    return version || undefined;
  }

  async createAppVersion(data: InsertAppVersion): Promise<AppVersion> {
    // Desativa versões anteriores
    await db.update(appVersion).set({ active: false });

    const [version] = await db.insert(appVersion).values(data).returning();
    return version;
  }

  async updateAppVersion(id: string, data: Partial<AppVersion>): Promise<AppVersion | undefined> {
    const [version] = await db
      .update(appVersion)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(appVersion.id, id))
      .returning();
    return version || undefined;
  }

  // ========================================
  // ALLOCATION TIME SLOTS (Faixas de Horário para Alocação)
  // ========================================

  async getAllAllocationTimeSlots(): Promise<AllocationTimeSlot[]> {
    return await db
      .select()
      .from(allocationTimeSlots)
      .orderBy(allocationTimeSlots.startTime);
  }

  async getAllocationTimeSlot(id: string): Promise<AllocationTimeSlot | undefined> {
    const [slot] = await db
      .select()
      .from(allocationTimeSlots)
      .where(eq(allocationTimeSlots.id, id));
    return slot || undefined;
  }

  async getActiveAllocationTimeSlots(serviceLocationId?: string): Promise<AllocationTimeSlot[]> {
    if (serviceLocationId) {
      return await db
        .select()
        .from(allocationTimeSlots)
        .where(
          and(
            eq(allocationTimeSlots.active, true),
            or(
              eq(allocationTimeSlots.serviceLocationId, serviceLocationId),
              isNull(allocationTimeSlots.serviceLocationId)
            )
          )
        )
        .orderBy(allocationTimeSlots.startTime);
    }
    return await db
      .select()
      .from(allocationTimeSlots)
      .where(eq(allocationTimeSlots.active, true))
      .orderBy(allocationTimeSlots.startTime);
  }

  async createAllocationTimeSlot(data: InsertAllocationTimeSlot): Promise<AllocationTimeSlot> {
    const [slot] = await db.insert(allocationTimeSlots).values(data).returning();
    return slot;
  }

  async updateAllocationTimeSlot(id: string, data: Partial<InsertAllocationTimeSlot>): Promise<AllocationTimeSlot | undefined> {
    const [slot] = await db
      .update(allocationTimeSlots)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(allocationTimeSlots.id, id))
      .returning();
    return slot || undefined;
  }

  async deleteAllocationTimeSlot(id: string): Promise<void> {
    await db.delete(allocationTimeSlots).where(eq(allocationTimeSlots.id, id));
  }

  // ========================================
  // ALLOCATIONS (Alocações de Entregadores)
  // ========================================

  async getAllocation(id: string): Promise<Allocation | undefined> {
    const [allocation] = await db
      .select()
      .from(allocations)
      .where(eq(allocations.id, id));
    return allocation || undefined;
  }

  async getAllocationsByCompany(companyId: string, date?: string): Promise<Allocation[]> {
    if (date) {
      return await db
        .select()
        .from(allocations)
        .where(
          and(
            eq(allocations.companyId, companyId),
            eq(allocations.allocationDate, date)
          )
        )
        .orderBy(desc(allocations.createdAt));
    }
    return await db
      .select()
      .from(allocations)
      .where(eq(allocations.companyId, companyId))
      .orderBy(desc(allocations.createdAt));
  }

  async getAllocationsByDriver(driverId: string, date?: string): Promise<Allocation[]> {
    if (date) {
      return await db
        .select()
        .from(allocations)
        .where(
          and(
            eq(allocations.driverId, driverId),
            eq(allocations.allocationDate, date)
          )
        )
        .orderBy(desc(allocations.createdAt));
    }
    return await db
      .select()
      .from(allocations)
      .where(eq(allocations.driverId, driverId))
      .orderBy(desc(allocations.createdAt));
  }

  async getActiveAllocationForDriver(driverId: string): Promise<Allocation | undefined> {
    const today = new Date().toISOString().split('T')[0];
    const [allocation] = await db
      .select()
      .from(allocations)
      .where(
        and(
          eq(allocations.driverId, driverId),
          eq(allocations.allocationDate, today),
          inArray(allocations.status, ["accepted", "in_progress"])
        )
      );
    return allocation || undefined;
  }

  async getActiveAllocationsForCompany(companyId: string): Promise<Allocation[]> {
    const today = new Date().toISOString().split('T')[0];
    return await db
      .select()
      .from(allocations)
      .where(
        and(
          eq(allocations.companyId, companyId),
          eq(allocations.allocationDate, today),
          inArray(allocations.status, ["accepted", "in_progress"])
        )
      );
  }

  async getPendingAllocations(): Promise<Allocation[]> {
    const today = new Date().toISOString().split('T')[0];
    return await db
      .select()
      .from(allocations)
      .where(
        and(
          eq(allocations.allocationDate, today),
          eq(allocations.status, "pending")
        )
      );
  }

  async createAllocation(data: InsertAllocation): Promise<Allocation> {
    const [allocation] = await db.insert(allocations).values(data).returning();
    return allocation;
  }

  async updateAllocation(id: string, data: Partial<Allocation>): Promise<Allocation | undefined> {
    const [allocation] = await db
      .update(allocations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(allocations.id, id))
      .returning();
    return allocation || undefined;
  }

  // ========================================
  // ALLOCATION ALERTS (Alertas de Alocação)
  // ========================================

  async createAllocationAlert(data: InsertAllocationAlert): Promise<AllocationAlert> {
    const [alert] = await db.insert(allocationAlerts).values(data).returning();
    return alert;
  }

  async getActiveAllocationAlerts(allocationId: string): Promise<AllocationAlert[]> {
    return await db
      .select()
      .from(allocationAlerts)
      .where(
        and(
          eq(allocationAlerts.allocationId, allocationId),
          eq(allocationAlerts.status, "notified")
        )
      );
  }

  async getAllocationAlertForDriver(allocationId: string, driverId: string): Promise<AllocationAlert | undefined> {
    const [alert] = await db
      .select()
      .from(allocationAlerts)
      .where(
        and(
          eq(allocationAlerts.allocationId, allocationId),
          eq(allocationAlerts.driverId, driverId)
        )
      );
    return alert || undefined;
  }

  async updateAllocationAlert(id: string, data: Partial<AllocationAlert>): Promise<AllocationAlert | undefined> {
    const [alert] = await db
      .update(allocationAlerts)
      .set(data)
      .where(eq(allocationAlerts.id, id))
      .returning();
    return alert || undefined;
  }

  async expireAllocationAlerts(allocationId: string): Promise<void> {
    await db
      .update(allocationAlerts)
      .set({ status: "expired" })
      .where(
        and(
          eq(allocationAlerts.allocationId, allocationId),
          eq(allocationAlerts.status, "notified")
        )
      );
  }
}

export const storage = new DatabaseStorage();
