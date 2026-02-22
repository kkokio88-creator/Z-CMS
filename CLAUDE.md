# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Z-CMS is a React-based production analytics dashboard for waste and BOM (Bill of Materials) difference analysis. It integrates with ECOUNT ERP for real-time monitoring of inventory, profitability, and order management.

## Build & Development Commands

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build
```

## Tech Stack

- React 19 with TypeScript 5.8
- Vite 6 for build tooling
- Recharts for data visualization
- Tailwind CSS for styling
- ECOUNT ERP API integration
- Gemini API for AI insights

## Architecture

### State Management

- App.tsx serves as the root component managing global state via React hooks
- No routing library - view switching handled via `currentView` state in App.tsx
- Date range filtering (7days, 30days, month) affects all relevant data views
- ECOUNT config persisted in localStorage, session ID kept in memory

### Data Flow

1. `syncAllEcountData()` in App.tsx fetches all data on mount
2. `ecountService.ts` handles API calls with automatic session management
3. Raw ECOUNT responses transformed to typed interfaces
4. Data passed down to view components via props
5. Mock data fallback (in constants.ts) when API unavailable

### ECOUNT API Integration (services/ecountService.ts)

- `callEcountApi()` wrapper with automatic re-login on session expiry (error code "999")
- Parallel API calls for efficiency using Promise.all
- Endpoints: `/Login`, `/Sale/GetList`, `/Purchase/GetList`, `/Inventory/GetBalance`, `/Production/GetList`, `/BOM/GetList`
- Config stored in localStorage as `ECOUNT_CONFIG` with zone (default: "CD")

### View Components (components/)

- `DashboardHomeView.tsx` - Summary KPIs and trends
- `ChannelProfitView.tsx` - Daily profit analysis with CSV export
- `WasteBomView.tsx` - Waste tracking and BOM difference analysis with AI reasoning
- `InventorySafetyView.tsx` - Stock levels with emergency order capability
- `StocktakeAnomalyView.tsx` - Inventory count discrepancies with AI predictions
- `MonthlyProfitView.tsx` - Profit rankings and cost structure
- `OrderManagementView.tsx` - Purchase order suggestions with supplier contacts
- `SettingsView.tsx` - ECOUNT API configuration

### Type Definitions (types.ts)

Core entities: `ChannelProfitData`, `BomDiffItem`, `InventorySafetyItem`, `StocktakeAnomalyItem`, `ProfitRankItem`, `WasteTrendData`, `OrderSuggestion`, `Notification`

ECOUNT raw types: `EcountSaleRaw`, `EcountInventoryRaw`, `EcountProductionRaw`, `EcountBomRaw`, `EcountPurchaseRaw`

## Key Conventions

- All UI text is in Korean
- Dark mode support via Tailwind `dark:` prefix
- Status color coding: red=shortage, orange=warning, green=normal
- Material Design Icons referenced via `material-icons-outlined` class
- BOM diff items include `reasoning` field for AI-generated analysis
- Deterministic random generation using seed-based hashing for mock data consistency

## Multi-Agent Collaboration

### Team Structure
- **Opus** (Leader): 아키텍처 결정, 코드 리뷰, 태스크 분배
- **Sonnet** (Executor): 구현, 리팩토링, 테스트

### Workflow Rules
1. 모든 태스크는 Leader가 TaskCreate로 생성하고 Executor에 할당
2. Executor는 작업 완료 후 TaskUpdate(completed)로 보고
3. 파일 충돌 방지: 동일 파일 동시 수정 금지
4. 커밋은 Leader만 수행 (Executor는 코드 변경만)

### Design System
- **UI 프레임워크**: shadcn/ui (Radix UI + Tailwind CSS) — `src/components/ui/` 15개 프리미티브
- **아이콘**: Lucide React — `src/lib/icons.ts` (100+ 매핑), `DynamicIcon` 컴포넌트
- **테마**: CSS 변수 기반 HSL 컬러 시스템 (index.css)
- **유틸리티**: `cn()` (clsx + tailwind-merge) — `src/lib/utils.ts`
- **Material Icons**: 완전 제거 (CDN + 코드 모두 0건)

## [Progress]

> 마지막 업데이트: 2026-02-22

### 현재 상태: shadcn/ui 디자인 시스템 마이그레이션 완료

- **종합 품질 점수**: ~80/100 (목표 80 달성)
- **계획 문서**: `docs/progress.md` 참조
- **Phase 0** (긴급 보안): ✅ 완료
- **Phase 1** (안정화): ✅ 완료
- **Phase 2** (프론트 리팩터링): ✅ 완료
- **Phase 3** (백엔드 개선): ✅ 완료 (13/13)
- **Phase 4** (UI/UX 고도화): ✅ 완료 (10/10)
- **Phase 5** (shadcn/ui 마이그레이션): ✅ 완료 — Material Icons 완전 제거, 15개 UI 프리미티브, 12개 뷰 + 20개 컴포넌트 전환
