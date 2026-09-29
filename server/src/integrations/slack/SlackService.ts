import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';
import { isSlackOAuthConfigured, env } from '../../config/env';

export interface RateLimitNotification {
  senderId: string;
  senderEmail?: string;
  limit: number;
  nextWindowStart: Date;
}

/**
 * Slack integration abstraction. Kept isolated from email business logic.
 * Phase 1: supports a manual Incoming Webhook connection (works without a Slack app).
 * Phase 3 (TODO): full Slack OAuth (connect/disconnect via SLACK_CLIENT_ID/SECRET/REDIRECT).
 */
export class SlackService {
  isOAuthReady(): boolean {
    return isSlackOAuthConfigured();
  }

  async getStatus(userId: string) {
    const integration = await prisma.slackIntegration.findUnique({ where: { userId } });
    return {
      connected: Boolean(integration),
      teamName: integration?.teamName ?? null,
      oauthConfigured: this.isOAuthReady(),
    };
  }

  async connectWithWebhook(userId: string, webhookUrl: string, teamName?: string) {
    return prisma.slackIntegration.upsert({
      where: { userId },
      create: { userId, webhookUrl, teamName: teamName ?? 'Slack Workspace' },
      update: { webhookUrl, teamName: teamName ?? 'Slack Workspace' },
    });
  }

  async disconnect(userId: string) {
    await prisma.slackIntegration.deleteMany({ where: { userId } });
    return { connected: false };
  }

  // Phase 3 TODO: exchange OAuth code -> token. Interface prepared, not yet wired.
  async handleOAuthCallback(_code: string): Promise<never> {
    throw new Error('Slack OAuth not configured (Phase 3). Use manual webhook connection.');
  }

  async sendRateLimitNotification(userId: string, payload: RateLimitNotification): Promise<void> {
    const integration = await prisma.slackIntegration.findUnique({ where: { userId } });
    if (!integration?.webhookUrl) {
      logger.debug({ userId }, 'Slack not connected; skipping rate-limit notification');
      return;
    }

    const text = `:hourglass_flowing_sand: *ReachInbox rate limit reached*\nSender \`${
      payload.senderEmail || payload.senderId
    }\` hit the hourly cap of *${payload.limit}* emails. Remaining emails were rescheduled to *${payload.nextWindowStart.toISOString()}*.`;

    try {
      const res = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, 'Slack webhook responded with non-OK status');
      } else {
        logger.info({ userId }, 'Slack rate-limit notification sent');
      }
    } catch (err) {
      logger.warn({ err: String(err) }, 'Failed to send Slack notification (non-fatal)');
    }
  }

  buildOAuthUrl(): string | null {
    if (!this.isOAuthReady()) return null;
    const scope = 'incoming-webhook,chat:write';
    return `https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=${scope}&redirect_uri=${encodeURIComponent(
      env.SLACK_REDIRECT_URI,
    )}`;
  }
}

export const slackService = new SlackService();
