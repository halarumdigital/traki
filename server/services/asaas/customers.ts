/**
 * Serviço de Clientes do Asaas
 * Gerencia cadastro de clientes (empresas) no Asaas
 */

import { asaasGet, asaasPost, asaasPut } from "./client";
import type { Company } from "@shared/schema";

interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  postalCode?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  dateCreated: string;
}

interface AsaasCustomerListResponse {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: AsaasCustomer[];
}

/**
 * Busca cliente no Asaas por CPF/CNPJ
 */
export async function getCustomerByCpfCnpj(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const cleanCpfCnpj = cpfCnpj.replace(/\D/g, "");

  const response = await asaasGet<AsaasCustomerListResponse>("/customers", {
    cpfCnpj: cleanCpfCnpj,
  });

  return response.data?.[0] || null;
}

/**
 * Busca cliente no Asaas por ID
 */
export async function getCustomerById(customerId: string): Promise<AsaasCustomer> {
  return asaasGet<AsaasCustomer>(`/customers/${customerId}`);
}

/**
 * Cria ou atualiza cliente no Asaas baseado nos dados da empresa
 */
export async function createOrUpdateCustomer(company: Company): Promise<AsaasCustomer> {
  // Se não tem CNPJ, não pode criar no Asaas
  if (!company.cnpj) {
    throw new Error("Empresa precisa ter CNPJ para criar cliente no Asaas");
  }

  // Verifica se já existe
  const existing = await getCustomerByCpfCnpj(company.cnpj);

  if (existing) {
    console.log(`[ASAAS] Cliente já existe: ${existing.id}`);
    return existing;
  }

  // Cria novo cliente
  const customerData: Record<string, unknown> = {
    name: company.name,
    cpfCnpj: company.cnpj.replace(/\D/g, ""),
    email: company.email || undefined,
    phone: company.phone?.replace(/\D/g, "") || undefined,
    mobilePhone: company.responsibleWhatsapp?.replace(/\D/g, "") || undefined,
    address: company.street || undefined,
    addressNumber: company.number || undefined,
    complement: company.complement || undefined,
    province: company.neighborhood || undefined,
    postalCode: company.cep?.replace(/\D/g, "") || undefined,
    externalReference: company.id, // ID da empresa no nosso sistema
    notificationDisabled: false,
  };

  // Remove campos undefined
  Object.keys(customerData).forEach((key) => {
    if (customerData[key] === undefined) {
      delete customerData[key];
    }
  });

  console.log(`[ASAAS] Criando cliente para empresa: ${company.name}`);

  const newCustomer = await asaasPost<AsaasCustomer>("/customers", customerData);

  console.log(`[ASAAS] Cliente criado: ${newCustomer.id}`);

  return newCustomer;
}

/**
 * Atualiza cliente no Asaas
 */
export async function updateCustomer(
  customerId: string,
  data: Partial<{
    name: string;
    email: string;
    phone: string;
    mobilePhone: string;
    address: string;
    addressNumber: string;
    complement: string;
    province: string;
    postalCode: string;
  }>
): Promise<AsaasCustomer> {
  // Remove campos undefined e limpa máscaras
  const cleanData: Record<string, unknown> = {};

  if (data.name) cleanData.name = data.name;
  if (data.email) cleanData.email = data.email;
  if (data.phone) cleanData.phone = data.phone.replace(/\D/g, "");
  if (data.mobilePhone) cleanData.mobilePhone = data.mobilePhone.replace(/\D/g, "");
  if (data.address) cleanData.address = data.address;
  if (data.addressNumber) cleanData.addressNumber = data.addressNumber;
  if (data.complement) cleanData.complement = data.complement;
  if (data.province) cleanData.province = data.province;
  if (data.postalCode) cleanData.postalCode = data.postalCode.replace(/\D/g, "");

  return asaasPut<AsaasCustomer>(`/customers/${customerId}`, cleanData);
}
