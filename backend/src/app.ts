import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes';
import healthRoutes from './modules/health/health.routes';
import { env } from './config/env';
import { isAllowedOrigin } from './config/cors';
import { timeOfDayJsonReplacer } from './common/utils/time-of-day';
import { errorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';
import { securityHeaders } from './middleware/security.middleware';
import { requestLogging } from './middleware/request-logging.middleware';

const app: Application = express();
app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);
app.set('json replacer', timeOfDayJsonReplacer);

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  })
);
app.use(securityHeaders);
app.use(requestLogging);
// Giới hạn 10mb vì API upload ảnh nhận data URI base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

// Route kiểm tra sức khỏe hệ thống
app.use('/', healthRoutes);

// Route API
app.use('/api', routes);

// Xử lý 404
app.use(notFoundHandler);

// Xử lý lỗi chung
app.use(errorHandler);

export default app;
