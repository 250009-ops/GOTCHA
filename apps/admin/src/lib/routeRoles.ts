/** final-5 A16: which admin roles may open each route (mirrors the API @Roles; the API still enforces). */
export type AdminRoleName = 'superadmin' | 'analyst' | 'editor' | 'moderator';
export const ROUTE_ROLES: Record<string, AdminRoleName[]> = {
  users: ['superadmin', 'analyst', 'moderator'],
  content: ['superadmin', 'editor'],
  'content/new': ['superadmin', 'editor'],
  'content/:id/edit': ['superadmin', 'editor'],
  'content/:directory': ['superadmin', 'editor', 'moderator'],
  languages: ['superadmin', 'editor', 'analyst'],
  'ai-usage': ['superadmin', 'analyst', 'editor'],
  gamification: ['superadmin', 'editor', 'analyst'],
  reports: ['superadmin', 'moderator'],
  notifications: ['superadmin', 'editor'],
  'import-pricing': ['superadmin', 'analyst', 'editor'],
  'import-pricing/:directory': ['superadmin', 'analyst', 'editor'],
  analytics: ['superadmin', 'analyst'],
  settings: ['superadmin'],
};
export const canOpen = (role: string | null | undefined, roles: readonly string[] | undefined) => Boolean(role && roles?.includes(role));
