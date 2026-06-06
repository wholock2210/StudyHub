import type { Question, VocabItem } from '../types';
import type { AISettings } from './helpers';
import { generateId } from './helpers';
import type { GenerateOptions } from './templateGenerator';

// --- Gemini ---

const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];

class APIError extends Error {
  status: number;
  isQuota: boolean;
  constructor(message: string, status: number, isQuota: boolean = false) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.isQuota = isQuota;
  }
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    const errText = await res.text();
    const isQuota = res.status === 429 || errText.includes('RESOURCE_EXHAUSTED') || errText.includes('quota');

    if (isQuota) {
      lastError = new APIError(`Gemini ${model}: hết quota free tier. Thử model khác...`, res.status, true);
      continue; // try next model
    }

    // Non-quota error (auth, etc.) — don't retry
    throw new APIError(`Gemini API error: ${res.status}`, res.status, false);
  }

  throw lastError || new APIError('Tất cả Gemini models đều hết quota', 429, true);
}

// --- Claude ---

async function callClaude(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-20250414',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// --- OpenAI / Compatible ---

async function callOpenAI(apiKey: string, baseUrl: string, model: string, prompt: string): Promise<string> {
  const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// --- Dispatch ---

async function callAI(settings: AISettings, prompt: string): Promise<string> {
  switch (settings.provider) {
    case 'gemini':
      return callGemini(settings.apiKey, prompt);
    case 'claude':
      return callClaude(settings.apiKey, prompt);
    case 'openai':
      return callOpenAI(settings.apiKey, settings.openaiBaseUrl, settings.openaiModel, prompt);
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}

// --- Test connection ---

export interface TestResult {
  ok: boolean;
  message?: string;
}

export async function testAIConnection(settings: AISettings): Promise<TestResult> {
  try {
    const result = await callAI(settings, 'Reply with only the word "OK".');
    return { ok: result.trim().toUpperCase().includes('OK') };
  } catch (err) {
    if (err instanceof APIError) {
      if (err.isQuota) {
        return { ok: false, message: 'Key hợp lệ nhưng hết quota. Thử lại sau hoặc dùng provider khác.' };
      }
      if (err.status === 401 || err.status === 403) {
        return { ok: false, message: 'API key không hợp lệ hoặc bị từ chối truy cập.' };
      }
      return { ok: false, message: err.message };
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return { ok: false, message: 'Không thể kết nối. Kiểm tra mạng hoặc Base URL.' };
    }
    return { ok: false, message: err instanceof Error ? err.message : 'Lỗi không xác định' };
  }
}

// --- Word Translation ---

export interface WordTranslation {
  word: string;
  meaning: string;
  vietnamese: string;
  wordType: string;
  example: string;
  phonetic: string;
}

export async function translateWordWithAI(word: string, settings: AISettings): Promise<WordTranslation | null> {
  const prompt = `Translate the English word "${word}" to Vietnamese. Return ONLY a JSON object (no markdown, no code blocks) with this exact format:
{
  "word": "${word}",
  "meaning": "English definition/explanation (in English)",
  "vietnamese": "Vietnamese translation of the word (nghĩa tiếng Việt)",
  "wordType": "noun/verb/adjective/adverb/preposition/conjunction/pronoun/phrase",
  "example": "An example sentence using this word",
  "phonetic": "IPA phonetic transcription"
}
If the word is not valid English, return null.`;

  try {
    const result = await callAI(settings, prompt);
    // Try to parse JSON from the response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.word || !parsed.meaning) return null;
    return {
      word: parsed.word,
      meaning: parsed.meaning,
      vietnamese: parsed.vietnamese || '',
      wordType: parsed.wordType || '',
      example: parsed.example || '',
      phonetic: parsed.phonetic || '',
    };
  } catch {
    return null;
  }
}

// --- Analyze description ---

export interface AnalysisOption {
  id: string;
  label: string;
  description: string;
}

export interface AnalysisResponse {
  question: string;
  type: 'single' | 'multi';
  done: boolean;
  options: AnalysisOption[];
}

export async function analyzeDescription(
  description: string,
  history: { question: string; selectedOption: string }[],
  customInput: string,
  settings: AISettings
): Promise<AnalysisResponse> {
  let context = `User's goal: "${description}"\n\n`;

  if (history.length > 0) {
    context += 'Previous selections:\n';
    for (const h of history) {
      context += `- ${h.question} → ${h.selectedOption}\n`;
    }
    context += '\n';
  }

  if (customInput) {
    context += `User's additional input: "${customInput}"\n\n`;
  }

  const prompt = `${context}You are helping a user customize test/exam/flashcard generation for ANY subject. Follow what the user wants — do NOT assume a specific subject.

Your job: ask the NEXT question to get MORE SPECIFIC details about what content to generate. Do NOT ask obvious questions or repeat what the user already told you.

Return ONLY a JSON object, no markdown:
{
  "question": "Next question in Vietnamese (short, direct)",
  "type": "single" or "multi",
  "done": false,
  "options": [{"id": "snake_case_id", "label": "Short Vietnamese label", "description": "Brief description"}]
}

STRICT RULES:
1. NEVER assume the subject — follow the user's description exactly (could be Math, History, Physics, English, IT, anything)
2. NEVER ask obvious questions or repeat what the user already said — move forward only
3. Each option must be a CONCRETE, SPECIFIC topic within the user's chosen subject
4. NEVER return meta-categories like "Loại câu hỏi", "Cấp độ khó", "Kỹ năng", "Môn học"
5. First question should ask about specific content areas within the chosen subject
6. Use "multi" type for most questions — let user select multiple topics at once
7. Use "single" ONLY for truly mutually exclusive choices (e.g. difficulty level)
8. Return 4-8 options per question
9. Labels in Vietnamese, concise (under 30 chars), IDs in snake_case English
10. Set "done": true after 2-3 rounds when you have enough specific topics
11. When done=true, options should be the FINAL specific topics to include in the test`;

  const raw = await callAI(settings, prompt);

  // Parse as JSON object
  let json = raw.trim();
  const codeBlockMatch = json.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    json = codeBlockMatch[1].trim();
  }
  const objStart = json.indexOf('{');
  const objEnd = json.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1) {
    json = json.slice(objStart, objEnd + 1);
  }

  const parsed = JSON.parse(json) as AnalysisResponse;
  if (!parsed.question || !Array.isArray(parsed.options)) {
    throw new Error('Invalid AI response format');
  }
  return parsed;
}

// --- Generate quiz ---

function buildQuizPrompt(options: GenerateOptions): string {
  let prompt = `Generate exactly ${options.count} multiple choice questions`;

  if (options.description) {
    prompt += ` based on this description: "${options.description}"`;
  }

  if (options.selectedOptions && options.selectedOptions.length > 0) {
    prompt += `\nFocus on these specific topics: ${options.selectedOptions.join(', ')}`;
  }

  if (options.flashcardContext) {
    prompt += `\nIncorporate these terms/keywords where appropriate: ${options.flashcardContext}`;
  }

  if (options.extraInfo) {
    prompt += `\nAdditional requirements: ${options.extraInfo}`;
  }

  prompt += `.

Return ONLY a JSON array, no markdown, no explanation. Each element must have this exact structure:
{
  "questionText": "The question text (use _____ for blanks if needed)",
  "options": {"A": "option text", "B": "option text", "C": "option text", "D": "option text"},
  "correctAnswer": "A",
  "explanation": "Brief explanation in Vietnamese (2-3 sentences)"
}

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- Only one correct answer per question
- Questions must match the subject and topics from the description
- Adapt question style to the subject (e.g. math: solve problems, history: recall events, grammar: fill blanks)
- Explanations should be in Vietnamese, clear and educational
- Vary difficulty: easy, medium, hard
- Do NOT wrap in markdown code blocks

FORMATTING RULES (apply inside questionText, options, and explanation):
- Use **text** for bold (important terms, keywords, numbers)
- Use *text* for italic (titles, foreign words, emphasis)
- Use __text__ for underline (key concepts needing attention)
- Use {red}text{/red} for critical warnings, wrong answers, or errors
- Use {blue}text{/blue} for technical terms, proper nouns
- Use {green}text{/green} for correct answers, positive examples
- Use {orange}text{/orange} for important notes, cautions
- Use {purple}text{/purple} for formulas, equations
- Available colors: red, blue, green, yellow, orange, purple, pink, gray, cyan, lime, indigo, teal
- You can also use {#hexcode}text{/#hexcode} for custom colors
- Use ==text== for highlighting key information
- Use \`text\` for code, technical notation
- Apply formatting SPARINGLY and only where it adds clarity — do NOT format every word
- In explanations: use {green} for the correct concept, {red} for common mistakes`;

  return prompt;
}

function buildFlashcardPrompt(options: GenerateOptions): string {
  let prompt = `Generate exactly ${options.count} flashcards`;

  if (options.description) {
    prompt += ` based on this description: "${options.description}"`;
  }

  if (options.selectedOptions && options.selectedOptions.length > 0) {
    prompt += `\nFocus on these specific categories: ${options.selectedOptions.join(', ')}`;
  }

  if (options.extraInfo) {
    prompt += `\nAdditional requirements: ${options.extraInfo}`;
  }

  prompt += `.

Return ONLY a JSON array, no markdown, no explanation. Each element must have this exact structure:
{
  "word": "Key term or concept",
  "meaning": "Definition/explanation in English",
  "vietnamese": "Vietnamese translation (nghĩa tiếng Việt)",
  "example": "Example sentence or usage in context",
  "phonetic": "IPA phonetic transcription (if applicable, empty string if not)"
}

Rules:
- Content must match the subject and topics from the description
- Adapt format to the subject (vocabulary: word+meaning, formulas: formula+explanation, concepts: term+definition)
- Meanings/definitions in Vietnamese
- Include phonetic transcription for language subjects, leave empty for other subjects
- Do NOT wrap in markdown code blocks

FORMATTING RULES (apply inside meaning and example fields):
- Use **text** for bold (key terms, important words)
- Use *text* for italic (foreign words, titles, emphasis)
- Use {red}text{/red} for warnings, common mistakes
- Use {blue}text{/blue} for technical terms, proper nouns
- Use {green}text{/green} for correct usage, positive examples
- Use {orange}text{/orange} for important notes
- Use {purple}text{/purple} for formulas, equations
- Available colors: red, blue, green, yellow, orange, purple, pink, gray, cyan, lime, indigo, teal
- You can also use {#hexcode}text{/#hexcode} for custom colors
- Use ==text== for highlighting key information
- Use \`text\` for code, technical notation
- Apply formatting SPARINGLY — only where it adds real clarity
- Do NOT format the "word" field itself`;

  return prompt;
}

function parseAIResponse<T>(raw: string): T[] {
  // Try to extract JSON from the response (AI might wrap it in markdown)
  let json = raw.trim();

  // Remove markdown code block if present
  const codeBlockMatch = json.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    json = codeBlockMatch[1].trim();
  }

  // Try to find array start/end
  const arrayStart = json.indexOf('[');
  const arrayEnd = json.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1) {
    json = json.slice(arrayStart, arrayEnd + 1);
  }

  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('Expected array');
  return parsed as T[];
}

export async function generateQuizWithAI(
  options: GenerateOptions,
  settings: AISettings
): Promise<Question[]> {
  const raw = await callAI(settings, buildQuizPrompt(options));

  const items = parseAIResponse<{
    questionText: string;
    options: { A: string; B: string; C: string; D: string };
    correctAnswer: string;
    explanation: string;
  }>(raw);

  return items.map(item => ({
    id: generateId(),
    questionText: item.questionText,
    options: {
      A: item.options.A || '',
      B: item.options.B || '',
      C: item.options.C || '',
      D: item.options.D || '',
    },
    correctAnswer: (['A', 'B', 'C', 'D'].includes(item.correctAnswer?.toUpperCase())
      ? item.correctAnswer.toUpperCase()
      : 'A') as 'A' | 'B' | 'C' | 'D',
    explanation: item.explanation || '',
  }));
}

export async function generateFlashcardWithAI(
  options: GenerateOptions,
  settings: AISettings
): Promise<VocabItem[]> {
  const raw = await callAI(settings, buildFlashcardPrompt(options));

  const items = parseAIResponse<{
    word: string;
    meaning: string;
    vietnamese?: string;
    example?: string;
    phonetic?: string;
  }>(raw);

  return items.map(item => ({
    id: generateId(),
    word: item.word || '',
    meaning: item.meaning || '',
    vietnamese: item.vietnamese || undefined,
    example: item.example || undefined,
    phonetic: item.phonetic || undefined,
  }));
}
