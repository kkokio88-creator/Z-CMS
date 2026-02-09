import React, { useEffect, useMemo } from 'react';
import { useUI } from '../contexts/UIContext';
import { useData } from '../contexts/DataContext';
import { generatePageInsights, AIInsightCard } from '../utils/pageInsightGenerator';

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
  good: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', icon: 'check_circle', iconColor: 'text-green-500', label: '정상' },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', icon: 'warning', iconColor: 'text-yellow-500', label: '주의' },
  danger: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: 'error', iconColor: 'text-red-500', label: '위험' },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: 'info', iconColor: 'text-blue-500', label: '정보' },
};

const TREND_ICON = {
  up: { icon: 'trending_up', color: 'text-green-500' },
  down: { icon: 'trending_down', color: 'text-red-500' },
  flat: { icon: 'trending_flat', color: 'text-gray-400' },
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
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0D5611' }}>
              <span className="material-icons-outlined text-white text-xl">auto_awesome</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">AI 분석 도우미</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                현재 페이지: <span className="font-medium text-gray-700 dark:text-gray-300">{pageName}</span>
                {activeSubTab && <span className="ml-1 text-gray-400">({activeSubTab})</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="material-icons-outlined text-gray-500">close</span>
          </button>
        </div>

        {/* 상태 요약 바 */}
        <div className="flex gap-3 px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          {(['danger', 'warning', 'good', 'info'] as const).map(status => (
            <div
              key={status}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].border} border`}
            >
              <span className={`material-icons-outlined text-sm ${STATUS_CONFIG[status].iconColor}`}>
                {STATUS_CONFIG[status].icon}
              </span>
              <span className="text-gray-700 dark:text-gray-300">
                {STATUS_CONFIG[status].label}
              </span>
              <span className="font-bold text-gray-900 dark:text-white">{statusCounts[status]}</span>
            </div>
          ))}
        </div>

        {/* 카드 리스트 */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {cards.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-icons-outlined text-5xl text-gray-300 dark:text-gray-600">analytics</span>
              <p className="mt-3 text-gray-500 dark:text-gray-400">
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
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
              <span className="material-icons-outlined text-base text-yellow-500">task_alt</span>
              추천 업무
            </h3>
            <div className="space-y-1.5">
              {actionCards.slice(0, 5).map(card => (
                <div key={`action-${card.id}`} className="flex items-start gap-2 text-sm">
                  <span className={`material-icons-outlined text-sm mt-0.5 ${STATUS_CONFIG[card.status].iconColor}`}>
                    {card.status === 'danger' ? 'priority_high' : 'arrow_right'}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">{card.action}</span>
                </div>
              ))}
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
      className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border} animate-slide-up`}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
    >
      {/* 카드 헤더 */}
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
          <span className={`material-icons-outlined text-lg ${cfg.iconColor}`}>{card.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{card.title}</h4>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.iconColor}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{card.explanation}</p>
        </div>
      </div>

      {/* 주요 지표 */}
      {card.keyMetrics.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3 ml-11">
          {card.keyMetrics.map((m, i) => (
            <div key={i} className="flex items-center gap-1 text-xs bg-white/60 dark:bg-gray-800/60 px-2.5 py-1.5 rounded-lg">
              <span className="text-gray-500 dark:text-gray-400">{m.label}:</span>
              <span className="font-bold text-gray-800 dark:text-gray-200">{m.value}</span>
              {m.trend && (
                <span className={`material-icons-outlined text-xs ${TREND_ICON[m.trend].color}`}>
                  {TREND_ICON[m.trend].icon}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 추천 업무 */}
      {card.action && (
        <div className="mt-3 ml-11 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="material-icons-outlined text-xs text-yellow-500">lightbulb</span>
          {card.action}
        </div>
      )}
    </div>
  );
};
