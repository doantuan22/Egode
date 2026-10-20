import { HealthRepository } from './health.repository';
import { env } from '../../config/env';

export const HEALTH_CHECK_TIMEOUT_MS = 5_000;

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  environment: string;
  database: {
    status: 'connected' | 'disconnected' | 'not_checked';
    details: string;
  };
}

export class HealthService {
  constructor(
    private readonly healthRepository: HealthRepository = new HealthRepository(),
    private readonly databaseTimeoutMs = HEALTH_CHECK_TIMEOUT_MS
  ) {}

  async getHealthStatus(includeDb = false): Promise<HealthCheckResult> {
    let dbStatus = { connected: false, message: 'Database check skipped' };

    if (includeDb) {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_resolve, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error('Database health check timed out')), this.databaseTimeoutMs);
        });
        dbStatus = await Promise.race([this.healthRepository.checkDatabase(), timeout]);
      } catch (error) {
        // Không đưa thông báo của driver vào kết quả
        if (error instanceof Error && error.message === 'Database health check timed out') {
          console.error('Database readiness probe timed out');
        } else {
          console.error('Database readiness probe failed');
        }
        dbStatus = { connected: false, message: 'Database unavailable' };
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }
    }

    return {
      status: includeDb && !dbStatus.connected ? 'degraded' : 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      database: {
        status: !includeDb ? 'not_checked' : dbStatus.connected ? 'connected' : 'disconnected',
        details: dbStatus.message,
      },
    };
  }
}
