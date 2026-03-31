import type { NextRequest } from "next/server";
import { getAmbassadorFromRequest, deleteSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const ambassador = await getAmbassadorFromRequest(request);
    if (!ambassador) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    return Response.json({
      id: ambassador.id,
      displayName: ambassador.displayName,
      email: ambassador.email,
      bio: ambassador.bio,
      zipCode: ambassador.zipCode,
      radius: ambassador.radius,
      status: ambassador.status,
      role: ambassador.role,
      verifiedAt: ambassador.verifiedAt?.toISOString() ?? null,
      createdAt: ambassador.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("GET /api/ambassadors/me error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookie = request.cookies.get("ambassador_token");
    if (cookie?.value) {
      deleteSession(cookie.value);
    }

    const response = Response.json({ success: true });
    response.headers.set(
      "Set-Cookie",
      "ambassador_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    );
    return response;
  } catch (error) {
    console.error("DELETE /api/ambassadors/me error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
