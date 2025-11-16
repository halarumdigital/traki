import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import https from "https";

// Cliente R2 será inicializado sob demanda
let r2Client: S3Client | null = null;

// Função para obter ou criar o cliente R2
function getR2Client(): S3Client {
  if (!r2Client) {
    console.log("🔧 Inicializando cliente R2...");
    console.log(`  Account ID: ${process.env.R2_ACCOUNT_ID}`);
    console.log(`  Bucket: ${process.env.R2_BUCKET_NAME || "fretus"}`);

    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
      requestHandler: {
        httpsAgent: new https.Agent({
          rejectUnauthorized: false, // Desabilita verificação SSL (necessário para algumas redes)
          keepAlive: true,
        }),
      },
      forcePathStyle: true, // Importante para R2
    });
  }
  return r2Client;
}

function getBucketName(): string {
  return process.env.R2_BUCKET_NAME || "fretus";
}

function getPublicUrl(): string {
  return process.env.R2_PUBLIC_URL || "";
}

/**
 * Faz upload de um arquivo para o R2
 * @param file - Buffer do arquivo
 * @param folder - Pasta onde o arquivo será armazenado ("documentos_entregadores" ou "imagens_tickets")
 * @param originalName - Nome original do arquivo (opcional, usado para extensão)
 * @returns URL pública do arquivo
 */
export async function uploadToR2(
  file: Buffer,
  folder: "documentos_entregadores" | "imagens_tickets",
  originalName?: string
): Promise<string> {
  // Gera um nome único para o arquivo
  const fileExtension = originalName
    ? originalName.split(".").pop()
    : "jpg";
  const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

  // Detecta o tipo MIME baseado na extensão
  const mimeType = getMimeType(fileExtension || "");

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: fileName,
    Body: file,
    ContentType: mimeType,
  });

  try {
    const client = getR2Client();
    await client.send(command);

    // Retorna a URL pública do arquivo
    const publicUrl = `${getPublicUrl()}/${fileName}`;
    console.log(`✅ Arquivo enviado para R2: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error("Erro ao fazer upload para R2:", error);
    throw new Error("Falha ao fazer upload do arquivo");
  }
}

/**
 * Deleta um arquivo do R2
 * @param fileUrl - URL do arquivo a ser deletado
 */
export async function deleteFromR2(fileUrl: string): Promise<void> {
  try {
    // Extrai o nome do arquivo da URL
    const fileName = fileUrl.replace(`${getPublicUrl()}/`, "");

    const command = new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: fileName,
    });

    const client = getR2Client();
    await client.send(command);
  } catch (error) {
    console.error("Erro ao deletar arquivo do R2:", error);
    throw new Error("Falha ao deletar arquivo");
  }
}

/**
 * Retorna o tipo MIME baseado na extensão do arquivo
 */
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
}

/**
 * Valida se o arquivo é uma imagem válida
 */
export function isValidImage(mimetype: string): boolean {
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  return validTypes.includes(mimetype);
}

/**
 * Valida se o arquivo é um documento válido
 */
export function isValidDocument(mimetype: string): boolean {
  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  return validTypes.includes(mimetype);
}

/**
 * Valida o tamanho do arquivo (max 5MB por padrão)
 */
export function isValidFileSize(
  size: number,
  maxSizeMB: number = 5
): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return size <= maxSizeBytes;
}
