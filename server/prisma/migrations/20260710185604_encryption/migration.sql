-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "iv" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "public_key" TEXT;

-- CreateTable
CREATE TABLE "conversation_keys" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "wrapped_key" TEXT NOT NULL,

    CONSTRAINT "conversation_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_keys_conversation_id_user_id_key" ON "conversation_keys"("conversation_id", "user_id");

-- AddForeignKey
ALTER TABLE "conversation_keys" ADD CONSTRAINT "conversation_keys_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_keys" ADD CONSTRAINT "conversation_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

