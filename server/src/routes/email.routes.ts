import { Router } from 'express';
import { emailController } from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { scheduleEmailSchema } from '../validators/email.validator';

const router = Router();

router.use(requireAuth);

router.post('/schedule', validate(scheduleEmailSchema), emailController.schedule);
router.get('/scheduled', emailController.scheduled);
router.get('/sent', emailController.sent);
router.get('/stats', emailController.stats);
router.get('/search', emailController.search);
router.get('/:id', emailController.getOne);
router.post('/:id/retry', emailController.retry);

export default router;
