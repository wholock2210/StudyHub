import type { Question } from '../types';
import { renderMarkdown } from '../utils/markdown';

interface QuestionPreviewProps {
  question: Question;
  index: number;
  onEdit: () => void;
}

export default function QuestionPreview({ question, index, onEdit }: QuestionPreviewProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md hover:scale-[1.01] transition-all">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Câu {index + 1}</span>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium hover:underline transition-colors"
        >
          Chỉnh sửa
        </button>
      </div>
      <div className="p-3 space-y-2">
        <p
          className="text-sm text-gray-800 dark:text-gray-200 font-medium leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(question.questionText) }}
        />
        <div className="grid grid-cols-2 gap-1.5">
          {(['A', 'B', 'C', 'D'] as const).map(key => (
            <div
              key={key}
              className={`text-xs px-2 py-1.5 rounded transition-colors ${
                key === question.correctAnswer
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <span className="font-semibold mr-1">{key}.</span>
              <span dangerouslySetInnerHTML={{ __html: renderMarkdown(question.options[key]) }} />
              {key === question.correctAnswer && <span className="ml-1 text-green-500">✓</span>}
            </div>
          ))}
        </div>
        {question.explanation && (
          <div
            className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded px-2 py-1.5"
            dangerouslySetInnerHTML={{ __html: '<span class="font-semibold">Giải thích:</span> ' + renderMarkdown(question.explanation) }}
          />
        )}
      </div>
    </div>
  );
}
