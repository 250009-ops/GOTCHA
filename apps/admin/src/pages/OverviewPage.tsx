import AnalyticsPage from './AnalyticsPage';
import DashboardPage from './DashboardPage';

/** Lean admin "Overview" = the former Dashboard + Analytics pages on one screen (DESIGN-practice §9, area 1). */
export default function OverviewPage() {
  return (
    <div className="space-y-10">
      <DashboardPage />
      <AnalyticsPage embedded />
    </div>
  );
}
