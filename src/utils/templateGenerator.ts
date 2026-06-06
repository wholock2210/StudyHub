import type { Question, VocabItem } from '../types';
import { generateId } from './helpers';

// --- TOEIC Grammar Question Templates ---

interface QuestionTemplate {
  pattern: string;
  correct: string;
  wrong: string[];
  explanation: string;
  topic: string;
}

const grammarTemplates: QuestionTemplate[] = [
  // Tenses
  { pattern: 'The company _____ its annual report last month.', correct: 'released', wrong: ['releases', 'is releasing', 'will release'], explanation: '"Last month" indicates past tense → use V2/V-ed.', topic: 'tenses' },
  { pattern: 'Ms. Johnson _____ as the marketing director since 2019.', correct: 'has served', wrong: ['served', 'is serving', 'serves'], explanation: '"Since 2019" indicates present perfect → has/have + V3.', topic: 'tenses' },
  { pattern: 'The new office _____ by the end of this quarter.', correct: 'will be completed', wrong: ['is completed', 'was completed', 'has been completed'], explanation: '"By the end of this quarter" indicates future → will be + V3.', topic: 'tenses' },
  { pattern: 'All employees _____ a performance review next week.', correct: 'will receive', wrong: ['received', 'receive', 'are receiving'], explanation: '"Next week" indicates future tense → will + V.', topic: 'tenses' },
  { pattern: 'The team _____ on the project when the client called.', correct: 'was working', wrong: ['worked', 'has worked', 'works'], explanation: 'Past continuous for background action in the past → was/were + V-ing.', topic: 'tenses' },
  { pattern: 'Profits _____ by 15% over the past fiscal year.', correct: 'have increased', wrong: ['increased', 'increase', 'are increasing'], explanation: '"Over the past fiscal year" → present perfect tense.', topic: 'tenses' },

  // Prepositions
  { pattern: 'Please submit the report _____ Friday.', correct: 'by', wrong: ['until', 'for', 'with'], explanation: '"By Friday" = before or on Friday (deadline). "Until" = up to that time.', topic: 'prepositions' },
  { pattern: 'The conference will be held _____ the main auditorium.', correct: 'in', wrong: ['at', 'on', 'by'], explanation: '"In" is used for enclosed spaces like rooms, buildings.', topic: 'prepositions' },
  { pattern: 'She has been working _____ the company for ten years.', correct: 'for', wrong: ['since', 'during', 'from'], explanation: '"For" + period of time. "Since" + specific point in time.', topic: 'prepositions' },
  { pattern: 'The meeting is scheduled _____ 3:00 PM.', correct: 'at', wrong: ['in', 'on', 'by'], explanation: '"At" is used for specific times.', topic: 'prepositions' },
  { pattern: 'There was a delay _____ the shipment due to weather.', correct: 'in', wrong: ['of', 'for', 'on'], explanation: '"A delay in something" is the correct collocation.', topic: 'prepositions' },

  // Articles
  { pattern: '_____ executive summary was presented to the board.', correct: 'The', wrong: ['A', 'An', '(no article)'], explanation: '"The" for specific, known items — the summary being discussed.', topic: 'articles' },
  { pattern: 'She is _____ honest and reliable employee.', correct: 'an', wrong: ['a', 'the', '(no article)'], explanation: '"An" before vowel sounds. "Honest" starts with a silent h → vowel sound.', topic: 'articles' },

  // Subject-Verb Agreement
  { pattern: 'Each of the employees _____ required to attend the training.', correct: 'is', wrong: ['are', 'were', 'have been'], explanation: '"Each" is singular → singular verb "is".', topic: 'agreement' },
  { pattern: 'The committee _____ reached a decision after lengthy discussions.', correct: 'has', wrong: ['have', 'are', 'were'], explanation: '"Committee" as a collective noun (American English) → singular verb.', topic: 'agreement' },
  { pattern: 'Neither the manager nor the employees _____ available for the meeting.', correct: 'are', wrong: ['is', 'was', 'has been'], explanation: 'With "neither...nor", the verb agrees with the nearer subject (employees → plural).', topic: 'agreement' },

  // Word Forms
  { pattern: 'The new policy had a significant _____ on employee morale.', correct: 'effect', wrong: ['affect', 'effective', 'affecting'], explanation: '"Effect" is a noun. "Affect" is a verb.', topic: 'wordForms' },
  { pattern: 'The company is looking for a more _____ solution.', correct: 'cost-effective', wrong: ['cost-effect', 'cost-effecting', 'cost-effectiveness'], explanation: '"Cost-effective" is the adjective form.', topic: 'wordForms' },
  { pattern: 'The _____ of the new product exceeded expectations.', correct: 'launch', wrong: ['launching', 'launched', 'launcher'], explanation: '"The launch" — noun form after "The".', topic: 'wordForms' },

  // Conditionals
  { pattern: 'If the proposal _____ approved, we will begin immediately.', correct: 'is', wrong: ['will be', 'was', 'were'], explanation: 'First conditional: If + present simple, will + V.', topic: 'conditionals' },
  { pattern: 'If we _____ more resources, the project would be finished sooner.', correct: 'had', wrong: ['have', 'has', 'would have'], explanation: 'Second conditional: If + past simple, would + V.', topic: 'conditionals' },

  // Relative Clauses
  { pattern: 'The employee _____ proposal was accepted received a promotion.', correct: 'whose', wrong: ['who', 'which', 'that'], explanation: '"Whose" shows possession — the proposal belongs to the employee.', topic: 'relatives' },
  { pattern: 'The office _____ I work is located downtown.', correct: 'where', wrong: ['which', 'that', 'when'], explanation: '"Where" refers to a place.', topic: 'relatives' },

  // Passive Voice
  { pattern: 'The new regulations _____ by the government last month.', correct: 'were announced', wrong: ['announced', 'are announced', 'have announced'], explanation: 'Passive voice in past: were + V3.', topic: 'passive' },
  { pattern: 'All applications must _____ by the deadline.', correct: 'be submitted', wrong: ['submit', 'be submitting', 'submitted'], explanation: 'Passive with modal: must + be + V3.', topic: 'passive' },

  // Conjunctions
  { pattern: 'The project was completed on time, _____ the team worked overtime.', correct: 'because', wrong: ['although', 'despite', 'however'], explanation: '"Because" shows cause and effect.', topic: 'conjunctions' },
  { pattern: '_____ the budget was limited, the event was a success.', correct: 'Despite', wrong: ['Because', 'Although', 'However'], explanation: '"Despite" + noun phrase (the budget was limited → despite the limited budget).', topic: 'conjunctions' },
];

// --- TOEIC Vocabulary by Topic ---

interface VocabEntry {
  word: string;
  meaning: string;
  example: string;
  phonetic: string;
  topic: string;
}

const vocabBank: VocabEntry[] = [
  // Business & Office
  { word: 'deadline', meaning: 'hạn chót', example: 'The deadline for the report is Friday.', phonetic: '/ˈdedlaɪn/', topic: 'business' },
  { word: 'agenda', meaning: 'chương trình nghị sự', example: 'Please review the agenda before the meeting.', phonetic: '/əˈdʒendə/', topic: 'business' },
  { word: 'revenue', meaning: 'doanh thu', example: 'Revenue increased by 20% this quarter.', phonetic: '/ˈrevənjuː/', topic: 'business' },
  { word: 'budget', meaning: 'ngân sách', example: 'We need to stay within the budget.', phonetic: '/ˈbʌdʒɪt/', topic: 'business' },
  { word: 'proposal', meaning: 'đề xuất', example: 'She submitted a proposal for the new project.', phonetic: '/prəˈpoʊzl/', topic: 'business' },
  { word: 'invoice', meaning: 'hóa đơn', example: 'Please send the invoice to the accounting department.', phonetic: '/ˈɪnvɔɪs/', topic: 'business' },
  { word: 'quarterly', meaning: 'hàng quý', example: 'The quarterly report shows strong growth.', phonetic: '/ˈkwɔːrtərli/', topic: 'business' },
  { word: 'stakeholder', meaning: 'bên liên quan', example: 'All stakeholders were invited to the presentation.', phonetic: '/ˈsteɪkhoʊldər/', topic: 'business' },
  { word: 'benchmark', meaning: 'tiêu chuẩn đánh giá', example: 'We use industry benchmarks to measure performance.', phonetic: '/ˈbentʃmɑːrk/', topic: 'business' },
  { word: 'compliance', meaning: 'sự tuân thủ', example: 'The company ensures compliance with all regulations.', phonetic: '/kəmˈplaɪəns/', topic: 'business' },

  // HR & Recruitment
  { word: 'applicant', meaning: 'người nộp đơn', example: 'Over 100 applicants applied for the position.', phonetic: '/ˈæplɪkənt/', topic: 'hr' },
  { word: 'recruitment', meaning: 'tuyển dụng', example: 'The recruitment process takes about three weeks.', phonetic: '/rɪˈkruːtmənt/', topic: 'hr' },
  { word: 'resume', meaning: 'sơ yếu lý lịch', example: 'Please attach your resume to the application.', phonetic: '/ˈrezjumeɪ/', topic: 'hr' },
  { word: 'probation', meaning: 'thử việc', example: 'New employees have a three-month probation period.', phonetic: '/proʊˈbeɪʃn/', topic: 'hr' },
  { word: 'compensation', meaning: 'bồi thường, lương bổng', example: 'The compensation package includes health insurance.', phonetic: '/ˌkɑːmpenˈseɪʃn/', topic: 'hr' },
  { word: 'orientation', meaning: 'định hướng', example: 'New hires attend an orientation session on their first day.', phonetic: '/ˌɔːriənˈteɪʃn/', topic: 'hr' },
  { word: 'promotion', meaning: 'thăng chức', example: 'He received a promotion after five years.', phonetic: '/prəˈmoʊʃn/', topic: 'hr' },
  { word: 'resignation', meaning: 'sự từ chức', example: 'She handed in her resignation letter.', phonetic: '/ˌrezɪɡˈneɪʃn/', topic: 'hr' },

  // Travel & Logistics
  { word: 'itinerary', meaning: 'lịch trình', example: 'The travel agent sent the itinerary by email.', phonetic: '/aɪˈtɪnəreri/', topic: 'travel' },
  { word: 'accommodation', meaning: 'chỗ ở', example: 'The company covers accommodation expenses.', phonetic: '/əˌkɑːməˈdeɪʃn/', topic: 'travel' },
  { word: 'departure', meaning: 'khởi hành', example: 'The departure time is 8:00 AM sharp.', phonetic: '/dɪˈpɑːrtʃər/', topic: 'travel' },
  { word: 'reservation', meaning: 'đặt chỗ', example: 'I made a reservation at the hotel.', phonetic: '/ˌrezərˈveɪʃn/', topic: 'travel' },
  { word: 'layover', meaning: 'chuyến dừng chân', example: 'There is a two-hour layover in Tokyo.', phonetic: '/ˈleɪoʊvər/', topic: 'travel' },
  { word: 'commute', meaning: 'đi làm hàng ngày', example: 'Her commute to work takes about 45 minutes.', phonetic: '/kəˈmjuːt/', topic: 'travel' },

  // Meetings & Presentations
  { word: 'minutes', meaning: 'biên bản họp', example: 'The secretary took the minutes during the meeting.', phonetic: '/ˈmɪnɪts/', topic: 'meetings' },
  { word: 'adjourn', meaning: 'tạm hoãn', example: 'The chairperson moved to adjourn the meeting.', phonetic: '/əˈdʒɜːrn/', topic: 'meetings' },
  { word: 'unanimous', meaning: 'nhất trí', example: 'The board reached a unanimous decision.', phonetic: '/juˈnænɪməs/', topic: 'meetings' },
  { word: 'delegate', meaning: 'ủy quyền', example: 'The manager decided to delegate the task.', phonetic: '/ˈdelɪɡeɪt/', topic: 'meetings' },
  { word: 'consensus', meaning: 'sự đồng thuận', example: 'We need to reach a consensus before proceeding.', phonetic: '/kənˈsensəs/', topic: 'meetings' },
  { word: 'postpone', meaning: 'hoãn lại', example: 'The meeting has been postponed until next week.', phonetic: '/poʊstˈpoʊn/', topic: 'meetings' },

  // Finance & Accounting
  { word: 'expenditure', meaning: 'chi tiêu', example: 'We need to reduce expenditure this quarter.', phonetic: '/ɪkˈspendɪtʃər/', topic: 'finance' },
  { word: 'audit', meaning: 'kiểm toán', example: 'The annual audit is scheduled for December.', phonetic: '/ˈɔːdɪt/', topic: 'finance' },
  { word: 'dividend', meaning: 'cổ tức', example: 'Shareholders received a generous dividend.', phonetic: '/ˈdɪvɪdend/', topic: 'finance' },
  { word: 'liability', meaning: 'nợ phải trả', example: 'The company reduced its total liabilities.', phonetic: '/ˌlaɪəˈbɪləti/', topic: 'finance' },
  { word: 'asset', meaning: 'tài sản', example: 'Real estate is considered a long-term asset.', phonetic: '/ˈæset/', topic: 'finance' },
  { word: 'depreciation', meaning: 'khấu hao', example: 'The depreciation of equipment is calculated annually.', phonetic: '/dɪˌpriːʃiˈeɪʃn/', topic: 'finance' },

  // Technology
  { word: 'software', meaning: 'phần mềm', example: 'The company upgraded its accounting software.', phonetic: '/ˈsɔːftwer/', topic: 'technology' },
  { word: 'database', meaning: 'cơ sở dữ liệu', example: 'Customer information is stored in the database.', phonetic: '/ˈdeɪtəbeɪs/', topic: 'technology' },
  { word: 'bandwidth', meaning: 'băng thông', example: 'We need more bandwidth for video conferencing.', phonetic: '/ˈbændwɪdθ/', topic: 'technology' },
  { word: 'encryption', meaning: 'mã hóa', example: 'Data encryption protects sensitive information.', phonetic: '/ɪnˈkrɪpʃn/', topic: 'technology' },
  { word: 'compatible', meaning: 'tương thích', example: 'The new system is compatible with existing hardware.', phonetic: '/kəmˈpætəbl/', topic: 'technology' },

  // Marketing & Sales
  { word: 'campaign', meaning: 'chiến dịch', example: 'The marketing campaign increased brand awareness.', phonetic: '/kæmˈpeɪn/', topic: 'marketing' },
  { word: 'demographic', meaning: 'nhân khẩu học', example: 'We need to target a younger demographic.', phonetic: '/ˌdeməˈɡræfɪk/', topic: 'marketing' },
  { word: 'brochure', meaning: 'tờ rơi', example: 'The brochure highlights our new products.', phonetic: '/broʊˈʃʊr/', topic: 'marketing' },
  { word: 'endorsement', meaning: 'sự chứng thực', example: 'The celebrity endorsement boosted sales.', phonetic: '/ɪnˈdɔːrsmənt/', topic: 'marketing' },
  { word: 'logistics', meaning: 'hậu cần', example: 'The logistics department handles shipping and delivery.', phonetic: '/ləˈdʒɪstɪks/', topic: 'marketing' },
];

// --- Generator Functions ---

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface GenerateOptions {
  topic: string;
  count: number;
  type: 'quiz' | 'flashcard';
  description?: string;
  selectedOptions?: string[];
  flashcardContext?: string;
  extraInfo?: string;
}

function matchTopic(input: string): string {
  const lower = input.toLowerCase();
  if (/thì|tense|past|present|future/i.test(lower)) return 'tenses';
  if (/giới từ|preposition/i.test(lower)) return 'prepositions';
  if (/mạo từ|article/i.test(lower)) return 'articles';
  if (/chủ ngữ|agreement|số nhiều|số ít/i.test(lower)) return 'agreement';
  if (/từ loại|word.?form/i.test(lower)) return 'wordForms';
  if (/điều kiện|conditional/i.test(lower)) return 'conditionals';
  if (/quan hệ|relative/i.test(lower)) return 'relatives';
  if (/bị động|passive/i.test(lower)) return 'passive';
  if (/liên từ|conjunction/i.test(lower)) return 'conjunctions';
  if (/công sở|business|office/i.test(lower)) return 'business';
  if (/nhân sự|hr|recruit|tuyển/i.test(lower)) return 'hr';
  if (/du lịch|travel|logistics/i.test(lower)) return 'travel';
  if (/họp|meeting|presentation/i.test(lower)) return 'meetings';
  if (/tài chính|finance|accounting/i.test(lower)) return 'finance';
  if (/công nghệ|technology|tech/i.test(lower)) return 'technology';
  if (/marketing|bán|sales/i.test(lower)) return 'marketing';
  return ''; // match all
}

export function generateQuizFromTemplate(options: GenerateOptions): Question[] {
  const topicKey = matchTopic(options.topic);
  const matched = topicKey
    ? grammarTemplates.filter(t => t.topic === topicKey)
    : grammarTemplates;

  const templates = matched.length >= options.count
    ? shuffleArray(matched).slice(0, options.count)
    : shuffleArray([...matched, ...grammarTemplates]).slice(0, options.count);

  return templates.map((tmpl) => {
    const allOptions = shuffleArray([tmpl.correct, ...tmpl.wrong]);
    const correctIdx = allOptions.indexOf(tmpl.correct);
    const keys = ['A', 'B', 'C', 'D'] as const;

    return {
      id: generateId(),
      questionText: tmpl.pattern,
      options: {
        A: allOptions[0],
        B: allOptions[1],
        C: allOptions[2],
        D: allOptions[3],
      },
      correctAnswer: keys[correctIdx],
      explanation: tmpl.explanation,
    };
  });
}

export function generateFlashcardFromTemplate(options: GenerateOptions): VocabItem[] {
  const topicKey = matchTopic(options.topic);
  const matched = topicKey
    ? vocabBank.filter(v => v.topic === topicKey)
    : vocabBank;

  const entries = matched.length >= options.count
    ? shuffleArray(matched).slice(0, options.count)
    : shuffleArray([...matched, ...vocabBank]).slice(0, options.count);

  return entries.map(entry => ({
    id: generateId(),
    word: entry.word,
    meaning: entry.meaning,
    example: entry.example,
    phonetic: entry.phonetic,
  }));
}
