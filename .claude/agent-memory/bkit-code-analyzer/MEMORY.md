# Z-CMS Code Analyzer Memory

## Project Architecture (Confirmed 2026-02-17)
- React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS
- App.tsx: 1360 lines - God Object pattern (state, sync, modals, rendering all in one)
- Contexts: DataContext, UIContext (thin wrappers passing App.tsx state down), SettingsContext (own state)
- Services: googleSheetService, insightService, ecountService, supabaseClient, costManagementService, costAnalysisService, orderingService, dataIntegrationService, costReportService

## Critical Issues Found
- .env file contains VITE_SUPABASE_ANON_KEY in plaintext (gitignored but .env.local is NOT gitignored for *.local pattern)
- Math.random() used for anomaly data generation (App.tsx:492, 500) — non-deterministic
- `any` type used 75+ times across 22 files
- loadBusinessConfig() called 3x inside handleEcountSync — should use SettingsContext
- getChannelCostSummaries() called 7+ times across components (no memoization)

## Key Patterns
- localStorage keys: ECOUNT_CONFIG, ZCMS_BUSINESS_CONFIG, ZCMS_CHANNEL_COSTS_V2, ZCMS_CHANNEL_PRICING, ZCMS_LABOR_RECORDS, Z_CMS_DATA_SOURCE_CONFIG, Z_CMS_DATA_SOURCE_MD
- sessionStorage keys: ZCMS_DATA_CACHE (30min TTL), Z_CMS_SHEET_TEST_CACHE (5min TTL)
- All UI text in Korean (project requirement)
- Validation schemas (Zod) exist but not applied to all mapper functions
- FilterBar component duplicated in CostManagementView.tsx and ProductionBomView.tsx
- KPICard component duplicated in DashboardHomeView.tsx and StatisticalOrderingView.tsx

## Details
- See frontend-analysis.md for full report
