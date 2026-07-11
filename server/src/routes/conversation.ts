import { Router } from 'express';
import * as conversationController from '../controllers/conversationController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { createConversationSchema, putKeysSchema } from '../validation/conversation';

const router = Router();

router.use(authenticate);
router.get('/', conversationController.list);
router.post('/', validate(createConversationSchema), conversationController.create);
router.get('/:id/keys', conversationController.getKeys);
router.put('/:id/keys', validate(putKeysSchema), conversationController.putKeys);
router.delete('/:id/keys', conversationController.deleteKeys);
router.get('/:id', conversationController.getById);
router.delete('/:id', conversationController.remove);

export default router;
