import React, { useEffect, useMemo } from 'react';
import {
  Sparkles,
  X,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  ListChecks,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useData } from '../../contexts/DataContext';
import { generatePageInsights, AIInsightCard } from '../../utils/pageInsightGenerator';
import { DynamicIcon } from '../ui/icon';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const VIEW_LABELS: Record<string, string> = {
  home: '통합 관제 대시보드',
  profit: '수익 분석',
  cost: '원가 관리',
  production: '생산/BOM 관리',
  inventory: '재고/발주 관리',
  settings: '시스템 설정',
};

const STATUS_CONFIG = {
  good: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', Icon: CheckCircle, iconColor: 'text-green-500', label: '정상' },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', Icon: AlertTriangle, iconColor: 'text-yellow-500', label: '주의' },
  danger: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', Icon: AlertCircle, iconColor: 'text-red-500', label: '위험' },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', Icon: Info, iconColor: 'text-blue-500', label: '정보' },
};

const TREND_ICON = {
  up: { Icon: TrendingUp, color: 'text-green-500' },
  down: { Icon: TrendingDown, color: 'text-red-500' },
  flat: { Icon: Minus, color: 'text-gray-400' },
};

export const AIAssistOverlay: React.FC<Props> = ({ isOpen, onClose }) => {
  const { activeView, activeSubTab } = useUI();
  const { insights } = useData();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const cards = useMemo(() => {
    return generatePageInsights(activeView, activeSubTab, insights);
  }, [activeView, activeSubTab, insights]);

  const statusCounts = useMemo(() => {
    const counts = { good: 0, warning: 0, danger: 0, info: 0 };
    cards.forEach(c => counts[c.status]++);
    return counts;
  }, [cards]);

  const actionCards = useMemo(() => cards.filter(c => c.action), [cards]);

  if (!isOpen) return null;

  const pageName = VIEW_LABELS[activeView] || '대시보드';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* panel */}
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-card rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0D5611' }}>
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">AI 분석 도우미</h2>
              <p className="text-xs text-muted-foreground">
                현재 페이지: <span className="font-medium text-foreground">{pageName}</span>
                {activeSubTab && <span className="ml-1 text-muted-foreground">({activeSubTab})</span>}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X size={20} className="text-muted-foreground" />
          </Button>
        </div>

        {/* 상태 요약 바 */}
        <div className="flex gap-3 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-border">
          {(['danger', 'warning', 'good', 'info'] as const).map(status => {
            const cfg = STATUS_CONFIG[status];
            return (
              <div
                key={status}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border',
                  cfg.bg, cfg.border
                )}
              >
                <cfg.Icon size={14} className={cfg.iconColor} />
                <span className="text-muted-foreground">
                  {cfg.label}
                </span>
                <span className="font-bold text-foreground">{statusCounts[status]}</span>
              </div>
            );
          })}
        </div>

        {/* 카드 리스트 */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {cards.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
              <p className="mt-3 text-muted-foreground">
                {activeView === 'settings' ? '설정 페이지에는 분석할 데이터가 없습니다.' : '분석할 데이터가 아직 없습니다. 데이터 동기화를 먼저 진행하세요.'}
              </p>
            </div>
          ) : (
            cards.map((card, idx) => (
              <InsightCardComponent key={card.id} card={card} index={idx} />
            ))
          )}
        </div>

        {/* 추천 업무 풋터 */}
        {actionCards.length > 0 && (
          <div className="border-t border-border px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
              <ListChecks size={16} className="text-yellow-500" />
              추천 업무
            </h3>
            <div className="space-y-1.5">
              {actionCards.slice(0, 5).map(card => {
                const isUrgent = card.status === 'danger';
                return (
                  <div key={`action-${card.id}`} className="flex items-start gap-2 text-sm">
                    {isUrgent ? (
                      <AlertTriangle size={14} className={cn('mt-0.5', STATUS_CONFIG[card.status].iconColor)} />
                    ) : (
                      <ArrowRight size={14} className={cn('mt-0.5', STATUS_CONFIG[card.status].iconColor)} />
                    )}
                    <span className="text-muted-foreground">{card.action}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 카드 컴포넌트 ───
const InsightCardComponent: React.FC<{ card: AIInsightCard; index: number }> = ({ card, index }) => {
  const cfg = STATUS_CONFIG[card.status];

  return (
    <div
      className={cn('rounded-xl border p-4 animate-slide-up', cfg.bg, cfg.border)}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
    >
      {/* 카드 헤더 */}
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', cfg.bg)}>
          <DynamicIcon name={card.icon} size={18} className={cfg.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-foreground text-sm">{card.title}</h4>
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', cfg.bg, cfg.iconColor)}>
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{card.explanation}</p>
        </div>
      </div>

      {/* 주요 지표 */}
      {card.keyMetrics.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3 ml-11">
          {card.keyMetrics.map((m, i) => {
            const trendEntry = m.trend ? TREND_ICON[m.trend] : null;
            return (
              <div key={i} className="flex items-center gap-1 text-xs bg-white/60 dark:bg-gray-800/60 px-2.5 py-1.5 rounded-lg">
                <span className="text-muted-foreground">{m.label}:</span>
                <span className="font-bold text-foreground">{m.value}</span>
                {trendEntry && <trendEntry.Icon size={12} className={trendEntry.color} />}
              </div>
            );
          })}
        </div>
      )}

      {/* 추천 업무 */}
      {card.action && (
        <div className="mt-3 ml-11 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lightbulb size={12} className="text-yellow-500" />
          {card.action}
        </div>
      )}
    </div>
  );
};
