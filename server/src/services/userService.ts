import { prisma } from '../config/db';
import { AppError } from '../utils/AppError';
import { comparePassword, hashPassword } from '../utils/password';

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      publicKey: true,
      theme: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      lastSeenAt: true,
    },
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
}

export async function searchUsers(query: string, currentUserId: string) {
  return prisma.user.findMany({
    where: {
      AND: [
        { id: { not: currentUserId } },
        {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      lastSeenAt: true,
    },
    take: 20,
  });
}

export async function updateProfile(
  userId: string,
  data: { displayName?: string; bio?: string; username?: string }
) {
  if (data.username) {
    const taken = await prisma.user.findFirst({
      where: { username: data.username, id: { not: userId } },
      select: { id: true },
    });
    if (taken) throw new AppError('Username already taken', 409);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      theme: true,
      lastSeenAt: true,
    },
  });
  return user;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw new AppError('User not found', 404);

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new AppError('Current password is incorrect', 400);

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}

export async function updateAvatar(userId: string, avatarUrl: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      theme: true,
      lastSeenAt: true,
    },
  });
  return user;
}

export async function updateTheme(userId: string, theme: string) {
  const validThemes = ['LIGHT', 'DARK', 'TELEGRAM', 'NORD'] as const;
  if (!validThemes.includes(theme as any)) {
    throw new AppError('Invalid theme', 400);
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { theme: theme as any },
    select: {
      id: true,
      theme: true,
    },
  });
  return user;
}


