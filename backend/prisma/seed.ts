import { PrismaClient } from '@prisma/client';
import { DEFAULT_ANALYSIS_PROMPT, DEFAULT_FOLLOW_UP_PROMPT } from '../src/analysis/default-prompts';
import { DEFAULT_MODEL } from '../src/analysis/model-catalog';

const prisma = new PrismaClient();

/**
 * Idempotent seed. Safe to re-run: it never overwrites prompt text an admin has
 * already edited, it only creates the row if it is missing.
 */
async function main(): Promise<void> {
  const config = await prisma.promptConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      analysisPrompt: DEFAULT_ANALYSIS_PROMPT,
      followUpPrompt: DEFAULT_FOLLOW_UP_PROMPT,
      model: DEFAULT_MODEL,
    },
  });
  console.log(`Prompt config ready (model: ${config.model}, version: ${config.version})`);

  // Existing accounts listed in ADMIN_EMAILS are promoted, so adding yourself
  // to the env var doesn't require re-registering.
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length > 0) {
    const { count } = await prisma.user.updateMany({
      where: { email: { in: adminEmails } },
      data: { isAdmin: true },
    });
    console.log(`Promoted ${count} existing account(s) to admin`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
