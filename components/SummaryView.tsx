
import React from 'react';

interface SummaryViewProps {
  summary: string;
  title: string;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ summary, title }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-4xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-800 mb-6 border-b pb-4">{title}</h2>
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
