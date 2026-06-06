import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { QuestionSet } from '../types';
import { addSet } from '../utils/helpers';
import { cleanQuestionText, cleanOptionText } from '../utils/helpers';
import QuestionPreview from '../components/QuestionPreview';

function isValidQuestionSet(data: unknown): data is QuestionSet {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== 'string' || typeof obj.name !== 'string' || !Array.isArray(obj.questions)) return false;
  if ((obj.questions as unknown[]).length === 0) return false;
  return (obj.questions as unknown[]).every((q: unknown) => {
    if (typeof q !== 'object' || q === null) return false;
    const question = q as Record<string, unknown>;
    return (
      typeof question.id === 'string' &&
      typeof question.questionText === 'string' &&
      typeof question.options === 'object' && question.options !== null &&
      typeof (question.options as Record<string, unknown>).A === 'string' &&
      typeof (question.options as Record<string, unknown>).B === 'string' &&
      typeof (question.options as Record<string, unknown>).C === 'string' &&
      typeof (question.options as Record<string, unknown>).D === 'string' &&
      ['A', 'B', 'C', 'D'].includes(question.correctAnswer as string)
    );
  });
}

function cleanQuestionSet(qs: QuestionSet): QuestionSet {
  return {
    ...qs,
    examTimeLimit: qs.examTimeLimit ?? 30,
    shuffleAnswers: qs.shuffleAnswers ?? false,
    questions: qs.questions.map(q => ({
      ...q,
      questionText: cleanQuestionText(q.questionText),
      options: {
        A: cleanOptionText(q.options.A),
        B: cleanOptionText(q.options.B),
        C: cleanOptionText(q.options.C),
        D: cleanOptionText(q.options.D),
      },
    })),
  };
}

export default function ImportPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<QuestionSet | null>(null);
  const [saved, setSaved] = useState(false);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setPreview(null);
    setSaved(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!isValidQuestionSet(data)) {
          setError('File JSON không hợp lệ. Cần có id, name, questions[].');
          return;
        }
        setPreview(cleanQuestionSet(data));
      } catch {
        setError('Không thể đọc file JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleStartQuiz = () => {
    if (!preview) return;
    navigate('/quiz', { state: { questionSet: preview } });
  };

  const handleSaveToCollection = () => {
    if (!preview) return;
    addSet(preview);
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <div className="animate-fadeIn">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import bộ câu hỏi</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Upload file JSON để xem trước và bắt đầu làm bài.</p>
      </div>

      {/* Upload area */}
      <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-cyan-400 dark:hover:border-cyan-500 hover:bg-cyan-50/50 dark:hover:bg-cyan-900/10 transition-all animate-fadeIn stagger-1 group">
        <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 mx-auto mb-3 transition-all group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <label className="cursor-pointer">
          <span className="bg-linear-to-r from-indigo-600 to-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium hover:from-indigo-700 hover:to-indigo-600 transition-all inline-block hover:scale-105 active:scale-95 shadow-md shadow-indigo-500/25">
            Chọn file JSON
          </span>
          <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Hỗ trợ file .json từ trang "Tạo bộ câu hỏi"</p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2 animate-scaleIn">{error}</p>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-4 animate-scaleIn">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{preview.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
                    {preview.questions.length} câu hỏi
                  </span>
                  {' · '}{preview.createdAt}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveToCollection}
                  disabled={saved}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95 ${
                    saved
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
                      : 'border-2 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                  }`}
                >
                  {saved ? '✓ Đã lưu' : 'Lưu vào bộ sưu tập'}
                </button>
                <button
                  onClick={handleStartQuiz}
                  className="bg-linear-to-r from-cyan-500 to-cyan-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all hover:scale-105 active:scale-95 shadow-md shadow-cyan-500/25"
                >
                  Bắt đầu làm bài
                </button>
              </div>
            </div>

            {/* Per-set settings */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 flex-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Thời gian thi:</label>
                <input
                  type="range"
                  min={0}
                  max={180}
                  step={5}
                  value={preview.examTimeLimit}
                  onChange={e => setPreview(prev => prev ? { ...prev, examTimeLimit: Number(e.target.value) } : null)}
                  className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 w-12 text-right">
                  {preview.examTimeLimit === 0 ? '∞' : `${preview.examTimeLimit}m`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Đảo đáp án:</label>
                <button
                  onClick={() => setPreview(prev => prev ? { ...prev, shuffleAnswers: !prev.shuffleAnswers } : null)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${preview.shuffleAnswers ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" style={{ transform: preview.shuffleAnswers ? 'translateX(16px)' : 'translateX(0)' }} />
                </button>
              </div>
            </div>
          </div>

          {/* Question previews */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Xem trước câu hỏi</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {preview.questions.map((q, i) => (
                <div key={q.id} className={`animate-fadeIn stagger-${Math.min(i + 1, 5)}`}>
                  <QuestionPreview question={q} index={i} onEdit={() => {}} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
