export const PUSH_CAMPAIGN_CHANNELS = ['push', 'in_app'] as const;
export const CAMPAIGN_AUDIENCES = ['all', 'free', 'payg', 'active', 'new_users'] as const;

export type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[number];

export function normalizeCampaignAudience(raw: unknown): CampaignAudience {
  const key = String(raw ?? 'all').trim().toLowerCase();
  if (key === 'premium' || key === 'pro' || key === 'pay as you go') return 'payg';
  if ((CAMPAIGN_AUDIENCES as readonly string[]).includes(key)) return key as CampaignAudience;
  return 'all';
}

export function campaignAudienceMatches(
  audience: string,
  ctx: { createdAt: Date; hasPaidImport: boolean; isActive: boolean },
): boolean {
  switch (normalizeCampaignAudience(audience)) {
    case 'free':
      return !ctx.hasPaidImport;
    case 'payg':
      return ctx.hasPaidImport;
    case 'new_users':
      return ctx.createdAt.getTime() >= Date.now() - 14 * 86_400_000;
    case 'active':
      return ctx.isActive;
    default:
      return true;
  }
}
