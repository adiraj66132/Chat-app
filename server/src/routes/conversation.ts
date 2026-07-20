import { Router } from 'express';
import * as conversationController from '../controllers/conversationController';
import * as messageController from '../controllers/messageController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { apiLimiter } from '../middleware/rateLimiter';
import {
  createConversationSchema,
  createGroupSchema,
  addMembersSchema,
  updateGroupSchema,
  changeRoleSchema,
  conversationKeySchema,
} from '../validation/conversation';

const router = Router();

router.use(authenticate);
router.get('/', conversationController.list);
router.post('/', validate(createConversationSchema), conversationController.create);
router.post('/group', apiLimiter, validate(createGroupSchema), conversationController.createGroup);
router.get('/:id/members', conversationController.getMembers);
router.post(
  '/:id/members',
  apiLimiter,
  validate(addMembersSchema),
  conversationController.addMembers
);
router.delete('/:id/members/:userId', conversationController.removeMember);
router.patch(
  '/:id/members/:userId/role',
  validate(changeRoleSchema),
  conversationController.changeRole
);
router.patch('/:id', validate(updateGroupSchema), conversationController.updateGroup);
router.post('/:id/leave', conversationController.leaveGroup);
router.get('/:id/keys', conversationController.getKeys);
router.post('/:id/keys', validate(conversationKeySchema), conversationController.saveKey);
router.get('/:id/pinned', messageController.getPinnedMessages);
router.delete('/:id/messages', conversationController.clearMessages);
router.get('/:id', conversationController.getById);
router.delete('/:id', conversationController.remove);

export default router;
