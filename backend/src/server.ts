import { createApp } from './app.js';
import { config } from './config/env.js';
import { prisma } from './config/database.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[ECOFlow Backend] Server running on port ${config.port} (${config.env})`);
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    await prisma.$disconnect();
    console.log('Database disconnected.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after 10s timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
