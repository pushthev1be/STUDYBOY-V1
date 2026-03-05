
import React, { useState, useMemo, useEffect } from 'react';
import { QuizQuestion, QuestionStatus, QuizSession, SavedUpload } from '../types';
import {
  CheckCircle2,
  XCircle,
  Flag,
  RotateCcw,
  Award,
  Check,
  Sparkles,
  PlusCircle,
  Loader2,
  Stethoscope,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { SessionList } from './SessionList';

interface QuizViewProps {
  questions: QuizQuestion[];
  onQuizComplete?: (score: number, total: number, questions: QuizQuestion[], questionStates: QuestionStatus[]) => void;
  onKeepGoing?: () => Promise<void>;
  onQuestionFailed?: () => Promise<void>;
  isExtending?: boolean;
  pastSessions?: QuizSession[];
  savedUploads?: SavedUpload[];
  onReattemptSession?: (session: QuizSession) => void;
  onOpenUpload?: (upload: SavedUpload) => void;
}

export const QuizView: React.FC<QuizViewProps> = ({
  questions,
  onQuizComplete,
  onKeepGoing,
  onQuestionFailed,
  isExtending = false,
  pastSessions = [],
  savedUploads = [],
  onReattemptSession,
  onOpenUpload,
}) => {
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const [sessionStates, setSessionStates] = useState<QuestionStatus[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Initialize and sync states when questions array grows
  useEffect(() => {
    setSessionStates(prev => {
      const newStates = [...prev];
      for (let i = prev.length; i < safeQuestions.length; i++) {
        newStates.push({
          id: i,
          isAnswered: false,
          isCorrect: null,
          selectedOption: null,
          isFlagged: false,
          showExplanation: false,
        });
      }
      return newStates;
    });
  }, [safeQuestions]);

  const stats = useMemo(() => {
    const answered = sessionStates.filter(s => s.isAnswered).length;
    const correct = sessionStates.filter(s => s.isCorrect === true).length;
    const flagged = sessionStates.filter(s => s.isFlagged).length;
    return { answered, correct, flagged, total: safeQuestions.length };
  }, [sessionStates, safeQuestions.length]);

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

  const handleOptionSelect = (qIdx: number, optionIndex: number) => {
    if (isSubmitted) return;

    const newStates = [...sessionStates];
    const isCorrect = optionIndex === safeQuestions[qIdx].correctAnswer;

    newStates[qIdx] = {
      ...newStates[qIdx],
      selectedOption: optionIndex,
      isAnswered: true,
      isCorrect: isCorrect,
      showExplanation: true
    };
    setSessionStates(newStates);

    // Trigger auto-generate 2 more questions on failure
    if (!isCorrect && onQuestionFailed) {
      onQuestionFailed();
    }
  };

  const toggleFlag = (qIdx: number) => {
    const newStates = [...sessionStates];
    newStates[qIdx] = { ...newStates[qIdx], isFlagged: !newStates[qIdx].isFlagged };
    setSessionStates(newStates);
  };

  const finalizeSession = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsSubmitted(true);
    if (onQuizComplete) {
      const finalizedStates = sessionStates.map(state => ({ ...state, showExplanation: true }));
      onQuizComplete(stats.correct, stats.total, safeQuestions, finalizedStates);
    }
  };

  const restartSession = () => {
    setSessionStates(safeQuestions.map((_, i) => ({
      id: i,
      isAnswered: false,
      isCorrect: null,
      selectedOption: null,
      isFlagged: false,
      showExplanation: false,
    })));
    setIsSubmitted(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isSubmitted) {
    return (
      <div className="max-w-4xl mx-auto bg-theme-card rounded-3xl shadow-xl border border-theme-primary overflow-hidden animate-fade-in mb-20">
        <div className="bg-theme-accent p-12 text-center text-white">
          <Award className="mx-auto mb-6 opacity-80" size={64} />
          <h2 className="text-4xl font-bold mb-2">Round Complete</h2>
          <p className="text-theme-accent-secondary text-lg">PANCE prep takes persistence.</p>
        </div>
        <div className="p-12">
          <div className="grid grid-cols-3 gap-8 mb-12">
            <div className="text-center p-6 bg-theme-hover rounded-2xl">
              <div className="text-3xl font-bold text-theme-primary">{stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%</div>
              <div className="text-sm text-theme-muted font-medium">Diagnostic Score</div>
            </div>
            <div className="text-center p-6 bg-theme-hover rounded-2xl">
              <div className="text-3xl font-bold text-theme-primary">{stats.correct}/{stats.total}</div>
              <div className="text-sm text-theme-muted font-medium">Cases Correct</div>
            </div>
            <div className="text-center p-6 bg-theme-hover rounded-2xl">
              <div className="text-3xl font-bold text-theme-primary">{stats.flagged}</div>
              <div className="text-sm text-theme-muted font-medium">Review Later</div>
            </div>
          </div>
          <button
            onClick={restartSession}
            className="w-full py-4 bg-theme-accent text-white rounded-xl font-bold hover:bg-theme-accent-secondary transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <RotateCcw size={20} /> Restart Board Review
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-32">
      <div className="flex items-center justify-between bg-theme-card/90 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-theme-secondary sticky top-24 z-30">
        <div className="flex items-center gap-4">
          <div className="bg-theme-accent-bg p-3 rounded-xl">
            <Stethoscope className="text-theme-accent" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-theme-primary">Clinical Vignettes</h2>
            <p className="text-sm text-theme-muted">Board-style practice questions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block mr-2">
            <div className="text-[10px] font-bold text-theme-tertiary uppercase tracking-widest">Questions Found</div>
            <div className="text-sm font-bold text-theme-accent">{stats.answered} / {stats.total}</div>
          </div>

          {onKeepGoing && (
            <button
              onClick={onKeepGoing}
              disabled={isExtending}
              className="flex items-center gap-2 px-4 py-2.5 bg-theme-card text-theme-accent border border-theme-accent rounded-xl font-bold hover:bg-theme-accent-bg transition-all disabled:opacity-50"
            >
              {isExtending ? <Loader2 size={18} className="animate-spin" /> : <PlusCircle size={18} />}
              Extend Case Study
            </button>
          )}

          <button
            onClick={finalizeSession}
            disabled={stats.answered === 0}
            className="px-6 py-2.5 bg-theme-accent text-white rounded-xl font-bold hover:bg-theme-accent-secondary transition-all disabled:opacity-50 shadow-lg"
          >
            Submit All
          </button>
        </div>
      </div>

      {pastSessions.length > 0 && (
        <div className="bg-theme-card rounded-2xl border border-theme-secondary overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-5 hover:bg-theme-hover transition-all"
          >
            <div className="flex items-center gap-3">
              <History className="text-theme-accent" size={20} />
              <span className="font-bold text-theme-secondary">Past Quiz Sessions</span>
              <span className="text-xs font-bold text-theme-tertiary bg-theme-tertiary px-2 py-0.5 rounded-full">{pastSessions.length}</span>
            </div>
            {showHistory ? <ChevronUp size={20} className="text-theme-tertiary" /> : <ChevronDown size={20} className="text-theme-tertiary" />}
          </button>

          {showHistory && (
            <SessionList
              sessions={pastSessions}
              savedUploads={savedUploads}
              onReattempt={onReattemptSession}
              onOpenUpload={onOpenUpload}
            />
          )}

        </div>
      )
      }

      <div className="space-y-6">
        {(() => {
          let lastSubtopic = '';
          return safeQuestions.map((q, qIdx) => {
            const status = sessionStates[qIdx];
            if (!status) return null;
            const subtopicHeader = q.subtopic && q.subtopic !== lastSubtopic;
            if (q.subtopic) lastSubtopic = q.subtopic;

            return (
              <React.Fragment key={qIdx}>
                {subtopicHeader && (
                  <div className="flex items-center gap-3 pt-4">
                    <div className="h-px flex-1 bg-theme-accent-secondary"></div>
                    <span className="text-xs font-black text-theme-accent uppercase tracking-widest bg-theme-accent-bg px-4 py-1.5 rounded-full">{q.subtopic}</span>
                    <div className="h-px flex-1 bg-theme-accent-secondary"></div>
                  </div>
                )}
                <div className={`bg-theme-card rounded-3xl border transition-all p-8 relative ${status.isAnswered ? 'border-theme-primary shadow-sm' : 'border-theme-secondary shadow-md'}`}>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${status.isAnswered ? 'bg-theme-accent-secondary text-theme-accent' : 'bg-theme-tertiary text-theme-tertiary'}`}>
                        {qIdx + 1}
                      </span>
                      <h3 className="text-lg font-bold text-theme-primary leading-relaxed whitespace-pre-wrap">{q.question}</h3>
                    </div>
                    <button
                      onClick={() => toggleFlag(qIdx)}
                      className={`p-2 rounded-lg transition-all ${status.isFlagged ? 'bg-amber-100 text-amber-600' : 'text-theme-tertiary hover:text-theme-muted'}`}
                    >
                      <Flag size={20} fill={status.isFlagged ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {q.options.map((option, oIdx) => {
                      const isSelected = status.selectedOption === oIdx;
                      const isCorrect = oIdx === q.correctAnswer;
                      const showFeedback = status.isAnswered;

                      let style = "border-theme-secondary hover:border-theme-accent hover:bg-theme-hover";
                      if (isSelected) style = "border-theme-accent bg-theme-accent-bg/50 ring-2 ring-theme-accent";
                      if (showFeedback) {
                        if (isCorrect) style = "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100";
                        else if (isSelected) style = "border-rose-500 bg-rose-50 ring-2 ring-rose-100";
                        else style = "border-theme-primary opacity-50";
                      }

                      return (
                        <button
                          key={oIdx}
                          disabled={status.isAnswered}
                          onClick={() => handleOptionSelect(qIdx, oIdx)}
                          className={`p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-4 group ${style}`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-theme-accent border-theme-accent' : 'border-theme-secondary'}`}>
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                          <span className={`text-base font-medium ${isSelected ? 'text-theme-primary' : 'text-theme-secondary'}`}>
                            {option}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {status.showExplanation && (
                    <div className="mt-8 p-6 bg-theme-hover rounded-2xl border border-theme-primary animate-slide-up">
                      <div className="flex gap-4 mb-4">
                        <div className={`p-2 rounded-lg h-fit ${status.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {status.isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-theme-primary mb-1">
                            {status.isCorrect ? 'Correct!' : `The correct answer is "${q.options[q.correctAnswer]}".`}
                          </h4>
                          <p className="text-theme-secondary text-sm leading-relaxed">{q.explanation}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-theme-secondary">
                        <Sparkles className="text-theme-accent" size={16} />
                        <span className="text-[10px] font-bold text-theme-accent uppercase tracking-widest">Clinical Pearl</span>
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          });
        })()}

        {isExtending && (
          <div className="bg-theme-card rounded-3xl border-2 border-dashed border-theme-secondary p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="text-theme-accent animate-spin mb-4" size={40} />
            <p className="text-theme-secondary font-semibold mb-2">Generating more clinical cases...</p>
            <p className="text-theme-tertiary text-sm mb-4">Creating challenging board-style questions</p>
            <div className="w-48 h-2 bg-theme-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-theme-accent to-theme-accent-secondary rounded-full animate-progress-indeterminate"></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
        <button
          onClick={onKeepGoing}
          disabled={isExtending}
          className="px-8 py-5 bg-theme-card text-theme-accent border-2 border-theme-accent rounded-2xl font-bold text-lg hover:bg-theme-accent-bg disabled:bg-theme-hover disabled:text-theme-accent-secondary disabled:cursor-wait transition-all flex items-center justify-center gap-2 min-w-[240px]"
        >
          {isExtending ? (
            <>
              <Loader2 size={24} className="animate-spin" />
              <span>Generating<span className="animate-pulse">...</span></span>
            </>
          ) : (
            <>
              <Sparkles size={24} />
              Request More Cases
            </>
          )}
        </button>
        <button
          onClick={finalizeSession}
          className="px-12 py-5 bg-theme-accent text-white rounded-2xl font-bold text-lg hover:bg-theme-accent-secondary transition-all shadow-xl shadow-theme-accent"
        >
          Finish Board Review
        </button>
      </div>
    </div >
  );
};
