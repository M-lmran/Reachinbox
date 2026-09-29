import { Worker, Job } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { bullConnection } from '../config/redis';
import { prisma } from '../config/prisma';
import { EMAIL_QUEUE_NAME, enqueueEmail } from '../queues/email.queue';
import { emailProvider } from '../integrations/email/EtherealEmailProvider';
import { rateLimitService } from '../services/rateLimit.service';
import { slackService } from '../integrations/slack/SlackService';
import { EmailJobData } from '../types';

/**
 * Processes a single email send job.
 * Idempotent: safe state transition scheduled -> processing -> sent/failed.
 * Rate-limited: reschedules (not fails) when the sender's hourly cap is reached.
 */
async function processEmailJob(job: Job<EmailJobData>) {
  const { emailJobId } = job.data;
  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
    include: { campaign: true, sender: true },
  });

  if (!emailJob) {
    logger.warn({ emailJobId }, 'Email job not found in DB; skipping');
    return { skipped: true };
  }

  // Idempotency guard: never resend an already-sent email.
  if (emailJob.status === 'sent') {
    logger.debug({ emailJobId }, 'Already sent; skipping (idempotent)');
    return { skipped: true };
  }

  // Rate limit check (Redis-backed, per sender, per hour).
  const decision = await rateLimitService.tryConsume(emailJob.senderId, emailJob.campaign.hourlyLimit);
  if (!decision.allowed) {
    const nextStart = new Date(decision.nextWindowStartMs);
    const delay = Math.max(1000, decision.nextWindowStartMs - Date.now());
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'scheduled',
        rescheduledForRateLimit: true,
        scheduledAt: nextStart,
      },
    });
    await enqueueEmail(emailJobId, delay, `rl:${decision.hourWindow}`);
    await slackService.sendRateLimitNotification(emailJob.campaign.userId, {
      senderId: emailJob.senderId,
      senderEmail: emailJob.sender.email,
      limit: decision.limit,
      nextWindowStart: nextStart,
    });
    logger.info({ emailJobId, nextStart }, 'Rate limit reached; rescheduled email');
    return { rescheduled: true };
  }

  // Transition to processing.
  await prisma.emailJob.update({
    where: { id: emailJobId },
    data: { status: 'processing', attempts: { increment: 1 } },
  });

  try {
    const result = await emailProvider.sendEmail({
      from: `${emailJob.sender.name} <${emailJob.sender.email}>`,
      to: emailJob.recipient,
      subject: emailJob.subject,
      html: emailJob.body,
      text: emailJob.body.replace(/<[^>]+>/g, ''),
    });

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        previewUrl: result.previewUrl ?? null,
        errorMessage: null,
      },
    });
    logger.info({ emailJobId, previewUrl: result.previewUrl }, 'Email sent');
    return { sent: true, previewUrl: result.previewUrl };
  } catch (err) {
    const attemptsLimit = job.opts.attempts ?? 1;
    const willRetry = job.attemptsMade + 1 < attemptsLimit;
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: willRetry ? 'scheduled' : 'failed',
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    logger.warn({ emailJobId, willRetry }, 'Email send failed');
    throw err; // Let BullMQ handle retry/backoff.
  }
}

export function startWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: bullConnection,
    concurrency: env.WORKER_CONCURRENCY,
  });

  worker.on('completed', (job) => logger.debug({ jobId: job.id }, 'Job completed'));
  worker.on('failed', (job, err) =>
    logger.warn({ jobId: job?.id, err: err.message }, 'Job failed'),
  );
  worker.on('ready', () =>
    logger.info(`Email worker ready (concurrency=${env.WORKER_CONCURRENCY})`),
  );

  return worker;
}

// Run standalone when executed directly (supervisor / npm run worker).
if (require.main === module) {
  startWorker();
  logger.info('Email worker process started');
}
