import React from 'react';
import { ICON_MAP } from '../../lib/icons';
import { HelpCircle } from 'lucide-react';

export interface DynamicIconProps {
  /** Material Icon name string to resolve */
  name: string;
  /** Icon size in pixels (default: 20) */
  size?: number;
  /** Additional CSS class names */
  className?: string;
  /** Inline styles (e.g., for dynamic colors) */
  style?: React.CSSProperties;
}

/**
 * DynamicIcon — Bridges string-based Material Icon names to Lucide React components.
 *
 * Used where icon names are passed as string props (e.g., from viewConfig, SubTabLayout tabs).
 * Falls back to HelpCircle with a console.warn for unmapped icon names.
 */
export const DynamicIcon: React.FC<DynamicIconProps> = ({ name, size = 20, className = '', style }) => {
  const IconComponent = ICON_MAP[name];

  if (!IconComponent) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[DynamicIcon] Unmapped icon name: "${name}"`);
    }
    return <HelpCircle size={size} className={className} style={style} />;
  }

  return <IconComponent size={size} className={className} style={style} />;
};

export default DynamicIcon;
