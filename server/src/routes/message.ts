import { Router } from 'express';
import * as messageController from '../controllers/messageController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { sendMessageSchema, editMessageSchema } from '../validation/message';

const router = Router();

router.use(authenticate);
router.get('/search', messageController.searchMessages);
router.get('/conversations/:conversationId/messages', messageController.getMessages);
router.post('/conversations/:conversationId/messages', validate(sendMessageSchema), messageController.sendMessage);
router.patch('/messages/:id', validate(editMessageSchema), messageController.editMessage);
router.post('/messages/:id/forward', messageController.forwardMessage);
router.post('/messages/:id/pin', messageController.pinMessage);
router.delete('/messages/:id/pin', messageController.unpinMessage);
router.delete('/messages/:id', messageController.deleteMessage);

export default router;
