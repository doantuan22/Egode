import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url:
      process.env.DATABASE_URL ||
      (process.env.DB_HOST
        ? `sqlserver://${process.env.DB_HOST}:${process.env.DB_PORT || 1433};database=${process.env.DB_NAME || 'HotelBooking'};user=${process.env.DB_USER || 'sa'};password=${process.env.DB_PASSWORD || ''};encrypt=${process.env.DB_ENCRYPT || (process.env.NODE_ENV === 'production' ? 'true' : 'false')};trustServerCertificate=${process.env.DB_TRUST_SERVER_CERTIFICATE || (process.env.NODE_ENV === 'production' ? 'false' : 'true')}`
        : 'sqlserver://server.invalid:1433;database=HotelBooking;user=placeholder;password=CHANGE_ME;encrypt=true'),
  },
});
