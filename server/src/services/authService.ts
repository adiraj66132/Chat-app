import { prisma } from '../config/db';
import { hashPassword, comparePassword } from '../utils/password';
import { signAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import crypto from 'crypto';

function generateTokenId(): string {
  return crypto.randomBytes(40).toString('hex');
}

function getRefreshTokenExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function registerUser(username: string, password: string, displayName?: string) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new AppError('Username already taken', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      username,
      displayName: displayName || username,
      passwordHash,
    },
  });

  const rawToken = generateTokenId();
  const tokenHash = hashToken(rawToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  const accessToken = signAccessToken({ userId: user.id, username: user.username });

  return {
    user: { id: user.id, username: user.username, displayName: user.displayName },
    accessToken,
    rawToken,
  };
}

export async function loginUser(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    throw new AppError('Invalid username or password', 401);
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid username or password', 401);
  }

  const rawToken = generateTokenId();
  const tokenHash = hashToken(rawToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  const accessToken = signAccessToken({ userId: user.id, username: user.username });

  return {
    user: { id: user.id, username: user.username, displayName: user.displayName },
    accessToken,
    rawToken,
  };
}

export async function refreshUserAccessToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // Rotate: delete old, create new
  const newRawToken = generateTokenId();
  const newTokenHash = hashToken(newRawToken);

  const [deleteResult] = await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { id: stored.id } }),
    prisma.refreshToken.create({
      data: {
        userId: stored.user.id,
        tokenHash: newTokenHash,
        expiresAt: getRefreshTokenExpiry(),
      },
    }),
  ]);

  if (deleteResult.count === 0) {
    throw new AppError('Token already consumed', 401);
  }

  const accessToken = signAccessToken({
    userId: stored.user.id,
    username: stored.user.username,
  });

  return {
    accessToken,
    rawToken: newRawToken,
    user: { id: stored.user.id, username: stored.user.username, displayName: stored.user.displayName },
  };
}

export async function logoutUser(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.deleteMany({ where: { tokenHash } });
}


