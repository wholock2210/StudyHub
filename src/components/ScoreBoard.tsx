interface ScoreBoardProps {
  correct: number;
  incorrect: number;
  total: number;
}

export default function ScoreBoard({ correct, incorrect, total }: ScoreBoardProps) {
  const answered = correct + incorrect;
  const unanswered = total - answered;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-scaleIn">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Kết quả</h3>
        <span className="text-2xl font-bold text-cyan-500 dark:text-cyan-400 animate-pulse-soft">{percentage}%</span>
      </div>
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Đúng: <strong className="text-gray-800 dark:text-gray-200">{correct}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className="text-gray-600 dark:text-gray-400">Sai: <strong className="text-gray-800 dark:text-gray-200">{incorrect}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></span>
          <span className="text-gray-600 dark:text-gray-400">Chưa trả lời: <strong className="text-gray-800 dark:text-gray-200">{unanswered}</strong></span>
        </div>
      </div>
      <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
        {answered > 0 && (
          <>
            <div className="bg-linear-to-r from-green-400 to-green-500 transition-all duration-700 ease-out" style={{ width: `${(correct / total) * 100}%` }}></div>
            <div className="bg-linear-to-r from-red-400 to-red-500 transition-all duration-700 ease-out" style={{ width: `${(incorrect / total) * 100}%` }}></div>
          </>
        )}
      </div>
    </div>
  );
}
