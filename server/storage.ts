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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

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
        totalPrice: requests.requestEtaAmount,
        // Calcular ganho do motorista e comissão do app
        driverEarnings: sql<string>`
          CASE
            WHEN ${requests.requestEtaAmount} IS NOT NULL
            THEN CAST(${requests.requestEtaAmount} * (1 - COALESCE(${serviceLocations.adminCommissionPercentage}, 20) / 100) AS NUMERIC(10,2))
            ELSE 0
          END
        `,
        appCommission: sql<string>`
          CASE
            WHEN ${requests.requestEtaAmount} IS NOT NULL
            THEN CAST(${requests.requestEtaAmount} * 20 / 100 AS NUMERIC(10,2))
            ELSE 0
          END
        `,
        createdAt: requests.createdAt,
        completedAt: requests.completedAt,
        cancelledAt: requests.cancelledAt,
      })
      .from(requests)
      .leftJoin(requestPlaces, eq(requests.id, requestPlaces.requestId))
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
        totalPrice: requests.requestEtaAmount,
        appCommission: sql<string>`
          CASE
            WHEN ${requests.requestEtaAmount} IS NOT NULL
            THEN CAST(${requests.requestEtaAmount} * 20 / 100 AS NUMERIC(10,2))
            ELSE 0
          END
        `,
        createdAt: requests.createdAt,
        completedAt: requests.completedAt,
        cancelledAt: requests.cancelledAt,
      })
      .from(requests)
      .leftJoin(requestPlaces, eq(requests.id, requestPlaces.requestId))
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
        paymentType: cityPrices.paymentType,
        basePrice: cityPrices.basePrice,
        pricePerDistance: cityPrices.pricePerDistance,
        pricePerTime: cityPrices.pricePerTime,
        baseDistance: cityPrices.baseDistance,
        waitingChargePerMinute: cityPrices.waitingChargePerMinute,
        freeWaitingTimeMins: cityPrices.freeWaitingTimeMins,
        cancellationFee: cityPrices.cancellationFee,
        stopPrice: cityPrices.stopPrice,
        returnPrice: cityPrices.returnPrice,
        serviceTax: cityPrices.serviceTax,
        adminCommisionType: cityPrices.adminCommisionType,
        adminCommision: cityPrices.adminCommision,
        surgePricing: cityPrices.surgePricing,
        peakHourStart: cityPrices.peakHourStart,
        peakHourEnd: cityPrices.peakHourEnd,
        peakHourMultiplier: cityPrices.peakHourMultiplier,
        active: cityPrices.active,
        createdAt: cityPrices.createdAt,
        updatedAt: cityPrices.updatedAt,
      })
      .from(cityPrices)
      .leftJoin(serviceLocations, eq(cityPrices.serviceLocationId, serviceLocations.id))
      .leftJoin(vehicleTypes, eq(cityPrices.vehicleTypeId, vehicleTypes.id));

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
        rating: drivers.rating,
        latitude: drivers.latitude,
        longitude: drivers.longitude,
        currentLatitude: drivers.latitude, // Alias para compatibilidade com o mapa
        currentLongitude: drivers.longitude, // Alias para compatibilidade com o mapa
        createdAt: drivers.createdAt,
        updatedAt: drivers.updatedAt,
      })
      .from(drivers)
      .leftJoin(serviceLocations, eq(drivers.serviceLocationId, serviceLocations.id))
      .leftJoin(vehicleTypes, eq(drivers.vehicleTypeId, vehicleTypes.id))
      .orderBy(desc(drivers.createdAt));

    return result;
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
          eq(drivers.active, true)
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
      .set({ latitude, longitude, updatedAt: new Date() })
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
}

export const storage = new DatabaseStorage();
