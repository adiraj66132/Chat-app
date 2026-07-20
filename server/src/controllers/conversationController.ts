import { Request, Response, NextFunction } from 'express';
import * as conversationService from '../services/conversationService';
import * as conversationKeyService from '../services/conversationKeyService';
import { emitToUser, emitToRoom, joinRoomForParticipants } from '../socket/emitter';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const conversations = await conversationService.listConversations(req.user!.userId);
    res.json(conversations);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { participantId } = req.body;
    const conversation = await conversationService.createDM(req.user!.userId, participantId);
    // Bring both participants' already-connected sockets into the room so the
    // new conversation updates in real time for the other user too.
    await joinRoomForParticipants(conversation.id);
    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const conversation = await conversationService.getConversation(
      req.params.id as string,
      req.user!.userId
    );
    res.json(conversation);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await conversationService.deleteConversation(req.params.id as string, req.user!.userId);
    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    next(err);
  }
}

export async function clearMessages(req: Request, res: Response, next: NextFunction) {
  try {
    await conversationService.clearConversationMessages(req.params.id as string, req.user!.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function createGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await conversationService.createGroupConversation(req.user!.userId, req.body);
    // Join all members' connected sockets to the room for live updates.
    await joinRoomForParticipants(group.id);
    for (const p of group.participants) {
      emitToUser(p.userId, 'conversation:group-created', { conversation: group });
    }
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
}

export async function getMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await conversationService.getGroupMembers(
      req.params.id as string,
      req.user!.userId
    );
    res.json(members);
  } catch (err) {
    next(err);
  }
}

export async function addMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await conversationService.addParticipants(
      req.params.id as string,
      req.user!.userId,
      req.body.userIds
    );
    const room = `conversation:${group.id}`;
    const added = group.participants.filter((p) => req.body.userIds.includes(p.userId));
    for (const p of added) {
      emitToUser(p.userId, 'conversation:group-created', { conversation: group });
    }
    // Bring newly-added members' connected sockets into the room.
    await joinRoomForParticipants(group.id);
    emitToRoom(room, 'group:member-added', { conversationId: group.id, conversation: group });
    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    const { removedUserId } = await conversationService.removeParticipant(
      req.params.id as string,
      req.user!.userId,
      req.params.userId as string
    );
    const room = `conversation:${req.params.id}`;
    emitToRoom(room, 'group:member-removed', {
      conversationId: req.params.id,
      userId: removedUserId,
      removedBy: req.user!.userId,
    });
    emitToUser(removedUserId, 'group:member-removed', {
      conversationId: req.params.id,
      userId: removedUserId,
      removedBy: req.user!.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function updateGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await conversationService.updateGroupMeta(
      req.params.id as string,
      req.user!.userId,
      req.body
    );
    emitToRoom(`conversation:${group.id}`, 'group:updated', {
      conversationId: group.id,
      name: group.name,
      avatarUrl: group.avatarUrl,
      description: group.description,
    });
    res.json(group);
  } catch (err) {
    next(err);
  }
}

export async function changeRole(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await conversationService.changeRole(
      req.params.id as string,
      req.user!.userId,
      req.params.userId as string,
      req.body.role
    );
    emitToRoom(`conversation:${req.params.id}`, 'group:role-changed', {
      conversationId: req.params.id,
      userId: result.userId,
      role: result.role,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function leaveGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await conversationService.leaveGroup(
      req.params.id as string,
      req.user!.userId
    );
    emitToRoom(`conversation:${req.params.id}`, 'group:member-left', {
      conversationId: req.params.id,
      userId: req.user!.userId,
      deleted: result.deleted,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// --- Conversation encryption keys (per-participant wrapped CEK) ---

export async function getKeys(req: Request, res: Response, next: NextFunction) {
  try {
    // Ensure the caller is a participant.
    await conversationService.getConversation(req.params.id as string, req.user!.userId);
    const keys = await conversationKeyService.listConversationKeys(req.params.id as string);
    res.json(keys);
  } catch (err) {
    next(err);
  }
}

export async function saveKey(req: Request, res: Response, next: NextFunction) {
  try {
    // Ensure the caller is a participant.
    await conversationService.getConversation(req.params.id as string, req.user!.userId);
    const key = await conversationKeyService.upsertConversationKey(
      req.params.id as string,
      req.user!.userId,
      req.body.wrappedKey
    );
    // Notify other participants that a key is available for this conversation.
    emitToRoom(`conversation:${req.params.id}`, 'conversation:key_updated', {
      conversationId: req.params.id,
      userId: req.user!.userId,
    });
    res.status(201).json(key);
  } catch (err) {
    next(err);
  }
}
