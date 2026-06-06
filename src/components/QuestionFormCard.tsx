import { useState } from 'react';
import type { Question } from '../types';
import { renderMarkdown } from '../utils/markdown';
import FormatToolbar from './FormatToolbar';

interface QuestionFormCardProps {
  question: Question;
  index: number;
  onChange: (q: Question) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

type FieldKey = 'questionText' | 'A' | 'B' | 'C' | 'D' | 'explanation';

export default function QuestionFormCard({ question, index, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: QuestionFormCardProps) {
  const [previews, setPreviews] = useState<Record<FieldKey, boolean>>({
    questionText: false, A: false, B: false, C: false, D: false, explanation: false,
  });

  const togglePreview = (field: FieldKey) => {
    setPreviews(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const updateField = (field: FieldKey, value: string) => {
    if (field === 'questionText' || field === 'explanation') {
      onChange({ ...question, [field]: value });
    } else {
      onChange({ ...question, options: { ...question.options, [field]: value } });
    }
  };

  const getValue = (field: FieldKey): string => {
    if (field === 'questionText' || field === 'explanation') return question[field];
    return question.options[field as 'A' | 'B' | 'C' | 'D'];
  };

  const renderField = (label: string, field: FieldKey, rows: number = 2, placeholder: string = '') => {
    const id = `qcard-${index}-${field}-${question.id}`;
    const value = getValue(field);
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">{label}</label>
          <FormatToolbar
            targetId={id}
            value={value}
            onChange={v => updateField(field, v)}
            showPreview={previews[field]}
            onTogglePreview={() => togglePreview(field)}
            compact
          />
        </div>
        {previews[field] ? (
          <div
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 min-h-9"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(value || '<span class="text-gray-400">Trống</span>') }}
          />
        ) : (
          <textarea
            id={id}
            value={value}
            onChange={e => updateField(field, e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            rows={rows}
            placeholder={placeholder}
          />
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Câu {index + 1}</span>
        </div>
        <div className="flex items-center gap-1">
          {onMoveUp && !isFirst && (
            <button
              type="button"
              onClick={onMoveUp}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
              title="Di chuyển lên"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
            </button>
          )}
          {onMoveDown && !isLast && (
            <button
              type="button"
              onClick={onMoveDown}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
              title="Di chuyển xuống"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
            title="Xoá câu hỏi"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {/* Question text */}
      {renderField('Câu hỏi', 'questionText', 2, 'Nhập câu hỏi...')}

      {/* Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(['A', 'B', 'C', 'D'] as const).map(key => (
          <div key={key}>
            {renderField(`Đáp án ${key}`, key, 1, `Đáp án ${key}...`)}
          </div>
        ))}
      </div>

      {/* Correct answer */}
      <div>
        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 block">Đáp án đúng</label>
        <div className="flex gap-2">
          {(['A', 'B', 'C', 'D'] as const).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ ...question, correctAnswer: key })}
              className={`w-10 h-9 rounded-lg text-sm font-bold border-2 transition-all hover:scale-105 active:scale-95 ${
                question.correctAnswer === key
                  ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-500/25 scale-105'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Explanation */}
      {renderField('Giải thích', 'explanation', 2, 'Nhập giải thích cách làm...')}
    </div>
  );
}
