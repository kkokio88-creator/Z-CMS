import React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../ui/tooltip';

interface FormulaTooltipProps {
  formula: string;
  details?: readonly string[];
}

const FormulaTooltip: React.FC<FormulaTooltipProps> = ({ formula, details }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center ml-1 cursor-help">
          <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-blue-500 transition-colors" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="w-64 p-3 text-left">
        <div className="font-bold text-xs mb-1.5">{formula}</div>
        {details && details.length > 0 && (
          <ul className="space-y-0.5">
            {details.map((d, i) => (
              <li key={i} className="text-muted-foreground text-[11px] leading-snug flex gap-1">
                <span className="shrink-0">·</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
};

export default FormulaTooltip;
