# 📋 DOCUMENTAÇÃO TÉCNICA - NFS-e Nacional API

## Guia Completo de Implementação para Claude Code

**Versão:** 1.0  
**Data:** Janeiro 2026  
**Aplicação:** App de Delivery / SaaS Multi-tenant

---

## 📑 ÍNDICE

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura da Solução](#2-arquitetura-da-solução)
3. [Requisitos Técnicos](#3-requisitos-técnicos)
4. [Configuração de Ambientes](#4-configuração-de-ambientes)
5. [Autenticação e Certificado Digital](#5-autenticação-e-certificado-digital)
6. [Estrutura do XML - DPS](#6-estrutura-do-xml---dps)
7. [Endpoints da API](#7-endpoints-da-api)
8. [Fluxos de Operação](#8-fluxos-de-operação)
9. [Códigos e Tabelas](#9-códigos-e-tabelas)
10. [Tratamento de Erros](#10-tratamento-de-erros)
11. [Implementação Node.js](#11-implementação-nodejs)
12. [Banco de Dados](#12-banco-de-dados)
13. [Testes e Homologação](#13-testes-e-homologação)
14. [Checklist de Implementação](#14-checklist-de-implementação)

---

## 1. VISÃO GERAL

### 1.1 O que é a NFS-e Nacional

A NFS-e Nacional é o padrão unificado de Nota Fiscal de Serviço Eletrônica do Brasil, desenvolvido pela Receita Federal, ABRASF e SERPRO. A partir de **01/01/2026**, será obrigatória para todos os prestadores de serviço.

### 1.2 Conceitos Fundamentais

| Termo | Descrição |
|-------|-----------|
| **DPS** | Declaração de Prestação de Serviço - "rascunho" enviado para gerar a NFS-e |
| **NFS-e** | Nota Fiscal de Serviço Eletrônica - documento fiscal válido |
| **ADN** | Ambiente de Dados Nacional - repositório central das NFS-e |
| **SEFIN Nacional** | Sistema que recepciona e valida as DPS |
| **Chave de Acesso** | Identificador único da NFS-e (50 caracteres) |
| **DANFSe** | Documento Auxiliar da NFS-e (PDF para impressão) |
| **NSU** | Número Sequencial Único - para consulta de documentos |

### 1.3 Fluxo Resumido

```
[Seu App] → [Monta XML DPS] → [Assina] → [GZip+Base64] → [POST /nfse]
                                                              ↓
[Recebe NFS-e XML] ← [Valida] ← [ADN] ← [SEFIN Nacional]
```

---

## 2. ARQUITETURA DA SOLUÇÃO

### 2.1 Módulos a Implementar

```
/src
├── /config
│   ├── nfse.config.js          # Configurações gerais
│   └── certificates.js          # Gestão de certificados
├── /services
│   ├── nfse/
│   │   ├── NfseService.js       # Orquestrador principal
│   │   ├── DpsBuilder.js        # Montagem do XML DPS
│   │   ├── XmlSigner.js         # Assinatura digital
│   │   ├── NfseClient.js        # Cliente HTTP com mTLS
│   │   ├── DanfseService.js     # Geração de PDF
│   │   └── EventService.js      # Cancelamento e eventos
│   └── /validators
│       └── DpsValidator.js      # Validação de dados
├── /models
│   ├── Nfse.js                  # Model NFS-e
│   ├── DpsLog.js                # Log de envios
│   └── NfseEvent.js             # Eventos (cancelamento)
├── /utils
│   ├── xml.utils.js             # Helpers XML
│   ├── gzip.utils.js            # Compressão
│   └── base64.utils.js          # Codificação
└── /routes
    └── nfse.routes.js           # Endpoints da API interna
```

### 2.2 Dependências NPM

```json
{
  "dependencies": {
    "xml2js": "^0.6.2",
    "xmlbuilder2": "^3.1.1",
    "xml-crypto": "^3.2.0",
    "node-forge": "^1.3.1",
    "axios": "^1.6.0",
    "https": "^1.0.0",
    "zlib": "^1.0.5",
    "uuid": "^9.0.0",
    "moment": "^2.29.4"
  }
}
```

---

## 3. REQUISITOS TÉCNICOS

### 3.1 Certificado Digital

| Requisito | Especificação |
|-----------|---------------|
| **Tipo** | ICP-Brasil A1 (arquivo .pfx) ou A3 (token/cartão) |
| **Formato** | PKCS#12 (.pfx/.p12) para A1 |
| **Validade** | Verificar antes de cada envio |
| **Uso** | Autenticação mTLS + Assinatura XML |

### 3.2 Comunicação

| Item | Especificação |
|------|---------------|
| **Protocolo** | HTTPS com TLS 1.2+ |
| **Autenticação** | mTLS (Mutual TLS) |
| **Content-Type Request** | `application/json` |
| **Body DPS** | XML compactado (GZip) + codificado (Base64) |
| **Encoding** | UTF-8 |

### 3.3 XML da DPS

| Item | Especificação |
|------|---------------|
| **Padrão** | W3C XML 1.0 |
| **Encoding** | UTF-8 |
| **Namespace** | `http://www.sped.fazenda.gov.br/nfse` |
| **Assinatura** | XMLDSIG (enveloped) |
| **Canonicalization** | `http://www.w3.org/TR/2001/REC-xml-c14n-20010315` |
| **Digest** | SHA-256 |
| **Signature** | RSA-SHA256 |

---

## 4. CONFIGURAÇÃO DE AMBIENTES

### 4.1 URLs Base

```javascript
// config/nfse.config.js

const NFSE_CONFIG = {
  // Ambiente de Homologação (testes)
  homologacao: {
    baseUrl: 'https://sefin.producaorestrita.nfse.gov.br',
    adnUrl: 'https://adn.producaorestrita.nfse.gov.br',
    portalUrl: 'https://www.producaorestrita.nfse.gov.br',
    ambiente: 1 // 1 = Homologação
  },
  
  // Ambiente de Produção
  producao: {
    baseUrl: 'https://sefin.nfse.gov.br',
    adnUrl: 'https://adn.nfse.gov.br',
    portalUrl: 'https://www.nfse.gov.br',
    ambiente: 2 // 2 = Produção
  }
};

module.exports = NFSE_CONFIG;
```

### 4.2 Swagger/Documentação Interativa

| Ambiente | URL Swagger |
|----------|-------------|
| **Produção** | https://www.nfse.gov.br/swagger/contribuintesissqn |
| **Homologação** | https://www.producaorestrita.nfse.gov.br/swagger/contribuintesissqn |

---

## 5. AUTENTICAÇÃO E CERTIFICADO DIGITAL

### 5.1 Carregamento do Certificado A1

```javascript
// services/nfse/certificates.js

const fs = require('fs');
const forge = require('node-forge');

class CertificateManager {
  constructor(pfxPath, password) {
    this.pfxPath = pfxPath;
    this.password = password;
    this.certificate = null;
    this.privateKey = null;
    this.publicKey = null;
  }

  load() {
    const pfxBuffer = fs.readFileSync(this.pfxPath);
    const pfxAsn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, this.password);

    // Extrair certificado
    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag][0];
    this.certificate = certBag.cert;

    // Extrair chave privada
    const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
    this.privateKey = keyBag.key;

    // Chave pública
    this.publicKey = this.certificate.publicKey;

    return this;
  }

  // Verificar validade
  isValid() {
    const now = new Date();
    return now >= this.certificate.validity.notBefore && 
           now <= this.certificate.validity.notAfter;
  }

  // Obter dados do certificado
  getInfo() {
    return {
      subject: this.certificate.subject.getField('CN').value,
      issuer: this.certificate.issuer.getField('CN').value,
      serialNumber: this.certificate.serialNumber,
      validFrom: this.certificate.validity.notBefore,
      validTo: this.certificate.validity.notAfter,
      cnpj: this._extractCNPJ()
    };
  }

  _extractCNPJ() {
    // CNPJ está no campo OU ou no CN do certificado
    const cn = this.certificate.subject.getField('CN')?.value || '';
    const match = cn.match(/\d{14}/);
    return match ? match[0] : null;
  }

  // Exportar para uso no HTTPS Agent
  getHttpsAgentOptions() {
    return {
      pfx: fs.readFileSync(this.pfxPath),
      passphrase: this.password,
      rejectUnauthorized: true
    };
  }

  // PEM para assinatura XML
  getPrivateKeyPem() {
    return forge.pki.privateKeyToPem(this.privateKey);
  }

  getCertificatePem() {
    return forge.pki.certificateToPem(this.certificate);
  }
}

module.exports = CertificateManager;
```

### 5.2 Cliente HTTP com mTLS

```javascript
// services/nfse/NfseClient.js

const https = require('https');
const axios = require('axios');
const zlib = require('zlib');

class NfseClient {
  constructor(config, certificateManager) {
    this.config = config;
    this.certManager = certificateManager;
    this.client = this._createClient();
  }

  _createClient() {
    const httpsAgent = new https.Agent({
      ...this.certManager.getHttpsAgentOptions(),
      keepAlive: true,
      timeout: 60000
    });

    return axios.create({
      baseURL: this.config.baseUrl,
      httpsAgent,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  // Comprimir e codificar XML
  _prepareXml(xmlString) {
    const gzipped = zlib.gzipSync(Buffer.from(xmlString, 'utf-8'));
    return gzipped.toString('base64');
  }

  // Descomprimir resposta
  _parseResponse(base64Data) {
    const buffer = Buffer.from(base64Data, 'base64');
    const decompressed = zlib.gunzipSync(buffer);
    return decompressed.toString('utf-8');
  }

  // POST /nfse - Emitir NFS-e
  async emitir(xmlDps) {
    const payload = {
      dps: this._prepareXml(xmlDps)
    };

    const response = await this.client.post('/SefinNacional/nfse', payload);
    
    if (response.data.nfse) {
      response.data.nfseXml = this._parseResponse(response.data.nfse);
    }
    
    return response.data;
  }

  // GET /nfse/{chaveAcesso} - Consultar NFS-e
  async consultar(chaveAcesso) {
    const response = await this.client.get(`/SefinNacional/nfse/${chaveAcesso}`);
    
    if (response.data.nfse) {
      response.data.nfseXml = this._parseResponse(response.data.nfse);
    }
    
    return response.data;
  }

  // POST /nfse/{chaveAcesso}/eventos - Registrar evento
  async registrarEvento(chaveAcesso, xmlEvento) {
    const payload = {
      pedRegEvento: this._prepareXml(xmlEvento)
    };

    const response = await this.client.post(
      `/SefinNacional/nfse/${chaveAcesso}/eventos`,
      payload
    );
    
    return response.data;
  }

  // GET /nfse/{chaveAcesso}/eventos - Listar eventos
  async listarEventos(chaveAcesso) {
    const response = await this.client.get(
      `/SefinNacional/nfse/${chaveAcesso}/eventos`
    );
    return response.data;
  }

  // GET /danfse/{chaveAcesso} - Obter PDF
  async obterDanfse(chaveAcesso) {
    const response = await this.client.get(
      `/SefinNacional/danfse/${chaveAcesso}`,
      { responseType: 'arraybuffer' }
    );
    return response.data; // Buffer do PDF
  }

  // GET /dps/{id} - Consultar DPS
  async consultarDps(idDps) {
    const response = await this.client.get(`/SefinNacional/dps/${idDps}`);
    return response.data;
  }

  // Consultar parâmetros municipais
  async getParametrosMunicipais(codigoIbge) {
    const response = await this.client.get(
      `/parametrizacao/municipios/${codigoIbge}/parametros`
    );
    return response.data;
  }
}

module.exports = NfseClient;
```

---

## 6. ESTRUTURA DO XML - DPS

### 6.1 Estrutura Completa da DPS

```xml
<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="DPS_XXXXXXXX">
    
    <!-- Identificação da DPS -->
    <tpAmb>2</tpAmb>                    <!-- 1=Homolog, 2=Prod -->
    <dhEmi>2026-01-15T10:30:00-03:00</dhEmi>
    <verAplic>1.0.0</verAplic>          <!-- Versão do seu app -->
    <serie>1</serie>                     <!-- Série numérica -->
    <nDPS>000000001</nDPS>              <!-- Número sequencial -->
    <dCompet>2026-01-15</dCompet>       <!-- Data competência -->
    <tpEmit>1</tpEmit>                  <!-- 1=Prestador, 2=Tomador -->
    <cLocEmi>4204202</cLocEmi>          <!-- Código IBGE município -->
    
    <!-- Substituição (opcional) -->
    <subst>
      <chSubstda>NFSe12345678901234567890123456789012345678901234</chSubstda>
    </subst>
    
    <!-- Prestador -->
    <prest>
      <CNPJ>12345678000199</CNPJ>
      <IM>12345</IM>                     <!-- Inscrição Municipal -->
      <xNome>EMPRESA PRESTADORA LTDA</xNome>
      <end>
        <xLgr>RUA EXEMPLO</xLgr>
        <nro>100</nro>
        <xCpl>SALA 01</xCpl>
        <xBairro>CENTRO</xBairro>
        <cMun>4204202</cMun>             <!-- Código IBGE -->
        <UF>SC</UF>
        <CEP>88000000</CEP>
      </end>
      <fone>4732001000</fone>
      <email>contato@empresa.com.br</email>
      <regTrib>
        <opSN>1</opSN>                   <!-- 1=Simples Nacional -->
        <regApworTrib>0</regApworTrib>
      </regTrib>
    </prest>
    
    <!-- Tomador -->
    <toma>
      <CNPJ>98765432000111</CNPJ>
      <!-- OU -->
      <CPF>12345678901</CPF>
      
      <xNome>CLIENTE TOMADOR</xNome>
      <end>
        <xLgr>AV PRINCIPAL</xLgr>
        <nro>500</nro>
        <xBairro>CENTRO</xBairro>
        <cMun>4204202</cMun>
        <UF>SC</UF>
        <CEP>88000100</CEP>
      </end>
      <fone>4732005000</fone>
      <email>cliente@email.com</email>
    </toma>
    
    <!-- Intermediário (opcional) -->
    <interm>
      <CNPJ>55566677700088</CNPJ>
      <xNome>INTERMEDIADOR</xNome>
    </interm>
    
    <!-- Serviço -->
    <serv>
      <locPrest>
        <cLocPrest>4204202</cLocPrest>   <!-- Onde foi prestado -->
        <cPaisPrest>1058</cPaisPrest>    <!-- Brasil -->
      </locPrest>
      
      <cServ>
        <cTribNac>010101</cTribNac>      <!-- Código Tributação Nacional -->
        <cTribMun>101</cTribMun>         <!-- Código municipal (se houver) -->
        <xDescServ>SERVICO DE DESENVOLVIMENTO DE SOFTWARE</xDescServ>
        <cNBS>1.1101.10.00</cNBS>        <!-- NBS obrigatório -->
      </cServ>
      
      <comExt>                           <!-- Se exportação -->
        <mdPrestworServ>0</mdPrestworServ>
        <vincPrest>0</vincPrest>
        <tpMoeda>BRL</tpMoeda>
        <vServMoeda>1000.00</vServMoeda>
      </comExt>
      
      <lsadppu>
        <worTpObra>0</worTpObra>
        <worUnidMedida>0</worUnidMedida>
      </lsadppu>
      
      <!-- Valores -->
      <vServ>1000.00</vServ>             <!-- Valor bruto do serviço -->
      <vDesc>0.00</vDesc>                <!-- Desconto -->
      <vBC>1000.00</vBC>                 <!-- Base de cálculo ISS -->
      <pAliqISS>5.00</pAliqISS>          <!-- Alíquota ISS % -->
      <vISS>50.00</vISS>                 <!-- Valor ISS -->
      <vLiq>950.00</vLiq>                <!-- Valor líquido -->
      
      <!-- Deduções (se houver) -->
      <vDed>
        <vDR>0.00</vDR>
      </vDed>
      
      <!-- Retenções Federais -->
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>       <!-- 1=Operação tributável -->
          <cPaisResult>1058</cPaisResult>
          <BM>
            <vBCISS>1000.00</vBCISS>
            <pAliq>5.00</pAliq>
            <vISS>50.00</vISS>
            <tpRetISS>1</tpRetISS>       <!-- 1=Não retido -->
          </BM>
        </tribMun>
        <tribFed>
          <CST>01</CST>                  <!-- PIS/COFINS -->
          <vBCPIS>1000.00</vBCPIS>
          <pPIS>0.65</pPIS>
          <vPIS>6.50</vPIS>
          <vBCCOFINS>1000.00</vBCCOFINS>
          <pCOFINS>3.00</pCOFINS>
          <vCOFINS>30.00</vCOFINS>
          <tpRetPISCOFINS>1</tpRetPISCOFINS>
          <vRetPISCOFINS>0.00</vRetPISCOFINS>
        </tribFed>
        <totTrib>
          <vTotTrib>86.50</vTotTrib>
        </totTrib>
      </trib>
    </serv>
    
    <!-- Informações Complementares -->
    <infComp>Informacoes adicionais da nota fiscal</infComp>
    
  </infDPS>
  
  <!-- Assinatura será inserida aqui -->
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <!-- ... -->
  </Signature>
  
</DPS>
```

### 6.2 Campos Obrigatórios Mínimos

```javascript
// Campos obrigatórios para emissão
const camposObrigatorios = {
  infDPS: {
    tpAmb: true,        // Tipo ambiente
    dhEmi: true,        // Data/hora emissão
    verAplic: true,     // Versão aplicativo
    serie: true,        // Série
    nDPS: true,         // Número DPS
    dCompet: true,      // Data competência
    tpEmit: true,       // Tipo emitente
    cLocEmi: true       // Código município emissão
  },
  prest: {
    CNPJ: true,         // ou CPF
    IM: false,          // Depende do município
    xNome: true,
    regTrib: true
  },
  toma: {
    CNPJ_ou_CPF: true,  // Um dos dois
    xNome: true
  },
  serv: {
    cServ: {
      cTribNac: true,   // Código tributação nacional
      xDescServ: true,  // Descrição do serviço
      cNBS: true        // Código NBS
    },
    vServ: true,        // Valor serviço
    vBC: true,          // Base cálculo
    pAliqISS: true,     // Alíquota ISS
    vISS: true          // Valor ISS
  }
};
```

### 6.3 Builder da DPS

```javascript
// services/nfse/DpsBuilder.js

const { create } = require('xmlbuilder2');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

class DpsBuilder {
  constructor(ambiente = 'producao') {
    this.ambiente = ambiente;
    this.tpAmb = ambiente === 'producao' ? 2 : 1;
  }

  build(dados) {
    const idDps = this._gerarIdDps(dados);
    
    const dps = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('DPS', {
        xmlns: 'http://www.sped.fazenda.gov.br/nfse',
        versao: '1.00'
      })
        .ele('infDPS', { Id: idDps })
          // Identificação
          .ele('tpAmb').txt(this.tpAmb).up()
          .ele('dhEmi').txt(moment().format('YYYY-MM-DDTHH:mm:ssZ')).up()
          .ele('verAplic').txt(dados.versaoApp || '1.0.0').up()
          .ele('serie').txt(dados.serie.toString()).up()
          .ele('nDPS').txt(dados.numero.toString().padStart(9, '0')).up()
          .ele('dCompet').txt(moment(dados.dataCompetencia).format('YYYY-MM-DD')).up()
          .ele('tpEmit').txt(dados.tipoEmitente || '1').up()
          .ele('cLocEmi').txt(dados.codigoMunicipioEmissao).up();

    // Substituição (se houver)
    if (dados.chaveSubstituicao) {
      dps.ele('subst')
        .ele('chSubstda').txt(dados.chaveSubstituicao).up()
      .up();
    }

    // Prestador
    this._addPrestador(dps, dados.prestador);

    // Tomador
    this._addTomador(dps, dados.tomador);

    // Intermediário (opcional)
    if (dados.intermediario) {
      this._addIntermediario(dps, dados.intermediario);
    }

    // Serviço
    this._addServico(dps, dados.servico);

    // Informações complementares
    if (dados.infoComplementar) {
      dps.ele('infComp').txt(dados.infoComplementar).up();
    }

    dps.up(); // fecha infDPS
    dps.up(); // fecha DPS

    return dps.end({ prettyPrint: true });
  }

  _gerarIdDps(dados) {
    // ID = DPS + Código IBGE (7) + Tipo Inscrição (1) + CNPJ/CPF (14) + Série (5) + Número (15)
    const tipoInscricao = dados.prestador.cnpj ? '1' : '2';
    const inscricao = (dados.prestador.cnpj || dados.prestador.cpf).padStart(14, '0');
    const serie = dados.serie.toString().padStart(5, '0');
    const numero = dados.numero.toString().padStart(15, '0');
    
    return `DPS${dados.codigoMunicipioEmissao}${tipoInscricao}${inscricao}${serie}${numero}`;
  }

  _addPrestador(dps, prestador) {
    const prest = dps.ele('prest');
    
    if (prestador.cnpj) {
      prest.ele('CNPJ').txt(prestador.cnpj.replace(/\D/g, '')).up();
    } else {
      prest.ele('CPF').txt(prestador.cpf.replace(/\D/g, '')).up();
    }
    
    if (prestador.inscricaoMunicipal) {
      prest.ele('IM').txt(prestador.inscricaoMunicipal).up();
    }
    
    prest.ele('xNome').txt(prestador.razaoSocial).up();
    
    // Endereço
    if (prestador.endereco) {
      const end = prest.ele('end');
      end.ele('xLgr').txt(prestador.endereco.logradouro).up();
      end.ele('nro').txt(prestador.endereco.numero).up();
      if (prestador.endereco.complemento) {
        end.ele('xCpl').txt(prestador.endereco.complemento).up();
      }
      end.ele('xBairro').txt(prestador.endereco.bairro).up();
      end.ele('cMun').txt(prestador.endereco.codigoIbge).up();
      end.ele('UF').txt(prestador.endereco.uf).up();
      end.ele('CEP').txt(prestador.endereco.cep.replace(/\D/g, '')).up();
      end.up();
    }
    
    if (prestador.telefone) {
      prest.ele('fone').txt(prestador.telefone.replace(/\D/g, '')).up();
    }
    if (prestador.email) {
      prest.ele('email').txt(prestador.email).up();
    }
    
    // Regime Tributário
    const regTrib = prest.ele('regTrib');
    if (prestador.simplesNacional) {
      regTrib.ele('opSN').txt('1').up();
    } else {
      regTrib.ele('opSN').txt('2').up();
    }
    if (prestador.regimeEspecial) {
      regTrib.ele('regEspTrib').txt(prestador.regimeEspecial.toString()).up();
    }
    regTrib.up();
    
    prest.up();
  }

  _addTomador(dps, tomador) {
    const toma = dps.ele('toma');
    
    if (tomador.cnpj) {
      toma.ele('CNPJ').txt(tomador.cnpj.replace(/\D/g, '')).up();
    } else if (tomador.cpf) {
      toma.ele('CPF').txt(tomador.cpf.replace(/\D/g, '')).up();
    }
    
    toma.ele('xNome').txt(tomador.nome).up();
    
    if (tomador.endereco) {
      const end = toma.ele('end');
      end.ele('xLgr').txt(tomador.endereco.logradouro).up();
      end.ele('nro').txt(tomador.endereco.numero).up();
      if (tomador.endereco.complemento) {
        end.ele('xCpl').txt(tomador.endereco.complemento).up();
      }
      end.ele('xBairro').txt(tomador.endereco.bairro).up();
      end.ele('cMun').txt(tomador.endereco.codigoIbge).up();
      end.ele('UF').txt(tomador.endereco.uf).up();
      end.ele('CEP').txt(tomador.endereco.cep.replace(/\D/g, '')).up();
      end.up();
    }
    
    if (tomador.telefone) {
      toma.ele('fone').txt(tomador.telefone.replace(/\D/g, '')).up();
    }
    if (tomador.email) {
      toma.ele('email').txt(tomador.email).up();
    }
    
    toma.up();
  }

  _addServico(dps, servico) {
    const serv = dps.ele('serv');
    
    // Local da prestação
    const locPrest = serv.ele('locPrest');
    locPrest.ele('cLocPrest').txt(servico.codigoMunicipioPrestacao).up();
    locPrest.ele('cPaisPrest').txt('1058').up(); // Brasil
    locPrest.up();
    
    // Código do Serviço
    const cServ = serv.ele('cServ');
    cServ.ele('cTribNac').txt(servico.codigoTributacaoNacional).up();
    if (servico.codigoTributacaoMunicipal) {
      cServ.ele('cTribMun').txt(servico.codigoTributacaoMunicipal).up();
    }
    cServ.ele('xDescServ').txt(servico.descricao).up();
    cServ.ele('cNBS').txt(servico.codigoNbs).up();
    cServ.up();
    
    // Valores
    serv.ele('vServ').txt(this._formatarValor(servico.valorServico)).up();
    serv.ele('vDesc').txt(this._formatarValor(servico.valorDesconto || 0)).up();
    serv.ele('vBC').txt(this._formatarValor(servico.baseCalculo)).up();
    serv.ele('pAliqISS').txt(this._formatarValor(servico.aliquotaIss)).up();
    serv.ele('vISS').txt(this._formatarValor(servico.valorIss)).up();
    serv.ele('vLiq').txt(this._formatarValor(servico.valorLiquido)).up();
    
    // Tributação
    const trib = serv.ele('trib');
    
    // Tributação Municipal
    const tribMun = trib.ele('tribMun');
    tribMun.ele('tribISSQN').txt(servico.tributacao?.issqn || '1').up();
    tribMun.ele('cPaisResult').txt('1058').up();
    
    const bm = tribMun.ele('BM');
    bm.ele('vBCISS').txt(this._formatarValor(servico.baseCalculo)).up();
    bm.ele('pAliq').txt(this._formatarValor(servico.aliquotaIss)).up();
    bm.ele('vISS').txt(this._formatarValor(servico.valorIss)).up();
    bm.ele('tpRetISS').txt(servico.retencaoIss ? '2' : '1').up();
    bm.up();
    tribMun.up();
    
    // Tributação Federal (se aplicável)
    if (servico.tributacao?.federal) {
      const tribFed = trib.ele('tribFed');
      tribFed.ele('CST').txt(servico.tributacao.federal.cst || '01').up();
      // ... outros campos federais
      tribFed.up();
    }
    
    // Total tributos
    const totTrib = trib.ele('totTrib');
    totTrib.ele('vTotTrib').txt(this._formatarValor(servico.valorIss)).up();
    totTrib.up();
    
    trib.up();
    serv.up();
  }

  _formatarValor(valor) {
    return Number(valor).toFixed(2);
  }
}

module.exports = DpsBuilder;
```

---

## 7. ENDPOINTS DA API

### 7.1 Tabela de Rotas - SEFIN Nacional

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/SefinNacional/nfse` | Emitir NFS-e (envia DPS) |
| `GET` | `/SefinNacional/nfse/{chaveAcesso}` | Consultar NFS-e por chave |
| `POST` | `/SefinNacional/nfse/{chaveAcesso}/eventos` | Registrar evento (cancelamento) |
| `GET` | `/SefinNacional/nfse/{chaveAcesso}/eventos` | Listar eventos da NFS-e |
| `GET` | `/SefinNacional/nfse/{chaveAcesso}/eventos/{tipoEvento}` | Eventos por tipo |
| `GET` | `/SefinNacional/danfse/{chaveAcesso}` | Obter PDF (DANFSe) |
| `GET` | `/SefinNacional/dps/{idDps}` | Consultar DPS |
| `HEAD` | `/SefinNacional/dps/{idDps}` | Verificar se DPS virou NFS-e |

### 7.2 Tabela de Rotas - ADN (Ambiente de Dados Nacional)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/contribuintes/DFe/{NSU}` | Distribuição de DF-e por NSU |
| `GET` | `/contribuintes/DFe/ultNSU` | Último NSU disponível |

### 7.3 Tabela de Rotas - Parâmetros Municipais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/parametrizacao/municipios/{codIbge}/parametros` | Parâmetros gerais |
| `GET` | `/parametrizacao/municipios/{codIbge}/aliquotas` | Alíquotas ISS |
| `GET` | `/parametrizacao/municipios/{codIbge}/convenio` | Status convênio |
| `GET` | `/parametrizacao/municipios/{codIbge}/regimes` | Regimes especiais |
| `GET` | `/parametrizacao/municipios/{codIbge}/retencoes` | Regras retenção |
| `GET` | `/parametrizacao/municipios/{codIbge}/beneficios` | Benefícios fiscais |

### 7.4 Detalhamento das Rotas

#### POST /SefinNacional/nfse - Emitir NFS-e

**Request:**
```json
{
  "dps": "H4sIAAAAAAAAA6tWKkktLlGyUlAqS8wpTgUA..." // XML GZip+Base64
}
```

**Response Sucesso (200):**
```json
{
  "nfse": "H4sIAAAAAAAAA...",           // XML NFS-e GZip+Base64
  "chaveAcesso": "NFSe42042021234567800019900001000000001123456789",
  "numero": "000000001",
  "codigoVerificacao": "ABCD1234",
  "dataEmissao": "2026-01-15T10:30:00-03:00"
}
```

**Response Erro (400):**
```json
{
  "erros": [
    {
      "codigo": "E001",
      "mensagem": "CNPJ do prestador inválido",
      "campo": "infDPS/prest/CNPJ"
    }
  ]
}
```

#### POST /SefinNacional/nfse/{chaveAcesso}/eventos - Cancelar

**Request:**
```json
{
  "pedRegEvento": "H4sIAAAAAAAAA..." // XML Evento GZip+Base64
}
```

---

## 8. FLUXOS DE OPERAÇÃO

### 8.1 Fluxo de Emissão

```
┌─────────────────────────────────────────────────────────────────┐
│                        FLUXO DE EMISSÃO                         │
└─────────────────────────────────────────────────────────────────┘

1. PREPARAÇÃO
   ├── Validar dados do serviço
   ├── Buscar parâmetros municipais (alíquota, códigos)
   └── Verificar certificado digital válido

2. MONTAGEM
   ├── Construir XML da DPS
   ├── Gerar ID único da DPS
   └── Preencher todos campos obrigatórios

3. ASSINATURA
   ├── Canonicalizar XML
   ├── Calcular digest SHA-256
   └── Assinar com RSA-SHA256

4. ENVIO
   ├── Comprimir XML (GZip)
   ├── Codificar Base64
   ├── POST /nfse com mTLS
   └── Timeout: 60 segundos

5. PROCESSAMENTO RESPOSTA
   ├── Se sucesso: extrair chave de acesso
   ├── Se erro: logar e tratar
   └── Salvar XML da NFS-e

6. PÓS-PROCESSAMENTO
   ├── Baixar DANFSe (PDF)
   ├── Enviar por email ao tomador
   └── Atualizar status no banco
```

### 8.2 Fluxo de Cancelamento

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO DE CANCELAMENTO                       │
└─────────────────────────────────────────────────────────────────┘

1. VALIDAÇÕES
   ├── NFS-e existe e está autorizada
   ├── Prazo de cancelamento não expirou (varia por município)
   └── Não há evento de cancelamento anterior

2. MONTAGEM EVENTO
   ├── Construir XML do Pedido de Registro de Evento
   ├── Tipo evento: 101001 (Cancelamento)
   └── Justificativa obrigatória

3. ASSINATURA E ENVIO
   ├── Assinar XML do evento
   ├── POST /nfse/{chaveAcesso}/eventos
   └── Aguardar resposta

4. PROCESSAMENTO
   ├── Se aceito: NFS-e cancelada
   ├── Se rejeitado: verificar motivo
   └── Atualizar status no banco
```

### 8.3 Fluxo de Substituição

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUXO DE SUBSTITUIÇÃO                       │
└─────────────────────────────────────────────────────────────────┘

1. Montar nova DPS com campo <subst>
2. Informar chave de acesso da NFS-e a ser substituída
3. Enviar normalmente via POST /nfse
4. Sistema:
   ├── Valida nova DPS
   ├── Cancela NFS-e original
   ├── Gera nova NFS-e
   └── Vincula as duas notas
```

---

## 9. CÓDIGOS E TABELAS

### 9.1 Códigos de Tributação Nacional (cTribNac)

Os códigos seguem a Lista de Serviços da LC 116/2003. Exemplos:

| Código | Descrição |
|--------|-----------|
| 010101 | Análise e desenvolvimento de sistemas |
| 010102 | Programação |
| 010103 | Processamento de dados |
| 010104 | Elaboração de programas |
| 010105 | Licenciamento de software |
| 010201 | Consultoria de hardware |
| 070201 | Engenharia consultiva |
| 140101 | Limpeza e conservação |
| 170501 | Transporte de natureza municipal |

> **IMPORTANTE:** Consultar tabela completa em:
> https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/anexo_b-nbs2-lista_servico_nacional-snnfse.xlsx

### 9.2 Código NBS (Nomenclatura Brasileira de Serviços)

| NBS | Descrição |
|-----|-----------|
| 1.1101.10.00 | Serviços de desenvolvimento de software sob encomenda |
| 1.1102.10.00 | Licenciamento de software de prateleira |
| 1.1201.10.00 | Serviços de consultoria em TI |
| 1.2001.10.00 | Serviços de contabilidade |

### 9.3 Tipos de Evento

| Código | Tipo | Descrição |
|--------|------|-----------|
| 101001 | Cancelamento | Cancela a NFS-e |
| 101002 | Cancelamento por Substituição | Automático na substituição |
| 105001 | Cancelamento Deferido | Pelo fiscal |
| 105002 | Cancelamento Indeferido | Negado pelo fiscal |
| 201001 | Manifestação - Confirmação | Tomador confirma |
| 201002 | Manifestação - Rejeição | Tomador rejeita |

### 9.4 Tipos de Retenção ISS

| Código | Descrição |
|--------|-----------|
| 1 | Não retido |
| 2 | Retido pelo tomador |
| 3 | Retido pelo intermediário |

### 9.5 Regime Especial Tributário

| Código | Descrição |
|--------|-----------|
| 0 | Nenhum |
| 1 | Microempresa Municipal |
| 2 | Estimativa |
| 3 | Sociedade de Profissionais |
| 4 | Cooperativa |
| 5 | MEI |
| 6 | ME/EPP Simples Nacional |

### 9.6 Códigos IBGE - Santa Catarina (Exemplo)

| Código | Município |
|--------|-----------|
| 4204202 | Chapecó |
| 4205407 | Florianópolis |
| 4209102 | Joinville |
| 4204608 | Criciúma |
| 4202008 | Blumenau |
| 4211702 | Lages |

---

## 10. TRATAMENTO DE ERROS

### 10.1 Códigos de Erro do ADN (Prefixo E)

| Código | Descrição | Ação |
|--------|-----------|------|
| E001 | CNPJ inválido | Corrigir CNPJ |
| E002 | CPF inválido | Corrigir CPF |
| E003 | Inscrição Municipal inválida | Verificar IM |
| E004 | Código município inválido | Usar código IBGE correto |
| E005 | Data emissão inválida | Formato ISO 8601 |
| E006 | Série deve ser numérica | A partir de 2026 |
| E007 | Valor negativo | Corrigir valores |
| E008 | Assinatura inválida | Verificar certificado |
| E009 | XML mal formado | Validar contra XSD |
| E010 | Código NBS inválido | Consultar tabela NBS |
| E011 | DPS duplicada | Verificar idempotência |
| E012 | Município não conveniado | Verificar adesão |

### 10.2 Códigos HTTP

| Status | Descrição | Ação |
|--------|-----------|------|
| 200 | Sucesso | Processar resposta |
| 400 | Bad Request | Verificar payload |
| 401 | Não autorizado | Verificar certificado |
| 403 | Proibido | mTLS inválido |
| 404 | Não encontrado | Verificar endpoint/chave |
| 409 | Conflito | DPS duplicada |
| 429 | Rate limit | Aguardar e retry |
| 500 | Erro servidor | Retry com backoff |
| 503 | Indisponível | Retry com backoff |

### 10.3 Implementação de Retry

```javascript
// utils/retry.utils.js

async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    retryOn = [429, 500, 502, 503, 504]
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const statusCode = error.response?.status;
      
      if (!retryOn.includes(statusCode) || attempt === maxAttempts) {
        throw error;
      }
      
      // Exponential backoff com jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
        maxDelay
      );
      
      console.log(`Retry ${attempt}/${maxAttempts} após ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

module.exports = { withRetry };
```

---

## 11. IMPLEMENTAÇÃO NODE.JS

### 11.1 Assinatura XML

```javascript
// services/nfse/XmlSigner.js

const { SignedXml } = require('xml-crypto');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

class XmlSigner {
  constructor(certificateManager) {
    this.certManager = certificateManager;
  }

  sign(xmlString, referenceId) {
    const doc = new DOMParser().parseFromString(xmlString);
    
    const sig = new SignedXml();
    
    // Configurar algoritmos
    sig.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
    
    // Chave privada
    sig.signingKey = this.certManager.getPrivateKeyPem();
    
    // Referência ao elemento a ser assinado
    sig.addReference(
      `//*[@Id='${referenceId}']`,
      [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
      ],
      'http://www.w3.org/2001/04/xmlenc#sha256'
    );
    
    // KeyInfo com X509
    sig.keyInfoProvider = {
      getKeyInfo: () => {
        const cert = this.certManager.getCertificatePem();
        const certBase64 = cert
          .replace('-----BEGIN CERTIFICATE-----', '')
          .replace('-----END CERTIFICATE-----', '')
          .replace(/\s/g, '');
        
        return `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`;
      }
    };
    
    // Calcular assinatura
    sig.computeSignature(xmlString, {
      location: { reference: `//*[@Id='${referenceId}']`, action: 'append' }
    });
    
    return sig.getSignedXml();
  }
}

module.exports = XmlSigner;
```

### 11.2 Serviço Principal

```javascript
// services/nfse/NfseService.js

const CertificateManager = require('./CertificateManager');
const NfseClient = require('./NfseClient');
const DpsBuilder = require('./DpsBuilder');
const XmlSigner = require('./XmlSigner');
const { withRetry } = require('../../utils/retry.utils');
const NFSE_CONFIG = require('../../config/nfse.config');

class NfseService {
  constructor(options = {}) {
    const ambiente = options.ambiente || 'producao';
    this.config = NFSE_CONFIG[ambiente];
    
    this.certManager = new CertificateManager(
      options.certificadoPath,
      options.certificadoSenha
    ).load();
    
    this.client = new NfseClient(this.config, this.certManager);
    this.dpsBuilder = new DpsBuilder(ambiente);
    this.xmlSigner = new XmlSigner(this.certManager);
  }

  /**
   * Emitir NFS-e
   */
  async emitir(dadosNota) {
    // 1. Validar dados
    this._validarDados(dadosNota);
    
    // 2. Buscar parâmetros municipais
    const parametros = await this.client.getParametrosMunicipais(
      dadosNota.codigoMunicipioEmissao
    );
    
    // 3. Montar XML da DPS
    const xmlDps = this.dpsBuilder.build({
      ...dadosNota,
      aliquotaIss: parametros.aliquotaPadrao || dadosNota.servico.aliquotaIss
    });
    
    // 4. Extrair ID para assinatura
    const idDps = this._extrairIdDps(xmlDps);
    
    // 5. Assinar XML
    const xmlAssinado = this.xmlSigner.sign(xmlDps, idDps);
    
    // 6. Enviar com retry
    const resultado = await withRetry(
      () => this.client.emitir(xmlAssinado),
      { maxAttempts: 3 }
    );
    
    // 7. Processar resposta
    return {
      sucesso: true,
      chaveAcesso: resultado.chaveAcesso,
      numero: resultado.numero,
      codigoVerificacao: resultado.codigoVerificacao,
      dataEmissao: resultado.dataEmissao,
      xmlNfse: resultado.nfseXml
    };
  }

  /**
   * Consultar NFS-e
   */
  async consultar(chaveAcesso) {
    const resultado = await this.client.consultar(chaveAcesso);
    return {
      chaveAcesso,
      xmlNfse: resultado.nfseXml,
      status: 'autorizada'
    };
  }

  /**
   * Cancelar NFS-e
   */
  async cancelar(chaveAcesso, justificativa) {
    if (!justificativa || justificativa.length < 15) {
      throw new Error('Justificativa deve ter no mínimo 15 caracteres');
    }
    
    // Montar XML do evento de cancelamento
    const xmlEvento = this._montarEventoCancelamento(chaveAcesso, justificativa);
    
    // Assinar
    const xmlAssinado = this.xmlSigner.sign(xmlEvento, `EVT${Date.now()}`);
    
    // Enviar
    const resultado = await this.client.registrarEvento(chaveAcesso, xmlAssinado);
    
    return {
      sucesso: true,
      chaveAcesso,
      protocolo: resultado.protocolo,
      dataEvento: resultado.dataEvento
    };
  }

  /**
   * Obter PDF (DANFSe)
   */
  async obterPdf(chaveAcesso) {
    const pdfBuffer = await this.client.obterDanfse(chaveAcesso);
    return pdfBuffer;
  }

  /**
   * Consultar DPS
   */
  async consultarDps(idDps) {
    return await this.client.consultarDps(idDps);
  }

  // Métodos privados
  
  _validarDados(dados) {
    const erros = [];
    
    if (!dados.prestador?.cnpj && !dados.prestador?.cpf) {
      erros.push('CNPJ ou CPF do prestador é obrigatório');
    }
    
    if (!dados.tomador?.nome) {
      erros.push('Nome do tomador é obrigatório');
    }
    
    if (!dados.servico?.valorServico || dados.servico.valorServico <= 0) {
      erros.push('Valor do serviço deve ser maior que zero');
    }
    
    if (!dados.servico?.codigoTributacaoNacional) {
      erros.push('Código de tributação nacional é obrigatório');
    }
    
    if (!dados.servico?.codigoNbs) {
      erros.push('Código NBS é obrigatório');
    }
    
    if (erros.length > 0) {
      throw new Error(`Dados inválidos: ${erros.join('; ')}`);
    }
  }

  _extrairIdDps(xml) {
    const match = xml.match(/Id="(DPS[^"]+)"/);
    return match ? match[1] : null;
  }

  _montarEventoCancelamento(chaveAcesso, justificativa) {
    const { create } = require('xmlbuilder2');
    const moment = require('moment');
    
    return create({ version: '1.0', encoding: 'UTF-8' })
      .ele('pedRegEvento', {
        xmlns: 'http://www.sped.fazenda.gov.br/nfse',
        versao: '1.00'
      })
        .ele('infPedReg', { Id: `EVT${Date.now()}` })
          .ele('tpAmb').txt(this.config.ambiente).up()
          .ele('verAplic').txt('1.0.0').up()
          .ele('dhEvento').txt(moment().format('YYYY-MM-DDTHH:mm:ssZ')).up()
          .ele('CNPJAutor').txt(this.certManager.getInfo().cnpj).up()
          .ele('chNFSe').txt(chaveAcesso).up()
          .ele('nPedRegEvento').txt('1').up()
          .ele('evento')
            .ele('infEvento')
              .ele('tpEvento').txt('101001').up() // Cancelamento
              .ele('cMotivo').txt('1').up()
              .ele('xMotivo').txt(justificativa).up()
            .up()
          .up()
        .up()
      .up()
      .end({ prettyPrint: true });
  }
}

module.exports = NfseService;
```

### 11.3 Rotas Express

```javascript
// routes/nfse.routes.js

const express = require('express');
const router = express.Router();
const NfseService = require('../services/nfse/NfseService');

// Middleware de autenticação
const authMiddleware = require('../middlewares/auth');

// Inicializar serviço (em produção, usar injeção de dependência)
const getNfseService = (empresa) => {
  return new NfseService({
    ambiente: process.env.NFSE_AMBIENTE || 'homologacao',
    certificadoPath: empresa.certificadoPath,
    certificadoSenha: empresa.certificadoSenha
  });
};

/**
 * POST /api/nfse/emitir
 * Emitir nova NFS-e
 */
router.post('/emitir', authMiddleware, async (req, res) => {
  try {
    const nfseService = getNfseService(req.empresa);
    
    const resultado = await nfseService.emitir({
      serie: req.body.serie || 1,
      numero: req.body.numero,
      dataCompetencia: req.body.dataCompetencia || new Date(),
      codigoMunicipioEmissao: req.empresa.codigoIbge,
      versaoApp: '1.0.0',
      tipoEmitente: '1',
      
      prestador: {
        cnpj: req.empresa.cnpj,
        inscricaoMunicipal: req.empresa.inscricaoMunicipal,
        razaoSocial: req.empresa.razaoSocial,
        simplesNacional: req.empresa.simplesNacional,
        endereco: req.empresa.endereco,
        telefone: req.empresa.telefone,
        email: req.empresa.email
      },
      
      tomador: req.body.tomador,
      servico: req.body.servico,
      infoComplementar: req.body.observacoes
    });
    
    // Salvar no banco
    await salvarNfse(resultado, req.empresa.id);
    
    res.json({
      sucesso: true,
      dados: resultado
    });
    
  } catch (error) {
    console.error('Erro ao emitir NFS-e:', error);
    res.status(400).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * GET /api/nfse/:chaveAcesso
 * Consultar NFS-e
 */
router.get('/:chaveAcesso', authMiddleware, async (req, res) => {
  try {
    const nfseService = getNfseService(req.empresa);
    const resultado = await nfseService.consultar(req.params.chaveAcesso);
    
    res.json({
      sucesso: true,
      dados: resultado
    });
  } catch (error) {
    res.status(404).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * POST /api/nfse/:chaveAcesso/cancelar
 * Cancelar NFS-e
 */
router.post('/:chaveAcesso/cancelar', authMiddleware, async (req, res) => {
  try {
    const nfseService = getNfseService(req.empresa);
    
    const resultado = await nfseService.cancelar(
      req.params.chaveAcesso,
      req.body.justificativa
    );
    
    res.json({
      sucesso: true,
      dados: resultado
    });
  } catch (error) {
    res.status(400).json({
      sucesso: false,
      erro: error.message
    });
  }
});

/**
 * GET /api/nfse/:chaveAcesso/pdf
 * Obter PDF da NFS-e
 */
router.get('/:chaveAcesso/pdf', authMiddleware, async (req, res) => {
  try {
    const nfseService = getNfseService(req.empresa);
    const pdfBuffer = await nfseService.obterPdf(req.params.chaveAcesso);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      `attachment; filename=nfse-${req.params.chaveAcesso}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(404).json({
      sucesso: false,
      erro: error.message
    });
  }
});

module.exports = router;
```

---

## 12. BANCO DE DADOS

### 12.1 Modelo PostgreSQL

```sql
-- Tabela de NFS-e emitidas
CREATE TABLE nfse (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    
    -- Identificação
    chave_acesso VARCHAR(50) UNIQUE,
    numero VARCHAR(15) NOT NULL,
    serie VARCHAR(5) NOT NULL,
    codigo_verificacao VARCHAR(20),
    
    -- Datas
    data_emissao TIMESTAMP WITH TIME ZONE NOT NULL,
    data_competencia DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'autorizada',
    -- autorizada, cancelada, substituida
    
    -- Tomador
    tomador_documento VARCHAR(14),
    tomador_nome VARCHAR(200),
    tomador_email VARCHAR(200),
    
    -- Serviço
    codigo_servico VARCHAR(10),
    descricao_servico TEXT,
    valor_servico DECIMAL(15,2) NOT NULL,
    valor_desconto DECIMAL(15,2) DEFAULT 0,
    base_calculo DECIMAL(15,2) NOT NULL,
    aliquota_iss DECIMAL(5,2) NOT NULL,
    valor_iss DECIMAL(15,2) NOT NULL,
    valor_liquido DECIMAL(15,2) NOT NULL,
    
    -- XMLs
    xml_dps TEXT,
    xml_nfse TEXT,
    
    -- Índices
    CONSTRAINT nfse_empresa_numero_serie_uk 
        UNIQUE (empresa_id, numero, serie)
);

-- Índices
CREATE INDEX idx_nfse_empresa ON nfse(empresa_id);
CREATE INDEX idx_nfse_chave ON nfse(chave_acesso);
CREATE INDEX idx_nfse_data ON nfse(data_emissao);
CREATE INDEX idx_nfse_status ON nfse(status);

-- Tabela de eventos
CREATE TABLE nfse_eventos (
    id SERIAL PRIMARY KEY,
    nfse_id INTEGER NOT NULL REFERENCES nfse(id),
    
    tipo_evento VARCHAR(10) NOT NULL,
    -- 101001 = cancelamento
    -- 201001 = manifestacao
    
    numero_sequencial INTEGER NOT NULL,
    data_evento TIMESTAMP WITH TIME ZONE NOT NULL,
    protocolo VARCHAR(50),
    justificativa TEXT,
    xml_evento TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de log de envios
CREATE TABLE nfse_log (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    operacao VARCHAR(20) NOT NULL,
    -- emissao, consulta, cancelamento
    
    request_payload TEXT,
    response_payload TEXT,
    status_code INTEGER,
    erro TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sequência para numeração
CREATE TABLE nfse_sequencia (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id),
    serie VARCHAR(5) NOT NULL,
    ultimo_numero INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT nfse_seq_uk UNIQUE (empresa_id, serie)
);

-- Função para obter próximo número
CREATE OR REPLACE FUNCTION get_proximo_numero_nfse(
    p_empresa_id INTEGER,
    p_serie VARCHAR(5)
) RETURNS INTEGER AS $$
DECLARE
    v_numero INTEGER;
BEGIN
    INSERT INTO nfse_sequencia (empresa_id, serie, ultimo_numero)
    VALUES (p_empresa_id, p_serie, 1)
    ON CONFLICT (empresa_id, serie)
    DO UPDATE SET ultimo_numero = nfse_sequencia.ultimo_numero + 1
    RETURNING ultimo_numero INTO v_numero;
    
    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;
```

---

## 13. TESTES E HOMOLOGAÇÃO

### 13.1 Ambiente de Homologação

```javascript
// Configuração para testes
const configHomologacao = {
  ambiente: 'homologacao',
  certificadoPath: './certificados/teste.pfx',
  certificadoSenha: process.env.CERT_PASSWORD
};

// Dados de teste
const dadosTeste = {
  serie: 1,
  numero: 1,
  dataCompetencia: new Date(),
  codigoMunicipioEmissao: '4204202', // Chapecó
  
  prestador: {
    cnpj: '12345678000199',
    inscricaoMunicipal: '12345',
    razaoSocial: 'EMPRESA TESTE LTDA',
    simplesNacional: true,
    endereco: {
      logradouro: 'RUA TESTE',
      numero: '100',
      bairro: 'CENTRO',
      codigoIbge: '4204202',
      uf: 'SC',
      cep: '89800000'
    }
  },
  
  tomador: {
    cpf: '12345678901',
    nome: 'CLIENTE TESTE',
    endereco: {
      logradouro: 'AV TESTE',
      numero: '200',
      bairro: 'CENTRO',
      codigoIbge: '4204202',
      uf: 'SC',
      cep: '89800000'
    },
    email: 'teste@email.com'
  },
  
  servico: {
    codigoTributacaoNacional: '010101',
    codigoNbs: '1.1101.10.00',
    descricao: 'SERVICO DE TESTE PARA HOMOLOGACAO',
    valorServico: 100.00,
    valorDesconto: 0,
    baseCalculo: 100.00,
    aliquotaIss: 5.00,
    valorIss: 5.00,
    valorLiquido: 95.00,
    codigoMunicipioPrestacao: '4204202'
  }
};
```

### 13.2 Casos de Teste

```javascript
// tests/nfse.test.js

describe('NFS-e Nacional', () => {
  
  describe('Emissão', () => {
    it('deve emitir NFS-e com dados válidos', async () => {
      const resultado = await nfseService.emitir(dadosTeste);
      expect(resultado.sucesso).toBe(true);
      expect(resultado.chaveAcesso).toHaveLength(50);
    });
    
    it('deve rejeitar sem CNPJ do prestador', async () => {
      const dados = { ...dadosTeste };
      delete dados.prestador.cnpj;
      await expect(nfseService.emitir(dados)).rejects.toThrow();
    });
    
    it('deve rejeitar valor zero', async () => {
      const dados = { ...dadosTeste };
      dados.servico.valorServico = 0;
      await expect(nfseService.emitir(dados)).rejects.toThrow();
    });
  });
  
  describe('Consulta', () => {
    it('deve consultar NFS-e existente', async () => {
      const resultado = await nfseService.consultar(chaveAcessoValida);
      expect(resultado.xmlNfse).toBeDefined();
    });
    
    it('deve retornar erro para chave inválida', async () => {
      await expect(
        nfseService.consultar('CHAVE_INVALIDA')
      ).rejects.toThrow();
    });
  });
  
  describe('Cancelamento', () => {
    it('deve cancelar NFS-e com justificativa válida', async () => {
      const resultado = await nfseService.cancelar(
        chaveAcessoValida,
        'Cancelamento para teste de homologacao do sistema'
      );
      expect(resultado.sucesso).toBe(true);
    });
    
    it('deve rejeitar justificativa curta', async () => {
      await expect(
        nfseService.cancelar(chaveAcessoValida, 'curta')
      ).rejects.toThrow();
    });
  });
});
```

---

## 14. CHECKLIST DE IMPLEMENTAÇÃO

### 14.1 Pré-Requisitos

- [ ] Certificado digital A1 válido
- [ ] Empresa cadastrada no município
- [ ] Inscrição Municipal ativa
- [ ] Acesso ao ambiente de homologação
- [ ] Node.js 18+ instalado

### 14.2 Desenvolvimento

- [ ] Configurar variáveis de ambiente
- [ ] Implementar CertificateManager
- [ ] Implementar NfseClient com mTLS
- [ ] Implementar DpsBuilder
- [ ] Implementar XmlSigner
- [ ] Implementar NfseService
- [ ] Criar rotas da API
- [ ] Criar tabelas no banco
- [ ] Implementar testes unitários

### 14.3 Testes em Homologação

- [ ] Emitir NFS-e de teste
- [ ] Consultar NFS-e emitida
- [ ] Baixar PDF (DANFSe)
- [ ] Cancelar NFS-e
- [ ] Testar substituição
- [ ] Testar erros conhecidos
- [ ] Validar XMLs contra XSD

### 14.4 Produção

- [ ] Trocar certificado de teste por produção
- [ ] Alterar URLs para produção
- [ ] Configurar monitoramento
- [ ] Configurar alertas de erro
- [ ] Documentar processo de suporte
- [ ] Treinar equipe

---

## 📚 REFERÊNCIAS

### Links Oficiais

| Recurso | URL |
|---------|-----|
| Portal NFS-e | https://www.gov.br/nfse |
| Documentação Técnica | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica |
| APIs Produção | https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao |
| Manual Contribuintes | [PDF](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/manual-contribuintes-emissor-publico-api-sistema-nacional-nfs-e-v1-2-out2025.pdf) |
| Esquemas XSD | [ZIP](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/nfse-esquemas_xsd-anexos_i_ii_iv-sefin_adn-prod-v1-00-20251216.zip) |
| Anexo I - Layout DPS | [XLSX](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/anexo_i-sefin_adn-dps_nfse-snnfse-v1-00-20251216.xlsx) |
| Tabela NBS | [XLSX](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/anexo_b-nbs2-lista_servico_nacional-snnfse.xlsx) |

### Swagger APIs

| Ambiente | URL |
|----------|-----|
| Produção - Contribuintes | https://www.nfse.gov.br/swagger/contribuintesissqn |
| Homologação - Contribuintes | https://www.producaorestrita.nfse.gov.br/swagger/contribuintesissqn |
| Produção - ADN | https://adn.nfse.gov.br/contribuintes/docs/index.html |
| Produção - DANFSE | https://adn.nfse.gov.br/danfse/docs/index.html |

---

**Documento criado em:** Janeiro 2026  
**Última atualização:** Janeiro 2026  
**Versão:** 1.0
