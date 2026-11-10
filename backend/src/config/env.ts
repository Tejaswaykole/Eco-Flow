import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment from database/.env (root or nested) or process.env
const possibleEnvPaths = [
  path.resolve(process.cwd(), 'database/.env'),
  path.resolve(process.cwd(), '../database/.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const p of possibleEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'fallback_secret_at_least_32_characters_long_for_dev_mode',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret_at_least_32_characters_for_dev',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  databaseUrl: process.env.DATABASE_URL || '',
  directUrl: process.env.DIRECT_URL || '',
  uploadDir: path.resolve(process.cwd(), 'uploads'),
  maxFileSize: 10 * 1024 * 1024, // 10MB
};
