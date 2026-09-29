import { EmailStatus, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import { campaignRepository } from '../repositories/campaign.repository';
import { emailJobRepository } from '../repositories/emailJob.repository';
import { userRepository } from '../repositories/user.repository';
import { enqueueEmail } from '../queues/email.queue';
import { normalizeRecipients } from '../utils/email-validator';
import { AppError, BadRequest, NotFound } from '../utils/errors';
import { ScheduleEmailDto } from '../types';

const SCHEDULED_STATUSES: EmailStatus[] = ['scheduled', 'processing'];
const SENT_STATUSES: EmailStatus[] = ['sent', 'failed'];

export const emailService = {
  async scheduleCampaign(userId: string, dto: ScheduleEmailDto) {
    const { valid, duplicatesRemoved, invalidIgnored } = normalizeRecipients(dto.recipients);
    if (valid.length === 0) {
      throw BadRequest('No valid recipients provided after normalization');
    }

    const delayMs = Math.max(dto.delayMs, env.MIN_EMAIL_DELAY_MS);
    const hourlyLimit = Math.max(1, dto.hourlyLimit);
    const startTime = new Date(dto.startTime);
    if (Number.isNaN(startTime.getTime())) {
      throw BadRequest('Invalid startTime');
    }

    const user = await userRepository.findById(userId);
    if (!user) throw NotFound('User not found');
    const sender = await userRepository.ensureDefaultSender(userId, user.name, user.email);

    // 1. Create campaign
    const campaign = await campaignRepository.create({
      userId,
      subject: dto.subject,
      body: dto.body,
      startTime,
      delayMs,
      hourlyLimit,
      rawFileUrl: dto.rawFileUrl ?? null,
    });

    // 2. Compute scheduled times and create jobs
    const now = Date.now();
    const startMs = startTime.getTime();
    const rows: Prisma.EmailJobCreateManyInput[] = valid.map((recipient, index) => ({
      campaignId: campaign.id,
      senderId: sender.id,
      recipient,
      subject: dto.subject,
      body: dto.body,
      scheduledAt: new Date(startMs + index * delayMs),
      status: 'scheduled',
    }));

    await emailJobRepository.createMany(rows);
    const jobs = await emailJobRepository.findByCampaign(campaign.id);

    // 3. Enqueue delayed BullMQ jobs (persisted in Redis, survive restarts)
    let enqueued = 0;
    for (const job of jobs) {
      const delay = Math.max(0, job.scheduledAt.getTime() - now);
      const bullJob = await enqueueEmail(job.id, delay);
      if (bullJob.id) {
        await emailJobRepository.updateBullJobId(job.id, bullJob.id);
      }
      enqueued += 1;
    }

    logger.info(
      { campaignId: campaign.id, jobs: enqueued, delayMs, hourlyLimit },
      'Campaign scheduled and jobs enqueued',
    );

    return {
      campaign,
      recipients: {
        valid: valid.length,
        duplicatesRemoved,
        invalidIgnored,
      },
      jobsCreated: enqueued,
    };
  },

  async listScheduled(userId: string, page: number, limit: number, status?: EmailStatus, search?: string) {
    if (status && !SCHEDULED_STATUSES.includes(status)) {
      throw BadRequest('Invalid status filter for scheduled emails');
    }
    const { items, total } = await emailJobRepository.paginateForUser({
      userId,
      statuses: SCHEDULED_STATUSES,
      page,
      limit,
      status,
      search,
      orderBy: 'scheduledAt',
      order: 'asc',
    });
    return { items, total };
  },

  async listSent(userId: string, page: number, limit: number, status?: EmailStatus, search?: string) {
    if (status && !SENT_STATUSES.includes(status)) {
      throw BadRequest('Invalid status filter for sent emails');
    }
    const { items, total } = await emailJobRepository.paginateForUser({
      userId,
      statuses: SENT_STATUSES,
      page,
      limit,
      status,
      search,
      orderBy: 'sentAt',
      order: 'desc',
    });
    return { items, total };
  },

  async getById(userId: string, id: string) {
    const job = await emailJobRepository.findByIdForUser(id, userId);
    if (!job) throw NotFound('Email job not found');
    return job;
  },

  async retry(userId: string, id: string) {
    const job = await emailJobRepository.findByIdForUser(id, userId);
    if (!job) throw NotFound('Email job not found');
    if (job.status !== 'failed') {
      throw new AppError(409, 'Only failed emails can be retried', 'CONFLICT');
    }
    await emailJobRepository.update(id, {
      status: 'scheduled',
      errorMessage: null,
      scheduledAt: new Date(),
    });
    const bullJob = await enqueueEmail(id, 0, `retry:${Date.now()}`);
    if (bullJob.id) await emailJobRepository.updateBullJobId(id, bullJob.id);
    return emailJobRepository.findByIdForUser(id, userId);
  },

  stats(userId: string) {
    return emailJobRepository.statsForUser(userId);
  },

  async search(userId: string, query: string) {
    if (!query || query.trim().length === 0) return [];
    return emailJobRepository.searchForUser(userId, query.trim());
  },
};
