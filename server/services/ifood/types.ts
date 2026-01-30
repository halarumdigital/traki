/**
 * Tipos TypeScript para integração com a API do iFood
 * Documentação: https://developer.ifood.com.br
 */

// ========================================
// AUTENTICAÇÃO
// ========================================

export interface IFoodAuthRequest {
  grantType: 'client_credentials' | 'authorization_code' | 'refresh_token';
  clientId: string;
  clientSecret: string;
  authorizationCode?: string;
  refreshToken?: string;
}

export interface IFoodAuthResponse {
  accessToken: string;
  type: string;
  expiresIn: number; // segundos
}

// ========================================
// EVENTOS
// ========================================

export type IFoodEventCode =
  | 'PLC'  // PLACED - Pedido realizado
  | 'CFM'  // CONFIRMED - Confirmado pelo restaurante
  | 'RTP'  // READY_TO_PICKUP - Pronto para coleta
  | 'DSP'  // DISPATCHED - Saiu para entrega
  | 'CON'  // CONCLUDED - Concluído
  | 'CAN'; // CANCELLED - Cancelado

export type IFoodEventFullCode =
  | 'PLACED'
  | 'CONFIRMED'
  | 'READY_TO_PICKUP'
  | 'DISPATCHED'
  | 'CONCLUDED'
  | 'CANCELLED';

export interface IFoodEvent {
  id: string;
  code: IFoodEventCode;
  fullCode: IFoodEventFullCode;
  orderId: string;
  merchantId: string;
  createdAt: string; // ISO 8601
  salesChannel: string;
  metadata?: Record<string, any>;
}

// ========================================
// PEDIDO (ORDER DETAILS)
// ========================================

export interface IFoodCustomerPhone {
  number: string;           // Telefone mascarado (0800)
  localizer: string;        // Código localizador
  localizerExpiration: string; // Expira 3h após entrega
}

export interface IFoodCustomer {
  id: string;
  name: string;
  documentNumber?: string;
  phone?: IFoodCustomerPhone;
  ordersCountOnMerchant: number;
  segmentation?: string; // Gold, Platinum, etc
}

export interface IFoodCoordinates {
  latitude: number;
  longitude: number;
}

export interface IFoodDeliveryAddress {
  streetName: string;
  streetNumber: string;
  formattedAddress: string;
  neighborhood: string;
  complement?: string;
  reference?: string;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  coordinates: IFoodCoordinates;
}

export interface IFoodDelivery {
  mode: string;
  deliveredBy: string;
  deliveryAddress: IFoodDeliveryAddress;
  deliveryDateTime?: string;
  pickupCode?: string;
}

export interface IFoodOrderItem {
  id: string;
  index: number;
  name: string;
  externalCode?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  observations?: string;
  options?: IFoodOrderItemOption[];
}

export interface IFoodOrderItemOption {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IFoodPayment {
  methods: IFoodPaymentMethod[];
  pending: number;
  prepaid: number;
}

export interface IFoodPaymentMethod {
  value: number;
  currency: string;
  method: string;
  type: string;
  prepaid: boolean;
}

export interface IFoodMerchant {
  id: string;
  name: string;
}

export interface IFoodTotal {
  subTotal: number;
  deliveryFee: number;
  benefits: number;
  orderAmount: number;
  additionalFees: number;
}

export interface IFoodOrder {
  id: string;
  displayId: string;
  orderType: string;
  orderTiming: string;
  createdAt: string;
  preparationStartDateTime?: string;
  customer: IFoodCustomer;
  delivery: IFoodDelivery;
  items: IFoodOrderItem[];
  payments: IFoodPayment;
  merchant: IFoodMerchant;
  total: IFoodTotal;
  salesChannel: string;
  extraInfo?: string;
}

// ========================================
// LOGISTICS - STATUS UPDATES
// ========================================

export interface IFoodAssignDriverRequest {
  // Atribui entregador ao pedido
}

export interface IFoodDispatchRequest {
  // Notifica que o entregador coletou e está a caminho
}

export interface IFoodArrivedAtOriginRequest {
  // Entregador chegou no restaurante
}

export interface IFoodArrivedAtDestinationRequest {
  // Entregador chegou no destino
}

export interface IFoodVerifyDeliveryCodeRequest {
  code: string; // Código de entrega fornecido pelo cliente
}

// ========================================
// CONFIGURAÇÃO DA INTEGRAÇÃO
// ========================================

export interface IFoodCredentials {
  id: string;
  companyId: string;
  merchantId: string;
  clientId: string;
  clientSecret: string;
  accessToken: string | null;
  tokenExpiresAt: Date | null;
  active: boolean;
  triggerOnReadyToPickup: boolean;
  triggerOnDispatched: boolean;
  lastSyncAt: Date | null;
  totalDeliveriesCreated: number;
}

export interface IFoodProcessedEvent {
  id: string;
  eventId: string;
  orderId: string;
  ifoodCredentialId: string;
  requestId: string | null; // ID da entrega criada no app
  processedAt: Date;
}

// ========================================
// ERROS
// ========================================

export interface IFoodApiError {
  code: string;
  message: string;
  details?: string;
}

export class IFoodAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IFoodAuthError';
  }
}

export class IFoodApiRequestError extends Error {
  public statusCode: number;
  public apiError?: IFoodApiError;

  constructor(message: string, statusCode: number, apiError?: IFoodApiError) {
    super(message);
    this.name = 'IFoodApiRequestError';
    this.statusCode = statusCode;
    this.apiError = apiError;
  }
}
