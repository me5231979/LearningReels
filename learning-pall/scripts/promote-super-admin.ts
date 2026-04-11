/**
 * Promote a user to super_admin (or create the account if missing).
 *
 * Usage:
 *   npx tsx scripts/promote-super-admin.ts <email> [password]
 *
 * If the email already exists, only the role is updated and password is left alone.
 * If the email is new, an account is created with the supplied password (required).
 * Enforces a single super_admin: any other super_admin is demoted to admin.
 */

import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const email = process.argv[2]?.toLowerCase();
  const password = process.argv[3];

  if (!email) {
    console.error("Usage: npx tsx scripts/promote-super-admin.ts <email> [password]");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Found existing user ${email} (current role: ${existing.role})`);
  } else {
    if (!password) {
      console.error("Password required when creating a new account.");
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: email.split("@")[0],
        role: "super_admin",
      },
    });
    console.log(`Created new super_admin: ${email}`);
  }

  // Demote any other super admins
  const others = await prisma.user.findMany({
    where: { role: "super_admin", email: { not: email } },
  });
  for (const u of others) {
    await prisma.user.update({
      where: { id: u.id },
      data: { role: "admin" },
    });
    console.log(`Demoted previous super_admin → admin: ${u.email}`);
  }

  // Promote target
  const updated = await prisma.user.update({
    where: { email },
    data: { role: "super_admin", deletedAt: null },
  });

  console.log(`✓ ${updated.email} is now super_admin`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
