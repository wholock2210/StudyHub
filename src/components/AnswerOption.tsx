import { renderMarkdown } from '../utils/markdown';
import TranslatableText from './TranslatableText';

interface AnswerOptionProps {
  letter: string;
  text: string;
  selected: boolean;
  correctAnswer: string;
  isRevealed: boolean;
  onSelect: () => void;
  translatable?: boolean;
}

export default function AnswerOption({ letter, text, selected, correctAnswer, isRevealed, onSelect, translatable }: AnswerOptionProps) {
  const isCorrect = letter === correctAnswer;

  let className = 'border-2 rounded-lg p-3 cursor-pointer transition-all flex items-start gap-3 hover:scale-[1.01] active:scale-[0.99]';

  if (!isRevealed) {
    className += selected
      ? ' border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-400 shadow-sm shadow-indigo-500/10'
      : ' border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50';
  } else if (isCorrect) {
    className += ' border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400';
  } else if (selected) {
    className += ' border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-400';
  } else {
    className += ' border-gray-200 dark:border-gray-700 opacity-60';
  }

  return (
    <div className={className} onClick={!isRevealed ? onSelect : undefined}>
      <span className={`font-bold text-sm w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
        !isRevealed
          ? selected ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          : isCorrect ? 'bg-green-600 text-white' : selected ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
      }`}>
        {letter}
      </span>
      {translatable ? (
        <TranslatableText html={renderMarkdown(text)} enabled className="text-gray-800 dark:text-gray-200 pt-0.5" />
      ) : (
        <span className="text-gray-800 dark:text-gray-200 pt-0.5" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
      )}
    </div>
  );
}
