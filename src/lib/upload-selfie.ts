import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

export async function saveSelfie(buffer: Buffer, contentType: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const filename = `selfies/${randomBytes(16).toString("hex")}.${ext}`;
    const blob = await put(filename, buffer, {
      access: "public",
      token,
      contentType: contentType || "image/jpeg",
    });
    return blob.url;
  }

  if (process.env.NODE_ENV === "production") {
    const maxBytes = 2 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new Error("Selfie too large; add BLOB_READ_WRITE_TOKEN or use a smaller image.");
    }
    const mime = contentType || "image/jpeg";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }

  const ext = contentType.includes("png") ? "png" : "jpg";
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "selfies");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, name);
  await writeFile(filePath, buffer);
  return `/uploads/selfies/${name}`;
}
