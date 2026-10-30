import { useState } from 'react';
import { resolveMediaUrl } from '../lib/media';
import { cn, initials } from '../lib/utils';

export function AdminAvatar({
  name,
  email,
  url,
  size = 40,
  className,
}: {
  name?: string | null;
  email?: string | null;
  url?: string | null;
  size?: number;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const resolved = resolveMediaUrl(url);
  const showPhoto = Boolean(resolved) && failedUrl !== resolved;
  const label = initials(name, email ?? undefined);

  return (
    <div
      className={cn(
        'rounded-full overflow-hidden shrink-0 grid place-items-center text-white font-bold',
        !showPhoto && 'bg-g-blue-700',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.35)),
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
        label
      )}
    </div>
  );
}
