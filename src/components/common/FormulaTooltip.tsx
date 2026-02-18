import React, { useState } from 'react';

interface FormulaTooltipProps {
  formula: string;
  details?: readonly string[];
}

const FormulaTooltip: React.FC<FormulaTooltipProps> = ({ formula, details }) => {
  const [hover, setHover] = useState(false);

  return (
    <span
      className="relative inline-flex items-center ml-1"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="material-icons-outlined text-sm text-gray-400 hover:text-blue-500 cursor-help transition-colors">
        info
      </span>
      {hover && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 dark:bg-gray-700 text-white rounded-lg shadow-xl p-3 text-left pointer-events-none">
          <div className="font-bold text-xs mb-1.5">{formula}</div>
          {details && details.length > 0 && (
            <ul className="space-y-0.5">
              {details.map((d, i) => (
                <li key={i} className="text-gray-300 text-[11px] leading-snug flex gap-1">
                  <span className="shrink-0">·</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </div>
      )}
    </span>
  );
};

export default FormulaTooltip;
