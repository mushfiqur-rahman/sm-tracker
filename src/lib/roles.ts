export const ROLES = ["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  OWNER: { label: "Owner", description: "Full access, including billing and deleting the workspace." },
  ADMIN: { label: "Admin", description: "Manage team, social channels and all posts." },
  EDITOR: { label: "Editor", description: "Create, schedule and publish posts on assigned channels." },
  CONTRIBUTOR: { label: "Contributor", description: "Draft posts; an admin or editor must approve before they go out." },
  VIEWER: { label: "Viewer", description: "Read-only access to the calendar and posts." },
};

export type Permission =
  | "billing.manage"
  | "team.manage"
  | "accounts.manage"
  | "posts.create"
  | "posts.publish" // schedule/publish without approval
  | "posts.approve"
  | "posts.editAll"
  | "settings.manage"
  | "audit.view";

const MATRIX: Record<Role, Permission[]> = {
  OWNER: ["billing.manage", "team.manage", "accounts.manage", "posts.create", "posts.publish", "posts.approve", "posts.editAll", "settings.manage", "audit.view"],
  ADMIN: ["team.manage", "accounts.manage", "posts.create", "posts.publish", "posts.approve", "posts.editAll", "settings.manage", "audit.view"],
  EDITOR: ["posts.create", "posts.publish", "posts.approve"],
  CONTRIBUTOR: ["posts.create"],
  VIEWER: [],
};

export function can(role: string, permission: Permission): boolean {
  return (MATRIX[role as Role] ?? []).includes(permission);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Roles a member with `role` is allowed to grant. Only owners can create admins. */
export function assignableRoles(role: string): Role[] {
  if (role === "OWNER") return ["ADMIN", "EDITOR", "CONTRIBUTOR", "VIEWER"];
  if (role === "ADMIN") return ["EDITOR", "CONTRIBUTOR", "VIEWER"];
  return [];
}

/** Owners/admins always see every channel; other roles may be restricted by assignment. */
export function isRestrictable(role: string): boolean {
  return role === "EDITOR" || role === "CONTRIBUTOR" || role === "VIEWER";
}
