import { readSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Database from "better-sqlite3";
import { existsSync } from "fs";
import path from "path";
import Link from "next/link";
import { Sparkles, Heart, Flag, MessageSquare } from "lucide-react";
import ProfileEditor from "@/components/profile/ProfileEditor";
import CoachHistory, {
  type CoachConversationView,
} from "@/components/profile/CoachHistory";

type StoredMessage = { role: "user" | "assistant"; content: string; ts: number };

function parseCoachMessages(raw: string | null | undefined): StoredMessage[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as StoredMessage[];
  } catch {}
  return [];
}

const CORE_COMPETENCIES = [
  "Radically collaborates and cultivates belonging",
  "Embodies an entrepreneurial spirit and leverages data and technology",
  "Continuously strives for excellence",
  "Grows self and others",
  "Leads and inspires teams",
  "Develops and implements University strategy",
  "Makes effective and ethical decisions for the University",
];

function getRawDb() {
  const candidates = [
    path.join(process.cwd(), "data", "learning-pall.db"),
    path.join(process.cwd(), "learning-pall", "data", "learning-pall.db"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return new Database(p);
  }
  return new Database("/Users/estesm4/Desktop/Learning Pall/learning-pall/data/learning-pall.db");
}

export default async function ProfilePage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    include: {
      progress: { where: { status: "completed" } },
    },
  });

  if (!user) redirect("/login");

  // Coach conversation history (joined to reel/topic for display)
  const coachRows = await prisma.coachConversation.findMany({
    where: { userId: session.uid },
    orderBy: { updatedAt: "desc" },
    include: {
      reel: {
        select: {
          id: true,
          title: true,
          topic: { select: { label: true } },
        },
      },
    },
  });
  const coachConversations: CoachConversationView[] = coachRows.map((c) => ({
    id: c.id,
    reelId: c.reel.id,
    reelTitle: c.reel.title,
    topicLabel: c.reel.topic.label,
    turnsUsed: c.turnsUsed,
    updatedAt: c.updatedAt.toISOString(),
    messages: parseCoachMessages(c.messages),
  }));

  const completedCount = user.progress.length;
  const completedReelIds = user.progress.map((p) => p.reelId);

  // Query core competency counts from completed reels via raw SQL
  let competencyCounts = new Map<string, number>();
  let myLearningTopics: { id: string; slug: string; label: string; reelCount: number }[] = [];
  let favoriteReels: {
    id: string;
    title: string;
    summary: string;
    topicLabel: string;
    categorySlug: string;
  }[] = [];
  type MyReport = {
    id: string;
    reason: string;
    details: string | null;
    status: string;
    createdAt: string;
    resolution: string | null;
    resolvedAt: string | null;
    resolverName: string | null;
    reelId: string;
    reelTitle: string;
    topicLabel: string;
    categorySlug: string;
  };
  let myReports: MyReport[] = [];
  try {
    const db = getRawDb();
    if (completedReelIds.length > 0) {
      const placeholders = completedReelIds.map(() => "?").join(",");
      const rows = db.prepare(
        `SELECT coreCompetency, COUNT(*) as cnt FROM LearningReel WHERE id IN (${placeholders}) AND coreCompetency IS NOT NULL GROUP BY coreCompetency`
      ).all(...completedReelIds) as { coreCompetency: string; cnt: number }[];
      competencyCounts = new Map(rows.map((r) => [r.coreCompetency, r.cnt]));
    }

    // Fetch user's custom topics with reel counts
    const topicRows = db.prepare(
      `SELECT t.id, t.slug, t.label, COUNT(r.id) as reelCount
       FROM Topic t
       LEFT JOIN LearningReel r ON r.topicId = t.id
       WHERE t.userId = ? AND t.isCustom = 1
       GROUP BY t.id
       ORDER BY t.createdAt DESC`
    ).all(session.uid) as { id: string; slug: string; label: string; reelCount: number }[];
    myLearningTopics = topicRows;

    // Fetch favorited reels with their topic info for deep-linking
    const favRows = db.prepare(
      `SELECT r.id, r.title, r.summary, t.label as topicLabel, t.category as categorySlug
       FROM UserReaction ur
       JOIN LearningReel r ON r.id = ur.reelId
       JOIN Topic t ON t.id = r.topicId
       WHERE ur.userId = ? AND ur.favorited = 1
       ORDER BY ur.updatedAt DESC`
    ).all(session.uid) as {
      id: string;
      title: string;
      summary: string;
      topicLabel: string;
      categorySlug: string;
    }[];
    favoriteReels = favRows;

    // Fetch this user's content reports with any admin response
    const reportRows = db.prepare(
      `SELECT cr.id, cr.reason, cr.details, cr.status, cr.createdAt,
              cr.resolution, cr.resolvedAt, cr.resolvedById,
              resolver.name as resolverName,
              r.id as reelId, r.title as reelTitle,
              t.label as topicLabel, t.category as categorySlug
         FROM ContentReport cr
         JOIN LearningReel r ON r.id = cr.reelId
         JOIN Topic t ON t.id = r.topicId
         LEFT JOIN User resolver ON resolver.id = cr.resolvedById
        WHERE cr.userId = ?
        ORDER BY cr.createdAt DESC`
    ).all(session.uid) as Array<{
      id: string;
      reason: string;
      details: string | null;
      status: string;
      createdAt: string;
      resolution: string | null;
      resolvedAt: string | null;
      resolvedById: string | null;
      resolverName: string | null;
      reelId: string;
      reelTitle: string;
      topicLabel: string;
      categorySlug: string;
    }>;
    myReports = reportRows.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
      resolution: r.resolution,
      resolvedAt: r.resolvedAt,
      resolverName: r.resolverName,
      reelId: r.reelId,
      reelTitle: r.reelTitle,
      topicLabel: r.topicLabel,
      categorySlug: r.categorySlug,
    }));

    // Mark any unread resolutions as read now that the learner is viewing them
    const unreadIds = reportRows
      .filter((r) => r.resolution && r.resolvedAt)
      .map((r) => r.id);
    if (unreadIds.length > 0) {
      const ph = unreadIds.map(() => "?").join(",");
      db.prepare(
        `UPDATE ContentReport SET resolutionReadAt = COALESCE(resolutionReadAt, ?) WHERE id IN (${ph})`
      ).run(new Date().toISOString(), ...unreadIds);
    }

    db.close();
  } catch (e) {
    console.error("Failed to fetch profile data:", e);
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-md mx-auto">
        {/* Profile header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-vand-gold/20 border-2 border-vand-gold/40 flex items-center justify-center mx-auto mb-4">
            <span className="font-serif text-2xl font-bold text-vand-gold">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-white">
            {user.name}
          </h1>
          <p className="text-vand-sand/60 text-sm">{user.email}</p>
          {user.jobTitle && (
            <p className="text-vand-sand/40 text-xs mt-1">{user.jobTitle}</p>
          )}
        </div>

        {/* Account / Profile editor */}
        <div className="mb-8">
          <ProfileEditor
            initialUser={{
              name: user.name,
              email: user.email,
              jobTitle: user.jobTitle,
              department: user.department,
            }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: "Reels", value: completedCount },
            { label: "Points", value: user.points },
            { label: "Streak", value: `${user.streak}d` },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/5 border border-white/10 rounded-lg p-4 text-center"
            >
              <div className="font-condensed text-2xl font-bold text-vand-gold">
                {stat.value}
              </div>
              <div className="text-xs text-vand-sand/50 uppercase tracking-wider font-condensed mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* My Learning */}
        <div className="mb-8">
          <h2 className="font-condensed text-xs uppercase tracking-wider text-vand-sand/50 mb-3">
            My Learning
          </h2>
          {myLearningTopics.length === 0 ? (
            <Link
              href="/onboarding"
              className="block bg-white/5 border border-white/10 border-dashed rounded-lg px-4 py-5 text-center active:bg-white/10 transition-colors"
            >
              <Sparkles className="w-5 h-5 text-vand-gold/60 mx-auto mb-2" />
              <p className="text-vand-sand/70 text-sm font-bold mb-1">
                Build your own topic
              </p>
              <p className="text-vand-sand/40 text-xs">
                Visit Explore to create custom learning reels
              </p>
            </Link>
          ) : (
            <div className="space-y-2">
              {myLearningTopics.map((t) => (
                <Link
                  key={t.id}
                  href={`/topics/${t.slug}`}
                  className="block bg-white/5 border border-white/10 rounded-lg px-4 py-3 active:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-bold truncate">
                        {t.label}
                      </p>
                      <p className="text-vand-sand/40 text-xs">
                        {t.reelCount} {t.reelCount === 1 ? "reel" : "reels"}
                      </p>
                    </div>
                    <Sparkles size={14} className="text-vand-gold/60 shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My Favorites */}
        {favoriteReels.length > 0 && (
          <div className="mb-8">
            <h2 className="font-condensed text-xs uppercase tracking-wider text-vand-sand/50 mb-3">
              My Favorites
            </h2>
            <div className="space-y-2">
              {favoriteReels.map((r) => (
                <Link
                  key={r.id}
                  href={`/topics/${r.categorySlug}?play=1&reel=${r.id}`}
                  className="block bg-white/5 border border-white/10 rounded-lg px-4 py-3 active:bg-white/10 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-pink-500/15 border border-pink-500/25 flex items-center justify-center shrink-0 mt-0.5">
                      <Heart size={13} className="text-pink-400" fill="currentColor" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-bold leading-snug break-words">
                        {r.title}
                      </p>
                      <p className="text-vand-sand/40 text-[11px] mt-0.5 font-condensed uppercase tracking-wider">
                        {r.topicLabel}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* My Reports */}
        {myReports.length > 0 && (
          <div className="mb-8">
            <h2 className="font-condensed text-xs uppercase tracking-wider text-vand-sand/50 mb-3">
              My Reports
            </h2>
            <div className="space-y-2">
              {myReports.map((r) => (
                <div
                  key={r.id}
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-vand-gold/15 border border-vand-gold/25 flex items-center justify-center shrink-0 mt-0.5">
                      <Flag size={13} className="text-vand-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/topics/${r.categorySlug}?play=1&reel=${r.reelId}`}
                        className="text-sm text-white font-bold leading-snug break-words hover:text-vand-gold"
                      >
                        {r.reelTitle}
                      </Link>
                      <p className="text-vand-sand/40 text-[11px] mt-0.5 font-condensed uppercase tracking-wider">
                        {r.topicLabel} · {r.reason} · {r.status}
                      </p>
                      {r.details && (
                        <p className="text-vand-sand/50 text-xs italic mt-1">
                          &ldquo;{r.details}&rdquo;
                        </p>
                      )}
                      {r.resolution ? (
                        <div className="mt-2 border-l-2 border-emerald-500/40 pl-3 py-1">
                          <div className="text-[10px] font-condensed uppercase tracking-wider text-emerald-300/80 mb-0.5 flex items-center gap-1">
                            <MessageSquare size={10} />
                            Response{r.resolverName ? ` from ${r.resolverName}` : ""}
                          </div>
                          <p className="text-xs text-vand-sand/80 whitespace-pre-wrap">
                            {r.resolution}
                          </p>
                        </div>
                      ) : (
                        <p className="text-vand-sand/30 text-[11px] mt-1 italic">
                          Awaiting review…
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coaching History */}
        <div className="mb-8">
          <h2 className="font-condensed text-xs uppercase tracking-wider text-vand-sand/50 mb-3">
            Coaching History
          </h2>
          <CoachHistory conversations={coachConversations} />
        </div>

        {/* Skill Growth */}
        <div>
          <h2 className="font-condensed text-xs uppercase tracking-wider text-vand-sand/50 mb-3">
            Skill Growth
          </h2>
          <div className="space-y-2">
            {CORE_COMPETENCIES.map((competency) => {
              const count = competencyCounts.get(competency) || 0;
              return (
                <div
                  key={competency}
                  className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-white leading-tight">
                    {competency}
                  </span>
                  <span className={`text-sm font-condensed font-bold shrink-0 ${count > 0 ? "text-vand-gold" : "text-vand-sand/30"}`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sign out */}
        <form
          action={async () => {
            "use server";
            const { clearSession } = await import("@/lib/auth");
            await clearSession();
            redirect("/login");
          }}
          className="mt-12"
        >
          <button
            type="submit"
            className="w-full py-3 rounded border border-white/10 text-vand-sand/60 hover:text-white hover:border-white/20 transition-colors text-sm font-condensed uppercase tracking-wider"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
