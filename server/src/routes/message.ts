import { Router } from 'express';
import * as messageController from '../controllers/messageController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { sendMessageSchema, editMessageSchema } from '../validation/message';

const router = Router();

router.use(authenticate);
router.get('/conversations/:conversationId/messages', messageController.getMessages);
router.post('/conversations/:conversationId/messages', validate(sendMessageSchema), messageController.sendMessage);
router.patch('/messages/:id', validate(editMessageSchema), messageController.editMessage);
router.delete('/messages/:id', messageController.deleteMessage);

export default router;
