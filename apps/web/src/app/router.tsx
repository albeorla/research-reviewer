import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DefineScreen } from "@/features/define/DefineScreen";
import { EnrichScreen } from "@/features/enrich/EnrichScreen";
import { CollectScreen } from "@/features/collect/CollectScreen";
import { ReviewScreen } from "@/features/review/ReviewScreen";
import { DecideScreen } from "@/features/decide/DecideScreen";
import { ExportScreen } from "@/features/export/ExportScreen";
import { usePrelineAutoInit } from "@/lib/preline";

export function AppRoutes() {
  usePrelineAutoInit();
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/runs/new" replace />} />
        <Route path="/runs/new" element={<DefineScreen />} />
        <Route path="/runs/:runId" element={<RunRedirect />} />
        <Route path="/runs/:runId/define" element={<DefineScreen />} />
        <Route path="/runs/:runId/enrich" element={<EnrichScreen />} />
        <Route path="/runs/:runId/collect" element={<CollectScreen />} />
        <Route path="/runs/:runId/review" element={<ReviewScreen />} />
        <Route path="/runs/:runId/decide" element={<DecideScreen />} />
        <Route path="/runs/:runId/export" element={<ExportScreen />} />
        <Route path="*" element={<Navigate to="/runs/new" replace />} />
      </Route>
    </Routes>
  );
}

function RunRedirect() {
  return <Navigate to="enrich" replace />;
}
