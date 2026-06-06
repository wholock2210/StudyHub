import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { QuestionSet } from '../types';

export interface ExportOptions {
  highlightAnswers: boolean;
  includeExplanations: boolean;
}

function stripFormatting(text: string): string {
  return text
    .replace(/\{(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\}(.*?)\{\/\1\}/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/==(.+?)==/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .trim();
}

function buildPDF(qs: QuestionSet, options: ExportOptions): jsPDF {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const maxW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  // Title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  const titleLines = pdf.splitTextToSize(qs.name, maxW);
  titleLines.forEach((line: string) => {
    checkPage(8);
    pdf.text(line, pageW / 2, y, { align: 'center' });
    y += 7;
  });

  // Subtitle
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100);
  const subtitle = `Ngày tạo: ${qs.createdAt}  |  Số câu: ${qs.questions.length}${qs.examTimeLimit ? `  |  Thời gian: ${qs.examTimeLimit} phút` : ''}`;
  pdf.text(subtitle, pageW / 2, y, { align: 'center' });
  y += 4;

  // Divider
  pdf.setDrawColor(200);
  pdf.line(margin, y, pageW - margin, y);
  y += 8;

  // Questions
  pdf.setTextColor(0);
  qs.questions.forEach((q, i) => {
    const qText = stripFormatting(q.questionText);

    // Question number + text
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    const qPrefix = `${i + 1}. `;
    const qLines = pdf.splitTextToSize(qPrefix + qText, maxW);
    checkPage(qLines.length * 5.5 + 30);
    qLines.forEach((line: string) => {
      checkPage(6);
      pdf.text(line, margin, y);
      y += 5.5;
    });
    y += 1;

    // Options
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    (['A', 'B', 'C', 'D'] as const).forEach(key => {
      const optText = stripFormatting(q.options[key]);
      const isCorrect = key === q.correctAnswer;
      const star = options.highlightAnswers && isCorrect ? ' ★' : '';

      if (options.highlightAnswers && isCorrect) {
        pdf.setTextColor(22, 163, 74); // green
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setTextColor(0);
        pdf.setFont('helvetica', 'normal');
      }

      const optLines = pdf.splitTextToSize(`    ${key}. ${optText}${star}`, maxW - 8);
      optLines.forEach((line: string) => {
        checkPage(5.5);
        pdf.text(line, margin + 4, y);
        y += 5;
      });
    });

    pdf.setTextColor(0);
    pdf.setFont('helvetica', 'normal');
    y += 4;
  });

  // Explanations
  if (options.includeExplanations) {
    const items = qs.questions.filter(q => q.explanation?.trim());
    if (items.length > 0) {
      pdf.addPage();
      y = margin;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GIẢI THÍCH ĐÁP ÁN', pageW / 2, y, { align: 'center' });
      y += 4;
      pdf.setDrawColor(200);
      pdf.line(margin, y, pageW - margin, y);
      y += 8;

      qs.questions.forEach((q, i) => {
        if (!q.explanation?.trim()) return;
        const exp = stripFormatting(q.explanation);

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        const header = `Câu ${i + 1} (${q.correctAnswer}): `;
        pdf.text(header, margin, y);
        y += 5;

        pdf.setFont('helvetica', 'normal');
        const expLines = pdf.splitTextToSize(exp, maxW);
        expLines.forEach((line: string) => {
          checkPage(5);
          pdf.text(line, margin, y);
          y += 5;
        });
        y += 4;
      });
    }
  }

  return pdf;
}

function getFilename(qs: QuestionSet): string {
  return qs.name.replace(/[^a-zA-Z0-9À-ɏḀ-ỿ\s]/g, '').replace(/\s+/g, '_');
}

/** Web: trigger browser download */
export function exportQuizPDF(qs: QuestionSet, options: ExportOptions): void {
  const pdf = buildPDF(qs, options);
  pdf.save(`${getFilename(qs)}.pdf`);
}

/** Mobile: save to filesystem, then share */
export async function sharePDF(qs: QuestionSet, options: ExportOptions): Promise<void> {
  const pdf = buildPDF(qs, options);
  const base64 = pdf.output('dataurlstring').split(',')[1];
  const filename = `${getFilename(qs)}.pdf`;

  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });

  await Share.share({
    title: filename,
    text: qs.name,
    url: result.uri,
    dialogTitle: 'Chia sẻ PDF',
  });
}

/** Mobile: save to filesystem, then open with system PDF viewer */
export async function openPDF(qs: QuestionSet, options: ExportOptions): Promise<void> {
  const pdf = buildPDF(qs, options);
  const base64 = pdf.output('dataurlstring').split(',')[1];
  const filename = `${getFilename(qs)}.pdf`;

  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });

  const { FileOpener } = await import('@capacitor-community/file-opener');
  await FileOpener.open({
    filePath: result.uri,
    contentType: 'application/pdf',
  });
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// --- JSON Share ---

function getJsonFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9À-ɏḀ-ỿ\s]/g, '').replace(/\s+/g, '_') + '.json';
}

/** Web: trigger browser download */
export function downloadJsonWeb(data: object, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** Mobile: save JSON to filesystem, then share */
export async function shareJSON(data: object, name: string): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  const filename = getJsonFilename(name);

  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });

  await Share.share({
    title: filename,
    text: name,
    url: result.uri,
    dialogTitle: 'Chia sẻ JSON',
  });
}

/** Mobile: save JSON to filesystem, then open */
export async function openJSON(data: object, name: string): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  const filename = getJsonFilename(name);

  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Cache,
  });

  const { FileOpener } = await import('@capacitor-community/file-opener');
  await FileOpener.open({
    filePath: result.uri,
    contentType: 'application/json',
  });
}
