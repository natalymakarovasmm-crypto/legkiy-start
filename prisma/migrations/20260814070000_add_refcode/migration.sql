-- Добавляем личный реферальный код ученику (может быть пустым)
ALTER TABLE "User" ADD COLUMN "refCode" TEXT;

-- Код должен быть уникальным (два ученика не могут иметь один код)
CREATE UNIQUE INDEX "User_refCode_key" ON "User"("refCode");
