// Pricing is driven by three usage dimensions the customer controls:
// posts per month, team seats, and media storage. Social channel count scales with the plan.

export type PlanId = "free" | "starter" | "growth" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number; // USD
  tagline: string;
  limits: {
    postsPerMonth: number; // one post published to one channel = 1
    seats: number; // members + pending invitations
    socialAccounts: number;
    storageMb: number;
    scheduleAheadDays: number;
  };
  features: string[];
  approvalWorkflow: boolean;
  highlighted?: boolean;
}

export const UNLIMITED = Number.MAX_SAFE_INTEGER;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    tagline: "Try it out with a few channels",
    limits: { postsPerMonth: 30, seats: 1, socialAccounts: 3, storageMb: 500, scheduleAheadDays: 30 },
    features: ["3 social channels", "30 posts / month", "1 user", "500 MB media storage", "Schedule up to 30 days ahead"],
    approvalWorkflow: false,
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthly: 19,
    tagline: "For small businesses",
    limits: { postsPerMonth: 300, seats: 3, socialAccounts: 10, storageMb: 5_000, scheduleAheadDays: 180 },
    features: ["10 social channels", "300 posts / month", "3 team members", "5 GB media storage", "Schedule 6 months ahead"],
    approvalWorkflow: false,
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceMonthly: 49,
    tagline: "For growing teams",
    limits: { postsPerMonth: 1_500, seats: 10, socialAccounts: 25, storageMb: 25_000, scheduleAheadDays: 365 },
    features: ["25 social channels", "1,500 posts / month", "10 team members", "25 GB media storage", "Approval workflow", "Per-channel access control"],
    approvalWorkflow: true,
    highlighted: true,
  },
  business: {
    id: "business",
    name: "Business",
    priceMonthly: 129,
    tagline: "For agencies & large teams",
    limits: { postsPerMonth: UNLIMITED, seats: 50, socialAccounts: 100, storageMb: 100_000, scheduleAheadDays: 730 },
    features: ["100 social channels", "Unlimited posts", "50 team members", "100 GB media storage", "Approval workflow", "Audit log", "Priority support"],
    approvalWorkflow: true,
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "growth", "business"];

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"];
}

export function formatLimit(n: number): string {
  return n >= UNLIMITED ? "Unlimited" : n.toLocaleString("en-US");
}
