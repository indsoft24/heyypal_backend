import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import {
  authenticateAdmin,
  attachAdminUser,
  isAdmin,
  isSeller,
} from '../middleware/auth.middleware.js';

const router = Router();

router.post('/auth/login', adminController.adminLogin);

router.use(authenticateAdmin);
router.use(attachAdminUser);

router.get('/experts', isAdmin, adminController.listExpertRequests);
router.post('/experts/:id/approve', isAdmin, adminController.approveExpert);
router.post('/experts/:id/reject', isAdmin, adminController.rejectExpert);

router.get('/sellers', isAdmin, adminController.listSellers);
router.post('/sellers', isAdmin, adminController.createSeller);

export default router;
