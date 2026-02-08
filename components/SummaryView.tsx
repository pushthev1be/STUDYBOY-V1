
import React, { useState } from 'react';
import { BookOpen, Target, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface SummaryViewProps {
  summary: string;
  title: string;
  contentCoveragePercent?: number;
  hasUnprocessedContent?: boolean;
}

interface StudySection {
  type: 'question' | 'section' | 'table' | 'misconception' | 'text';
  title?: string;
  content?: string;
  tableData?: { left: string; right: string }[];
}

export const SummaryView: React.FC<SummaryViewProps> = ({ summary, title, contentCoveragePercent, hasUnprocessedContent }) => {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  // Parse summary to extract structured sections - more flexible
  const parseSummary = (text: string): StudySection[] => {
    const sections: StudySection[] = [];
    const lines = text.split('\n');
    let currentSection: StudySection | null = null;
    let tableLines: string[] = [];
    let isTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;

      // Big Picture Question / Essential Question
      if (line.match(/^[*•\-]?\s*(Big Picture|Essential Question|Key Question)/i)) {
        const content = line.replace(/^[*•\-]?\s*(Big Picture|Essential Question|Key Question)[:\s]*/i, '');
        if (content) {
          currentSection = { type: 'question', content };
          sections.push(currentSection);
        }
      }
      // Common Misconceptions / Mistakes
      else if (line.match(/^[*•\-]?\s*(Common Misconception|Common Mistake|Frequent Error)/i)) {
        const title = line.replace(/^[*•\-]\s*/, '');
        currentSection = { type: 'misconception', title, content: '' };
        sections.push(currentSection);
      }
      // Numbered/bulleted list items that look like section headers
      else if (line.match(/^[0-9]+\.\s+[A-Z]/)) {
        const title = line.replace(/^[0-9]+\.\s+/, '');
        currentSection = { type: 'section', title, content: '' };
        sections.push(currentSection);
        tableLines = [];
        isTable = false;
      }
      // Section Headers (ends with colon or is ALL CAPS)
      else if ((line.endsWith(':') || /^[A-Z][A-Z\s&]+$/.test(line)) && !line.includes('|')) {
        const title = line.replace(/:$/, '');
        currentSection = { type: 'section', title, content: '' };
        sections.push(currentSection);
        tableLines = [];
        isTable = false;
      }
      // Table detection - lines with pipes
      else if (line.includes('|') && !isTable) {
        isTable = true;
        tableLines = [line];
      }
      else if (isTable && line.includes('|')) {
        tableLines.push(line);
      }
      else if (isTable && !line.includes('|')) {
        // Process table
        const tableData = parseTable(tableLines);
        if (tableData.length > 0) {
          sections.push({ type: 'table', tableData });
        }
        isTable = false;
        tableLines = [];
        // Continue with regular text
        if (currentSection && (currentSection.type === 'section' || currentSection.type === 'misconception')) {
          currentSection.content = (currentSection.content || '') + (currentSection.content ? '\n' : '') + line;
        } else {
          currentSection = { type: 'text', content: line };
          sections.push(currentSection);
        }
      }
      else if (currentSection) {
        if (currentSection.type === 'section' || currentSection.type === 'misconception' || currentSection.type === 'text') {
          currentSection.content = (currentSection.content || '') + (currentSection.content ? '\n' : '') + line;
        }
      } else {
        // Default: treat as regular text
        currentSection = { type: 'text', content: line };
        sections.push(currentSection);
      }
    }

    // Handle remaining table
    if (isTable && tableLines.length > 0) {
      const tableData = parseTable(tableLines);
      if (tableData.length > 0) {
        sections.push({ type: 'table', tableData });
      }
    }

    return sections.length > 0 ? sections : [{ type: 'text', content: text }];
  };

  const parseTable = (lines: string[]): { left: string; right: string }[] => {
    const cells: { left: string; right: string }[] = [];
    // Skip header and separator
    for (let i = 2; i < lines.length; i++) {
      const parts = lines[i].split('|').map(p => p.trim()).filter(p => p);
      if (parts.length >= 2) {
        cells.push({ left: parts[0], right: parts[1] });
      }
    }
    return cells;
  };

  const sections = parseSummary(summary);

  const toggleSection = (idx: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="border-b-2 border-indigo-200 pb-6">
        <div className="flex items-start gap-3">
          <BookOpen className="w-8 h-8 text-indigo-600 flex-shrink-0 mt-1" />
          <div>
            <h1 className="text-4xl font-bold text-slate-800">{title}</h1>
            <p className="text-slate-500 text-sm mt-1">📚 Effective Study Guide</p>
          </div>
        </div>
      </div>

      {/* Content Coverage Indicator */}
      {contentCoveragePercent && contentCoveragePercent < 100 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900 mb-2">Content Coverage: {contentCoveragePercent}%</p>
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full transition-all" 
                  style={{ width: `${contentCoveragePercent}%` }}
                />
              </div>
              <p className="text-xs text-blue-700 mt-3">
                {hasUnprocessedContent 
                  ? '📚 More content available! Tap "Generate More" to create additional study materials.'
                  : '✓ All content processed.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Study Guide Sections */}
      <div className="space-y-4">
        {sections.map((section, idx) => {
          const isExpanded = expandedSections.has(idx);

          if (section.type === 'question') {
            return (
              <div key={idx} className="bg-gradient-to-r from-purple-50 to-indigo-50 border-l-4 border-purple-600 p-5 rounded">
                <h3 className="font-bold text-lg text-purple-900 mb-2">❓ Key Question</h3>
                <p className="text-purple-800">{section.content}</p>
              </div>
            );
          }

          if (section.type === 'misconception') {
            return (
              <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-5 rounded">
                <h3 className="font-bold text-lg text-red-900 mb-2">⚠️ Common Misconception</h3>
                <p className="text-red-800 whitespace-pre-wrap">{section.content}</p>
              </div>
            );
          }

          if (section.type === 'table') {
            return (
              <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <tbody>
                    {section.tableData?.map((row, rowIdx) => (
                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="px-4 py-3 font-semibold text-indigo-700 border-r border-slate-200">{row.left}</td>
                        <td className="px-4 py-3 text-slate-700">{row.right}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          // Collapsible sections
          return (
            <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(idx)}
                className="w-full px-5 py-4 bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 text-left font-semibold text-slate-800 flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  {section.type === 'section' && <Target className="w-5 h-5 text-indigo-600" />}
                  {section.title}
                </span>
                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              {isExpanded && (
                <div className="px-5 py-4 bg-white border-t border-slate-200 text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
