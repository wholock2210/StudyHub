import type { Question, UserAnswer } from '../types';
import { renderMarkdown } from '../utils/markdown';

interface QuestionReviewProps {
  questions: Question[];
  answers: Record<string, UserAnswer>;
}

export default function QuestionReview({ questions, answers }: QuestionReviewProps) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg">Xem lại kết quả</h3>
      {questions.map((q, i) => {
        const answer = answers[q.id];
        const selected = answer?.selectedAnswer;
        const isCorrect = selected === q.correctAnswer;

        return (
          <div key={q.id} className={`border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-4 hover:shadow-md transition-all animate-fadeIn stagger-${Math.min(i + 1, 5)}`}>
            <div className="flex items-start gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                !selected ? 'bg-gray-400 dark:bg-gray-500' : isCorrect ? 'bg-green-600' : 'bg-red-600'
              }`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-gray-800 dark:text-gray-200 font-medium mb-2" dangerouslySetInnerHTML={{ __html: renderMarkdown(q.questionText) }} />
                <div className="grid grid-cols-2 gap-1 text-sm mb-2">
                  {(['A', 'B', 'C', 'D'] as const).map(key => (
                    <span key={key} className={`px-2 py-1 rounded transition-colors ${
                      key === q.correctAnswer ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-medium' :
                      key === selected && !isCorrect ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 line-through' :
                      'text-gray-600 dark:text-gray-400'
                    }`}>
                      {key}. <span dangerouslySetInnerHTML={{ __html: renderMarkdown(q.options[key]) }} />
                    </span>
                  ))}
                </div>
                {q.explanation && (
                  <div
                    className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-sm text-amber-900 dark:text-amber-200"
                    dangerouslySetInnerHTML={{ __html: '<strong>Giải thích:</strong> ' + renderMarkdown(q.explanation) }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
