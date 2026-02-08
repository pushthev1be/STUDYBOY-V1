
import React from 'react';
import { BookOpen, Target, AlertCircle } from 'lucide-react';

interface SummaryViewProps {
  summary: string;
  title: string;
  contentCoveragePercent?: number;
  hasUnprocessedContent?: boolean;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ summary, title, contentCoveragePercent, hasUnprocessedContent }) => {
  // Parse summary into sections for better formatting
  const sections = summary.split('\n\n').filter(s => s.trim());
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="border-b-2 border-indigo-200 pb-6">
        <div className="flex items-start gap-3 mb-3">
          <BookOpen className="w-8 h-8 text-indigo-600 flex-shrink-0 mt-1" />
          <div>
            <h1 className="text-4xl font-bold text-slate-800">{title}</h1>
            <p className="text-slate-500 text-sm mt-1">Comprehensive Study Guide</p>
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
                  ? '📚 More content available! Tap "Generate More" to create additional study materials from the remaining content.'
                  : '✓ All content has been processed into study materials.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Study Guide Content */}
      <div className="space-y-6">
        {sections.map((section, idx) => {
          const lines = section.split('\n');
          const isKeySection = section.includes('Key') || section.includes('Learning') || section.includes('Objective');
          
          return (
            <div key={idx} className={isKeySection ? 'bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded' : ''}>
              {lines.map((line, lineIdx) => {
                // Bold lines that look like headers (all caps or end with colon)
                const isHeader = line.trim().match(/^[A-Z][^a-z]*:?$/) || line.trim().length < 50 && lineIdx === 0 && !line.includes('.');
                
                if (isHeader && line.trim()) {
                  return (
                    <h3 key={lineIdx} className="text-lg font-bold text-slate-800 mt-4 mb-2 flex items-center gap-2">
                      {isKeySection && <Target className="w-5 h-5 text-indigo-600" />}
                      {line.trim()}
                    </h3>
                  );
                }
                
                return (
                  <p key={lineIdx} className="text-slate-700 leading-relaxed mb-3">
                    {line}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
