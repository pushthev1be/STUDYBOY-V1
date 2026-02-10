
import React, { useState } from 'react';
import { Flashcard } from '../types';
import { ChevronLeft, ChevronRight, RotateCcw, ChevronDown } from 'lucide-react';

interface FlashcardViewProps {
  cards: Flashcard[];
  topic?: string;
  onCardViewed?: () => void;
  onCardRated?: (cardIndex: number, quality: number) => void;
  onLoadMore?: (newCards: Flashcard[]) => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ cards, topic, onCardViewed, onCardRated, onLoadMore }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [viewedIndices, setViewedIndices] = useState<Set<number>>(new Set([0]));
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const displayedCards = cards.length;

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
    const nextIdx = (currentIndex + 1) % displayedCards;
    setTimeout(() => {
      setCurrentIndex(nextIdx);
      markAsViewed(nextIdx);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    const prevIdx = (currentIndex - 1 + displayedCards) % displayedCards;
    setTimeout(() => {
      setCurrentIndex(prevIdx);
      markAsViewed(prevIdx);
    }, 150);
  };

  const loadMore = async () => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const { generateAdditionalFlashcards } = await import('../services/geminiService');
      const cardTopic = topic || 'Study Material';
      const newCards = await generateAdditionalFlashcards(cardTopic);
      if (newCards.length > 0 && onLoadMore) {
        onLoadMore(newCards);
      }
    } catch (error) {
      console.error("Failed to load more flashcards:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextCard();
      if (e.key === 'ArrowLeft') prevCard();
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped(!isFlipped);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, currentIndex]);

  const currentCard = cards[currentIndex];

  return (
    <div className="flex flex-col items-center space-y-8 py-12 max-w-lg mx-auto min-h-full">
      <div className="text-slate-500 font-medium text-sm">
        Card {currentIndex + 1} of {cards.length}
      </div>

      <div 
        role="button"
        tabIndex={0}
        aria-label={`Flashcard ${currentIndex + 1} of ${cards.length}. ${isFlipped ? 'Showing answer: ' + currentCard.answer : 'Showing question: ' + currentCard.question}. Press Space or Enter to flip. Use arrow keys to navigate.`}
        className="relative w-full aspect-[4/3] perspective-1000 cursor-pointer group outline-none focus:ring-4 focus:ring-indigo-500 rounded-3xl"
        onClick={() => setIsFlipped(!isFlipped)}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setIsFlipped(!isFlipped);
          }
        }}
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
          <div className="absolute inset-0 bg-indigo-600 border-2 border-indigo-500 rounded-3xl shadow-xl flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180">
            <div className="text-center mb-6">
              <span className="text-indigo-200 font-bold uppercase tracking-wider text-xs mb-4 block">Answer</span>
              <p className="text-2xl font-medium text-white">{currentCard.answer}</p>
            </div>
            {isFlipped && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCardRated?.(currentIndex, 1);
                    nextCard();
                  }}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors"
                  title="Hard - Review soon"
                >
                  Hard
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCardRated?.(currentIndex, 2);
                    nextCard();
                  }}
                  className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs font-bold transition-colors"
                  title="Good - Review in a few days"
                >
                  Good
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCardRated?.(currentIndex, 3);
                    nextCard();
                  }}
                  className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition-colors"
                  title="Easy - Mastered"
                >
                  Easy
                </button>
              </div>
            )}
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

      <button
        onClick={loadMore}
        disabled={isLoadingMore}
        className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
      >
        <ChevronDown size={20} />
        {isLoadingMore ? 'Generating more...' : 'Load More Flashcards'}
      </button>
    </div>
  );
};
