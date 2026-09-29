import { Request, Response } from 'express';
import { checkDatabase } from '../config/prisma';
import { checkRedis } from '../config/redis';
import { emailQueue } from '../queues/email.queue';

export const healthController = {
  async health(_req: Request, res: Response) {
    const [database, redisOk] = await Promise.all([checkDatabase(), checkRedis()]);
    const status = database && redisOk ? 'ok' : 'degraded';
    return res.status(status === 'ok' ? 200 : 503).json({
      status,
      database: database ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
    });
  },

  async queue(_req: Request, res: Response) {
    try {
      const counts = await emailQueue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'completed',
        'failed',
      );
      return res.json({ status: 'ok', queue: emailQueue.name, counts });
    } catch (err) {
      return res.status(503).json({ status: 'error', error: String(err) });
    }
  },
};
