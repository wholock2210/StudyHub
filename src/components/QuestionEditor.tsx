import { useState } from 'react';
import type { Question } from '../types';
import { renderMarkdown } from '../utils/markdown';
import FormatToolbar from './FormatToolbar';

interface QuestionEditorProps {
  question: Question;
  index: number;
  onChange: (updated: Question) => void;
}

type FocusTarget = 'questionText' | 'explanation' | 'A' | 'B' | 'C' | 'D';

export default function QuestionEditor({ question, index, onChange }: QuestionEditorProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [previews, setPreviews] = useState<Record<FocusTarget, boolean>>({
    questionText: false, explanation: false, A: false, B: false, C: false, D: false,
  });

  const togglePreview = (field: FocusTarget) => {
    setPreviews(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const update = (field: keyof Question, value: string) => {
    onChange({ ...question, [field]: value });
  };

  const updateOption = (key: 'A' | 'B' | 'C' | 'D', value: string) => {
    onChange({ ...question, options: { ...question.options, [key]: value } });
  };

  const renderField = (
    label: string,
    field: FocusTarget,
    value: string,
    onChangeFn: (v: string) => void,
    rows: number = 2,
    placeholder: string = '',
  ) => {
    const id = `${field}-${question.id}`;
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <FormatToolbar
            targetId={id}
            value={value}
            onChange={onChangeFn}
            showPreview={previews[field]}
            onTogglePreview={() => togglePreview(field)}
          />
        </div>
        {previews[field] ? (
          <div
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 min-h-10"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(value || '<span class="text-gray-400">Trống</span>') }}
          />
        ) : (
          <textarea
            id={id}
            value={value}
            onChange={e => onChangeFn(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
            rows={rows}
            placeholder={placeholder}
          />
        )}
      </div>
    );
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-medium text-gray-800">
          Câu {index + 1}: <span className="font-normal text-gray-500 ml-1">{question.questionText.slice(0, 60)}{question.questionText.length > 60 ? '...' : ''}</span>
        </span>
        <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="p-4 space-y-3">
          {renderField('Câu hỏi', 'questionText', question.questionText, v => update('questionText', v), 2, 'Nhập câu hỏi...')}

          <div className="grid grid-cols-2 gap-3">
            {(['A', 'B', 'C', 'D'] as const).map(key => (
              <div key={key}>
                {renderField(`Đáp án ${key}`, key, question.options[key], v => updateOption(key, v), 1, `Đáp án ${key}...`)}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Đáp án đúng</label>
            <select
              value={question.correctAnswer}
              onChange={e => update('correctAnswer', e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>

          {renderField('Giải thích', 'explanation', question.explanation, v => update('explanation', v), 3, 'Nhập giải thích cách làm...')}
        </div>
      )}
    </div>
  );
}
