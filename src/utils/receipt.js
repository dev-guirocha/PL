const DRAFT_KEY = 'receiptDraft';
const HISTORY_KEY = 'receiptHistory';

const safeParse = (str, fallback) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

export const getDraft = () => {
  if (typeof window === 'undefined') return {};
  const raw = localStorage.getItem(DRAFT_KEY);
  return safeParse(raw, {}) || {};
};

export const updateDraft = (partial) => {
  if (typeof window === 'undefined') return;
  const current = getDraft();
  const updated = { ...current, ...partial };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
  return updated;
};

export const clearDraft = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_KEY);
};

export const appendToHistory = (entry) => {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(HISTORY_KEY);
  const arr = safeParse(raw, []) || [];
  arr.push(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
};

export const getHistory = () => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  return safeParse(raw, []) || [];
};
