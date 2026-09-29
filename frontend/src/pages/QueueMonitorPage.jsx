import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ExternalLink, Clock, Play, Timer, CheckCircle2, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/common/StatCard";
import { ErrorState } from "@/components/common/ErrorState";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { emailService } from "@/services/emailService";
import { formatNumber } from "@/utils/format";
import { API_BASE } from "@/lib/apiClient";

export default function QueueMonitorPage() {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await emailService.getQueueHealth();
      setCounts(res.counts);
    } catch (_e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const cards = counts
    ? [
        { label: "Waiting", value: formatNumber(counts.waiting), icon: Clock, accent: "bg-slate-100 text-slate-600", testId: "queue-waiting" },
        { label: "Active", value: formatNumber(counts.active), icon: Play, accent: "bg-blue-50 text-blue-600", testId: "queue-active" },
        { label: "Delayed", value: formatNumber(counts.delayed), icon: Timer, accent: "bg-amber-50 text-amber-600", testId: "queue-delayed" },
        { label: "Completed", value: formatNumber(counts.completed), icon: CheckCircle2, accent: "bg-emerald-50 text-emerald-600", testId: "queue-completed" },
        { label: "Failed", value: formatNumber(counts.failed), icon: XCircle, accent: "bg-rose-50 text-rose-600", testId: "queue-failed" },
      ]
    : [];

  return (
    <DashboardLayout title="Queue Monitor">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Queue Monitor</h2>
          <p className="text-sm text-muted-foreground">
            Live BullMQ <code className="font-mono">email-send-queue</code> state · auto-refreshes every 5s.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={load} data-testid="queue-refresh">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <a href={`${API_BASE}/admin/queues`} target="_blank" rel="noreferrer">
            <Button className="gap-2" data-testid="open-bullboard">
              Bull Board <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>

      <div className="mt-6">
        {loading && !counts ? (
          <TableSkeleton rows={2} cols={5} />
        ) : error ? (
          <ErrorState onRetry={load} description="Could not reach the queue." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((c) => (
              <StatCard key={c.label} {...c} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-accent/40 p-5 text-sm text-muted-foreground">
        <p className="font-semibold text-accent-foreground">About the queue</p>
        <p className="mt-1">
          Scheduling uses BullMQ delayed jobs backed by Redis — no cron, no timers. Delayed jobs
          persist across restarts. The Bull Board dashboard is protected by basic auth
          (default <code className="font-mono">admin</code>).
        </p>
      </div>
    </DashboardLayout>
  );
}
