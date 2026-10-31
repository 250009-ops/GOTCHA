/** P3c: reports must be reviewed within 24 h of filing. */
export const REPORT_SLA_HOURS = 24;
export type SlaState = 'ok' | 'due-soon' | 'overdue' | 'closed';

export function reportAgeHours(createdAt: string | Date, now = new Date()): number {
  return Math.max(0, (now.getTime() - new Date(createdAt).getTime()) / 3_600_000);
}

export function slaState(r: { createdAt: string | Date; status: string }, now = new Date()): SlaState {
  if (r.status !== 'open') return 'closed';
  const h = reportAgeHours(r.createdAt, now);
  if (h >= REPORT_SLA_HOURS) return 'overdue';
  if (h >= REPORT_SLA_HOURS - 4) return 'due-soon';
  return 'ok';
}

export function formatAge(createdAt: string | Date, now = new Date()): string {
  const h = reportAgeHours(createdAt, now);
  if (h < 1) return `${Math.floor(h * 60)} min`;
  if (h < 48) return `${Math.floor(h)} h`;
  return `${Math.floor(h / 24)} d`;
}
