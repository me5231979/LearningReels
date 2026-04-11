import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const dbPath = path.join(__dirname, "..", "data", "learning-pall.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const TOPICS = [
  {
    slug: "leadership-fundamentals",
    label: "Leadership Fundamentals",
    description: "Core leadership principles, decision-making frameworks, and team management strategies",
    category: "leadership",
  },
  {
    slug: "project-management",
    label: "Project Management",
    description: "Planning, execution, and delivery methodologies including Agile, Waterfall, and hybrid approaches",
    category: "operations",
  },
  {
    slug: "effective-communication",
    label: "Effective Communication",
    description: "Professional communication skills including presentations, writing, and stakeholder management",
    category: "professional-skills",
  },
  {
    slug: "data-driven-decisions",
    label: "Data-Driven Decision Making",
    description: "Using data analysis, metrics, and evidence to inform strategic and operational decisions",
    category: "technical",
  },
  {
    slug: "change-management",
    label: "Change Management",
    description: "Leading organizational change, managing transitions, and building adaptability",
    category: "leadership",
  },
  {
    slug: "strategic-thinking",
    label: "Strategic Thinking",
    description: "Long-term planning, competitive analysis, and aligning tactical actions with organizational goals",
    category: "leadership",
  },
  {
    slug: "financial-literacy",
    label: "Financial Literacy for Managers",
    description: "Budget management, financial statements, cost-benefit analysis, and resource allocation",
    category: "operations",
  },
  {
    slug: "conflict-resolution",
    label: "Conflict Resolution",
    description: "Techniques for managing workplace disagreements, mediation, and negotiation",
    category: "professional-skills",
  },
  {
    slug: "time-management",
    label: "Time Management & Productivity",
    description: "Prioritization frameworks, delegation, and personal effectiveness strategies",
    category: "professional-skills",
  },
  {
    slug: "technical-writing",
    label: "Technical Writing",
    description: "Creating clear documentation, reports, proposals, and standard operating procedures",
    category: "technical",
  },
  {
    slug: "process-improvement",
    label: "Process Improvement",
    description: "Lean, Six Sigma, and continuous improvement methodologies for operational excellence",
    category: "operations",
  },
  {
    slug: "coaching-mentoring",
    label: "Coaching & Mentoring",
    description: "Developing others through effective coaching conversations, feedback, and mentorship",
    category: "leadership",
  },
  {
    slug: "critical-thinking",
    label: "Critical Thinking & Problem Solving",
    description: "Analytical reasoning, root cause analysis, and structured problem-solving approaches",
    category: "professional-skills",
  },
  {
    slug: "customer-service-excellence",
    label: "Customer Service Excellence",
    description: "Service design, stakeholder satisfaction, and building a service-oriented culture",
    category: "operations",
  },
  {
    slug: "technology-fluency",
    label: "Technology Fluency",
    description: "Understanding emerging technologies, digital transformation, and AI in the workplace",
    category: "technical",
  },
];

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@vanderbilt.edu" },
    update: {},
    create: {
      email: "admin@vanderbilt.edu",
      passwordHash: adminHash,
      name: "Platform Admin",
      role: "admin",
      department: "Learning & Development",
    },
  });
  console.log(`Admin user: ${admin.email}`);

  // Create demo learner
  const learnerHash = await bcrypt.hash("learn123", 12);
  const learner = await prisma.user.upsert({
    where: { email: "learner@vanderbilt.edu" },
    update: {},
    create: {
      email: "learner@vanderbilt.edu",
      passwordHash: learnerHash,
      name: "Demo Learner",
      role: "learner",
      department: "Human Resources",
      jobTitle: "Program Coordinator",
    },
  });
  console.log(`Demo learner: ${learner.email}`);

  // Create topics
  for (const topic of TOPICS) {
    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: { label: topic.label, description: topic.description, category: topic.category },
      create: topic,
    });
  }
  console.log(`Seeded ${TOPICS.length} topics`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
