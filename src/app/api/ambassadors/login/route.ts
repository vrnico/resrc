import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { AmbassadorLoginSchema } from "@/lib/validators";
import { verifyPassword, createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AmbassadorLoginSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const ambassador = await prisma.ambassador.findUnique({ where: { email } });
    if (!ambassador) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, ambassador.passwordHash);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (ambassador.status === "pending") {
      return Response.json(
        { error: "Your account is pending approval" },
        { status: 403 }
      );
    }

    if (ambassador.status === "suspended") {
      return Response.json(
        { error: "Your account has been suspended" },
        { status: 403 }
      );
    }

    const token = createSession(ambassador.id);

    const response = Response.json({
      id: ambassador.id,
      displayName: ambassador.displayName,
      email: ambassador.email,
      bio: ambassador.bio,
      zipCode: ambassador.zipCode,
      radius: ambassador.radius,
      status: ambassador.status,
      role: ambassador.role,
    });

    response.headers.set(
      "Set-Cookie",
      `ambassador_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    );

    return response;
  } catch (error) {
    console.error("POST /api/ambassadors/login error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
