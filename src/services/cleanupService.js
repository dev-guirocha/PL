const fs = require('fs');
const os = require('os');
const path = require('path');
const prisma = require('../utils/prismaClient');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_BOOT_GUARD_MS = 15 * 60 * 1000;
let cleanupStarted = false;

const resolveNumber = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getCleanupStatePath = (options = {}) =>
  options.statePath ||
  process.env.CLEANUP_STATE_PATH ||
  path.join(os.tmpdir(), 'pl-cleanup-state.json');

const readCleanupState = (statePath) => {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const data = JSON.parse(raw);
    return Number.isFinite(data?.lastCleanupAt) ? data.lastCleanupAt : null;
  } catch {
    return null;
  }
};

const writeCleanupState = (statePath, timestamp) => {
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ lastCleanupAt: timestamp }));
  } catch {
    // best-effort: state file is optional
  }
};

const deleteInBatches = async (model, cutoff, batchSize) => {
  let total = 0;
  while (true) {
    const batch = await model.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    if (!batch.length) break;

    const ids = batch.map((row) => row.id);
    await model.deleteMany({ where: { id: { in: ids } } });
    total += ids.length;

    if (batch.length < batchSize) break;
  }

  return total;
};

const cleanupOldRecords = async (ttlDays, options = {}) => {
  const cutoff = new Date(Date.now() - ttlDays * DAY_MS);
  const batchSize = Math.max(1, resolveNumber(options.batchSize || process.env.CLEANUP_BATCH_SIZE, DEFAULT_BATCH_SIZE));

  try {
    await deleteInBatches(prisma.idempotencyKey, cutoff, batchSize);
  } catch (err) {
    console.warn('[CLEANUP] Falha ao remover IdempotencyKey:', err?.message || err);
  }

  try {
    await deleteInBatches(prisma.webhookEvent, cutoff, batchSize);
  } catch (err) {
    console.warn('[CLEANUP] Falha ao remover WebhookEvent:', err?.message || err);
  }
};

const startCleanupJobs = (options = {}) => {
  if (cleanupStarted) return;
  cleanupStarted = true;

  const ttlDays = Number(options.ttlDays || process.env.CLEANUP_TTL_DAYS || 7);
  const intervalMs = Number(options.intervalMs || process.env.CLEANUP_INTERVAL_MS || 6 * 60 * 60 * 1000);
  const batchSize = resolveNumber(options.batchSize || process.env.CLEANUP_BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const guardMs = resolveNumber(options.bootGuardMs || process.env.CLEANUP_BOOT_GUARD_MS, intervalMs || DEFAULT_BOOT_GUARD_MS);
  const statePath = getCleanupStatePath(options);

  if (!Number.isFinite(ttlDays) || ttlDays <= 0) return;

  const runCleanup = (reason) => {
    const now = Date.now();
    writeCleanupState(statePath, now);
    cleanupOldRecords(ttlDays, { batchSize }).catch((err) => {
      console.warn(`[CLEANUP] Falha ao remover registros antigos (${reason}):`, err?.message || err);
    });
  };

  const lastCleanupAt = readCleanupState(statePath);
  const now = Date.now();
  const shouldRunBoot = !Number.isFinite(lastCleanupAt) || now - lastCleanupAt >= guardMs;
  if (shouldRunBoot) {
    runCleanup('boot');
  }

  if (Number.isFinite(intervalMs) && intervalMs > 0) {
    const timer = setInterval(() => {
      runCleanup('interval');
    }, intervalMs);
    timer.unref?.();
  }
};

module.exports = { startCleanupJobs, cleanupOldRecords };
