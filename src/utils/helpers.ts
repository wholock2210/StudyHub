import type { QuestionSet, QuizResult, VocabSet, VocabItem, SRSData, SRSRating } from '../types';
import {
  getDB, dbLoadSets, dbAddSet, dbDeleteSet,
  dbLoadVocabSets, dbAddVocabSet, dbDeleteVocabSet,
  dbLoadHistory, dbAddResult,
  dbLoadSRSData, dbSaveSRSData,
  dbLoadSettings, dbSaveSetting,
} from './db';

export function generateId(): string {
  return crypto.randomUUID();
}

export function downloadJson(data: object, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  // Try blob URL first (works on desktop browsers)
  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    return;
  } catch { /* blob failed, try data URL */ }

  // Fallback: data URL (works on mobile WebViews)
  const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
  window.open(dataUrl, '_blank');
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function cleanQuestionText(text: string): string {
  return text.replace(/^(?:C[aàảãáạăắằẳẵặâấầẩẫậA]u?\s*\d+\s*[.:)\]]\s*|Question\s*\d+\s*[.:)\]]\s*|\d+\s*[.:)\]]\s*)/i, '').trim();
}

export function cleanOptionText(text: string): string {
  return text.replace(/^[A-D]\s*[.:)\]]\s*/, '').trim();
}

// --- In-memory cache ---

let setsCache: QuestionSet[] | null = null;
let vocabCache: VocabSet[] | null = null;
let historyCache: QuizResult[] | null = null;
let srsCache: Record<string, SRSData> | null = null;
let settingsCache: Record<string, unknown> | null = null;

// --- Initialization ---

export async function initDB(): Promise<void> {
  await getDB(); // ensures DB is initialized and migration runs
  // Pre-load caches
  setsCache = await dbLoadSets() as QuestionSet[];
  vocabCache = await dbLoadVocabSets() as VocabSet[];
  historyCache = await dbLoadHistory() as QuizResult[];
  srsCache = await dbLoadSRSData() as Record<string, SRSData>;
  settingsCache = await dbLoadSettings();
}

// --- Question Sets ---

function ensureSetDefaults(qs: QuestionSet): QuestionSet {
  return {
    ...qs,
    category: qs.category || 'general',
    examTimeLimit: qs.examTimeLimit ?? 30,
    shuffleAnswers: qs.shuffleAnswers ?? false,
  };
}

export function loadSets(): QuestionSet[] {
  return (setsCache || []).map(ensureSetDefaults);
}

export async function saveSets(sets: QuestionSet[]): Promise<void> {
  setsCache = sets;
}

export function addSet(qs: QuestionSet): void {
  const sets = loadSets();
  const idx = sets.findIndex(s => s.id === qs.id);
  if (idx >= 0) sets[idx] = ensureSetDefaults(qs);
  else sets.unshift(ensureSetDefaults(qs));
  setsCache = sets;
  dbAddSet(ensureSetDefaults(qs)); // fire-and-forget
}

export function deleteSet(id: string): void {
  setsCache = loadSets().filter(s => s.id !== id);
  dbDeleteSet(id); // fire-and-forget
}

// --- Quiz History ---

export function loadHistory(): QuizResult[] {
  return historyCache || [];
}

export async function saveHistory(results: QuizResult[]): Promise<void> {
  historyCache = results;
}

export function addResult(result: QuizResult): void {
  const history = loadHistory();
  history.unshift(result);
  if (history.length > 50) history.length = 50;
  historyCache = history;
  dbAddResult(result); // fire-and-forget
}

// --- Active set (session only, not persisted) ---

let activeSetCache: QuestionSet | null = null;

export function saveActiveSet(qs: QuestionSet): void {
  activeSetCache = qs;
}

export function loadActiveSet(): QuestionSet | null {
  return activeSetCache ? ensureSetDefaults(activeSetCache) : null;
}

export function clearActiveSet(): void {
  activeSetCache = null;
}

export function migrateOldStorage(): void {
  // Migration is now handled by db.ts during init
}

// --- Vocab Sets ---

function ensureVocabSetDefaults(vs: VocabSet): VocabSet {
  return {
    ...vs,
    category: vs.category || 'general',
    items: vs.items.map(item => ({
      ...item,
      wordType: item.wordType || undefined,
    })),
  };
}

export function loadVocabSets(): VocabSet[] {
  return (vocabCache || []).map(ensureVocabSetDefaults);
}

export async function saveVocabSets(sets: VocabSet[]): Promise<void> {
  vocabCache = sets;
}

export function addVocabSet(vs: VocabSet): void {
  const sets = loadVocabSets();
  const defaulted = ensureVocabSetDefaults(vs);
  const idx = sets.findIndex(s => s.id === defaulted.id);
  if (idx >= 0) sets[idx] = defaulted;
  else sets.unshift(defaulted);
  vocabCache = sets;
  dbAddVocabSet(defaulted); // fire-and-forget
}

export function deleteVocabSet(id: string): void {
  vocabCache = loadVocabSets().filter(s => s.id !== id);
  dbDeleteVocabSet(id); // fire-and-forget
}

// --- SRS (Spaced Repetition System) ---

export function loadSRSData(): Record<string, SRSData> {
  return srsCache || {};
}

export async function saveSRSData(data: Record<string, SRSData>): Promise<void> {
  srsCache = data;
}

export function updateSRSCard(itemId: string, rating: SRSRating): SRSData {
  const allSrs = loadSRSData();
  const current = allSrs[itemId] || {
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    nextReview: new Date().toISOString(),
  };

  const now = new Date();
  const updated = sm2(current, rating);
  updated.lastReview = now.toISOString();
  updated.nextReview = new Date(now.getTime() + updated.interval * 86400000).toISOString();

  allSrs[itemId] = updated;
  srsCache = allSrs;
  dbSaveSRSData(itemId, updated); // fire-and-forget
  return updated;
}

function sm2(data: SRSData, rating: SRSRating): SRSData {
  const quality = { again: 0, hard: 2, good: 4, easy: 5 }[rating];
  let { interval, easeFactor, repetitions } = { ...data };

  if (quality < 3) {
    repetitions = 0;
    interval = 0;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 3;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  return { interval, easeFactor, repetitions, nextReview: '', lastReview: '' };
}

export function getDueCards(items: VocabItem[]): VocabItem[] {
  const srsData = loadSRSData();
  const now = new Date();
  return items.filter(item => {
    const srs = srsData[item.id];
    if (!srs) return true; // new cards are always due
    return new Date(srs.nextReview) <= now;
  });
}

export function getSRSStats(items: VocabItem[]): { newCount: number; learningCount: number; reviewCount: number; masteredCount: number } {
  const srsData = loadSRSData();
  let newCount = 0, learningCount = 0, reviewCount = 0, masteredCount = 0;
  for (const item of items) {
    const srs = srsData[item.id];
    if (!srs) { newCount++; continue; }
    if (srs.interval === 0) { learningCount++; continue; }
    if (srs.interval >= 21) { masteredCount++; continue; }
    reviewCount++;
  }
  return { newCount, learningCount, reviewCount, masteredCount };
}

// --- App Settings ---

export function loadAppSettings(): Record<string, unknown> {
  return settingsCache || {};
}

export function saveAppSetting(key: string, value: unknown): void {
  if (!settingsCache) settingsCache = {};
  settingsCache[key] = value;
  dbSaveSetting(key, value); // fire-and-forget
}

// --- AI Settings ---

export interface AISettings {
  provider: 'gemini' | 'claude' | 'openai';
  apiKey: string;
  enabled: boolean;
  openaiBaseUrl: string;
  openaiModel: string;
}

export function loadAISettings(): AISettings {
  const s = settingsCache || {};
  return {
    provider: (s['ai_provider'] as AISettings['provider']) || 'gemini',
    apiKey: (s['ai_api_key'] as string) || '',
    enabled: (s['ai_enabled'] as boolean) ?? false,
    openaiBaseUrl: (s['ai_openai_base_url'] as string) || 'https://api.openai.com/v1',
    openaiModel: (s['ai_openai_model'] as string) || 'gpt-4o-mini',
  };
}

export function saveAISettings(settings: AISettings): void {
  saveAppSetting('ai_provider', settings.provider);
  saveAppSetting('ai_api_key', settings.apiKey);
  saveAppSetting('ai_enabled', settings.enabled);
  saveAppSetting('ai_openai_base_url', settings.openaiBaseUrl);
  saveAppSetting('ai_openai_model', settings.openaiModel);
}
