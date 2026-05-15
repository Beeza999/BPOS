import { PrismaClient } from '@prisma/client';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. This backend uses Prisma + MongoDB as real data storage.');
export const prisma = new PrismaClient();
