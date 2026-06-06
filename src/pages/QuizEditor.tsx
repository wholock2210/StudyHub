import { useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { parseQuestions } from '../utils/parser';
import { generateId, addSet, formatDate } from '../utils/helpers';
import FormatToolbar from '../components/FormatToolbar';
import QuestionPreview from '../components/QuestionPreview';
import QuestionEditPanel from '../components/QuestionEditPanel';
import QuestionFormCard from '../components/QuestionFormCard';
import { useSettings } from '../context/SettingsContext';
import { t } from '../utils/i18n';
import type { Question, QuestionSet, ParsedQuestion, Category } from '../types';
import { CATEGORIES } from '../types';
import { getCategoryLabel } from './CreateSet';

const SAMPLE_FORMAT = `Câu 1: The upcoming flight to Chicago _______ at 8:30 AM tomorrow, so all passengers must check in two hours prior to departure.
A. will depart
B. departs
C. is departing
D. departed
Answer: A
Explanation: **Thì tương lai đơn** (will + V) dùng cho lịch trình. "__The flight departs at 8:30 AM__" là đúng ngữ pháp nhưng {blue}will depart{/blue} phù hợp hơn khi nói về sự kiện sắp tới. Mẹo: thấy **tomorrow** → nghĩ đến ==thì tương lai==.

Câu 2: The company's profits _______ significantly last quarter due to strong sales in the Asian market.
A. increased
B. increase
C. increasing
D. increases
Answer: A
Explanation: "{red}Last quarter{/red}" là thời gian đã qua → dùng **thì quá khứ đơn**. S + V-ed: ~~increase~~ → {green}increased{/green}. Không dùng hiện tại đơn vì đã có mốc thời gian quá khứ.

Câu 3: All employees are required to submit their reports _______ the end of each business day.
A. until
B. by
C. for
D. with
Answer: B
Explanation: "__By the end of__" = trước khi kết thúc, chỉ **hạn chót** (deadline). {red}Until{/red} = cho đến khi, không phù hợp. Ví dụ: _Submit __by__ Friday_ = nộp trước thứ 6.`;

// Find line ranges for each question block in the raw text
function findQuestionRanges(rawText: string): { start: number; end: number }[] {
  const lines = rawText.split('\n');
  const ranges: { start: number; end: number }[] = [];
  const QUESTION_START = /^(?:C[aàảãáạăắằẳẵặâấầẩẫậA]u?\s*\d+|Question\s*\d+|\d+)\s*[.:)\]]/i;
  let currentStart = -1;

  for (let i = 0; i < lines.length; i++) {
    if (QUESTION_START.test(lines[i].trim())) {
      if (currentStart >= 0) {
        ranges.push({ start: currentStart, end: i - 1 });
      }
      currentStart = i;
    }
  }
  if (currentStart >= 0) {
    ranges.push({ start: currentStart, end: lines.length - 1 });
  }
  return ranges;
}

function questionToText(q: Question, prefix: string): string {
  const lines: string[] = [];
  lines.push(`${prefix}${q.questionText}`);
  lines.push(`A. ${q.options.A}`);
  lines.push(`B. ${q.options.B}`);
  lines.push(`C. ${q.options.C}`);
  lines.push(`D. ${q.options.D}`);
  lines.push(`Answer: ${q.correctAnswer}`);
  if (q.explanation.trim()) {
    lines.push(`Explanation: ${q.explanation}`);
  }
  return lines.join('\n');
}

// Extract the original prefix (e.g. "Câu 1: " or "1. ") from a line
const PREFIX_PATTERN = /^((?:C[aàảãáạăắằẳẵặâấầẩẫậA]u?\s*\d+\s*[.:)\]]\s*|Question\s*\d+\s*[.:)\]]\s*|\d+\s*[.:)\]]\s*))/i;

function extractPrefix(line: string): string {
  const match = line.match(PREFIX_PATTERN);
  return match ? match[1] : '';
}

function questionsToRawText(questions: Question[]): string {
  return questions.map((q, i) => {
    const prefix = `Câu ${i + 1}: `;
    return questionToText(q, prefix);
  }).join('\n\n');
}

export default function QuizEditor() {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();
  const lang = settings.language;
  const navState = location.state as { questionSet?: QuestionSet; category?: Category } | null;
  const existing = navState?.questionSet;
  const initialCategory = existing?.category || navState?.category || 'general';

  const [rawText, setRawText] = useState(() => existing ? questionsToRawText(existing.questions) : '');
  const [setName, setSetName] = useState(existing?.name || '');
  const [category, setCategory] = useState<Category>(initialCategory);
  const [copied, setCopied] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [examTimeLimit, setExamTimeLimit] = useState(existing?.examTimeLimit ?? 30);
  const [shuffleAnswers, setShuffleAnswers] = useState(existing?.shuffleAnswers ?? false);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<'text' | 'ui'>(existing ? 'ui' : 'text');

  const parsed: ParsedQuestion[] = useMemo(() => {
    if (!rawText.trim()) return [];
    return parseQuestions(rawText);
  }, [rawText]);

  const questions: Question[] = useMemo(() => {
    return parsed.map((p, i) => ({
      id: `q-${i}-${p.questionText.slice(0, 20)}`,
      questionText: p.questionText,
      options: p.options,
      correctAnswer: (p.correctAnswer as Question['correctAnswer']) || 'A',
      explanation: p.explanation ?? '',
    }));
  }, [parsed]);

  const handleCopySample = useCallback(() => {
    navigator.clipboard.writeText(SAMPLE_FORMAT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const handleUseSample = useCallback(() => {
    setRawText(SAMPLE_FORMAT);
    setEditIndex(null);
  }, []);

  const handleEditSave = useCallback((updated: Question) => {
    if (editIndex === null) return;
    const ranges = findQuestionRanges(rawText);
    if (editIndex >= ranges.length) return;

    const lines = rawText.split('\n');
    const range = ranges[editIndex];
    const prefix = extractPrefix(lines[range.start]);
    const newBlock = questionToText(updated, prefix).split('\n');

    const newLines = [
      ...lines.slice(0, range.start),
      ...newBlock,
      ...lines.slice(range.end + 1),
    ];
    setRawText(newLines.join('\n'));
    setEditIndex(null);
  }, [rawText, editIndex]);

  // UI mode: direct questions state
  const [uiQuestions, setUiQuestions] = useState<Question[]>(() => {
    if (existing) return existing.questions;
    return [];
  });

  // Sync questions when switching modes
  const switchMode = useCallback((newMode: 'text' | 'ui') => {
    if (newMode === mode) return;
    if (newMode === 'ui') {
      // text -> ui: parse rawText into uiQuestions
      setUiQuestions(questions);
    } else {
      // ui -> text: serialize uiQuestions into rawText
      setRawText(questionsToRawText(uiQuestions));
    }
    setMode(newMode);
    setEditIndex(null);
  }, [mode, questions, uiQuestions]);

  // UI mode handlers
  const handleUiQuestionChange = useCallback((index: number, q: Question) => {
    setUiQuestions(prev => {
      const next = [...prev];
      next[index] = q;
      return next;
    });
  }, []);

  const handleUiQuestionDelete = useCallback((index: number) => {
    setUiQuestions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUiAddQuestion = useCallback(() => {
    const newQ: Question = {
      id: generateId(),
      questionText: '',
      options: { A: '', B: '', C: '', D: '' },
      correctAnswer: 'A',
      explanation: '',
    };
    setUiQuestions(prev => [...prev, newQ]);
  }, []);

  const handleUiMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setUiQuestions(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleUiMoveDown = useCallback((index: number) => {
    setUiQuestions(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  // Use the correct questions source based on mode
  const activeQuestions = mode === 'ui' ? uiQuestions : questions;

  const handleSave = () => {
    const incomplete = activeQuestions.filter(q => !q.explanation.trim());
    if (incomplete.length > 0) {
      if (!confirm(`${incomplete.length} câu chưa có giải thích. Bạn có muốn lưu không?`)) {
        return;
      }
    }
    const questionSet: QuestionSet = {
      id: existing?.id || generateId(),
      name: setName || 'Bộ câu hỏi',
      category,
      createdAt: existing?.createdAt || formatDate(new Date()),
      questions: activeQuestions,
      examTimeLimit,
      shuffleAnswers,
    };
    addSet(questionSet);
    setSaved(true);
    setTimeout(() => {
      navigate('/sets');
    }, 800);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{existing ? 'Sửa bộ câu hỏi' : 'Tạo bộ câu hỏi'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {mode === 'text'
              ? 'Nhập đề thi bên trái, xem kết quả bên phải. Nhấn "Chỉnh sửa" để sửa câu hỏi.'
              : 'Thêm và chỉnh sửa câu hỏi bằng giao diện trực quan.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Mode toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => switchMode('text')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                mode === 'text'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('editor.textMode', lang)}
            </button>
            <button
              type="button"
              onClick={() => switchMode('ui')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                mode === 'ui'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('editor.uiMode', lang)}
            </button>
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value as Category)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.key} value={cat.key}>{cat.icon} {getCategoryLabel(cat.key, lang)}</option>
            ))}
          </select>
          <input
            type="text"
            value={setName}
            onChange={e => setSetName(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-w-0 flex-1 sm:w-56 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Tên bộ câu hỏi..."
          />
          <button
            onClick={handleSave}
            disabled={activeQuestions.length === 0}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-md ${
              saved
                ? 'bg-green-500 text-white shadow-green-500/25'
                : 'bg-linear-to-r from-cyan-500 to-cyan-600 text-white hover:from-cyan-600 hover:to-cyan-700 shadow-cyan-500/25'
            }`}
          >
            {saved ? '✓ Đã lưu' : 'Lưu bộ câu hỏi'}
          </button>
        </div>
      </div>

      {/* Per-set settings */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-3 flex-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Thời gian thi:</label>
          <input
            type="range"
            min={0}
            max={180}
            step={5}
            value={examTimeLimit}
            onChange={e => setExamTimeLimit(Number(e.target.value))}
            className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
          />
          <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 w-12 text-right">
            {examTimeLimit === 0 ? '∞' : `${examTimeLimit}m`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Đảo đáp án:</label>
          <button
            onClick={() => setShuffleAnswers(!shuffleAnswers)}
            className={`relative w-10 h-6 rounded-full transition-colors ${shuffleAnswers ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: shuffleAnswers ? 'translateX(16px)' : 'translateX(0)' }} />
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">Hướng dẫn định dạng</h3>
            <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1 mb-3">
              <p><strong>Bắt buộc:</strong> Số câu (<code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">Câu 1:</code> hoặc <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">1.</code>) + 4 đáp án (<code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">A. B. C. D.</code>)</p>
              <p><strong>Tùy chọn:</strong> <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">Answer: A</code> (đáp án đúng) + <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">Explanation:</code> (giải thích)</p>
              <p><strong>Formatting:</strong>{' '}
                <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">**đậm**</code>{' '}
                <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">*nghiêng*</code>{' '}
                <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">__gạch chân__</code>{' '}
                <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">~~gạch ngang~~</code>{' '}
                <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">==tô sáng==</code>{' '}
                <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">`code`</code>
              </p>
              <p><strong>Màu sắc:</strong> <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">{'{red}text{/red}'}</code> — red, blue, green, yellow, orange, purple, pink, gray, cyan, indigo, teal, lime hoặc <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">{'{#ff0000}text{/#ff0000}'}</code></p>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={handleCopySample}
              className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              {copied ? '✓ Đã copy' : 'Copy mẫu'}
            </button>
            <button
              onClick={handleUseSample}
              className="px-3 py-1.5 border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 text-xs font-medium rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              Dùng thử
            </button>
          </div>
        </div>
      </div>

      {/* Edit panel (text mode only) */}
      {mode === 'text' && editIndex !== null && editIndex < questions.length && (
        <QuestionEditPanel
          question={questions[editIndex]}
          index={editIndex}
          onSave={handleEditSave}
          onCancel={() => setEditIndex(null)}
        />
      )}

      {/* Text mode: Split view */}
      {mode === 'text' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ minHeight: '400px' }}>
          {/* Left: textarea + toolbar */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nhập đề thi</label>
              <div className="flex items-center gap-2">
                <FormatToolbar targetId="raw-textarea" value={rawText} onChange={setRawText} compact />
                {rawText && (
                  <button onClick={() => { setRawText(''); setEditIndex(null); }} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    Xoá
                  </button>
                )}
              </div>
            </div>
            <textarea
              id="raw-textarea"
              value={rawText}
              onChange={e => { setRawText(e.target.value); setEditIndex(null); }}
              className="flex-1 min-h-48 lg:min-h-0 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder={`Dán đề thi vào đây...\n\nHỗ trợ: Câu 1: ... / 1. ... / Question 1: ...\nA. B. C. D. + Answer: X + Explanation: ...`}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {rawText.split('\n').filter(l => l.trim()).length} dòng
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {questions.length > 0 && `${questions.length} câu hỏi`}
              </span>
            </div>
          </div>

          {/* Right: read-only previews */}
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Xem trước
              {questions.length > 0 && (
                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">({questions.length} câu)</span>
              )}
            </label>
            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 space-y-2">
              {questions.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
                  {rawText.trim() ? 'Không tìm thấy câu hỏi nào' : 'Nhập đề thi bên trái để xem kết quả'}
                </div>
              ) : (
                questions.map((q, i) => (
                  <QuestionPreview
                    key={q.id}
                    question={q}
                    index={i}
                    onEdit={() => setEditIndex(i)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* UI mode: form cards */}
      {mode === 'ui' && (
        <div className="space-y-4">
          {uiQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm">{t('editor.noQuestions', lang)}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {uiQuestions.map((q, i) => (
                <QuestionFormCard
                  key={q.id}
                  question={q}
                  index={i}
                  onChange={updated => handleUiQuestionChange(i, updated)}
                  onDelete={() => handleUiQuestionDelete(i)}
                  onMoveUp={() => handleUiMoveUp(i)}
                  onMoveDown={() => handleUiMoveDown(i)}
                  isFirst={i === 0}
                  isLast={i === uiQuestions.length - 1}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleUiAddQuestion}
            className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all"
          >
            {t('editor.addQuestion', lang)}
          </button>
          {uiQuestions.length > 0 && (
            <div className="text-center text-xs text-gray-400 dark:text-gray-500">
              {uiQuestions.length} câu hỏi
            </div>
          )}
        </div>
      )}
    </div>
  );
}
