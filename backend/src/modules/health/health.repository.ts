import { getPrismaClient } from '../../config/prisma';

export interface DatabaseStatus {
  connected: boolean;
  message: string;
}

export class HealthRepository {
  /**
   * Check database connectivity via Prisma 7 client without crashing if DB is offline.
   */
  async checkDatabase(): Promise<DatabaseStatus> {
    try {
      const prisma = getPrismaClient();
      // Test Prisma connectivity via $queryRaw or basic ping
      await prisma.$queryRaw`SELECT 1 as ping`;
      return { connected: true, message: 'Database connected successfully' };
    } catch (error) {
      // Error messages from SQL drivers may include host/login details; retain only a safe category in server logs.
      console.error('Database health probe failed', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      return { connected: false, message: 'Database unavailable' };
    }
  }
}
