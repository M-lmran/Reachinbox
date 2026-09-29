import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { checkDatabase } from './config/prisma';
import { checkRedis } from './config/redis';

async function bootstrap() {
  const app = createApp();

  const [db, redisOk] = await Promise.all([checkDatabase(), checkRedis()]);
  logger.info({ database: db, redis: redisOk }, 'Startup dependency check');
  if (!db) logger.error('Database is not reachable — check DATABASE_URL / Postgres');
  if (!redisOk) logger.error('Redis is not reachable — check REDIS_URL');

  app.listen(env.PORT, () => {
    logger.info(`ReachInbox API listening on port ${env.PORT} (${env.NODE_ENV})`);
    logger.info(`Queue dashboard: /api/admin/queues`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err: String(err) }, 'Fatal error during startup');
  process.exit(1);
});
