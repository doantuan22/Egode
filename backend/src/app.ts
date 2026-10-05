import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes';
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

// Middlewares
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
// 10mb: owner image-upload endpoints accept a base64 data URI in the JSON
// body (reuses the existing Cloudinary integration as-is, no multer/
// multipart parsing added) — the default 100kb limit is too small for that.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(cookieParser());

// API Routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
