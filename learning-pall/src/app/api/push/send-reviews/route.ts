import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import webPush from "web-push";

// Configure VAPID keys (generate with: npx web-push generate-vapid-keys)
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webPush.setVapidDetails(
    "mailto:admin@vanderbilt.edu",
    VAPID_PUBLIC,
    VAPID_PRIVATE
  );
}

export async function POST() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 500 }
    );
  }

  // Find all users with due reviews
  const dueReviews = await prisma.spacedReview.findMany({
    where: {
      nextReviewAt: { lte: new Date() },
    },
    include: {
      user: {
        include: { pushSubscriptions: true },
      },
      reel: { select: { title: true } },
    },
  });

  // Group by user
  const userReviews = new Map<
    string,
    { subscriptions: typeof dueReviews[0]["user"]["pushSubscriptions"]; titles: string[] }
  >();

  for (const review of dueReviews) {
    const existing = userReviews.get(review.userId);
    if (existing) {
      existing.titles.push(review.reel.title);
    } else {
      userReviews.set(review.userId, {
        subscriptions: review.user.pushSubscriptions,
        titles: [review.reel.title],
      });
    }
  }

  let sent = 0;
  for (const [, { subscriptions, titles }] of userReviews) {
    const payload = JSON.stringify({
      title: "Time to review!",
      body: `${titles.length} reel${titles.length > 1 ? "s" : ""} ready for review: ${titles[0]}${titles.length > 1 ? ` +${titles.length - 1} more` : ""}`,
      url: "/reels",
    });

    for (const sub of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: unknown) {
        // Remove invalid subscriptions
        if (err && typeof err === "object" && "statusCode" in err) {
          const pushErr = err as { statusCode: number };
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
        }
      }
    }
  }

  return NextResponse.json({ sent, usersNotified: userReviews.size });
}
