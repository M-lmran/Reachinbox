export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface ScheduleEmailDto {
  subject: string;
  body: string;
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
  recipients: string[];
  rawFileUrl?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export interface EmailJobData {
  emailJobId: string;
}

export interface SendEmailInput {
  from?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl?: string;
  accepted: (string | { address: string })[];
}

export interface EmailProvider {
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
