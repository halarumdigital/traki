/**
 * Serviço de Notas Fiscais do Asaas
 * Gerencia emissão de NFS-e via API do Asaas
 * Documentação: https://docs.asaas.com/docs/emitindo-notas-fiscais-de-servico
 */

import { asaasGet, asaasPost, asaasDelete } from "./client";

// ========== INTERFACES ==========

interface AsaasInvoiceTaxes {
  retainIss?: boolean;
  iss?: number;
  cofins?: number;
  csll?: number;
  inss?: number;
  ir?: number;
  pis?: number;
}

export interface AsaasInvoice {
  id: string;
  status: string; // SCHEDULED, SYNCHRONIZED, AUTHORIZED, ERROR, PROCESSING_CANCELLATION, CANCELED, CANCELLATION_DENIED
  customer: string;
  type: string; // NFSE
  value: number;
  deductions?: number;
  effectiveDate: string;
  serviceDescription: string;
  observations?: string;
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName?: string;
  taxes: AsaasInvoiceTaxes;
  number?: string; // Número da NFS-e
  validationCode?: string; // Código de verificação
  pdfUrl?: string;
  xmlUrl?: string;
  rpsSerie?: string;
  rpsNumber?: string;
  statusDescription?: string;
  estimatedTaxesDescription?: string;
  payment?: string;
  installment?: string;
  dateCreated: string;
}

export interface AsaasMunicipalService {
  id: string;
  description: string;
  code?: string;
}

export interface AsaasMunicipalOptions {
  authenticationType: string; // CERTIFICATE, TOKEN, USER_AND_PASSWORD
  supportsCancellation: boolean;
  usesSpecialTaxRegimes: boolean;
  usesServiceListItem: boolean;
  usesStateInscription?: boolean;
  specialTaxRegimesList?: Array<{ label: string; value: string }>;
  municipalInscriptionHelp?: string;
  specialTaxRegimeHelp?: string;
  serviceListItemHelp?: string;
  digitalCertificatedHelp?: string;
  accessTokenHelp?: string;
  municipalServiceCodeHelp?: string;
}

export interface CreateInvoiceParams {
  payment?: string;          // ID do pagamento no Asaas (para vincular a cobrança)
  customer?: string;         // ID do cliente (para nota avulsa)
  serviceDescription: string;
  value: number;
  deductions?: number;
  effectiveDate: Date;
  municipalServiceCode?: string;
  municipalServiceId?: string;
  municipalServiceName?: string;
  observations?: string;
  externalReference?: string;
  taxes?: {
    retainIss?: boolean;
    iss?: number;
    cofins?: number;
    csll?: number;
    inss?: number;
    ir?: number;
    pis?: number;
  };
}

// ========== FUNÇÕES ==========

/**
 * Formata data para o formato esperado pelo Asaas (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Agenda emissão de nota fiscal
 */
export async function scheduleInvoice(params: CreateInvoiceParams): Promise<AsaasInvoice> {
  const invoiceData: Record<string, unknown> = {
    serviceDescription: params.serviceDescription,
    value: params.value,
    effectiveDate: formatDate(params.effectiveDate),
  };

  // Vinculação: payment OU customer
  if (params.payment) {
    invoiceData.payment = params.payment;
  } else if (params.customer) {
    invoiceData.customer = params.customer;
  } else {
    throw new Error("É necessário informar payment ou customer para emitir nota fiscal");
  }

  // Serviço municipal - usar municipalServiceId se disponível, senão municipalServiceCode
  if (params.municipalServiceId) {
    invoiceData.municipalServiceId = params.municipalServiceId;
    invoiceData.municipalServiceCode = null;
  } else if (params.municipalServiceCode) {
    invoiceData.municipalServiceCode = params.municipalServiceCode;
    invoiceData.municipalServiceId = null;
  }

  if (params.municipalServiceName) {
    invoiceData.municipalServiceName = params.municipalServiceName;
  }

  // Deduções
  if (params.deductions !== undefined) {
    invoiceData.deductions = params.deductions;
  }

  // Observações
  if (params.observations) {
    invoiceData.observations = params.observations;
  }

  // Referência externa
  if (params.externalReference) {
    invoiceData.externalReference = params.externalReference;
  }

  // Impostos
  if (params.taxes) {
    invoiceData.taxes = {
      retainIss: params.taxes.retainIss ?? false,
      iss: params.taxes.iss ?? 0,
      cofins: params.taxes.cofins ?? 0,
      csll: params.taxes.csll ?? 0,
      inss: params.taxes.inss ?? 0,
      ir: params.taxes.ir ?? 0,
      pis: params.taxes.pis ?? 0,
    };
  }

  console.log(`[ASAAS] Agendando NFS-e: R$ ${params.value}`);

  const invoice = await asaasPost<AsaasInvoice>("/invoices", invoiceData);

  console.log(`[ASAAS] NFS-e agendada: ${invoice.id} - Status: ${invoice.status}`);

  return invoice;
}

/**
 * Autoriza/emite nota fiscal imediatamente
 * Usado para forçar emissão quando está em status SCHEDULED
 */
export async function authorizeInvoice(invoiceId: string): Promise<AsaasInvoice> {
  console.log(`[ASAAS] Autorizando NFS-e: ${invoiceId}`);
  return asaasPost<AsaasInvoice>(`/invoices/${invoiceId}/authorize`, {});
}

/**
 * Busca nota fiscal por ID
 */
export async function getInvoice(invoiceId: string): Promise<AsaasInvoice> {
  return asaasGet<AsaasInvoice>(`/invoices/${invoiceId}`);
}

/**
 * Cancela nota fiscal
 */
export async function cancelInvoice(invoiceId: string): Promise<AsaasInvoice> {
  console.log(`[ASAAS] Cancelando NFS-e: ${invoiceId}`);
  return asaasDelete<AsaasInvoice>(`/invoices/${invoiceId}`);
}

/**
 * Lista notas fiscais
 */
export async function listInvoices(params?: {
  customer?: string;
  payment?: string;
  status?: string;
  offset?: number;
  limit?: number;
  effectiveDateGE?: string; // effectiveDate >= (YYYY-MM-DD)
  effectiveDateLE?: string; // effectiveDate <= (YYYY-MM-DD)
}): Promise<{
  data: AsaasInvoice[];
  hasMore: boolean;
  totalCount: number;
}> {
  const queryParams: Record<string, string> = {};

  if (params?.customer) queryParams.customer = params.customer;
  if (params?.payment) queryParams.payment = params.payment;
  if (params?.status) queryParams.status = params.status;
  if (params?.offset !== undefined) queryParams.offset = String(params.offset);
  if (params?.limit !== undefined) queryParams.limit = String(params.limit);
  if (params?.effectiveDateGE) queryParams["effectiveDate[ge]"] = params.effectiveDateGE;
  if (params?.effectiveDateLE) queryParams["effectiveDate[le]"] = params.effectiveDateLE;

  return asaasGet(`/invoices`, queryParams);
}

/**
 * Lista serviços municipais disponíveis
 */
export async function getMunicipalServices(params?: {
  offset?: number;
  limit?: number;
}): Promise<{
  data: AsaasMunicipalService[];
  hasMore: boolean;
  totalCount: number;
}> {
  const queryParams: Record<string, string> = {};
  if (params?.offset !== undefined) queryParams.offset = String(params.offset);
  if (params?.limit !== undefined) queryParams.limit = String(params.limit);

  return asaasGet(`/invoices/municipalServices`, queryParams);
}

/**
 * Obtém opções de configuração municipal
 * Retorna requisitos específicos da prefeitura para emissão de NFS-e
 */
export async function getMunicipalOptions(): Promise<AsaasMunicipalOptions> {
  return asaasGet<AsaasMunicipalOptions>("/fiscalInfo/municipalOptions");
}

/**
 * Obtém informações fiscais da conta Asaas
 */
export async function getFiscalInfo(): Promise<{
  simplesNacional: boolean;
  rpsSerie: string;
  rpsNumber: number;
  specialTaxRegime?: string;
  serviceListItem?: string;
  cnae?: string;
  municipalInscription?: string;
  stateInscription?: string;
}> {
  return asaasGet("/fiscalInfo");
}
