import type { ParsedQuestion } from '../types';

const QUESTION_START = /^(\s*(?:C[aàảãáạăắằẳẵặâấầẩẫậA]u?\s*\d+|Question\s*\d+|\d+)\s*[.:)\]]\s*)(.*)/i;
const OPTION_PATTERN = /^([A-D])\s*[.:)\]]\s*(.+)/;
const ANSWER_KEY = /^Answer\s*[:.]\s*([A-D])\s*$/i;
const EXPLANATION_KEY = /^(?:Explanation|Giải thích|Giai thich)\s*[:.]\s*(.+)/i;

export function parseQuestions(rawText: string): ParsedQuestion[] {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const blocks: { body: string[] }[] = [];
  let current: { body: string[] } | null = null;

  for (const line of lines) {
    const match = line.match(QUESTION_START);
    if (match) {
      if (current) blocks.push(current);
      current = { body: [match[2]] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) blocks.push(current);

  return blocks.map(block => {
    const questionLines: string[] = [];
    const options: Record<string, string> = {};
    let correctAnswer: string | null = null;
    let explanation: string | null = null;

    for (const line of block.body) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const ansMatch = trimmed.match(ANSWER_KEY);
      if (ansMatch) {
        correctAnswer = ansMatch[1].toUpperCase();
        continue;
      }

      const expMatch = trimmed.match(EXPLANATION_KEY);
      if (expMatch) {
        explanation = expMatch[1].trim();
        continue;
      }

      const optMatch = trimmed.match(OPTION_PATTERN);
      if (optMatch) {
        options[optMatch[1]] = optMatch[2].trim();
        continue;
      }

      questionLines.push(trimmed);
    }

    return {
      questionText: questionLines.join(' ').replace(/\s+/g, ' ').trim(),
      options: {
        A: options['A'] || '',
        B: options['B'] || '',
        C: options['C'] || '',
        D: options['D'] || '',
      },
      correctAnswer,
      explanation,
    };
  });
}
