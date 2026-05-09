import { Outlet, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  const { runId } = useParams();
  const runQuery = useQuery({
    queryKey: ["run", runId],
    queryFn: () => (runId ? api.getRun(runId) : Promise.resolve(null)),
    enabled: Boolean(runId),
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar run={runQuery.data ?? null} />
      <div className="flex flex-1 flex-col">
        <TopBar run={runQuery.data ?? null} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
