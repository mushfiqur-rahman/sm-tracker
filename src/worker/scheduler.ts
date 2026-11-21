// Long-running scheduler. Run alongside the web app: `npm run worker`.
// Alternatively call GET /api/cron/publish every minute from any cron service.
import { runDueTargets } from "../lib/publisher";
import { db } from "../lib/db";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 15_000);
let stopping = false;

async function tick() {
  try {
    const { processed } = await runDueTargets(50);
    if (processed) console.log(`[scheduler] ${new Date().toISOString()} published ${processed} target(s)`);
  } catch (e) {
    console.error("[scheduler] tick failed", e);
  }
}

async function main() {
  console.log(`[scheduler] started, polling every ${INTERVAL_MS / 1000}s`);
  while (!stopping) {
    await tick();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  await db.$disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, () => {
    console.log(`[scheduler] ${sig} received, finishing current tick…`);
    stopping = true;
  });

main();
