import React from 'react';

interface Props {
  onClick: () => void;
  dangerCount: number;
}

export const AIAssistButton: React.FC<Props> = ({ onClick, dangerCount }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform animate-ai-pulse"
      style={{ backgroundColor: '#0D5611' }}
      title="AI 분석 도우미"
    >
      <span className="material-icons-outlined text-white text-2xl">auto_awesome</span>
      {dangerCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {dangerCount > 9 ? '9+' : dangerCount}
        </span>
      )}
    </button>
  );
};
