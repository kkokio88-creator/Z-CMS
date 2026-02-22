import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  onClick: () => void;
  dangerCount: number;
  isActive?: boolean;
}

export const AIAssistButton: React.FC<Props> = ({ onClick, dangerCount, isActive = false }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300',
        isActive
          ? 'bg-gray-700 hover:bg-gray-800 scale-110 ring-4 ring-gray-400/30'
          : 'hover:scale-105 animate-ai-pulse'
      )}
      style={isActive ? undefined : { backgroundColor: '#0D5611' }}
      title={isActive ? 'AI 분석 모드 끄기' : 'AI 분석 도우미'}
    >
      {isActive ? (
        <X size={24} className="text-white" />
      ) : (
        <Sparkles size={24} className="text-white" />
      )}
      {!isActive && dangerCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {dangerCount > 9 ? '9+' : dangerCount}
        </span>
      )}
    </button>
  );
};
