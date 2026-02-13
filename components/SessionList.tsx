import React, { useState } from 'react';
import { QuizSession, SavedUpload } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    XCircle,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

interface SessionListProps {
    sessions: QuizSession[];
    savedUploads: SavedUpload[];
    onReattempt?: (session: QuizSession) => void;
    onOpenUpload?: (upload: SavedUpload) => void;
}

export const SessionList: React.FC<SessionListProps> = ({
    sessions,
    savedUploads,
    onReattempt,
    onOpenUpload
}) => {
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

    const getUploadForSession = (session: QuizSession) => {
        if (!session.uploadId) return undefined;
        return savedUploads.find(upload => upload.id === session.uploadId);
    };

    const handleDownloadUpload = (upload: SavedUpload | undefined, session: QuizSession) => {
        if (!upload) return;
        if (upload.sourceType === 'image' && upload.sourceDataUrl) {
            const link = document.createElement('a');
            link.href = upload.sourceDataUrl;
            link.download = upload.fileName || `${session.topic}.png`;
            link.click();
            return;
        }
        if (upload.sourceText) {
            const baseName = upload.fileName ? upload.fileName.replace(/\.[^/.]+$/, '') : session.topic;
            const fileName = `${baseName}.txt`;
            const blob = new Blob([upload.sourceText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
        }
    };

    if (sessions.length === 0) {
        return (
            <div className="text-center p-8 text-slate-400 text-sm">
                No past sessions found. Complete a quiz to see it here!
            </div>
        );
    }

    return (
        <motion.div layout className="divide-y divide-slate-100">
            {sessions.map((session) => {
                const upload = getUploadForSession(session);
                const isExpanded = expandedSessionId === session.id;
                const sessionQuestions = (Array.isArray(session.questions) && session.questions.length > 0)
                    ? session.questions
                    : (upload?.material?.quiz || []);
                const hasQuestions = sessionQuestions.length > 0;
                const hasReview = hasQuestions && Array.isArray(session.questionStates) && session.questionStates.length > 0;

                return (
                    <motion.div
                        layout
                        key={session.id}
                        className="px-5 py-4 hover:bg-slate-50/50 transition-colors"
                    >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <p className="font-semibold text-slate-700 text-sm md:text-base">{session.topic}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-400">{new Date(session.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    {upload && (
                                        <>
                                            <span className="text-xs text-slate-300">•</span>
                                            <span className="text-xs text-slate-400">File: {upload.fileName}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 justify-between md:justify-end">
                                <div className="text-right mr-2">
                                    <span className={`text-lg font-bold ${session.score === session.total ? 'text-emerald-600' : session.score / session.total >= 0.7 ? 'text-indigo-600' : 'text-amber-600'}`}>
                                        {Math.round((session.score / session.total) * 100)}%
                                    </span>
                                    <p className="text-xs text-slate-400">{session.score}/{session.total} correct</p>
                                </div>
                                {upload && onOpenUpload && (
                                    <button
                                        onClick={() => onOpenUpload(upload)}
                                        className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-all"
                                    >
                                        Open Upload
                                    </button>
                                )}
                                {upload && (upload.sourceText || upload.sourceDataUrl) && (
                                    <button
                                        onClick={() => handleDownloadUpload(upload, session)}
                                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all"
                                    >
                                        Download
                                    </button>
                                )}
                                {onReattempt && hasQuestions && (
                                    <button
                                        onClick={() => onReattempt(session)}
                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all"
                                    >
                                        Reattempt
                                    </button>
                                )}
                                <button
                                    onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1"
                                >
                                    {isExpanded ? 'Hide' : 'Review'}
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                            </div>
                        </div>

                        <AnimatePresence>
                            {isExpanded && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-4 space-y-4 overflow-hidden"
                                >
                                    {!hasQuestions && (
                                        <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 text-center italic border border-slate-100">
                                            This session doesn’t have stored questions to review. Reattempt to regenerate a reviewable quiz.
                                        </div>
                                    )}
                                    {hasQuestions && !hasReview && (
                                        <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 text-center italic border border-slate-100">
                                            Answer history isn’t available for this session. You can reattempt to generate a new review.
                                        </div>
                                    )}
                                    {hasReview && sessionQuestions.map((q, qIdx) => {
                                        const state = session.questionStates[qIdx];
                                        const selectedOption = state?.selectedOption ?? null;
                                        const isCorrect = state?.isCorrect ?? null;

                                        return (
                                            <motion.div
                                                layout
                                                key={qIdx}
                                                className="bg-slate-50 border border-slate-100 rounded-2xl p-4"
                                            >
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800"><span className="text-indigo-500 mr-2">Q{qIdx + 1}</span> {q.question}</p>
                                                        {!state?.isAnswered && (
                                                            <span className="inline-block mt-2 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Unanswered</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {q.options.map((option, oIdx) => {
                                                        const isSelected = selectedOption === oIdx;
                                                        const isOptionCorrect = oIdx === q.correctAnswer;

                                                        let style = "border-slate-200 bg-white";
                                                        if (isOptionCorrect) style = "border-emerald-400 bg-emerald-50";
                                                        if (isSelected && !isOptionCorrect) style = "border-rose-400 bg-rose-50";
                                                        if (!isSelected && !isOptionCorrect && selectedOption !== null) style = "border-slate-100 bg-white opacity-70";

                                                        return (
                                                            <div key={oIdx} className={`p-3 rounded-xl border text-xs ${style}`}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${isOptionCorrect ? 'border-emerald-500 text-emerald-600' : isSelected ? 'border-rose-500 text-rose-600' : 'border-slate-300 text-slate-400'}`}>
                                                                        {String.fromCharCode(65 + oIdx)}
                                                                    </span>
                                                                    <span className="text-slate-700">{option}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500 flex items-start gap-2">
                                                    <div className={`mt-0.5 shrink-0 ${isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                                    </div>
                                                    <span className="text-slate-600 leading-relaxed"><span className="font-bold">Explanation:</span> {q.explanation}</span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </motion.div>
    );
};
