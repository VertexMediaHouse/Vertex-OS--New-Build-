import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

export * from "./generated/client";

function createClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
}

// One client per process; dev hot reload would otherwise open a new pool on every edit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
