import { getPrismaClient } from '../../config/prisma';

export interface DatabaseStatus {
  connected: boolean;
  message: string;
}

export class HealthRepository {
  /** Kiểm tra kết nối cơ sở dữ liệu */
  async checkDatabase(): Promise<DatabaseStatus> {
    try {
      const prisma = getPrismaClient();
      // Thử kết nối bằng truy vấn đơn giản
      await prisma.$queryRaw`SELECT 1 as ping`;
      return { connected: true, message: 'Database connected successfully' };
    } catch (error) {
      // Chỉ ghi nhóm lỗi an toàn vào log
      console.error('Database health probe failed', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      return { connected: false, message: 'Database unavailable' };
    }
  }
}
