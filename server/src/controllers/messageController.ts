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

export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
  try {
    await messageService.deleteMessage(req.params.id as string, req.user!.userId);
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}
