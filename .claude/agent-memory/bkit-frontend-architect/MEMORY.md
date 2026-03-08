# Frontend Architect Memory — Z-CMS

## Project Summary
- React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 3 + Recharts
- Korean-language production analytics dashboard (ERP/BOM/inventory)
- Single-page app with manual view switching (no router)
- Data sources: Google Sheets (via Supabase) + ECOUNT ERP

## Key Architecture Facts
- Root: `src/app/App.tsx` — 1363 lines, holds ALL data state (20+ useState)
- Context: 3 contexts (DataContext, UIContext, SettingsContext) in `src/contexts/`
- Components: 29 in `src/components/` (mix of view, layout, and UI components)
- Services: `googleSheetService.ts`, `ecountService.ts`, `insightService.ts`, `supabaseClient.ts`, `costManagementService.ts`
- Config: `businessConfig.ts` (localStorage-persisted), `dataSourceConfig.ts`

## Critical Issues (from 2026-02-17 review)
1. App.tsx is a God Component — 1363 lines, handles data fetch, cache, sync logic, modal render, CSV export, navigation guard
2. DataContext value is computed in App.tsx via useMemo and passed as prop — anti-pattern (re-creates on every change)
3. UIContext contains isDarkMode/toggleDarkMode but Header/Sidebar still receive them via props (context not fully used)
4. `selectedItem: any` type used for modal — no discriminated union
5. No code splitting / lazy loading — all 29 components bundled eagerly
6. tailwind.config.js content paths missing `src/components/` without `src/` prefix (has both patterns, OK)
7. Sidebar has hardcoded user name "박종철" — not dynamic
8. No ARIA labels on icon-only buttons (accessibility gap)
9. InsightSection uses a nested Context (InsightCardsContext) inside App.tsx render — unusual but functional
10. `getFilteredData` slices by index (not date) — legacy pattern inconsistent with `filterByDate` utility

## Design Patterns in Use
- SubTabLayout: render-prop pattern `children: (activeTab: string) => ReactNode` — good
- ErrorBoundary: per-view wrapping with key prop — good
- sessionStorage cache (30min TTL) with background sync — good UX pattern
- Promise.all for parallel data fetch — good

## File Paths to Know
- `src/app/App.tsx` — root (God Component, refactor target)
- `src/contexts/DataContext.tsx` — data context
- `src/contexts/UIContext.tsx` — UI/nav context
- `src/contexts/SettingsContext.tsx` — business config context
- `src/config/businessConfig.ts` — localStorage-persisted business settings
- `tailwind.config.js` — 2 custom colors: `primary`, `primary-hover`, `surface-*`, `background-*`
- `index.css` — minimal (17 lines), no custom component classes

## Improvement Priorities (ranked)
1. Split App.tsx into: useSyncData hook + useDataCache hook + App shell
2. Move modal rendering to dedicated ModalManager component
3. Add React.lazy + Suspense for view components
4. Replace `selectedItem: any` with discriminated union type
5. Add missing ARIA labels to interactive elements
6. Move isDarkMode state to UIContext internal state (not passed via props)

See `architecture-review.md` for full review details.
