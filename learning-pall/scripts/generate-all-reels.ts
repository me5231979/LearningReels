/**
 * Bulk reel generation script with curated sources per category.
 * Run: npx tsx scripts/generate-all-reels.ts [category-slug]
 * Example: npx tsx scripts/generate-all-reels.ts leadership-management
 */

import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Anthropic from "@anthropic-ai/sdk";
import path from "path";
import { readFileSync } from "fs";

// ── DB setup ───────────────────────────────────────────────
const dbPath = path.join(__dirname, "..", "data", "learning-pall.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

// ── Anthropic setup ────────────────────────────────────────
function getApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const envPath = path.join(__dirname, "..", ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^ANTHROPIC_API_KEY=(.+)$/);
      if (match) return match[1].trim();
    }
  } catch {}
  throw new Error("ANTHROPIC_API_KEY not found");
}

const anthropic = new Anthropic({ apiKey: getApiKey() });

// ── Bloom's config ─────────────────────────────────────────
type BloomsLevel = "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";

const BLOOMS: Record<BloomsLevel, { label: string; verb: string; description: string }> = {
  remember: { label: "Remember", verb: "Recall", description: "Retrieve relevant knowledge from long-term memory" },
  understand: { label: "Understand", verb: "Explain", description: "Construct meaning from instructional messages" },
  apply: { label: "Apply", verb: "Execute", description: "Carry out or use a procedure in a given situation" },
  analyze: { label: "Analyze", verb: "Differentiate", description: "Break material into parts and determine relationships" },
  evaluate: { label: "Evaluate", verb: "Judge", description: "Make judgments based on criteria and standards" },
  create: { label: "Create", verb: "Produce", description: "Put elements together to form a coherent whole" },
};

// Base distribution proportions (sums to 20). Scaled to target.
const BASE_DISTRIBUTION: [BloomsLevel, number][] = [
  ["remember", 4],
  ["understand", 4],
  ["apply", 4],
  ["analyze", 3],
  ["evaluate", 3],
  ["create", 2],
];

function buildDistribution(target: number): [BloomsLevel, number][] {
  const factor = target / 20;
  const dist: [BloomsLevel, number][] = BASE_DISTRIBUTION.map(([lvl, n]) => [lvl, Math.round(n * factor)]);
  // Adjust to exact total
  let sum = dist.reduce((a, [, n]) => a + n, 0);
  let i = 0;
  while (sum < target) {
    dist[i % dist.length][1]++;
    sum++;
    i++;
  }
  while (sum > target) {
    if (dist[i % dist.length][1] > 0) {
      dist[i % dist.length][1]--;
      sum--;
    }
    i++;
  }
  return dist;
}

// ── Curated source lists per category ──────────────────────
const CATEGORY_SOURCES: Record<string, string> = {
  "leadership-management": `
REQUIRED SOURCES — You MUST base each reel's content on one of these specific sources and cite it:
- Harvard Business Review (hbr.org) — leadership articles, management frameworks
- Korn Ferry research and leadership assessments
- DDI (Development Dimensions International) — leadership development research
- Ken Blanchard / Blanchard Learning — situational leadership, SLII model
- Brené Brown — Dare to Lead, vulnerability-based leadership
- Simon Sinek — Start With Why, The Infinite Game, Leaders Eat Last
- Chief Learning Officer magazine — CLO research
- Radical Candor (Kim Scott) — feedback frameworks
- First Round Review — startup leadership insights
- CCL (Center for Creative Leadership) — leadership competency research
- MIT Sloan Management Review — management science
- Manager Tools podcast — practical management frameworks
- McKinsey Leadership Insights — organizational leadership research
- Zenger Folkman research — extraordinary leader research
- LinkedIn Learning leadership courses
- Harvard ManageMentor program
- SHRM Executive Network content`,

  "ai-fluency": `
CRITICAL FOCUS — AI Fluency content MUST be PRODUCT-AGNOSTIC. Do NOT teach how to use specific tools (ChatGPT, Claude, Gemini, Copilot, etc.). Instead teach SKILLS and CONCEPTS that apply to any AI tool.

REQUIRED THEMES — Each reel must address one of these themes:
1. PROMPT ENGINEERING — How to write effective prompts: clarity, context, constraints, examples (few-shot), role assignment, iterative refinement, chain-of-thought, breaking complex tasks into steps
2. WHAT IS AI / HOW IT WORKS — Foundational mental models: how LLMs work conceptually, training vs inference, tokens, hallucinations, context windows, pattern matching vs reasoning, capabilities and limitations
3. AI FOR DAILY EFFICIENCY — Practical use cases that save time: drafting, summarizing, brainstorming, research synthesis, data analysis, meeting prep, email triage, writing assistance, code review, document QA
4. OVERCOMING AI FEAR — Addressing common concerns: job displacement myths vs realities, building trust, when to verify AI output, maintaining human judgment, AI as augmentation not replacement, ethical use, getting started safely
5. AI FOR STRATEGY — Higher-order applications: decision support, scenario planning, competitive analysis, trend synthesis, stakeholder analysis, strategic communication, executive briefings, risk assessment

REQUIRED SOURCES — Base content on these research-backed, vendor-neutral sources:
- Ethan Mollick's "One Useful Thing" Substack and book "Co-Intelligence" — practical AI for professionals
- MIT Sloan Management Review — AI in business research
- Harvard Business Review — AI strategy and adoption articles
- Stanford HAI (Human-Centered AI Institute) — AI research and reports
- Wharton AI & Analytics Initiative — business applications research
- McKinsey & Company AI research — productivity and strategic adoption
- BCG on AI — workforce transformation research
- Anthropic's prompt engineering guide and research papers (cite as "Anthropic Research")
- OpenAI cookbook (for prompt techniques only, not product features)
- Google DeepMind research papers
- Andrew Ng's "AI for Everyone" framework (Coursera)
- Cassie Kozyrkov on decision intelligence and AI
- Brookings Institution AI policy research
- World Economic Forum — AI and work research
- arXiv papers on prompt engineering (e.g., chain-of-thought, few-shot learning)
- Wired, The Atlantic, and MIT Technology Review for context articles

CITATION RULES:
- NEVER cite a specific tool's marketing page or feature documentation
- NEVER recommend specific products by name in titles or scripts
- It IS okay to mention that "modern AI assistants" or "large language models" can do something
- Source URLs should be research articles, academic papers, or vendor-neutral analysis`,

  "career-growth": `
CRITICAL FOCUS — Career & Growth content MUST focus on GOAL SETTING and PERSONAL/PROFESSIONAL DEVELOPMENT. Do NOT teach data-driven decision making, problem solving, or critical thinking frameworks (those belong in Operations & Productivity).

REQUIRED THEMES — Each reel must address one of these themes:
1. GOAL SETTING — frameworks like SMART, OKRs, WOOP, BHAGs, PACT goals, goal hierarchies, milestone planning, tracking progress, the science of goal pursuit
2. PERSONAL DEVELOPMENT — habit formation, identity-based change, growth mindset, self-awareness, strengths discovery, building confidence, deliberate practice, learning agility
3. CAREER PLANNING — career mapping, skill gap analysis, networking, mentorship, sponsorship, asking for feedback, navigating promotions, internal mobility, career pivots
4. PROFESSIONAL BRAND — personal brand, executive presence, thought leadership, professional networks, LinkedIn strategy, reputation building
5. SELF-LEADERSHIP — managing energy, prioritization, self-coaching, accountability, reflection practices, personal effectiveness

REQUIRED SOURCES — You MUST base each reel's content on one of these specific sources and cite it:
- James Clear — Atomic Habits, identity-based habits, habit stacking
- Carol Dweck — Mindset: The New Psychology of Success, growth mindset research
- Angela Duckworth — Grit: The Power of Passion and Perseverance
- BJ Fogg — Tiny Habits, behavior design
- Gabriele Oettingen — WOOP method, mental contrasting research
- John Doerr — Measure What Matters, OKRs
- Edwin Locke & Gary Latham — goal-setting theory research
- Daniel Pink — Drive, To Sell Is Human
- Cal Newport — Deep Work, So Good They Can't Ignore You
- Adam Grant — Think Again, Give and Take, Originals
- Brené Brown — Dare to Lead, vulnerability research
- Marshall Goldsmith — What Got You Here Won't Get You There, feedforward
- Korn Ferry career development research
- Gallup CliftonStrengths — strengths-based development
- LinkedIn Learning career development courses
- Harvard Business Review — career development articles
- ATD (Association for Talent Development) — professional growth frameworks
- Reid Hoffman — The Start-up of You, network strategy
- Herminia Ibarra — Working Identity, Act Like a Leader Think Like a Leader
- Tasha Eurich — Insight, self-awareness research
- Dorie Clark — Reinventing You, The Long Game
- Stanford d.school — Designing Your Life (Bill Burnett, Dave Evans)
- McKinsey career development research
- HBR Ascend — early career professional development`,

  "future-of-work": `
REQUIRED SOURCES — You MUST base each reel's content on one of these specific sources and cite it:
- MIT Sloan Management Review — future of work, digital transformation research
- McKinsey Global Institute — workforce transformation, automation, future skills
- World Economic Forum — Future of Jobs Report, technology adoption, reskilling
- Deloitte Insights — tech-enabled workforce, human capital trends
- Harvard Business Review — systems thinking, adaptive leadership, complexity
- Santa Fe Institute — complex adaptive systems research
- Peter Senge / The Fifth Discipline — systems thinking, learning organizations
- Dave Snowden / Cynefin Framework — complexity management, sense-making
- Donella Meadows / Thinking in Systems — systems dynamics, leverage points
- Gartner — digital workplace, technology trends, future of work
- Accenture — technology-driven workforce transformation
- BCG Henderson Institute — adaptive strategy, organizational complexity
- OECD Future of Work research — skills, automation, policy implications
- Josh Bersin — HR technology, workforce analytics, skills-based organizations
- Forrester Research — digital transformation, employee experience technology`,

  "communication": `
REQUIRED SOURCES — You MUST base each reel's content on one of these specific sources and cite it:
- Coursera communication courses (University of Michigan, Wharton)
- VitalSmarts / Crucial Conversations (Joseph Grenny) — crucial conversations framework
- Matt Abrahams / Think Fast Talk Smart podcast (Stanford) — spontaneous communication
- TED Masterclass — public speaking and storytelling
- Toastmasters International resources — speaking skills
- Duarte (Nancy Duarte) — presentation design and storytelling
- Nielsen Norman Group — clear writing and UX communication
- Radical Candor (Kim Scott) — direct communication
- Carmine Gallo — communication and storytelling
- Roy Peter Clark — writing craft
- Poynter Institute — clear communication
- Next Level Writing resources
- Rhetoric Society resources`,

  "wellbeing-resilience": `
REQUIRED SOURCES — You MUST base each reel's content on one of these specific sources and cite it:
- Greater Good Science Center (UC Berkeley) — science of wellbeing
- American Institute of Stress — workplace stress research
- NIOSH (CDC) — workplace wellbeing research
- Thrive Global (Arianna Huffington) — burnout prevention
- Jennifer Moss — burnout research and prevention
- Dr. Aditi Nerurkar — stress management research
- Headspace for Work — workplace mindfulness
- BetterUp content library — coaching and resilience
- Mayo Clinic workplace wellness research
- Gallup Wellbeing Institute — employee wellbeing data
- Calm for Business — workplace mental health
- Lyra Health — workplace mental health, EAP modernization, clinical mental health resources
- Lyra Health research hub — evidence-based mental health interventions, workforce mental health data
- Limeade employee wellbeing content`,

  "vanderbilt-know-how": `
REQUIRED SOURCES — You MUST base each reel's content on one of these specific sources and cite it:
- Working at Vanderbilt HR portal — policies, benefits, procedures
- Vanderbilt University Chancellor's office communications
- Vanderbilt Magazine — campus culture and initiatives
- Office of Equity, Diversity & Inclusion — campus resources
- VU Board of Trust updates — institutional governance
- Faculty Senate updates — shared governance
- The Hustler (student newspaper) — campus culture perspective
- VAULT practitioner network — professional development community
- Vanderbilt campus research offices — research enterprise resources
- Each VC division's communications — divisional updates
- Vanderbilt EAP resources — employee assistance programs
NOTE: For Vanderbilt-specific content, create realistic professional development scenarios based on higher education best practices when specific Vanderbilt content isn't publicly available. Attribute to "Vanderbilt University HR" or "Vanderbilt Professional Development" as appropriate.`,

  "operations-productivity": `
REQUIRED SOURCES — You MUST base each reel's content on one of these specific sources and cite it:
- Harvard Business School Online — operations management courses
- APQC — benchmarking and process improvement research
- American Society for Quality (ASQ) — quality management
- Lean/Six Sigma organizations — process improvement
- MIT OpenCourseWare — operations and systems
- Atlassian Team Playbook — team collaboration frameworks
- Tiago Forte / Building a Second Brain — knowledge management
- Cal Newport — Deep Work, digital minimalism, productivity
- Process Street — process documentation
- Google Project Management Certificate (Coursera)
- Notion guides — workspace organization
- Monday.com Academy — project management
- Zapier blog — workflow automation
- Smartsheet/Asana learning hubs — project management
- ClickUp University — productivity systems`,
};

const SYSTEM_PROMPT = `You are a Vanderbilt University learning content architect. You create structured micro-learning experiences called "Learning Reels" — short, interactive, narrated experiences optimized for mobile delivery.

YOUR VOICE: Confident, clear, growth-oriented. You speak like a knowledgeable colleague, not a textbook. Use conversational tone (per Mayer's Personalization Principle). Address the learner as "you."

CRITICAL REQUIREMENTS:
- Each reel MUST be based on and reference content from a SPECIFIC source provided to you.
- The sourceUrl MUST be a REAL, verifiable URL from that source (article page, research page, course page, etc.).
- The sourceCredit MUST name the specific author, publication, or organization.
- The reel content must teach concepts, frameworks, or insights that actually come from that source.
- Do NOT make up generic content. Reference real frameworks, real research, real statistics from the cited source.
- Each reel MUST align to exactly ONE of these Vanderbilt core competencies:
  1. "Radically collaborates and cultivates belonging"
  2. "Embodies an entrepreneurial spirit and leverages data and technology"
  3. "Continuously strives for excellence"
  4. "Grows self and others"
  5. "Leads and inspires teams"
  6. "Develops and implements University strategy"
  7. "Makes effective and ethical decisions for the University"
  Pick the ONE core competency that best fits the reel content.

CONTENT RESTRICTIONS:
- Focus exclusively on professional skills, leadership, technical knowledge, and domain expertise.
- Do not include DEI (Diversity, Equity, Inclusion) topics or inclusionist language.
- Every claim should be defensible and evidence-based.

VISUAL DESCRIPTION REQUIREMENTS:
- All visualDescription fields MUST depict Western society and culture exclusively.
- Settings must be modern American or Western European: corporate offices, university campuses, business meeting rooms, conference settings, professional workplaces.
- People, attire, architecture, and cultural references must reflect contemporary Western (US, Canada, UK, Western Europe) corporate or academic life.
- Do NOT describe East Asian, Middle Eastern, South Asian, or non-Western settings, attire, or cultural elements.

PEDAGOGICAL MODEL:
- Each reel is 3-5 cards, each card 60-90 seconds.
- Follow Mayer's Multimedia Principles: narration describes visuals, never duplicate narration as on-screen text.
- Apply Keller's ARCS: hook with attention, establish relevance, build confidence, deliver satisfaction.
- Embed retrieval practice: every reel must include at least one interaction card.
- Use the generation effect: prompt learners to produce answers before revealing them.

OUTPUT FORMAT: Respond with a JSON object only, no markdown wrapping:
{
  "title": "string — reel title, max 60 chars",
  "summary": "string — one-sentence summary",
  "sourceUrl": "string — REAL URL to the specific article, page, or resource used",
  "sourceCredit": "string — e.g. 'Harvard Business Review, by Amy Edmondson' or 'Simon Sinek, The Infinite Game'",
  "coreCompetency": "string — exactly one of the 7 Vanderbilt core competencies listed above",
  "estimatedSeconds": number,
  "cards": [
    {
      "cardType": "hook" | "narration" | "interaction" | "feedback",
      "title": "string — card title",
      "script": "string — narration text for TTS (60-120 words max per card)",
      "visualDescription": "string — what the visual should depict (for image generation)",
      "animationCue": "string — animation type: 'reveal', 'diagram', 'chart', 'process', 'comparison'",
      "quizJson": null | { "question": "string", "choices": ["string", "string", "string", "string"], "correctIndex": number, "explanation": "string" },
      "durationMs": number
    }
  ]
}

CARD SEQUENCE RULES:
1. First card MUST be type "hook" — a surprising fact, provocative question, or scenario FROM the source material
2. Middle cards are "narration" (teaching content from the source) and "interaction" (retrieval practice)
3. At least one card MUST be "interaction" with quizJson
4. Last card MUST be "feedback" — summarize the key takeaway and credit the source
5. Total cards: 3-5 (not fewer, not more)`;

// ── Generate one reel ──────────────────────────────────────
async function generateOneReel(
  topicId: string,
  topicLabel: string,
  topicDescription: string,
  bloomLevel: BloomsLevel,
  category: string,
  reelNumber: number,
  totalCount: number
): Promise<string | null> {
  const bloom = BLOOMS[bloomLevel];
  const sources = CATEGORY_SOURCES[category] || "";

  // For ai-fluency, rotate through the 5 required themes
  const AI_THEMES = [
    "PROMPT ENGINEERING — Teach a specific prompt engineering technique (e.g., few-shot examples, role assignment, chain-of-thought, iterative refinement, constraint setting, decomposition). Be tool-agnostic.",
    "WHAT IS AI / HOW IT WORKS — Build a foundational mental model (e.g., how LLMs predict tokens, what context windows mean, why hallucinations happen, the difference between pattern matching and reasoning). No tool names.",
    "AI FOR DAILY EFFICIENCY — Show a concrete time-saving workflow that works in any AI tool (e.g., drafting emails, summarizing meetings, brainstorming, research synthesis). Frame as a transferable technique.",
    "OVERCOMING AI FEAR — Address a specific concern with evidence (e.g., job displacement reality, building trust, when to verify, augmentation vs replacement, ethical use). Help the learner feel confident.",
    "AI FOR STRATEGY — Demonstrate a higher-order strategic application (e.g., decision support, scenario planning, competitive analysis, stakeholder mapping, executive communication). Position AI as a thinking partner.",
  ];
  const themeGuidance = category === "ai-fluency"
    ? `\n\nREQUIRED THEME FOR THIS REEL: ${AI_THEMES[(reelNumber - 1) % AI_THEMES.length]}\n\nIMPORTANT: Do NOT mention specific AI products or brands by name (no ChatGPT, Claude, Gemini, Copilot, Perplexity, etc.). Use generic terms like "AI assistant", "large language model", "generative AI tool", or "AI chatbot".`
    : "";

  const userPrompt = `Generate a Learning Reel on the topic: "${topicLabel}"

TOPIC CONTEXT: ${topicDescription}

BLOOM'S LEVEL: ${bloom.label} — ${bloom.description}
The cognitive verb for this level is "${bloom.verb}". Content and quiz questions should target this level of thinking.

${sources}${themeGuidance}

${reelNumber > 1 ? `This is reel ${reelNumber} of ${totalCount}. You MUST cover a DIFFERENT source and different aspect than previous reels. Pick a DIFFERENT source from the list above and teach a DIFFERENT concept or framework.` : "Pick any source from the list above to base this reel on."}

Generate a complete reel with 4 cards following the hook → narration → interaction → feedback pattern. The content MUST be directly based on insights from the source you choose. Include the real URL to the specific article/page used.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`  ✗ Failed to parse JSON for "${topicLabel}" reel #${reelNumber}`);
      return null;
    }

    const reelData = JSON.parse(jsonMatch[0]);
    if (!reelData.title || !reelData.cards || !Array.isArray(reelData.cards)) {
      console.error(`  ✗ Invalid reel structure for "${topicLabel}" reel #${reelNumber}`);
      return null;
    }

    if (!reelData.sourceUrl || !reelData.sourceCredit) {
      console.error(`  ✗ Missing source attribution for "${topicLabel}" reel #${reelNumber}`);
      return null;
    }

    const reel = await prisma.learningReel.create({
      data: {
        topicId,
        title: reelData.title,
        summary: reelData.summary || "",
        bloomLevel,
        estimatedSeconds: reelData.estimatedSeconds || 240,
        contentJson: JSON.stringify(reelData),
        sourceUrl: reelData.sourceUrl,
        sourceCredit: reelData.sourceCredit,
        coreCompetency: reelData.coreCompetency || null,
        status: "published",
      },
    });

    for (let j = 0; j < reelData.cards.length; j++) {
      const card = reelData.cards[j];
      await prisma.reelCard.create({
        data: {
          reelId: reel.id,
          order: j,
          cardType: card.cardType,
          title: card.title || "",
          script: card.script || "",
          visualDescription: card.visualDescription || "",
          animationCue: card.animationCue || null,
          quizJson: card.quizJson ? JSON.stringify(card.quizJson) : null,
          durationMs: card.durationMs || 60000,
        },
      });
    }

    return reel.id;
  } catch (err) {
    console.error(`  ✗ Error generating "${topicLabel}" reel #${reelNumber}:`, err);
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  const targetCategory = process.argv[2];
  const targetArg = process.argv.find((a) => a.startsWith("--target="));
  const TARGET_PER_TOPIC = targetArg ? parseInt(targetArg.split("=")[1], 10) : 20;
  const DISTRIBUTION = buildDistribution(TARGET_PER_TOPIC);
  const wipeExisting = process.argv.includes("--wipe");

  const topics = await prisma.topic.findMany({
    where: targetCategory ? { category: targetCategory, isActive: true } : { isActive: true },
    include: { _count: { select: { reels: true } } },
  });

  console.log(`\n━━━ Bulk Reel Generation (Sourced) ━━━`);
  console.log(`Topics: ${topics.length}`);
  console.log(`Target: ${TARGET_PER_TOPIC} reels per topic`);
  if (wipeExisting) console.log(`⚠ Wiping existing reels first`);
  console.log();

  let totalGenerated = 0;

  for (const topic of topics) {
    // Optionally wipe existing reels for this topic
    if (wipeExisting && topic._count.reels > 0) {
      await prisma.reelCard.deleteMany({ where: { reel: { topicId: topic.id } } });
      await prisma.learningReel.deleteMany({ where: { topicId: topic.id } });
      console.log(`  Wiped ${topic._count.reels} existing reels for ${topic.label}`);
      topic._count.reels = 0;
    }

    const existing = topic._count.reels;
    const needed = Math.max(0, TARGET_PER_TOPIC - existing);

    console.log(`\n▸ ${topic.label} (${topic.category})`);
    console.log(`  Existing: ${existing}, Needed: ${needed}`);

    if (needed === 0) {
      console.log(`  ✓ Already has ${existing} reels, skipping`);
      continue;
    }

    let generated = 0;
    let reelNumber = existing + 1;

    for (const [level, count] of DISTRIBUTION) {
      if (generated >= needed) break;

      const levelCount = Math.min(count, needed - generated);
      for (let i = 0; i < levelCount; i++) {
        process.stdout.write(`  [${level}] Reel ${reelNumber}/${TARGET_PER_TOPIC}...`);

        const id = await generateOneReel(
          topic.id,
          topic.label,
          topic.description,
          level,
          topic.category,
          reelNumber,
          TARGET_PER_TOPIC
        );

        if (id) {
          console.log(` ✓`);
          generated++;
          reelNumber++;
        } else {
          console.log(` ✗ (retrying)`);
          const retryId = await generateOneReel(
            topic.id,
            topic.label,
            topic.description,
            level,
            topic.category,
            reelNumber,
            TARGET_PER_TOPIC
          );
          if (retryId) {
            console.log(`  Retry ✓`);
            generated++;
            reelNumber++;
          }
        }
      }
    }

    totalGenerated += generated;
    console.log(`  Generated ${generated} new reels (total: ${existing + generated})`);
  }

  console.log(`\n━━━ Complete ━━━`);
  console.log(`Total new reels: ${totalGenerated}`);
  console.log(`Total reels in DB: ${(await prisma.learningReel.count())}`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
