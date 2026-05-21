import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';

// Loading Fallback Component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E94560]" />
    </div>
  );
}

// Lazy-loaded Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
// Monitoring
const MON001Overview = lazy(() => import('./pages/monitoring/MON001Overview'));
const MON002LineDetail = lazy(() => import('./pages/monitoring/MON002LineDetail'));
const MON003EnergyRanking = lazy(() => import('./pages/monitoring/MON003EnergyRanking'));
const MON004EnergyAlert = lazy(() => import('./pages/monitoring/MON004EnergyAlert'));
const MON005PowerQuality = lazy(() => import('./pages/monitoring/MON005PowerQuality'));
const MON006AirLeak = lazy(() => import('./pages/monitoring/MON006AirLeak'));
// Dashboard
const DSH001EnergyTrend = lazy(() => import('./pages/dashboard/DSH001EnergyTrend'));
const DSH002FacilityTrend = lazy(() => import('./pages/dashboard/DSH002FacilityTrend'));
const DSH003UsageDistribution = lazy(() => import('./pages/dashboard/DSH003UsageDistribution'));
const DSH004ProcessRanking = lazy(() => import('./pages/dashboard/DSH004ProcessRanking'));
const DSH005CycleRanking = lazy(() => import('./pages/dashboard/DSH005CycleRanking'));
const DSH008EnergyChangeTopN = lazy(() => import('./pages/dashboard/DSH008EnergyChangeTopN'));
// HMGMA 화면 모음 (Slide 2/5/27/29 등)
const MON007FactoryMap     = lazy(() => import('./pages/monitoring/MON007FactoryMap'));
const DSH009EnergyFlow     = lazy(() => import('./pages/dashboard/DSH009EnergyFlow'));
const DSH010ShopIntegrated = lazy(() => import('./pages/dashboard/DSH010ShopIntegrated'));
const DSH011EnergyReport   = lazy(() => import('./pages/dashboard/DSH011EnergyReport'));
const HVC002RTUStatus      = lazy(() => import('./pages/auxiliary/HVC002RTUStatus'));
const HVC003RTUDetail      = lazy(() => import('./pages/auxiliary/HVC003RTUDetail'));
const LGT002LightingControl = lazy(() => import('./pages/auxiliary/LGT002LightingControl'));
const SET021RTUSchedule    = lazy(() => import('./pages/settings/SET021RTUSchedule'));
// Alert
const ALT001PowerQualityStats = lazy(() => import('./pages/alert/ALT001PowerQualityStats'));
const ALT002AirLeakStats = lazy(() => import('./pages/alert/ALT002AirLeakStats'));
const ALT003CycleAnomalyStats = lazy(() => import('./pages/alert/ALT003CycleAnomalyStats'));
const ALT004PowerQualityHistory = lazy(() => import('./pages/alert/ALT004PowerQualityHistory'));
const ALT005AirLeakHistory = lazy(() => import('./pages/alert/ALT005AirLeakHistory'));
const ALT006CycleAnomalyHistory = lazy(() => import('./pages/alert/ALT006CycleAnomalyHistory'));
// Phase 2-③ 부대설비 알림 (ALT-007/008/009) — 공통 컴포넌트, 경로별 type 분기
const ALT007AuxAlert = lazy(() => import('./pages/alert/ALT007AuxAlert'));
// Analysis
const ANL001Comparison = lazy(() => import('./pages/analysis/ANL001Comparison'));
const ANL002DetailedComparison = lazy(() => import('./pages/analysis/ANL002DetailedComparison'));
const ANL003CycleAnalysis = lazy(() => import('./pages/analysis/ANL003CycleAnalysis'));
const ANL004CycleDelay = lazy(() => import('./pages/analysis/ANL004CycleDelay'));
const ANL005PowerQualityAnalysis = lazy(() => import('./pages/analysis/ANL005PowerQualityAnalysis'));
const ANL006AirDetailedComparison = lazy(() => import('./pages/analysis/ANL006AirDetailedComparison'));
const ANL007PeriodPowerComparison = lazy(() => import('./pages/analysis/ANL007PeriodPowerComparison'));
const ANL008PeriodAirComparison = lazy(() => import('./pages/analysis/ANL008PeriodAirComparison'));
const ANL009AdvPowerComparison = lazy(() => import('./pages/analysis/ANL009AdvPowerComparison'));
const ANL010AdvAirComparison = lazy(() => import('./pages/analysis/ANL010AdvAirComparison'));
const ANL011CycleSingleAnalysis = lazy(() => import('./pages/analysis/ANL011CycleSingleAnalysis'));
// Settings
const SET001PowerQuality = lazy(() => import('./pages/settings/SET001PowerQuality'));
const SET002AirLeak = lazy(() => import('./pages/settings/SET002AirLeak'));
const SET003ReferenceCycle = lazy(() => import('./pages/settings/SET003ReferenceCycle'));
const SET004CycleAlert = lazy(() => import('./pages/settings/SET004CycleAlert'));
const SET005EnergyAlert = lazy(() => import('./pages/settings/SET005EnergyAlert'));
const SET006CycleEnergyAlert = lazy(() => import('./pages/settings/SET006CycleEnergyAlert'));
const SET007FacilityMaster = lazy(() => import('./pages/settings/SET007FacilityMaster'));
const SET008FactoryManagement = lazy(() => import('./pages/settings/SET008FactoryManagement'));
const SET009LineSettings = lazy(() => import('./pages/settings/SET009LineSettings'));
const SET011FacilityTypeManagement = lazy(() => import('./pages/settings/SET011FacilityTypeManagement'));
const SET012TagMaster = lazy(() => import('./pages/settings/SET012TagMaster'));
const SET013TagHierarchy = lazy(() => import('./pages/settings/SET013TagHierarchy'));
const SET014EnergySourceConfig = lazy(() => import('./pages/settings/SET014EnergySourceConfig'));
const SET015SystemSettings = lazy(() => import('./pages/settings/SET015SystemSettings'));
// Aux (부대설비: 공조/조명/환경)
const AuxHvacOverview     = lazy(() => import('./pages/auxiliary/AuxHvacOverview'));
const AuxLightingOverview = lazy(() => import('./pages/auxiliary/AuxLightingOverview'));
const AuxZoneMaster       = lazy(() => import('./pages/auxiliary/AuxZoneMaster'));
const AuxScheduleRules    = lazy(() => import('./pages/auxiliary/AuxScheduleRules'));
const AuxLuxStandards     = lazy(() => import('./pages/auxiliary/AuxLuxStandards'));
const AuxControlHistory   = lazy(() => import('./pages/auxiliary/AuxControlHistory'));

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/monitoring/overview" replace /> },
      // Monitoring
      { path: 'monitoring/overview', element: <MON001Overview /> },
      { path: 'monitoring/line-detail', element: <MON002LineDetail /> },
      { path: 'monitoring/energy-ranking', element: <MON003EnergyRanking /> },
      { path: 'monitoring/energy-alert', element: <MON004EnergyAlert /> },
      { path: 'monitoring/power-quality', element: <MON005PowerQuality /> },
      { path: 'monitoring/air-leak', element: <MON006AirLeak /> },
      // Dashboard
      { path: 'dashboard/energy-trend', element: <DSH001EnergyTrend /> },
      { path: 'dashboard/facility-trend', element: <DSH002FacilityTrend /> },
      { path: 'dashboard/usage-distribution', element: <DSH003UsageDistribution /> },
      { path: 'dashboard/process-ranking', element: <DSH004ProcessRanking /> },
      { path: 'dashboard/cycle-ranking', element: <DSH005CycleRanking /> },
      { path: 'dashboard/energy-change-top', element: <DSH008EnergyChangeTopN /> },
      // Alert
      { path: 'alert/power-quality-stats', element: <ALT001PowerQualityStats /> },
      { path: 'alert/air-leak-stats', element: <ALT002AirLeakStats /> },
      { path: 'alert/cycle-anomaly-stats', element: <ALT003CycleAnomalyStats /> },
      { path: 'alert/power-quality-history', element: <ALT004PowerQualityHistory /> },
      { path: 'alert/air-leak-history', element: <ALT005AirLeakHistory /> },
      { path: 'alert/cycle-anomaly-history', element: <ALT006CycleAnomalyHistory /> },
      // Phase 2-③ 부대설비 알림 (ALT-007/008/009)
      { path: 'alert/hvac-fault',          element: <ALT007AuxAlert /> },
      { path: 'alert/light-fault',         element: <ALT007AuxAlert /> },
      { path: 'alert/interlock-violation', element: <ALT007AuxAlert /> },
      // Analysis
      { path: 'analysis/comparison', element: <ANL001Comparison /> },
      { path: 'analysis/detailed-comparison', element: <ANL002DetailedComparison /> },
      { path: 'analysis/air-detailed-comparison', element: <ANL006AirDetailedComparison /> },
      { path: 'analysis/period-power', element: <ANL007PeriodPowerComparison /> },
      { path: 'analysis/period-air', element: <ANL008PeriodAirComparison /> },
      { path: 'analysis/adv-power-comparison', element: <ANL009AdvPowerComparison /> },
      { path: 'analysis/adv-air-comparison', element: <ANL010AdvAirComparison /> },
      { path: 'analysis/cycle-single', element: <ANL011CycleSingleAnalysis /> },
      { path: 'analysis/cycle', element: <ANL003CycleAnalysis /> },
      { path: 'analysis/cycle-delay', element: <ANL004CycleDelay /> },
      { path: 'analysis/power-quality', element: <ANL005PowerQualityAnalysis /> },
      // Settings
      { path: 'settings/factory', element: <SET008FactoryManagement /> },
      { path: 'settings/line', element: <SET009LineSettings /> },
      { path: 'settings/facility-master', element: <SET007FacilityMaster /> },
      { path: 'settings/facility-type', element: <SET011FacilityTypeManagement /> },
      { path: 'settings/tag', element: <SET012TagMaster /> },
      { path: 'settings/hierarchy', element: <SET013TagHierarchy /> },
      { path: 'settings/energy-config', element: <SET014EnergySourceConfig /> },
      { path: 'settings/power-quality', element: <SET001PowerQuality /> },
      { path: 'settings/air-leak', element: <SET002AirLeak /> },
      { path: 'settings/reference-cycle', element: <SET003ReferenceCycle /> },
      { path: 'settings/cycle-alert', element: <SET004CycleAlert /> },
      { path: 'settings/energy-alert', element: <SET005EnergyAlert /> },
      { path: 'settings/cycle-energy-alert', element: <SET006CycleEnergyAlert /> },
      { path: 'settings/system', element: <SET015SystemSettings /> },
      // 부대설비(Auxiliary) 설정 — 설정 GNB로 이전
      { path: "aux/hvac/overview",     element: <AuxHvacOverview /> },
      { path: "aux/lighting/overview", element: <AuxLightingOverview /> },
      { path: "aux/control-history",   element: <AuxControlHistory /> },
      // 부대설비 설정 — 설정 GNB로 이전
      { path: "settings/aux-zones",          element: <AuxZoneMaster /> },
      { path: "settings/aux-schedule-rules", element: <AuxScheduleRules /> },
      { path: "settings/aux-lux-standards",  element: <AuxLuxStandards /> },
      // 구 경로 리다이렉트 (북마크 호환)
      { path: "aux/zones",          element: <Navigate to="/settings/aux-zones" replace /> },
      { path: "aux/schedule-rules", element: <Navigate to="/settings/aux-schedule-rules" replace /> },
      { path: "aux/lux-standards",  element: <Navigate to="/settings/aux-lux-standards" replace /> },
    ],
  },
]);

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
