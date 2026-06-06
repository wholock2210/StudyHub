import type { VocabItem } from '../types';

const WORD_TYPES = [
  { value: '', label: '-- Loại từ --' },
  { value: 'noun', label: 'Danh từ (noun)' },
  { value: 'verb', label: 'Động từ (verb)' },
  { value: 'adjective', label: 'Tính từ (adjective)' },
  { value: 'adverb', label: 'Trạng từ (adverb)' },
  { value: 'preposition', label: 'Giới từ (preposition)' },
  { value: 'conjunction', label: 'Liên từ (conjunction)' },
  { value: 'pronoun', label: 'Đại từ (pronoun)' },
  { value: 'phrase', label: 'Cụm từ (phrase)' },
  { value: 'other', label: 'Khác' },
];

interface VocabFormCardProps {
  item: VocabItem;
  index: number;
  onChange: (item: VocabItem) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export default function VocabFormCard({ item, index, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: VocabFormCardProps) {
  const update = (field: keyof VocabItem, value: string) => {
    onChange({ ...item, [field]: value || undefined });
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/40 rounded-lg flex items-center justify-center text-sm font-bold text-cyan-600 dark:text-cyan-400">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Thẻ {index + 1}</span>
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
            title="Xoá thẻ"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Từ / Nội dung *</label>
          <input
            type="text"
            value={item.word}
            onChange={e => update('word', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="hello"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Nghĩa / Ghi chú *</label>
          <input
            type="text"
            value={item.meaning}
            onChange={e => update('meaning', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="xin chào"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Tiếng Việt <span className="text-gray-400 dark:text-gray-500 font-normal">(tùy chọn)</span></label>
          <input
            type="text"
            value={item.vietnamese || ''}
            onChange={e => update('vietnamese', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="bản dịch tiếng Việt"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Loại từ <span className="text-gray-400 dark:text-gray-500 font-normal">(tùy chọn)</span></label>
          <select
            value={item.wordType || ''}
            onChange={e => update('wordType', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            {WORD_TYPES.map(wt => (
              <option key={wt.value} value={wt.value}>{wt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Phiên âm <span className="text-gray-400 dark:text-gray-500 font-normal">(tùy chọn)</span></label>
          <input
            type="text"
            value={item.phonetic || ''}
            onChange={e => update('phonetic', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="/həˈloʊ/"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Ví dụ <span className="text-gray-400 dark:text-gray-500 font-normal">(tùy chọn)</span></label>
          <input
            type="text"
            value={item.example || ''}
            onChange={e => update('example', e.target.value)}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Hello, how are you?"
          />
        </div>
      </div>
    </div>
  );
}
