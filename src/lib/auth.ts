import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

// Simple password hashing using Web Crypto API (no bcrypt dependency needed)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.randomUUID();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${salt}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex === hash;
}

// Simple token-based auth for ambassadors (stored as cookie)
export function generateToken(): string {
  return crypto.randomUUID() + "-" + crypto.randomUUID();
}

// In-memory session store (MVP - upgrade to DB/Redis for production)
const sessions = new Map<string, { ambassadorId: string; expiresAt: number }>();

export function createSession(ambassadorId: string): string {
  const token = generateToken();
  sessions.set(token, {
    ambassadorId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  return token;
}

export function getSession(token: string): string | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session.ambassadorId;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}

export async function getAmbassadorFromRequest(request: NextRequest) {
  const cookie = request.cookies.get("ambassador_token");
  if (!cookie?.value) return null;

  const ambassadorId = getSession(cookie.value);
  if (!ambassadorId) return null;

  const ambassador = await prisma.ambassador.findUnique({
    where: { id: ambassadorId },
  });

  if (!ambassador || ambassador.status !== "approved") return null;
  return ambassador;
}
