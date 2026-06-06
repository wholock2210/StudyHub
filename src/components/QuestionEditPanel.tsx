import { useState, useEffect } from 'react';
import type { Question } from '../types';
import { renderMarkdown } from '../utils/markdown';
import FormatToolbar from './FormatToolbar';

interface QuestionEditPanelProps {
  question: Question;
  index: number;
  onSave: (updated: Question) => void;
  onCancel: () => void;
}

type FieldKey = 'questionText' | 'A' | 'B' | 'C' | 'D' | 'explanation';

export default function QuestionEditPanel({ question, index, onSave, onCancel }: QuestionEditPanelProps) {
  const [editData, setEditData] = useState<Question>({ ...question });
  const [previews, setPreviews] = useState<Record<FieldKey, boolean>>({
    questionText: false, A: false, B: false, C: false, D: false, explanation: false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditData({ ...question });
    setPreviews({ questionText: false, A: false, B: false, C: false, D: false, explanation: false });
  }, [question]);

  const togglePreview = (field: FieldKey) => {
    setPreviews(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const updateField = (field: FieldKey, value: string) => {
    if (field === 'questionText' || field === 'explanation') {
      setEditData(prev => ({ ...prev, [field]: value }));
    } else {
      setEditData(prev => ({ ...prev, options: { ...prev.options, [field]: value } }));
    }
  };

  const getValue = (field: FieldKey): string => {
    if (field === 'questionText' || field === 'explanation') return editData[field];
    return editData.options[field as 'A' | 'B' | 'C' | 'D'];
  };

  const renderField = (label: string, field: FieldKey, rows: number = 2, placeholder: string = '') => {
    const id = `edit-${field}-${question.id}`;
    const value = getValue(field);
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</label>
          <FormatToolbar
            targetId={id}
            value={value}
            onChange={v => updateField(field, v)}
            showPreview={previews[field]}
            onTogglePreview={() => togglePreview(field)}
          />
        </div>
        {previews[field] ? (
          <div
            className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 min-h-11"
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
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl p-5 space-y-4 animate-scaleIn">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-indigo-900 dark:text-indigo-200">Chỉnh sửa Câu {index + 1}</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all hover:scale-105 active:scale-95"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => onSave(editData)}
            className="px-4 py-1.5 text-sm bg-linear-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-all font-medium hover:scale-105 active:scale-95 shadow-md shadow-indigo-500/25"
          >
            Lưu & Cập nhật
          </button>
        </div>
      </div>

      {renderField('Câu hỏi', 'questionText', 2, 'Nhập câu hỏi...')}

      <div className="grid grid-cols-2 gap-4">
        {(['A', 'B', 'C', 'D'] as const).map(key => (
          <div key={key}>
            {renderField(`Đáp án ${key}`, key, 1, `Đáp án ${key}...`)}
          </div>
        ))}
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">Đáp án đúng</label>
        <div className="flex gap-2">
          {(['A', 'B', 'C', 'D'] as const).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => setEditData(prev => ({ ...prev, correctAnswer: key }))}
              className={`w-12 h-10 rounded-lg text-sm font-bold border-2 transition-all hover:scale-105 active:scale-95 ${
                editData.correctAnswer === key
                  ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-500/25 scale-105'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {renderField('Giải thích', 'explanation', 3, 'Nhập giải thích cách làm...')}
    </div>
  );
}
