import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import {
  authenticateApp,
  attachAppUser,
  requireProfileComplete,
} from '../middleware/auth.middleware.js';

const router = Router();

router.post('/google', authController.googleLogin);
router.post('/refresh', authController.refresh);

router.use(authenticateApp);
router.use(attachAppUser);

router.get('/me', authController.me);
router.post('/profile/complete', authController.completeProfileRoute);

export default router;
