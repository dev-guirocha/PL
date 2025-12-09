-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "loteria" TEXT,
    "codigoHorario" TEXT,
    "total" REAL NOT NULL,
    "dataJogo" TEXT,
    "modalidade" TEXT,
    "colocacao" TEXT,
    "palpites" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "prize" REAL NOT NULL DEFAULT 0,
    "settledAt" DATETIME,
    "resultId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bet_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bet" ("codigoHorario", "colocacao", "createdAt", "dataJogo", "id", "loteria", "modalidade", "palpites", "resultId", "total", "userId") SELECT "codigoHorario", "colocacao", "createdAt", "dataJogo", "id", "loteria", "modalidade", "palpites", "resultId", "total", "userId" FROM "Bet";
DROP TABLE "Bet";
ALTER TABLE "new_Bet" RENAME TO "Bet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
