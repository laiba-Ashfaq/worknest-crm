import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Clean disconnection on process exit
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
