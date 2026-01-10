const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const dbPath = path.resolve(__dirname, '../../prisma-test/test.db');
  const cleanupFiles = [
    dbPath,
    `${dbPath}-journal`,
    `${dbPath}-shm`,
    `${dbPath}-wal`,
    path.resolve(__dirname, '../../prisma-test/test-shadow.db'),
  ];

  cleanupFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
};
