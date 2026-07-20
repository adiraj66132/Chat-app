import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as messageService from '../services/messageService';

const uuidSchema = z.string().uuid();

export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const conversationId = uuidSchema.parse(req.params.conversationId);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = await messageService.getMessages(
      conversationId,
      req.user!.userId,
      cursor
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const conversationId = uuidSchema.parse(req.params.conversationId);
    const message = await messageService.sendMessage(
      conversationId,
      req.user!.userId,
      req.body
    );
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

export async function editMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const messageId = uuidSchema.parse(req.params.id);
    const message = await messageService.editMessage(
      messageId,
      req.user!.userId,
      req.body.content
    );
    res.json(message);
  } catch (err) {
    next(err);
  }
}

export async function searchMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 1) { res.json([]); return; }
    const results = await messageService.searchMessages(req.user!.userId, q);
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function pinMessage(req: Request, res: Response, next: NextFunction) {
  try {
    await messageService.pinMessage(uuidSchema.parse(req.params.id), req.user!.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function unpinMessage(req: Request, res: Response, next: NextFunction) {
  try {
    await messageService.unpinMessage(uuidSchema.parse(req.params.id), req.user!.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function getPinnedMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const pinned = await messageService.getPinnedMessages(uuidSchema.parse(req.params.id), req.user!.userId);
    res.json(pinned);
  } catch (err) { next(err); }
}

export async function forwardMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { targetConversationId } = req.body;
    const messageId = uuidSchema.parse(req.params.id);
    const target = uuidSchema.parse(targetConversationId);
    const message = await messageService.forwardMessage(messageId, req.user!.userId, target);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const messageId = uuidSchema.parse(req.params.id);
    await messageService.deleteMessage(messageId, req.user!.userId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}
