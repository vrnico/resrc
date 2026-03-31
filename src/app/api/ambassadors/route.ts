import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { AmbassadorRegisterSchema } from "@/lib/validators";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AmbassadorRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { displayName, email, password, bio, zipCode, radius } = parsed.data;

    // Check zip exists
    const zipRecord = await prisma.zipCode.findUnique({ where: { zip: zipCode } });
    if (!zipRecord) {
      return Response.json({ error: "Zip code not found" }, { status: 404 });
    }

    // Check email not taken
    const existing = await prisma.ambassador.findUnique({ where: { email } });
    if (existing) {
      return Response.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const ambassador = await prisma.ambassador.create({
      data: {
        displayName,
        email,
        passwordHash,
        bio: bio ?? null,
        zipCode,
        radius,
        status: "pending",
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        bio: true,
        zipCode: true,
        radius: true,
        status: true,
        role: true,
        createdAt: true,
      },
    });

    return Response.json(
      {
        ...ambassador,
        createdAt: ambassador.createdAt.toISOString(),
        message: "Registration submitted. You will be notified when approved.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/ambassadors error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
