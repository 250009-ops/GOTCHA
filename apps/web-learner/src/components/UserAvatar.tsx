import { useState } from 'react';
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
  const resolved = resolveMediaUrl(url);
  const initials = avatarInitials(name?.trim() || '?');
  const showPhoto = Boolean(resolved) && failedUrl !== resolved;
  const dot = Math.max(8, Math.round(size * 0.28));

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <div
        className="rounded-full overflow-hidden w-full h-full flex items-center justify-center text-white font-bold"
        style={{
          fontSize: Math.max(10, Math.round(size * 0.35)),
          backgroundImage: showPhoto ? undefined : 'linear-gradient(135deg, #8e51ff 0%, #432dd7 100%)',
          backgroundColor: showPhoto ? '#efe7ff' : undefined,
        }}
      >
        {showPhoto ? (
          <img
            src={resolved ?? undefined}
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
