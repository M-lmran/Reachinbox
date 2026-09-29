import { Queue } from 'bullmq';
import { bullConnection } from '../config/redis';
import { EmailJobData } from '../types';

export const EMAIL_QUEUE_NAME = 'email-send-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 2000 },
    removeOnFail: { count: 5000 },
  },
});

/** Add a delayed send job. Uses emailJobId as a stable jobId for idempotency. */
export async function enqueueEmail(emailJobId: string, delayMs: number, jobIdSuffix?: string) {
  const jobId = jobIdSuffix ? `${emailJobId}:${jobIdSuffix}` : emailJobId;
  return emailQueue.add(
    'send',
    { emailJobId },
    { delay: Math.max(0, Math.floor(delayMs)), jobId },
  );
}
