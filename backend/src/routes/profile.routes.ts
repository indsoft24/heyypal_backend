import { Router } from 'express';
import { getProfiles, getProfileById, updateProfile } from '../controllers/profile.controller.js';

const router = Router();

router.get('/', getProfiles);
router.get('/:id', getProfileById);
router.put('/', updateProfile);

export default router;
