/**
 * Woovi/OpenPix API Service
 *
 * Serviço para integração com a API da Woovi/OpenPix
 * Documentação: https://developers.woovi.com
 */

interface WooviConfig {
  appId: string;
  apiUrl: string;
  environment: 'sandbox' | 'production';
}

interface CreateSubaccountParams {
  name: string;
  pixKey: string;
}

interface CreateSubaccountResponse {
  subAccount: {
    name: string;
    pixKey: string;
  };
}

interface GetSubaccountBalanceResponse {
  SubAccount: {
    name: string;
    pixKey: string;
    balance: number;
  };
}

interface CreateChargeParams {
  value: number; // Valor em centavos
  correlationID: string;
  comment?: string;
  expiresIn?: number; // Tempo em segundos até expirar
  splits?: Array<{ // Para split de pagamento conforme documentação
    pixKey: string;
    percent?: number; // Porcentagem do valor total (0-100)
    value?: number; // Valor fixo em centavos (alternativa ao percent)
    splitType?: string; // Tipo de split: SPLIT_SUB_ACCOUNT para subcontas virtuais
  }>;
}

interface CreateChargeResponse {
  charge: {
    value: number;
    comment: string;
    correlationID: string;
    status: string;
    createdAt: string;
    qrCodeImage: string; // URL da imagem do QR Code
    brCode: string; // BR Code duplicado para compatibilidade
    [key: string]: any; // Outras propriedades da API
  };
  brCode: string; // BR Code (Pix Copia e Cola)
  correlationID: string;
}

interface TransferBetweenSubaccountsParams {
  value: number; // Valor em centavos
  fromPixKey: string;
  fromPixKeyType: 'EMAIL' | 'CPF' | 'CNPJ' | 'PHONE' | 'EVP';
  toPixKey: string;
  toPixKeyType: 'EMAIL' | 'CPF' | 'CNPJ' | 'PHONE' | 'EVP';
  correlationID?: string;
}

interface WithdrawFromSubaccountResponse {
  transaction: {
    status: string;
    value: number;
    correlationID: string;
    destinationAlias: string;
    comment: string;
  };
}

interface ListSubaccountsResponse {
  subAccounts: Array<{
    name: string;
    pixKey: string;
  }>;
  pageInfo: {
    skip: number;
    limit: number;
    totalCount: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

class WooviService {
  private config: WooviConfig;

  constructor() {
    const appId = process.env.WOOVI_APP_ID;
    const apiUrl = process.env.WOOVI_API_URL || 'https://api.woovi.com';
    const environment = (process.env.WOOVI_ENVIRONMENT as 'sandbox' | 'production') || 'production';

    if (!appId) {
      throw new Error('WOOVI_APP_ID não está configurado no arquivo .env');
    }

    this.config = {
      appId,
      apiUrl,
      environment,
    };
  }

  /**
   * Faz uma requisição para a API da Woovi
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': this.config.appId,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na API Woovi (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao comunicar com a Woovi: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Cria uma subconta na Woovi
   */
  async createSubaccount(params: CreateSubaccountParams): Promise<CreateSubaccountResponse> {
    return this.request<CreateSubaccountResponse>(
      '/api/v1/subaccount',
      'POST',
      params
    );
  }

  /**
   * Lista todas as subcontas
   */
  async listSubaccounts(skip: number = 0, limit: number = 100): Promise<ListSubaccountsResponse> {
    return this.request<ListSubaccountsResponse>(
      `/api/v1/subaccount/list?skip=${skip}&limit=${limit}`,
      'GET'
    );
  }

  /**
   * Obtém o saldo e detalhes de uma subconta
   * @param pixKey - Chave PIX da subconta
   */
  async getSubaccountBalance(pixKey: string): Promise<GetSubaccountBalanceResponse> {
    return this.request<GetSubaccountBalanceResponse>(
      `/api/v1/subaccount/${encodeURIComponent(pixKey)}`,
      'GET'
    );
  }

  /**
   * Cria uma cobrança PIX (para recarga da empresa)
   * @param params - Parâmetros da cobrança
   */
  async createCharge(params: CreateChargeParams): Promise<CreateChargeResponse> {
    // Converter valor de reais para centavos
    const payload = {
      ...params,
      value: Math.round(params.value), // Garantir que é inteiro
    };

    return this.request<CreateChargeResponse>(
      '/api/v1/charge',
      'POST',
      payload
    );
  }

  /**
   * Transfere valor entre subcontas
   * Usado para transferir da subconta da empresa para a subconta do entregador
   */
  async transferBetweenSubaccounts(params: TransferBetweenSubaccountsParams): Promise<any> {
    // Converter valor de reais para centavos
    const payload = {
      ...params,
      value: Math.round(params.value), // Garantir que é inteiro
    };

    return this.request(
      '/api/v1/subaccount/transfer',
      'POST',
      payload
    );
  }

  /**
   * Registra um webhook para receber notificações
   * Conforme documentação: https://developers.woovi.com/docs/apis/api-create-webhook
   */
  async registerWebhook(params: {
    name: string;
    url: string;
    authorization?: string;
    isActive?: boolean;
  }): Promise<any> {
    // Remover event - não está na documentação oficial
    const webhookData = {
      name: params.name,
      url: params.url,
      authorization: params.authorization,
      isActive: params.isActive !== false, // true por padrão
    };

    return this.request(
      '/api/openpix/v1/webhook', // Endpoint correto conforme documentação
      'POST',
      { webhook: webhookData }
    );
  }

  /**
   * Lista webhooks registrados
   */
  async listWebhooks(): Promise<any> {
    return this.request('/api/openpix/v1/webhook', 'GET');
  }

  /**
   * Saca todo o saldo de uma subconta para a chave PIX registrada
   * @param pixKey - Chave PIX da subconta
   */
  async withdrawFromSubaccount(pixKey: string): Promise<WithdrawFromSubaccountResponse> {
    return this.request<WithdrawFromSubaccountResponse>(
      `/api/v1/subaccount/${encodeURIComponent(pixKey)}/withdraw`,
      'POST'
    );
  }

  /**
   * Converte reais para centavos
   */
  toCents(valueInReais: number): number {
    return Math.round(valueInReais * 100);
  }

  /**
   * Converte centavos para reais
   */
  toReais(valueInCents: number): number {
    return valueInCents / 100;
  }

  /**
   * Gera um correlationID único
   */
  generateCorrelationId(prefix: string = ''): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  /**
   * Lista todas as subcontas
   * Conforme documentação: https://developers.woovi.com/docs/subaccount/how-to-list-subaccounts-of-a-company-using-api
   */
  async listSubaccounts(skip: number = 0, limit: number = 100): Promise<ListSubaccountsResponse> {
    return this.request<ListSubaccountsResponse>(
      `/api/v1/subaccount/list?skip=${skip}&limit=${limit}`,
      'GET'
    );
  }

  /**
   * Busca uma subconta específica pela chave PIX
   */
  async getSubaccountByPixKey(pixKey: string): Promise<any> {
    try {
      const response = await this.listSubaccounts(0, 100);
      const subaccount = response.subAccounts?.find(sub => sub.pixKey === pixKey);
      return subaccount || null;
    } catch (error) {
      console.error('Erro ao buscar subconta:', error);
      return null;
    }
  }
}

// Exportar instância única (singleton)
export const wooviService = new WooviService();
export default wooviService;
