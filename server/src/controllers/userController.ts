import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.getCurrentUser(req.user!.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function getUserById(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.getUserById(req.params.id as string);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function searchUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const q = String(req.query.q || '');
    if (!q || q.length < 1) {
      res.status(400).json({ error: 'Search query required' });
      return;
    }
    const users = await userService.searchUsers(q, req.user!.userId);
    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.updateProfile(req.user!.userId, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await userService.updateAvatar(req.user!.userId, avatarUrl);
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateTheme(req: Request, res: Response, next: NextFunction) {
  try {
    const { theme } = req.body;
    const result = await userService.updateTheme(req.user!.userId, theme);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function setPublicKey(req: Request, res: Response, next: NextFunction) {
  try {
    const publicKey = String(req.body?.publicKey || '');
    if (!publicKey) {
      res.status(400).json({ error: 'publicKey is required' });
      return;
    }
    const user = await userService.setPublicKey(req.user!.userId, publicKey);
    res.json(user);
  } catch (err) {
    next(err);
  }
}
