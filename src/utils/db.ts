import initSqlJs, { type Database } from 'sql.js';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;
const DB_NAME = 'studyhub-db';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('data');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIDB(): Promise<Uint8Array | null> {
  try {
    const idb = await openIDB();
    return new Promise((resolve) => {
      const tx = idb.transaction('data', 'readonly');
      const store = tx.objectStore('data');
      const req = store.get('sqlite');
      req.onsuccess = () => {
        try {
          resolve(req.result ? new Uint8Array(req.result) : null);
        } catch {
          console.warn('Failed to convert IndexedDB value, starting fresh');
          resolve(null);
        }
      };
      req.onerror = () => {
        console.warn('IndexedDB read error, starting fresh:', req.error);
        resolve(null);
      };
    });
  } catch (e) {
    console.warn('Failed to open IndexedDB, starting fresh:', e);
    return null;
  }
}

async function saveToIDB(data: Uint8Array): Promise<void> {
  try {
    const idb = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction('data', 'readwrite');
      const store = tx.objectStore('data');
      const req = store.put(data.buffer, 'sqlite');
      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.warn('IndexedDB write error:', req.error);
        // If save fails (e.g. value too large), try to clear and retry with fresh DB
        try {
          store.clear();
        } catch { /* ignore */ }
        reject(req.error);
      };
    });
  } catch (e) {
    console.warn('Failed to save to IndexedDB:', e);
  }
}

async function saveDB(): Promise<void> {
  if (!db) return;
  try {
    const data = db.export();
    await saveToIDB(data);
  } catch (e) {
    console.warn('Failed to persist DB to IndexedDB:', e);
  }
}

function createSchema(database: Database): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS question_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at TEXT NOT NULL,
      exam_time_limit INTEGER DEFAULT 30,
      shuffle_answers INTEGER DEFAULT 0
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL DEFAULT 'A',
      explanation TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (set_id) REFERENCES question_sets(id) ON DELETE CASCADE
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS vocab_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at TEXT NOT NULL
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS vocab_items (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      word TEXT NOT NULL,
      meaning TEXT NOT NULL,
      word_type TEXT,
      example TEXT,
      phonetic TEXT,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (set_id) REFERENCES vocab_sets(id) ON DELETE CASCADE
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS quiz_results (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      set_name TEXT NOT NULL,
      date TEXT NOT NULL,
      score_correct INTEGER NOT NULL,
      score_total INTEGER NOT NULL,
      mode TEXT NOT NULL,
      time_spent INTEGER
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS quiz_result_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      result_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      selected_answer TEXT,
      correct_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      FOREIGN KEY (result_id) REFERENCES quiz_results(id) ON DELETE CASCADE
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS srs_data (
      item_id TEXT PRIMARY KEY,
      interval_days REAL NOT NULL DEFAULT 0,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      repetitions INTEGER NOT NULL DEFAULT 0,
      next_review TEXT NOT NULL,
      last_review TEXT
    );
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add category column to existing tables if missing
  try {
    const cols = database.exec("PRAGMA table_info(question_sets)");
    const colNames = cols.length ? cols[0].values.map((r: unknown[]) => r[1] as string) : [];
    if (!colNames.includes('category')) {
      database.run("ALTER TABLE question_sets ADD COLUMN category TEXT DEFAULT 'general'");
    }
  } catch { /* table may not exist yet on first run */ }

  try {
    const cols = database.exec("PRAGMA table_info(vocab_sets)");
    const colNames = cols.length ? cols[0].values.map((r: unknown[]) => r[1] as string) : [];
    if (!colNames.includes('category')) {
      database.run("ALTER TABLE vocab_sets ADD COLUMN category TEXT DEFAULT 'general'");
    }
  } catch { /* */ }

  try {
    const cols = database.exec("PRAGMA table_info(vocab_items)");
    const colNames = cols.length ? cols[0].values.map((r: unknown[]) => r[1] as string) : [];
    if (!colNames.includes('word_type')) {
      database.run("ALTER TABLE vocab_items ADD COLUMN word_type TEXT");
    }
  } catch { /* */ }
}

export async function getDB(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });

    let savedData: Uint8Array | null = null;
    try {
      savedData = await loadFromIDB();
    } catch (e) {
      console.warn('Failed to load from IndexedDB, starting fresh:', e);
      // Clear corrupted data
      try {
        const idb = await openIDB();
        const tx = idb.transaction('data', 'readwrite');
        tx.objectStore('data').clear();
      } catch { /* ignore */ }
    }

    const database = savedData ? new SQL.Database(savedData) : new SQL.Database();

    createSchema(database);

    // Run migration from localStorage
    await migrateFromLocalStorage(database);

    db = database;
    await saveDB();
    return database;
  })();

  return initPromise;
}

async function migrateFromLocalStorage(database: Database): Promise<void> {
  const MIGRATION_KEY = 'studyhub-migrated-to-sqlite';
  if (localStorage.getItem(MIGRATION_KEY)) return;

  try {
    // Migrate question sets
    const setsRaw = localStorage.getItem('studyhub-quiz-sets');
    if (setsRaw) {
      const sets = JSON.parse(setsRaw);
      for (const qs of sets) {
        database.run(
          'INSERT OR IGNORE INTO question_sets (id, name, created_at, exam_time_limit, shuffle_answers) VALUES (?, ?, ?, ?, ?)',
          [qs.id, qs.name, qs.createdAt, qs.examTimeLimit ?? 30, qs.shuffleAnswers ? 1 : 0]
        );
        for (let i = 0; i < qs.questions.length; i++) {
          const q = qs.questions[i];
          database.run(
            'INSERT OR IGNORE INTO questions (id, set_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [q.id, qs.id, q.questionText, q.options.A, q.options.B, q.options.C, q.options.D, q.correctAnswer, q.explanation || '', i]
          );
        }
      }
    }

    // Migrate vocab sets
    const vocabRaw = localStorage.getItem('studyhub-vocab-sets');
    if (vocabRaw) {
      const sets = JSON.parse(vocabRaw);
      for (const vs of sets) {
        database.run(
          'INSERT OR IGNORE INTO vocab_sets (id, name, created_at) VALUES (?, ?, ?)',
          [vs.id, vs.name, vs.createdAt]
        );
        for (let i = 0; i < vs.items.length; i++) {
          const v = vs.items[i];
          database.run(
            'INSERT OR IGNORE INTO vocab_items (id, set_id, word, meaning, example, phonetic, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [v.id, vs.id, v.word, v.meaning, v.example || null, v.phonetic || null, i]
          );
        }
      }
    }

    // Migrate quiz history
    const historyRaw = localStorage.getItem('studyhub-quiz-history');
    if (historyRaw) {
      const results = JSON.parse(historyRaw);
      for (const r of results) {
        database.run(
          'INSERT OR IGNORE INTO quiz_results (id, set_id, set_name, date, score_correct, score_total, mode, time_spent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [r.id, r.setId, r.setName, r.date, r.score.correct, r.score.total, r.mode, r.timeSpent || null]
        );
        for (const qr of r.questionResults) {
          database.run(
            'INSERT INTO quiz_result_questions (result_id, question_id, question_text, selected_answer, correct_answer, is_correct) VALUES (?, ?, ?, ?, ?, ?)',
            [r.id, qr.questionId, qr.questionText, qr.selectedAnswer, qr.correctAnswer, qr.isCorrect ? 1 : 0]
          );
        }
      }
    }

    // Migrate SRS data
    const srsRaw = localStorage.getItem('studyhub-srs-data');
    if (srsRaw) {
      const srsData = JSON.parse(srsRaw);
      for (const [itemId, srs] of Object.entries(srsData)) {
        const s = srs as { interval: number; easeFactor: number; repetitions: number; nextReview: string; lastReview?: string };
        database.run(
          'INSERT OR REPLACE INTO srs_data (item_id, interval_days, ease_factor, repetitions, next_review, last_review) VALUES (?, ?, ?, ?, ?, ?)',
          [itemId, s.interval, s.easeFactor, s.repetitions, s.nextReview, s.lastReview || null]
        );
      }
    }

    // Migrate settings
    const settingsRaw = localStorage.getItem('studyhub-settings');
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      for (const [key, value] of Object.entries(settings)) {
        database.run(
          'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
          [key, JSON.stringify(value)]
        );
      }
    }

    // Mark migration complete
    localStorage.setItem(MIGRATION_KEY, 'true');
  } catch (e) {
    console.error('Migration from localStorage failed:', e);
  }
}

// --- Question Sets ---

export async function dbLoadSets(): Promise<Array<{
  id: string; name: string; category: string; createdAt: string;
  examTimeLimit: number; shuffleAnswers: boolean;
  questions: Array<{
    id: string; questionText: string;
    options: { A: string; B: string; C: string; D: string };
    correctAnswer: 'A' | 'B' | 'C' | 'D'; explanation: string;
  }>;
}>> {
  const database = await getDB();
  const setsResult = database.exec('SELECT id, name, category, created_at, exam_time_limit, shuffle_answers FROM question_sets ORDER BY rowid DESC');
  if (!setsResult.length) return [];

  return setsResult[0].values.map((row: unknown[]) => {
    const setId = row[0] as string;
    const qResult = database.exec(
      'SELECT id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation FROM questions WHERE set_id = ? ORDER BY sort_order',
      [setId]
    );
    const questions = qResult.length ? qResult[0].values.map((q: unknown[]) => ({
      id: q[0] as string,
      questionText: q[1] as string,
      options: { A: q[2] as string, B: q[3] as string, C: q[4] as string, D: q[5] as string },
      correctAnswer: (q[6] as string) as 'A' | 'B' | 'C' | 'D',
      explanation: (q[7] as string) || '',
    })) : [];

    return {
      id: setId,
      name: row[1] as string,
      category: (row[2] as string) || 'general',
      createdAt: row[3] as string,
      examTimeLimit: row[4] as number,
      shuffleAnswers: (row[5] as number) === 1,
      questions,
    };
  });
}

export async function dbAddSet(qs: {
  id: string; name: string; category?: string; createdAt: string;
  examTimeLimit: number; shuffleAnswers: boolean;
  questions: Array<{
    id: string; questionText: string;
    options: { A: string; B: string; C: string; D: string };
    correctAnswer: string; explanation: string;
  }>;
}): Promise<void> {
  const database = await getDB();
  database.run(
    'INSERT OR REPLACE INTO question_sets (id, name, category, created_at, exam_time_limit, shuffle_answers) VALUES (?, ?, ?, ?, ?, ?)',
    [qs.id, qs.name, qs.category || 'general', qs.createdAt, qs.examTimeLimit, qs.shuffleAnswers ? 1 : 0]
  );
  // Delete old questions and re-insert
  database.run('DELETE FROM questions WHERE set_id = ?', [qs.id]);
  for (let i = 0; i < qs.questions.length; i++) {
    const q = qs.questions[i];
    database.run(
      'INSERT INTO questions (id, set_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [q.id, qs.id, q.questionText, q.options.A, q.options.B, q.options.C, q.options.D, q.correctAnswer, q.explanation || '', i]
    );
  }
  await saveDB();
}

export async function dbDeleteSet(id: string): Promise<void> {
  const database = await getDB();
  database.run('DELETE FROM question_sets WHERE id = ?', [id]);
  await saveDB();
}

// --- Vocab Sets ---

export async function dbLoadVocabSets(): Promise<Array<{
  id: string; name: string; category: string; createdAt: string;
  items: Array<{
    id: string; word: string; meaning: string;
    wordType?: string; example?: string; phonetic?: string;
  }>;
}>> {
  const database = await getDB();
  const setsResult = database.exec('SELECT id, name, category, created_at FROM vocab_sets ORDER BY rowid DESC');
  if (!setsResult.length) return [];

  return setsResult[0].values.map((row: unknown[]) => {
    const setId = row[0] as string;
    const itemsResult = database.exec(
      'SELECT id, word, meaning, word_type, example, phonetic FROM vocab_items WHERE set_id = ? ORDER BY sort_order',
      [setId]
    );
    const items = itemsResult.length ? itemsResult[0].values.map((v: unknown[]) => ({
      id: v[0] as string,
      word: v[1] as string,
      meaning: v[2] as string,
      wordType: (v[3] as string) || undefined,
      example: (v[4] as string) || undefined,
      phonetic: (v[5] as string) || undefined,
    })) : [];

    return {
      id: setId,
      name: row[1] as string,
      category: (row[2] as string) || 'general',
      createdAt: row[3] as string,
      items,
    };
  });
}

export async function dbAddVocabSet(vs: {
  id: string; name: string; category?: string; createdAt: string;
  items: Array<{
    id: string; word: string; meaning: string;
    wordType?: string; example?: string; phonetic?: string;
  }>;
}): Promise<void> {
  const database = await getDB();
  database.run(
    'INSERT OR REPLACE INTO vocab_sets (id, name, category, created_at) VALUES (?, ?, ?, ?)',
    [vs.id, vs.name, vs.category || 'general', vs.createdAt]
  );
  database.run('DELETE FROM vocab_items WHERE set_id = ?', [vs.id]);
  for (let i = 0; i < vs.items.length; i++) {
    const v = vs.items[i];
    database.run(
      'INSERT INTO vocab_items (id, set_id, word, meaning, word_type, example, phonetic, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [v.id, vs.id, v.word, v.meaning, v.wordType || null, v.example || null, v.phonetic || null, i]
    );
  }
  await saveDB();
}

export async function dbDeleteVocabSet(id: string): Promise<void> {
  const database = await getDB();
  database.run('DELETE FROM vocab_sets WHERE id = ?', [id]);
  await saveDB();
}

// --- Quiz Results ---

export async function dbLoadHistory(): Promise<Array<{
  id: string; setId: string; setName: string; date: string;
  score: { correct: number; total: number };
  questionResults: Array<{
    questionId: string; questionText: string;
    selectedAnswer: string | null; correctAnswer: string; isCorrect: boolean;
  }>;
  mode: 'exam' | 'study'; timeSpent?: number;
}>> {
  const database = await getDB();
  const result = database.exec('SELECT id, set_id, set_name, date, score_correct, score_total, mode, time_spent FROM quiz_results ORDER BY rowid DESC LIMIT 50');
  if (!result.length) return [];

  return result[0].values.map((row: unknown[]) => {
    const resultId = row[0] as string;
    const qrResult = database.exec(
      'SELECT question_id, question_text, selected_answer, correct_answer, is_correct FROM quiz_result_questions WHERE result_id = ?',
      [resultId]
    );
    const questionResults = qrResult.length ? qrResult[0].values.map((qr: unknown[]) => ({
      questionId: qr[0] as string,
      questionText: qr[1] as string,
      selectedAnswer: (qr[2] as string) || null,
      correctAnswer: qr[3] as string,
      isCorrect: (qr[4] as number) === 1,
    })) : [];

    return {
      id: resultId,
      setId: row[1] as string,
      setName: row[2] as string,
      date: row[3] as string,
      score: { correct: row[4] as number, total: row[5] as number },
      questionResults,
      mode: (row[6] as string) as 'exam' | 'study',
      timeSpent: (row[7] as number) || undefined,
    };
  });
}

export async function dbAddResult(result: {
  id: string; setId: string; setName: string; date: string;
  score: { correct: number; total: number };
  questionResults: Array<{
    questionId: string; questionText: string;
    selectedAnswer: string | null; correctAnswer: string; isCorrect: boolean;
  }>;
  mode: string; timeSpent?: number;
}): Promise<void> {
  const database = await getDB();
  database.run(
    'INSERT INTO quiz_results (id, set_id, set_name, date, score_correct, score_total, mode, time_spent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [result.id, result.setId, result.setName, result.date, result.score.correct, result.score.total, result.mode, result.timeSpent || null]
  );
  for (const qr of result.questionResults) {
    database.run(
      'INSERT INTO quiz_result_questions (result_id, question_id, question_text, selected_answer, correct_answer, is_correct) VALUES (?, ?, ?, ?, ?, ?)',
      [result.id, qr.questionId, qr.questionText, qr.selectedAnswer, qr.correctAnswer, qr.isCorrect ? 1 : 0]
    );
  }
  await saveDB();
}

// --- SRS Data ---

export async function dbLoadSRSData(): Promise<Record<string, {
  interval: number; easeFactor: number; repetitions: number;
  nextReview: string; lastReview?: string;
}>> {
  const database = await getDB();
  const result = database.exec('SELECT item_id, interval_days, ease_factor, repetitions, next_review, last_review FROM srs_data');
  if (!result.length) return {};

  const data: Record<string, { interval: number; easeFactor: number; repetitions: number; nextReview: string; lastReview?: string }> = {};
  for (const row of result[0].values as unknown[][]) {
    data[row[0] as string] = {
      interval: row[1] as number,
      easeFactor: row[2] as number,
      repetitions: row[3] as number,
      nextReview: row[4] as string,
      lastReview: (row[5] as string) || undefined,
    };
  }
  return data;
}

export async function dbSaveSRSData(itemId: string, srs: {
  interval: number; easeFactor: number; repetitions: number;
  nextReview: string; lastReview?: string;
}): Promise<void> {
  const database = await getDB();
  database.run(
    'INSERT OR REPLACE INTO srs_data (item_id, interval_days, ease_factor, repetitions, next_review, last_review) VALUES (?, ?, ?, ?, ?, ?)',
    [itemId, srs.interval, srs.easeFactor, srs.repetitions, srs.nextReview, srs.lastReview || null]
  );
  await saveDB();
}

// --- Settings ---

export async function dbLoadSettings(): Promise<Record<string, unknown>> {
  const database = await getDB();
  const result = database.exec('SELECT key, value FROM app_settings');
  if (!result.length) return {};

  const settings: Record<string, unknown> = {};
  for (const row of result[0].values as unknown[][]) {
    try {
      settings[row[0] as string] = JSON.parse(row[1] as string);
    } catch {
      settings[row[0] as string] = row[1];
    }
  }
  return settings;
}

export async function dbSaveSetting(key: string, value: unknown): Promise<void> {
  const database = await getDB();
  database.run(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    [key, JSON.stringify(value)]
  );
  await saveDB();
}

// --- Active set (in-memory for now, could be a setting) ---

let activeSet: unknown = null;

export function getActiveSet() {
  return activeSet;
}

export function setActiveSet(set: unknown) {
  activeSet = set;
}

export function clearActiveSet() {
  activeSet = null;
}
