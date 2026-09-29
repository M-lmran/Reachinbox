import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ComposeForm } from "@/components/email/ComposeForm";

export default function ComposePage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout title="Compose">
      <div className="mx-auto max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Compose New Email</h2>
          <p className="text-sm text-muted-foreground">
            Upload recipients and schedule a paced campaign.
          </p>
        </div>
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 surface-shadow">
          <ComposeForm
            onCancel={() => navigate("/dashboard")}
            onSuccess={() => navigate("/dashboard/scheduled")}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
