import React, { useState, useRef, useEffect } from 'react';
import { useTheme, THEMES } from './ThemeContext';
import { Palette } from 'lucide-react';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTheme = themes.find(t => t.id === theme) || themes[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-theme-card border border-theme-primary hover:bg-theme-card-hover transition-all duration-200 shadow-theme-sm"
        aria-label="Change theme"
        title="Change theme"
      >
        <Palette size={18} className="text-theme-accent" />
        <span className="text-sm font-medium text-theme-secondary hidden sm:inline">
          {currentTheme.icon} {currentTheme.name}
        </span>
        <span className="text-sm sm:hidden">{currentTheme.icon}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-theme-card rounded-2xl border border-theme-primary shadow-theme-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2">
            <div className="text-xs font-semibold text-theme-tertiary uppercase tracking-wider px-3 py-2">
              Choose Theme
            </div>
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 ${
                  theme === t.id
                    ? 'bg-theme-accent-bg text-theme-accent'
                    : 'hover:bg-theme-tertiary text-theme-primary'
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <span className="font-medium flex-1 text-left">{t.name}</span>
                <div className="flex gap-1">
                  <div
                    className="w-4 h-4 rounded-full border border-white/30"
                    style={{ backgroundColor: t.preview.primary }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-white/30"
                    style={{ backgroundColor: t.preview.secondary }}
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-white/30"
                    style={{ backgroundColor: t.preview.accent }}
                  />
                </div>
                {theme === t.id && (
                  <svg className="w-5 h-5 text-theme-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
