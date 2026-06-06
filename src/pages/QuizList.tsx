import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { QuestionSet } from '../types';
import { CATEGORIES } from '../types';
import { loadSets, deleteSet, migrateOldStorage } from '../utils/helpers';
import { exportQuizPDF, sharePDF, openPDF, downloadJsonWeb, shareJSON, isNativePlatform } from '../utils/pdfExport';
import { getCategoryLabel } from './CreateSet';
import { useSettings } from '../context/SettingsContext';

export default function QuizList() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const lang = settings.language;
  const [sets, setSets] = useState<QuestionSet[]>(() => {
    migrateOldStorage();
    return loadSets();
  });
  const [pdfMenuId, setPdfMenuId] = useState<string | null>(null);
  const [highlightAnswers, setHighlightAnswers] = useState(false);
  const [includeExplanations, setIncludeExplanations] = useState(false);
  const pdfSet = sets.find(s => s.id === pdfMenuId);

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Xoá bộ câu hỏi "${name}"?`)) return;
    deleteSet(id);
    setSets(loadSets());
  };

  const handleStart = (qs: QuestionSet) => {
    navigate('/quiz', { state: { questionSet: qs } });
  };

  if (sets.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center space-y-6 py-16 animate-fadeIn">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Chưa có bộ câu hỏi</h2>
        <p className="text-gray-500 dark:text-gray-400">Tạo bộ câu hỏi mới hoặc import file JSON để bắt đầu.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate('/create')} className="bg-linear-to-r from-indigo-600 to-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium hover:from-indigo-700 hover:to-indigo-600 transition-all hover:scale-105 active:scale-95 shadow-md shadow-indigo-500/25">
            Tạo mới
          </button>
          <button onClick={() => navigate('/import')} className="border-2 border-cyan-200 dark:border-cyan-700/50 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-xl font-medium hover:border-cyan-400 dark:hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all hover:scale-105 active:scale-95">
            Import
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 animate-fadeIn">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bộ câu hỏi</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{sets.length} bộ câu hỏi đã lưu</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => navigate('/create')} className="bg-linear-to-r from-indigo-600 to-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-indigo-700 hover:to-indigo-600 transition-all hover:scale-105 active:scale-95 shadow-md shadow-indigo-500/25">
            + Tạo mới
          </button>
          <button onClick={() => navigate('/import')} className="border border-cyan-300 dark:border-cyan-700/50 text-cyan-700 dark:text-cyan-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all hover:scale-105 active:scale-95">
            Import
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {sets.map((qs, i) => (
          <div key={qs.id} className={`relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 overflow-hidden hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-lg hover:scale-[1.01] transition-all animate-fadeIn stagger-${Math.min(i + 1, 5)}`}>
            {/* Top: name + date */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate">{qs.name}</h3>
                {qs.category && qs.category !== 'general' && (
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 truncate max-w-24">
                    {CATEGORIES.find(c => c.key === qs.category)?.icon} {getCategoryLabel(qs.category, lang)}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{qs.createdAt}</span>
            </div>
            {/* Bottom: buttons */}
            <div className="flex items-center gap-2 flex-wrap overflow-hidden">
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mr-auto min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0"></span>
                <span className="truncate">{qs.questions.length} câu hỏi</span>
              </span>
              <button
                onClick={() => navigate('/create/quiz', { state: { questionSet: qs } })}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all hover:scale-110 active:scale-95 shrink-0"
                title="Sửa"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
              <button
                onClick={async () => {
                  const filename = `${qs.name.replace(/\s+/g, '_')}.json`;
                  if (isNativePlatform()) {
                    try {
                      await shareJSON(qs, qs.name);
                    } catch (err) {
                      console.error('JSON share failed:', err);
                      alert('Chia sẻ JSON thất bại. Vui lòng thử lại.');
                    }
                  } else {
                    downloadJsonWeb(qs, filename);
                  }
                }}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all hover:scale-110 active:scale-95 shrink-0"
                title={isNativePlatform() ? "Chia sẻ JSON" : "Tải JSON"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
              <button
                onClick={() => { setPdfMenuId(pdfMenuId === qs.id ? null : qs.id); setHighlightAnswers(false); setIncludeExplanations(false); }}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-110 active:scale-95 shrink-0"
                title="Xuất PDF"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(qs.id, qs.name)}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-110 active:scale-95"
                title="Xoá"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => handleStart(qs)}
                className="bg-linear-to-r from-cyan-500 to-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all hover:scale-105 active:scale-95 shadow-md shadow-cyan-500/25"
              >
                Làm bài
              </button>
            </div>
          </div>
        ))}
      </div>
      {pdfSet && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setPdfMenuId(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 w-full max-w-xs animate-scaleIn"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Xuất PDF</p>
            <label className="flex items-center gap-2.5 cursor-pointer mb-2.5 group">
              <input
                type="checkbox"
                checked={highlightAnswers}
                onChange={e => setHighlightAnswers(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500 accent-green-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">Tô màu đáp án đúng</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer mb-3.5 group">
              <input
                type="checkbox"
                checked={includeExplanations}
                onChange={e => setIncludeExplanations(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-amber-600 focus:ring-amber-500 accent-amber-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">In mẹo/giải thích</span>
            </label>
            {isNativePlatform() ? (
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setPdfMenuId(null);
                    try {
                      await sharePDF(pdfSet, { highlightAnswers, includeExplanations });
                    } catch (err) {
                      console.error('PDF share failed:', err);
                      alert('Chia sẻ PDF thất bại. Vui lòng thử lại.');
                    }
                  }}
                  className="flex-1 bg-linear-to-r from-blue-500 to-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-blue-500/25"
                >
                  Chia sẻ
                </button>
                <button
                  onClick={async () => {
                    setPdfMenuId(null);
                    try {
                      await openPDF(pdfSet, { highlightAnswers, includeExplanations });
                    } catch (err) {
                      console.error('PDF open failed:', err);
                      alert('Mở PDF thất bại. Vui lòng thử lại.');
                    }
                  }}
                  className="flex-1 bg-linear-to-r from-green-500 to-green-600 text-white py-2 rounded-lg text-sm font-medium hover:from-green-600 hover:to-green-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-green-500/25"
                >
                  Mở file
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  setPdfMenuId(null);
                  try {
                    exportQuizPDF(pdfSet, { highlightAnswers, includeExplanations });
                  } catch (err) {
                    console.error('PDF export failed:', err);
                    alert('Xuất PDF thất bại. Vui lòng thử lại.');
                  }
                }}
                className="w-full bg-linear-to-r from-red-500 to-red-600 text-white py-2 rounded-lg text-sm font-medium hover:from-red-600 hover:to-red-700 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-red-500/25"
              >
                Tải PDF
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
