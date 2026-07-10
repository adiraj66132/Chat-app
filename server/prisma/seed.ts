import { PrismaClient, ConversationType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const alice = await prisma.user.upsert({
    where: { username: 'alice' },
    update: {},
    create: {
      id: uuid(),
      username: 'alice',
      displayName: 'Alice',
      passwordHash,
      bio: 'Hello, I am Alice!',
    },
  });

  const bob = await prisma.user.upsert({
    where: { username: 'bob' },
    update: {},
    create: {
      id: uuid(),
      username: 'bob',
      displayName: 'Bob',
      passwordHash,
      bio: 'Hey there!',
    },
  });

  // Global chat conversation
  const globalChatId = '00000000-0000-0000-0000-000000000000';
  await prisma.conversation.upsert({
    where: { id: globalChatId },
    update: {},
    create: {
      id: globalChatId,
      type: ConversationType.GLOBAL,
      name: 'Global Chat',
      description: 'Everyone can chat here',
    },
  });

  // DM between alice and bob
  const dmId = uuid();
  await prisma.conversation.upsert({
    where: { id: dmId },
    update: {},
    create: { id: dmId, type: ConversationType.DM },
  });

  for (const userId of [alice.id, bob.id]) {
    await prisma.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: dmId, userId } },
      update: {},
      create: { conversationId: dmId, userId, role: 'MEMBER' },
    });
  }

  // A few sample messages in the DM
  const messages = [
    { content: 'Hey Bob! How are you?', senderId: alice.id },
    { content: 'Hi Alice! I am great, thanks!', senderId: bob.id },
    { content: 'Are you working on the chat app?', senderId: alice.id },
    { content: 'Yes! It is going to be awesome.', senderId: bob.id },
  ];

  for (const msg of messages) {
    await prisma.message.create({
      data: {
        conversationId: dmId,
        senderId: msg.senderId,
        content: msg.content,
        type: 'TEXT',
      },
    });
  }

  console.log('Seed completed successfully');
  console.log(`Users: alice / password123, bob / password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
