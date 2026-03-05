#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config();

const prisma = require('../src/utils/prismaClient');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 5000;
const DEFAULT_PREVIEW = 20;
const DEFAULT_MAX_APPLY = 500;
const CHUNK_SIZE = 500;

const parseArgs = (argv) => {
  const flags = new Set();
  const values = {};

  argv.forEach((arg) => {
    if (!arg.startsWith('--')) return;
    const clean = arg.slice(2);
    const eq = clean.indexOf('=');
    if (eq === -1) {
      flags.add(clean);
      return;
    }
    const key = clean.slice(0, eq);
    const value = clean.slice(eq + 1);
    values[key] = value;
  });

  return { flags, values };
};

const toInt = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.floor(num);
};

const parseIds = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => Number(String(item).trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
};

const parseDateLoose = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]) - 1;
    const year = Number(br[3]);
    const dt = new Date(year, month, day, 0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]) - 1;
    const day = Number(iso[3]);
    const dt = new Date(year, month, day, 0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

const classify = (bet, { cutoffDate, today, forceIdsMode }) => {
  if (forceIdsMode) return ['targeted_id'];

  const reasons = [];
  if (bet.settledAt) reasons.push('open_with_settledAt');
  if (bet.recheckedAt) reasons.push('open_with_recheckedAt');
  if (bet.createdAt && bet.createdAt < cutoffDate) reasons.push('created_before_cutoff');

  const gameDate = parseDateLoose(bet.dataJogo);
  if (gameDate && gameDate < today) reasons.push('game_date_in_past');

  return reasons;
};

const run = async () => {
  const { flags, values } = parseArgs(process.argv.slice(2));

  const apply = flags.has('apply');
  const days = toInt(values.days, DEFAULT_DAYS);
  const limit = toInt(values.limit, DEFAULT_LIMIT);
  const preview = toInt(values.preview, DEFAULT_PREVIEW);
  const maxApply = toInt(values['max-apply'], DEFAULT_MAX_APPLY);
  const targetIds = parseIds(values.ids);
  const userId = values.userId ? Number(values.userId) : null;

  const cutoffDate = new Date(Date.now() - days * MS_PER_DAY);
  const today = startOfToday();

  const where = {
    status: 'open',
    resultId: null,
  };
  if (targetIds.length) where.id = { in: targetIds };
  if (Number.isInteger(userId) && userId > 0) where.userId = userId;

  const openBets = await prisma.bet.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      userId: true,
      loteria: true,
      codigoHorario: true,
      dataJogo: true,
      total: true,
      status: true,
      resultId: true,
      createdAt: true,
      settledAt: true,
      recheckedAt: true,
    },
  });

  const stale = openBets
    .map((bet) => {
      const reasons = classify(bet, { cutoffDate, today, forceIdsMode: targetIds.length > 0 });
      return { ...bet, reasons };
    })
    .filter((bet) => bet.reasons.length > 0);

  const reasonCount = stale.reduce((acc, bet) => {
    bet.reasons.forEach((reason) => {
      acc[reason] = (acc[reason] || 0) + 1;
    });
    return acc;
  }, {});

  const totalValue = stale.reduce((acc, bet) => acc + Number(bet.total || 0), 0);

  console.log('--- Cleanup stale open bets ---');
  console.log(`Dry-run: ${apply ? 'no' : 'yes'}`);
  console.log(`Rules: days=${days}, limit=${limit}, userId=${userId || 'all'}, ids=${targetIds.length ? targetIds.join(',') : 'none'}`);
  console.log(`Open fetched: ${openBets.length}`);
  console.log(`Candidates: ${stale.length}`);
  console.log(`Candidate total value: ${totalValue.toFixed(2)}`);
  console.log('Reason count:', reasonCount);

  if (stale.length) {
    const rows = stale.slice(0, preview).map((bet) => ({
      id: bet.id,
      userId: bet.userId,
      loteria: bet.loteria,
      codigoHorario: bet.codigoHorario,
      dataJogo: bet.dataJogo,
      createdAt: bet.createdAt,
      total: Number(bet.total || 0),
      reasons: bet.reasons.join(','),
    }));
    console.table(rows);
  }

  if (!apply) {
    console.log('No changes applied. Use --apply --confirm=YES to archive candidates as lost.');
    return;
  }

  if (values.confirm !== 'YES') {
    throw new Error('Missing --confirm=YES');
  }

  if (stale.length === 0) {
    console.log('No candidates to archive.');
    return;
  }

  if (stale.length > maxApply && !flags.has('force')) {
    throw new Error(`Refusing to update ${stale.length} bets (max-apply=${maxApply}). Use --force or increase --max-apply.`);
  }

  const ids = stale.map((bet) => bet.id);
  const now = new Date();
  let updated = 0;

  for (const part of chunk(ids, CHUNK_SIZE)) {
    const result = await prisma.bet.updateMany({
      where: {
        id: { in: part },
        status: 'open',
        resultId: null,
      },
      data: {
        status: 'lost',
        prize: 0,
        settledAt: now,
      },
    });
    updated += result.count;
  }

  console.log(`Archived as lost: ${updated}`);
};

run()
  .catch((err) => {
    console.error('[cleanup-stale-open-bets] failed:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // noop
    }
  });
