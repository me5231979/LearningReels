import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const subscription = await request.json();

  if (!subscription.endpoint || !subscription.keys) {
    return NextResponse.json(
      { error: "Invalid subscription" },
      { status: 400 }
    );
  }

  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId: session.uid,
        endpoint: subscription.endpoint,
      },
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    create: {
      userId: session.uid,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  return NextResponse.json({ ok: true });
}
