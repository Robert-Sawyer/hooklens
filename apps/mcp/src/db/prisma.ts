import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { mcpPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.mcpPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.mcpPrisma = prisma;
}
