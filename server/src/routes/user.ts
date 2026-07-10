import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import * as userController from '../controllers/userController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { updateProfileSchema, changePasswordSchema } from '../validation/user';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(__dirname, '../../uploads/avatars'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

const router = Router();

router.use(authenticate);
router.get('/me', userController.getMe);
router.patch('/me', validate(updateProfileSchema), userController.updateProfile);
router.post('/me/avatar', upload.single('avatar'), userController.updateAvatar);
router.post('/me/public-key', userController.setPublicKey);
router.patch('/me/theme', userController.updateTheme);
router.post('/me/change-password', validate(changePasswordSchema), userController.changePassword);
router.get('/search', userController.searchUsers);
router.get('/:id', userController.getUserById);

export default router;
