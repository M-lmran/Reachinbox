import { useState } from "react";
import { z } from "zod";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CsvUpload } from "@/components/email/CsvUpload";
import { emailService } from "@/services/emailService";
import { normalizeRecipients } from "@/utils/emailValidator";
import { getErrorMessage } from "@/lib/apiClient";
import { DEFAULTS } from "@/constants";
import { toast } from "sonner";

const schema = z.object({
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Body is required"),
  startTime: z.string().min(1, "Start time is required"),
  delaySeconds: z.coerce.number().min(0, "Delay must be 0 or more"),
  hourlyLimit: z.coerce.number().min(1, "Hourly limit must be at least 1"),
});

function defaultStart() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export function ComposeForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState({
    subject: "",
    body: "",
    startTime: defaultStart(),
    delaySeconds: DEFAULTS.delayMs / 1000,
    hourlyLimit: DEFAULTS.hourlyLimit,
  });
  const [csvResult, setCsvResult] = useState(null);
  const [pasted, setPasted] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const pastedRecipients = pasted.trim()
    ? normalizeRecipients(pasted.split(/[\s,;]+/))
    : null;

  const recipients = csvResult?.valid?.length
    ? csvResult.valid
    : pastedRecipients?.valid || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    const fieldErrors = {};
    if (!parsed.success) {
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        fieldErrors[k] = v?.[0];
      }
    }
    if (recipients.length === 0) {
      fieldErrors.recipients = "Add at least one valid recipient";
    }
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        subject: form.subject.trim(),
        body: form.body.trim(),
        startTime: new Date(form.startTime).toISOString(),
        delayMs: Number(form.delaySeconds) * 1000,
        hourlyLimit: Number(form.hourlyLimit),
        recipients,
      };
      const result = await emailService.scheduleEmail(payload);
      toast.success(`Scheduled ${result.jobsCreated} emails successfully`);
      onSuccess?.(result);
    } catch (err) {
      toast.error(getErrorMessage(err, "Unable to schedule emails. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="compose-form">
      <div className="space-y-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          data-testid="compose-subject"
          placeholder="AI Internship Opportunity"
          value={form.subject}
          onChange={(e) => set("subject", e.target.value)}
        />
        {errors.subject && <p className="text-xs text-rose-600">{errors.subject}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Body</Label>
        <Textarea
          id="body"
          data-testid="compose-body"
          rows={5}
          placeholder="Hi, we are hiring interns for our AI team…"
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
        />
        {errors.body && <p className="text-xs text-rose-600">{errors.body}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Recipients</Label>
          {recipients.length > 0 && (
            <span className="text-xs font-semibold text-emerald-600" data-testid="detected-count">
              {recipients.length} email addresses detected
            </span>
          )}
        </div>
        <CsvUpload result={csvResult} onParsed={setCsvResult} onClear={() => setCsvResult(null)} />
        {!csvResult && (
          <div className="space-y-1.5">
            <Textarea
              rows={2}
              data-testid="compose-paste-recipients"
              placeholder="…or paste emails separated by commas / new lines"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            {pastedRecipients && pasted.trim() && (
              <p className="text-xs text-muted-foreground">
                {pastedRecipients.valid.length} valid · {pastedRecipients.duplicatesRemoved} dupes ·{" "}
                {pastedRecipients.invalidIgnored} invalid
              </p>
            )}
          </div>
        )}
        {errors.recipients && <p className="text-xs text-rose-600">{errors.recipients}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="startTime">Start Time</Label>
          <Input
            id="startTime"
            type="datetime-local"
            data-testid="compose-start-time"
            value={form.startTime}
            onChange={(e) => set("startTime", e.target.value)}
          />
          {errors.startTime && <p className="text-xs text-rose-600">{errors.startTime}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delay">Delay (seconds)</Label>
          <Input
            id="delay"
            type="number"
            min={0}
            data-testid="compose-delay"
            value={form.delaySeconds}
            onChange={(e) => set("delaySeconds", e.target.value)}
          />
          {errors.delaySeconds && <p className="text-xs text-rose-600">{errors.delaySeconds}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hourly">Hourly Limit</Label>
          <Input
            id="hourly"
            type="number"
            min={1}
            data-testid="compose-hourly-limit"
            value={form.hourlyLimit}
            onChange={(e) => set("hourlyLimit", e.target.value)}
          />
          {errors.hourlyLimit && <p className="text-xs text-rose-600">{errors.hourlyLimit}</p>}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} data-testid="compose-cancel">
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting} data-testid="compose-submit">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scheduling…
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" /> Schedule Email
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
