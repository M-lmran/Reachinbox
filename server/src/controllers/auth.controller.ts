import { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { slackService } from '../integrations/slack/SlackService';
import { googleAuthProvider } from '../integrations/google/GoogleAuthProvider';
import { ok } from '../utils/response';
import { AppError } from '../utils/errors';

export const authController = {
  async devLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await authService.devLogin(req.body);
      return ok(res, session);
    } catch (err) {
      return next(err);
    }
  },

  async supabaseLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const session = await authService.loginWithSupabaseToken(req.body.accessToken);
      return ok(res, session);
    } catch (err) {
      return next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.me(req.user!.id);
      return ok(res, user);
    } catch (err) {
      return next(err);
    }
  },

  logout(_req: Request, res: Response) {
    // Stateless JWT: client discards the token. (Supabase sign-out happens client-side.)
    return ok(res, { loggedOut: true });
  },

  authConfig(_req: Request, res: Response) {
    return ok(res, {
      supabaseConfigured: googleAuthProvider.isSupabaseReady(),
      googleOAuthConfigured: googleAuthProvider.isDirectOAuthReady(),
      devLoginEnabled: true,
    });
  },

  // Direct Google OAuth entry point (alternative to Supabase). Interface kept ready.
  googleStart(_req: Request, res: Response, next: NextFunction) {
    try {
      if (!googleAuthProvider.isDirectOAuthReady()) {
        throw new AppError(
          501,
          'Direct Google OAuth is not configured. Sign in via Supabase Google, or use dev login.',
          'NOT_CONFIGURED',
        );
      }
      // TODO (Phase 2): redirect to Google's consent screen.
      return res.status(501).json({ success: false, error: { message: 'Not implemented' } });
    } catch (err) {
      return next(err);
    }
  },

  // ---- Slack ----
  async slackStatus(req: Request, res: Response, next: NextFunction) {
    try {
      return ok(res, await slackService.getStatus(req.user!.id));
    } catch (err) {
      return next(err);
    }
  },

  async slackConnect(req: Request, res: Response, next: NextFunction) {
    try {
      await slackService.connectWithWebhook(req.user!.id, req.body.webhookUrl, req.body.teamName);
      return ok(res, await slackService.getStatus(req.user!.id));
    } catch (err) {
      return next(err);
    }
  },

  async slackDisconnect(req: Request, res: Response, next: NextFunction) {
    try {
      await slackService.disconnect(req.user!.id);
      return ok(res, { connected: false });
    } catch (err) {
      return next(err);
    }
  },
};
