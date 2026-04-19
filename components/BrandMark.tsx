
import React from 'react';

interface Props {
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export function BrandMark({ size = 'md', style }: Props) {
  const isLg = size === 'md';
  return (
    <span style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em', lineHeight: 1, ...style }}>
      Cross&nbsp;Chec
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: isLg ? 13 : 11,
        height: isLg ? 15 : 14,
        position: 'relative',
        top: 0
      }}>
        {isLg ? (
          <svg width="13" height="15" viewBox="0 0 13 15" fill="none">
            <polyline points="1,7 5,11.5 12,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
            <polyline points="1,6 4,10 10,2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </span>
  );
}
