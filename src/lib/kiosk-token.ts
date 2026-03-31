import { createHash, randomBytes } from "crypto";

export function hashKioskToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export function generateKioskPlainToken(): string {
  return randomBytes(32).toString("base64url");
}
