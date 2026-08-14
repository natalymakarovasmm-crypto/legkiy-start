-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "telegramId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'NEWBIE',
    "referrerId" TEXT,
    "dragons" INTEGER NOT NULL DEFAULT 0,
    "programStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "programStartDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DragonTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DragonTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgramDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programDayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dragonReward" INTEGER NOT NULL DEFAULT 10,
    CONSTRAINT "Mission_programDayId_fkey" FOREIGN KEY ("programDayId") REFERENCES "ProgramDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissionCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionCompletion_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramDay_dayNumber_key" ON "ProgramDay"("dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MissionCompletion_userId_missionId_key" ON "MissionCompletion"("userId", "missionId");
