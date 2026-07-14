import { Request, Response, NextFunction } from 'express';
import * as messageService from '../services/messageService';

export async function getMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const cursor = req.query.cursor as string | undefined;
    const result = await messageService.getMessages(
      req.params.conversationId as string,
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
    const message = await messageService.sendMessage(
      req.params.conversationId as string,
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
    const message = await messageService.editMessage(
      req.params.id as string,
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
    const q = String(req.query.q || '');
    if (q.length < 1) { res.json([]); return; }
    const results = await messageService.searchMessages(req.user!.userId, q);
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function pinMessage(req: Request, res: Response, next: NextFunction) {
  try {
    await messageService.pinMessage(req.params.id as string, req.user!.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function unpinMessage(req: Request, res: Response, next: NextFunction) {
  try {
    await messageService.unpinMessage(req.params.id as string, req.user!.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function getPinnedMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const pinned = await messageService.getPinnedMessages(req.params.id as string, req.user!.userId);
    res.json(pinned);
  } catch (err) { next(err); }
}

export async function forwardMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { targetConversationId } = req.body;
    if (!targetConversationId) { res.status(400).json({ error: 'targetConversationId required' }); return; }
    const message = await messageService.forwardMessage(req.params.id as string, req.user!.userId, targetConversationId);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
  try {
    await messageService.deleteMessage(req.params.id as string, req.user!.userId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}
