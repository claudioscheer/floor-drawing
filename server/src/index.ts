/**
 * Local projects API entrypoint.
 * Run: npm run server
 *
 * Schema is managed by Prisma Migrate (`npm run db:migrate`).
 * This process only connects and serves HTTP.
 */

import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { checkDb, prisma } from "./db.js";

const PORT = Number(process.env.PORT) || 3001;

async function main(): Promise<void> {
  const ready = await checkDb();
  if (!ready) {
    console.error(
      "[server] Cannot connect to Postgres. Start it with: npm run db:up"
    );
    console.error(
      "[server] Expected DATABASE_URL or postgres://floor:floor@127.0.0.1:5432/floor_drawing"
    );
    process.exit(1);
  }

  console.log("[server] Database connected (Prisma)");

  const app = createApp();
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`[server] Listening on http://127.0.0.1:${info.port}`);
  });
}

async function shutdown(): Promise<void> {
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

main().catch(async (err) => {
  console.error("[server] Fatal:", err);
  await prisma.$disconnect();
  process.exit(1);
});
