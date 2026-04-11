import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    onboardedAt: user.onboardedAt,
    points: user.points,
    streak: user.streak,
  });
}
