-- CreateTable
CREATE TABLE "SupervisorCommission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "supervisorId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "betId" INTEGER,
    "amount" REAL NOT NULL,
    "basis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupervisorCommission_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupervisorCommission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupervisorCommission_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
