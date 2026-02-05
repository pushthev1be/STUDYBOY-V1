
import React from 'react';

interface SummaryViewProps {
  summary: string;
  title: string;
  contentCoveragePercent?: number;
  hasUnprocessedContent?: boolean;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ summary, title, contentCoveragePercent, hasUnprocessedContent }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-4xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-800 mb-6 border-b pb-4">{title}</h2>
      
      {contentCoveragePercent && contentCoveragePercent < 100 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900 font-medium mb-2">Content Coverage: {contentCoveragePercent}%</p>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all" 
              style={{ width: `${contentCoveragePercent}%` }}
            />
          </div>
          <p className="text-xs text-blue-700 mt-2">
            {hasUnprocessedContent 
              ? 'You have more content to explore. Tap "Generate More" to create study materials from the remaining content.'
              : 'All content has been processed into study materials.'}
          </p>
        </div>
      )}
      
      <div className="prose prose-slate max-w-none">
        {summary.split('\n').map((paragraph, idx) => (
          <p key={idx} className="text-slate-600 leading-relaxed mb-4 text-lg">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
};
