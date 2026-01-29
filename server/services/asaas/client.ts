/**
 * Cliente HTTP para integração com Asaas
 * Documentação: https://docs.asaas.com/
 */

import { storage } from "../../storage";

interface AsaasConfig {
  baseUrl: string;
  apiKey: string;
}

let cachedConfig: AsaasConfig | null = null;

/**
 * Obtém configuração do Asaas do banco de dados ou variáveis de ambiente
 */
async function getAsaasConfig(): Promise<AsaasConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const settings = await storage.getSettings();

  // Primeiro tenta do banco de dados, depois das variáveis de ambiente
  const apiKey = settings?.asaasApiKey || process.env.ASAAS_API_KEY;

  if (!apiKey) {
    throw new Error("API Key do Asaas não configurada. Configure em Configurações > Payment Gateway ou defina ASAAS_API_KEY no .env");
  }

  // Ambiente: primeiro banco, depois env, default sandbox
  const environment = settings?.asaasEnvironment || process.env.ASAAS_ENVIRONMENT || "sandbox";
  const isSandbox = environment === "sandbox";

  cachedConfig = {
    baseUrl: isSandbox
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3",
    apiKey,
  };

  console.log(`[ASAAS] Configurado para ambiente: ${isSandbox ? 'SANDBOX' : 'PRODUCTION'}`);

  return cachedConfig;
}

/**
 * Limpa cache de configuração (usar quando settings mudar)
 */
export function clearAsaasConfigCache(): void {
  cachedConfig = null;
}

/**
 * Verifica se está em ambiente sandbox
 */
export async function isSandboxEnvironment(): Promise<boolean> {
  const config = await getAsaasConfig();
  return config.baseUrl.includes("sandbox");
}

/**
 * Faz requisição para API do Asaas
 */
export async function asaasRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  data?: Record<string, unknown>
): Promise<T> {
  const config = await getAsaasConfig();

  const url = `${config.baseUrl}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": config.apiKey,
    },
  };

  if (data && (method === "POST" || method === "PUT")) {
    options.body = JSON.stringify(data);
  }

  console.log(`[ASAAS] ${method} ${endpoint}`);

  const response = await fetch(url, options);

  const responseData = await response.json();

  if (!response.ok) {
    console.error("[ASAAS] Erro:", responseData);
    const errorMessage = responseData.errors?.[0]?.description || responseData.message || "Erro na API do Asaas";
    throw new Error(errorMessage);
  }

  return responseData as T;
}

/**
 * GET request
 */
export async function asaasGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url = `${endpoint}?${searchParams.toString()}`;
  }
  return asaasRequest<T>("GET", url);
}

/**
 * POST request
 */
export async function asaasPost<T>(endpoint: string, data: Record<string, unknown>): Promise<T> {
  return asaasRequest<T>("POST", endpoint, data);
}

/**
 * PUT request
 */
export async function asaasPut<T>(endpoint: string, data: Record<string, unknown>): Promise<T> {
  return asaasRequest<T>("PUT", endpoint, data);
}

/**
 * DELETE request
 */
export async function asaasDelete<T>(endpoint: string): Promise<T> {
  return asaasRequest<T>("DELETE", endpoint);
}
