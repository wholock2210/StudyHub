import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { QuestionSet, QuizResult } from '../types';
import { loadSets, loadHistory, migrateOldStorage } from '../utils/helpers';

export default function Home() {
  const [sets] = useState<QuestionSet[]>(() => {
    migrateOldStorage();
    return loadSets();
  });
  const [history] = useState<QuizResult[]>(() => loadHistory());

  const totalQuiz = history.length;
  const avgScore = totalQuiz > 0
    ? Math.round(history.reduce((sum, r) => sum + (r.score.correct / r.score.total) * 100, 0) / totalQuiz)
    : 0;

  const recentSets = sets.slice(0, 5);

  const missedMap: Record<string, { text: string; wrong: number; total: number }> = {};
  for (const result of history) {
    for (const qr of result.questionResults) {
      const key = qr.questionText.slice(0, 80);
      if (!missedMap[key]) missedMap[key] = { text: qr.questionText, wrong: 0, total: 0 };
      missedMap[key].total++;
      if (!qr.isCorrect) missedMap[key].wrong++;
    }
  }
  const mostMissed = Object.values(missedMap)
    .filter(q => q.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fadeIn">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Tổng quan hoạt động học tập</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn stagger-1">
        <Link
          to="/create"
          className="bg-linear-to-r from-indigo-600 to-indigo-500 text-white text-center py-5 rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-600 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 shadow-md shadow-indigo-500/25"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Tạo bộ câu hỏi mới
        </Link>
        <Link
          to="/import"
          className="bg-white dark:bg-gray-800 border-2 border-cyan-200 dark:border-cyan-700/50 text-gray-800 dark:text-gray-200 text-center py-5 rounded-xl font-semibold hover:border-cyan-400 dark:hover:border-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import JSON
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { value: sets.length, label: 'Bộ câu hỏi', delay: 'stagger-1' },
          { value: totalQuiz, label: 'Lần làm bài', delay: 'stagger-2' },
          { value: `${avgScore}%`, label: 'Điểm trung bình', delay: 'stagger-3' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center hover:scale-[1.03] hover:shadow-lg transition-all animate-fadeIn ${stat.delay} group`}
          >
            <p className="text-3xl font-bold text-cyan-500 dark:text-cyan-400 group-hover:scale-110 transition-transform">{stat.value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Recent sets */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 animate-fadeIn stagger-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">Gần đây</h2>
            <Link to="/sets" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Xem tất cả</Link>
          </div>
          {recentSets.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">Chưa có bộ câu hỏi nào</p>
          ) : (
            <div className="space-y-2">
              {recentSets.map((s, i) => (
                <Link
                  key={s.id}
                  to="/quiz"
                  state={{ questionSet: s }}
                  className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all group animate-fadeIn stagger-${i + 1}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{s.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{s.questions.length} câu · {s.createdAt}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 group-hover:translate-x-1 shrink-0 transition-all" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Most missed */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 animate-fadeIn stagger-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Câu hay sai nhất</h2>
          {mostMissed.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">Chưa có dữ liệu. Hãy làm bài quiz!</p>
          ) : (
            <div className="space-y-3">
              {mostMissed.map((q, i) => (
                <div key={i} className={`flex items-start gap-3 animate-fadeIn stagger-${i + 1}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    q.wrong >= 3 ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{q.text}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Sai {q.wrong}/{q.total} lần</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent quiz history */}
      {history.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 animate-fadeIn stagger-5">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Lịch sử làm bài</h2>
          <div className="space-y-2">
            {history.slice(0, 10).map((r, i) => (
              <div key={r.id} className={`flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors animate-fadeIn stagger-${Math.min(i + 1, 5)}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.setName}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(r.date).toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${
                    r.score.correct / r.score.total >= 0.8 ? 'text-green-600 dark:text-green-400' :
                    r.score.correct / r.score.total >= 0.5 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {r.score.correct}/{r.score.total}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{Math.round((r.score.correct / r.score.total) * 100)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
