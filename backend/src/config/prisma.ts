import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../generated/prisma/client';
import { env } from './env';

let prismaInstance: PrismaClient | null = null;
let adapterInstance: PrismaMssql | null = null;

export const getPrismaClient = (): PrismaClient => {
  if (!prismaInstance) {
    adapterInstance = new PrismaMssql(env.DATABASE_URL);
    prismaInstance = new PrismaClient({
      adapter: adapterInstance,
      log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prismaInstance;
};

export const disconnectPrisma = async (): Promise<void> => {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    adapterInstance = null;
  }
};

// Xuất proxy tải chậm cho tiện dùng
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: keyof PrismaClient) {
    const client = getPrismaClient();
    const value = client[prop];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
