/**
 * Prisma client for the local projects API.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

/** Connection string; defaults match docker-compose.yml / .env.example. */
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://floor:floor@127.0.0.1:5432/floor_drawing";

const adapter = new PrismaPg({ connectionString: DATABASE_URL });

/** Shared Prisma client (one per process). */
export const prisma = new PrismaClient({ adapter });

/**
 * Ping the database.
 * @returns true when a simple query succeeds
 */
export async function checkDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
