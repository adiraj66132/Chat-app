import { Request, Response, NextFunction } from 'express';
import * as conversationService from '../services/conversationService';

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

export async function getKeys(req: Request, res: Response, next: NextFunction) {
  try {
    const key = await conversationService.getMyKey(
      req.params.id as string,
      req.user!.userId
    );
    res.json({ wrappedKey: key });
  } catch (err) {
    next(err);
  }
}

export async function putKeys(req: Request, res: Response, next: NextFunction) {
  try {
    const { keys } = req.body;
    await conversationService.putKeys(req.params.id as string, req.user!.userId, keys);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function deleteKeys(req: Request, res: Response, next: NextFunction) {
  try {
    await conversationService.deleteMyKey(req.params.id as string, req.user!.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
