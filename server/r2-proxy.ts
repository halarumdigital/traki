import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import https from "https";
import { Request, Response } from "express";

// Cliente R2
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
      requestHandler: {
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
          keepAlive: true,
        }),
      },
      forcePathStyle: true,
    });
  }
  return r2Client;
}

/**
 * Proxy para servir imagens do R2
 * Converte URLs do formato R2 para buscar via API
 */
export async function r2ProxyHandler(req: Request, res: Response) {
  try {
    // Extrair o caminho do arquivo da URL
    let filePath = req.params[0] || req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ message: "Caminho do arquivo não especificado" });
    }

    // Se for uma URL completa do R2, extrair apenas o caminho
    if (filePath.includes("r2.dev")) {
      const match = filePath.match(/r2\.dev\/(.*)/);
      if (match) {
        filePath = match[1];
      }
    }

    console.log(`🔄 [R2 Proxy] Buscando arquivo: ${filePath}`);

    const bucketName = process.env.R2_BUCKET_NAME || "fretus";

    // Buscar o objeto do R2
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: filePath,
    });

    const client = getR2Client();
    const response = await client.send(command);

    if (!response.Body) {
      return res.status(404).json({ message: "Arquivo não encontrado" });
    }

    // Configurar headers de resposta
    res.setHeader("Content-Type", response.ContentType || "application/octet-stream");

    if (response.ContentLength) {
      res.setHeader("Content-Length", response.ContentLength.toString());
    }

    // Cache por 30 dias
    res.setHeader("Cache-Control", "public, max-age=2592000");

    // Permitir CORS
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Converter o stream para buffer e enviar
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);
    res.send(buffer);

  } catch (error: any) {
    console.error("❌ [R2 Proxy] Erro:", error.message);

    if (error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ message: "Arquivo não encontrado no R2" });
    }

    res.status(500).json({
      message: "Erro ao buscar arquivo",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}

/**
 * Middleware para converter URLs do R2 automaticamente
 * Transforma URLs antigas do R2 para usar o proxy
 */
export function transformR2Urls(obj: any): any {
  if (!obj) return obj;

  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  const serverUrl = process.env.SERVER_URL || "";

  if (!r2PublicUrl) return obj;

  const transform = (value: any): any => {
    if (typeof value === "string" && value.includes(r2PublicUrl)) {
      // Converter URL do R2 para URL do proxy
      const path = value.replace(r2PublicUrl + "/", "");
      return `${serverUrl}/api/r2-proxy/${path}`;
    }

    if (Array.isArray(value)) {
      return value.map(transform);
    }

    if (value && typeof value === "object") {
      const transformed: any = {};
      for (const key in value) {
        transformed[key] = transform(value[key]);
      }
      return transformed;
    }

    return value;
  };

  return transform(obj);
}