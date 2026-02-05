
import React, { useState } from 'react';
import { Flashcard } from '../types';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

interface FlashcardViewProps {
  cards: Flashcard[];
  onCardViewed?: () => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ cards, onCardViewed }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewedIndices, setViewedIndices] = useState<Set<number>>(new Set([0]));

  const markAsViewed = (index: number) => {
    if (!viewedIndices.has(index)) {
      const newViewed = new Set(viewedIndices);
      newViewed.add(index);
      setViewedIndices(newViewed);
      if (onCardViewed) onCardViewed();
    }
  };

  const nextCard = () => {
    setIsFlipped(false);
    const nextIdx = (currentIndex + 1) % cards.length;
    setTimeout(() => {
      setCurrentIndex(nextIdx);
      markAsViewed(nextIdx);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    const prevIdx = (currentIndex - 1 + cards.length) % cards.length;
    setTimeout(() => {
      setCurrentIndex(prevIdx);
      markAsViewed(prevIdx);
    }, 150);
  };

  const currentCard = cards[currentIndex];

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12 max-w-lg mx-auto">
      <div className="text-slate-500 font-medium text-sm">
        Card {currentIndex + 1} of {cards.length}
      </div>

      <div 
        className="relative w-full aspect-[4/3] perspective-1000 cursor-pointer group"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
          {/* Front */}
          <div className="absolute inset-0 bg-white border-2 border-slate-100 rounded-3xl shadow-xl flex items-center justify-center p-8 backface-hidden">
            <div className="text-center">
              <span className="text-indigo-500 font-bold uppercase tracking-wider text-xs mb-4 block">Question</span>
              <p className="text-2xl font-semibold text-slate-800">{currentCard.question}</p>
            </div>
            <div className="absolute bottom-6 text-slate-400 text-sm flex items-center gap-2">
              <RotateCcw size={16} /> Tap to reveal answer
            </div>
          </div>

          {/* Back */}
          <div className="absolute inset-0 bg-indigo-600 border-2 border-indigo-500 rounded-3xl shadow-xl flex items-center justify-center p-8 backface-hidden rotate-y-180">
            <div className="text-center">
              <span className="text-indigo-200 font-bold uppercase tracking-wider text-xs mb-4 block">Answer</span>
              <p className="text-2xl font-medium text-white">{currentCard.answer}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button 
          onClick={prevCard}
          className="p-4 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ChevronLeft size={24} />
        </button>
        <button 
          onClick={nextCard}
          className="p-4 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};
