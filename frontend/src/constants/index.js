import {
  LayoutDashboard,
  CalendarClock,
  Send,
  PenSquare,
  Settings,
  Activity,
} from "lucide-react";

export const NAV_ITEMS = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard, end: true },
  { label: "Scheduled", to: "/dashboard/scheduled", icon: CalendarClock },
  { label: "Sent", to: "/dashboard/sent", icon: Send },
  { label: "Compose", to: "/dashboard/compose", icon: PenSquare },
  { label: "Queue Monitor", to: "/dashboard/queue", icon: Activity },
  { label: "Settings", to: "/dashboard/settings", icon: Settings },
];

export const STATUS_META = {
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    dot: "bg-blue-500",
  },
  processing: {
    label: "Processing",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "bg-amber-500",
  },
  sent: {
    label: "Sent",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    dot: "bg-rose-500",
  },
};

export const DEFAULTS = {
  delayMs: 2000,
  hourlyLimit: 200,
};
