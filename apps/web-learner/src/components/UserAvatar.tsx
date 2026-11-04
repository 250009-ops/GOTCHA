import { useEffect, useState } from 'react';
import { getAccessToken } from '../lib/api';
import { resolveMediaUrl } from '../lib/media';
import { avatarInitials } from '../lib/types';
import { cn } from './ui/utils';

export function UserAvatar({
  name,
  url,
  size = 32,
  className,
  online,
}: {
  name?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
  online?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const resolved = resolveMediaUrl(url);
  const signed = Boolean(resolved && /[?&]sig=/.test(resolved));
  const authed = Boolean(resolved && resolved.includes('/users/avatars/') && !signed);
  useEffect(() => {
    if (!authed || !resolved) {
      setBlobUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl = '';
    const token = getAccessToken();
    void fetch(resolved, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error('avatar');
        return res.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailedUrl(resolved);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [authed, resolved]);
  const initials = avatarInitials(name?.trim() || '?');
  const showPhoto = Boolean(resolved) && failedUrl !== resolved && (!authed || Boolean(blobUrl));
  const dot = Math.max(8, Math.round(size * 0.28));

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <div
        className="rounded-full overflow-hidden w-full h-full flex items-center justify-center text-g-on-cta font-bold"
        style={{
          fontSize: Math.max(10, Math.round(size * 0.35)),
          backgroundImage: showPhoto ? undefined : 'linear-gradient(135deg, var(--g-blue-500) 0%, #2107AA 100%)',
          backgroundColor: showPhoto ? '#efe7ff' : undefined,
        }}
      >
        {showPhoto ? (
          <img
            src={authed ? blobUrl ?? undefined : resolved ?? undefined}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setFailedUrl(resolved)}
          />
        ) : (
          initials
        )}
      </div>
      {online ? (
        <span
          className="absolute bottom-0 right-0 rounded-full bg-[#22c55e] border-2 border-white"
          style={{ width: dot, height: dot }}
        />
      ) : null}
    </div>
  );
}
