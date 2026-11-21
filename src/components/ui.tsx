import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand-hover shadow-sm",
  secondary: "bg-surface text-fg border border-border hover:bg-muted",
  ghost: "text-subtle hover:text-fg hover:bg-muted",
  danger: "bg-danger text-white hover:opacity-90",
};
const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-base" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary", size = "md", className, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary", size = "md", className, ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

const field =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-subtle/70 outline-none transition focus:border-brand focus:ring-2 focus:ring-ring/30 disabled:opacity-60";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, "h-10 pe-8", className)} {...props} />;
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-fg", className)} {...props} />;
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-border bg-surface", className)} {...props} />;
}

export function CardHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const tones = {
  neutral: "bg-muted text-subtle",
  brand: "bg-brand-soft text-brand",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)} {...props} />;
}

export function Alert({ tone = "danger", children }: { tone?: Tone; children: React.ReactNode }) {
  return <div role="alert" className={cn("rounded-lg px-3 py-2.5 text-sm", tones[tone])}>{children}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-full bg-muted p-3 text-subtle">{icon}</div>}
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-subtle">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const POST_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warn",
  SCHEDULED: "brand",
  PUBLISHING: "brand",
  PUBLISHED: "ok",
  PARTIAL: "warn",
  FAILED: "danger",
  PENDING: "brand",
  CANCELLED: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status === "PENDING_APPROVAL" ? "Needs approval" : status.charAt(0) + status.slice(1).toLowerCase();
  return <Badge tone={POST_STATUS_TONE[status] ?? "neutral"}>{label}</Badge>;
}
