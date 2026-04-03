import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

export type QrLogoSide = "left" | "right";

function storeBuffer(buffer: Buffer, contentType: string, basename: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : contentType.includes("gif") ? "gif" : "jpg";
    const filename = `qr-branding/${basename}-${randomBytes(12).toString("hex")}.${ext}`;
    return put(filename, buffer, {
      access: "public",
      token,
      contentType: contentType || "image/png",
    }).then((b) => b.url);
  }

  if (process.env.NODE_ENV === "production") {
    const maxBytes = 2 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new Error("Logo too large; add BLOB_READ_WRITE_TOKEN or use a smaller image.");
    }
    const mime = contentType || "image/png";
    return Promise.resolve(`data:${mime};base64,${buffer.toString("base64")}`);
  }

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const name = `${basename}-${randomBytes(12).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "qr-branding");
  return mkdir(dir, { recursive: true }).then(() =>
    writeFile(path.join(dir, name), buffer).then(() => `/uploads/qr-branding/${name}`)
  );
}

export async function saveQrLogo(buffer: Buffer, contentType: string, side: QrLogoSide): Promise<string> {
  return storeBuffer(buffer, contentType, side);
}

/** Per-company logo for public QR page (stored under qr-branding/company-{id}/… in blob naming). */
export async function saveCompanyQrLogo(companyId: string, buffer: Buffer, contentType: string): Promise<string> {
  return storeBuffer(buffer, contentType, `company-${companyId}`);
}
