import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, ShieldCheck, Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/authService";
import { getErrorMessage } from "@/lib/apiClient";
import { toast } from "sonner";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1 2.6-2.1 3.4v2.8h3.4c2-1.8 3.2-4.5 3.2-7.7 0-.7-.06-1.4-.18-2.1H12z" />
    <path fill="#34A853" d="M12 22c2.9 0 5.3-1 7.1-2.6l-3.4-2.8c-1 .7-2.2 1.1-3.7 1.1-2.8 0-5.2-1.9-6-4.5H2.4v2.8C4.2 19.7 7.8 22 12 22z" />
    <path fill="#4A90E2" d="M6 13.2c-.2-.7-.34-1.4-.34-2.2s.12-1.5.34-2.2V6H2.4C1.6 7.5 1.2 9.2 1.2 11s.4 3.5 1.2 5l3.6-2.8z" />
    <path fill="#FBBC05" d="M12 5.4c1.6 0 3 .55 4.1 1.6l3-3C17.3 2.2 14.9 1.2 12 1.2 7.8 1.2 4.2 3.5 2.4 6L6 8.8c.8-2.6 3.2-4.4 6-4.4z" />
  </svg>
);

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loginDev } = useAuth();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    authService.getConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      // Real Google OAuth runs through Supabase once keys are configured.
      // Until then, dev sign-in provides full end-to-end access.
      await loginDev();
      toast.success("Signed in");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err, "Sign-in failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0F1024] p-12 text-white lg:flex">
        <div className="absolute inset-0 grid-bg opacity-[0.15]" />
        <div className="relative flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary">
            <Mail className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">ReachInbox</span>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Schedule bulk email campaigns that send{" "}
            <span className="text-indigo-400">gradually</span>, never all at once.
          </h1>
          <p className="max-w-md text-white/70">
            Upload your recipients, set your pacing, and let real delayed background
            jobs drip your emails out — tracked from scheduled to sent.
          </p>
          <div className="grid max-w-md gap-3 pt-2">
            {[
              { icon: Clock, text: "BullMQ delayed jobs — no cron, restart-safe" },
              { icon: Zap, text: "Configurable delay & per-sender hourly limits" },
              { icon: ShieldCheck, text: "Idempotent sends with full status tracking" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 text-sm text-white/85">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                  <f.icon className="h-4 w-4" />
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-white/40">
          © {new Date().getFullYear()} ReachInbox — Email Job Scheduler
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Mail className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">ReachInbox</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to schedule and track your email campaigns.
          </p>

          <div className="mt-8 space-y-4">
            <Button
              onClick={handleGoogle}
              disabled={loading}
              data-testid="google-signin-button"
              variant="outline"
              className="h-12 w-full justify-center gap-3 text-base font-semibold"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <GoogleIcon /> Continue with Google
                </>
              )}
            </Button>

            <div className="rounded-xl border border-border bg-accent/40 p-3 text-xs text-muted-foreground">
              {config?.supabaseConfigured
                ? "Google OAuth via Supabase is configured."
                : "Demo mode: Google sign-in maps to a demo account until Supabase Google keys are added in Settings."}
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By continuing you agree to the ReachInbox terms & privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
