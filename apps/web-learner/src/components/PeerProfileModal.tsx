import { useEffect, useState } from 'react';
import { BookOpen, Brain, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';
import { chatLangName, normalizeChatLang } from '../lib/chatLang';
import { useLearnerCopy } from '../lib/learnerLocaleContext';
import { resolveMediaUrl } from '../lib/media';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';
import { UserAvatar } from './UserAvatar';

export type MessagingPeerProfile = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  nativeLanguage?: string | null;
  primaryLanguage?: string | null;
  targetLanguages: Array<{
    language?: string | null;
    cefrLevel?: string | null;
    isPrimary?: boolean;
  }>;
  createdAt?: string | null;
  stats?: {
    booksRead: number;
    wordsLearned: number;
    chats: number;
  } | null;
  currentlyReading?: {
    id?: string | null;
    title?: string | null;
    coverImageKey?: string | null;
    language?: string | null;
    progressPct?: number | null;
  } | null;
  reading?: {
    id?: string | null;
    title?: string | null;
  } | null;
  sharedReadingsNote?: string | null;
};

function formatMemberSince(iso: string | undefined | null, memberSince: (date: string) => string) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return memberSince(formatted);
}

function cefrDisplay(level: string, copy: ReturnType<typeof useLearnerCopy>['peerProfile']) {
  if (level.toLowerCase() === 'native') return copy.native;
  const code = level.toUpperCase().slice(0, 2);
  if (code.startsWith('C')) return `${code} ${copy.proficient}`;
  if (code.startsWith('B')) return `${code} ${copy.intermediate}`;
  if (code.startsWith('A')) return `${code} ${copy.basic}`;
  return level;
}

function langChip(code?: string | null) {
  const c = normalizeChatLang(code);
  const styles: Record<string, string> = {
    RU: 'bg-g-blue-100 text-g-blue-700',
    EN: 'bg-g-info-surface text-g-info-text',
    UZ: 'bg-[#ecfdf5] text-[#047857]',
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${styles[c] ?? 'bg-gray-100 text-gray-600'}`}>
      {c}
    </span>
  );
}

export function PeerProfileModal({
  peerId,
  onClose,
  onMessage,
}: {
  peerId: string | null;
  onClose: () => void;
  onMessage: (peer: MessagingPeerProfile) => void | Promise<void>;
}) {
  const copy = useLearnerCopy();
  const pp = copy.peerProfile;
  const [peer, setPeer] = useState<MessagingPeerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!peerId) {
      setPeer(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<MessagingPeerProfile>(`/messaging/peers/${peerId}`)
      .then((data) => {
        if (!cancelled) setPeer(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : copy.commonExt.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [peerId, copy.commonExt.error]);

  const firstName = peer?.displayName?.split(' ')[0] || 'learner';
  const langs = [
    ...(peer?.nativeLanguage ? [[peer.nativeLanguage, pp.native] as const] : []),
    ...(peer?.targetLanguages ?? []).map(
      (t) => [t.language ?? 'en', (t.cefrLevel ?? 'A1').toUpperCase()] as const,
    ),
  ]
    .filter((row, i, all) => all.findIndex((other) => other[0] === row[0]) === i)
    .slice(0, 3);

  const memberSince = formatMemberSince(peer?.createdAt, pp.memberSince);

  return (
    <Dialog open={!!peerId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogHeader onClose={onClose}>{pp.title}</DialogHeader>
      <DialogContent className="pt-4">
        {loading && !peer ? (
          <p className="text-sm text-[#99a1af] text-center py-8">{pp.loading}</p>
        ) : error && !peer ? (
          <p className="text-sm text-red-500 text-center py-8">{error}</p>
        ) : peer ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full ring-[3px] ring-g-blue-700 p-[2px]">
              <UserAvatar name={peer.displayName} url={peer.avatarUrl} size={80} />
            </div>
            <div className="text-center">
              <div className="text-xl font-extrabold text-gray-900">{peer.displayName}</div>
              <div className="text-sm text-[#6a7282]">{peer.handle}</div>
              {memberSince && (
                <div className="text-xs text-[#99a1af] mt-1">{memberSince}</div>
              )}
            </div>

            <button
              type="button"
              disabled={starting}
              onClick={() => {
                setStarting(true);
                void Promise.resolve(onMessage(peer)).finally(() => setStarting(false));
              }}
              className="w-full h-11 rounded-xl bg-g-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#5b07c4] disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" />
              {pp.message(firstName)}
            </button>

            <div className="grid grid-cols-3 gap-2 w-full">
              {[
                { value: peer.stats?.booksRead ?? 0, label: pp.booksRead, Icon: BookOpen },
                { value: peer.stats?.wordsLearned ?? 0, label: pp.wordsLearned, Icon: Brain },
                { value: peer.stats?.chats ?? 0, label: pp.chats, Icon: MessageSquare },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-[#e5e7eb] bg-white px-2 py-3 text-center"
                >
                  <stat.Icon className="w-4 h-4 text-g-blue-700 mx-auto mb-1" />
                  <div className="text-base font-extrabold text-gray-900">{stat.value}</div>
                  <div className="text-[11px] text-[#6a7282]">{stat.label}</div>
                </div>
              ))}
            </div>

            {langs.length > 0 && (
              <div className="w-full">
                <div className="text-sm font-bold text-gray-900 mb-2">{pp.languages}</div>
                <div className="grid grid-cols-3 gap-2">
                  {langs.map(([code, level]) => (
                    <div key={code} className="rounded-xl border border-[#e5e7eb] bg-white p-3">
                      {langChip(code)}
                      <div className="text-sm font-bold text-gray-900 mt-2">{chatLangName(code)}</div>
                      <div className="text-[11px] text-[#6a7282]">{cefrDisplay(level, pp)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {peer.currentlyReading && (
              <div className="w-full">
                <div className="text-sm font-bold text-gray-900 mb-2">{pp.currentlyReading}</div>
                <div className="rounded-2xl border border-[#e5e7eb] bg-white p-3">
                  <div className="flex gap-3 items-center">
                    {resolveMediaUrl(peer.currentlyReading.coverImageKey) ? (
                      <img
                        src={resolveMediaUrl(peer.currentlyReading.coverImageKey) ?? ''}
                        alt=""
                        className="w-[42px] h-[58px] rounded-lg object-cover bg-g-blue-700"
                      />
                    ) : (
                      <div className="w-[42px] h-[58px] rounded-lg bg-g-blue-700 text-white/70 text-sm font-bold flex items-center justify-center">
                        G
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        {langChip(peer.currentlyReading.language)}
                        <span className="text-xs text-[#99a1af]">
                          {pp.percentRead(Math.round(peer.currentlyReading.progressPct ?? 0))}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-gray-900 mt-1 truncate">
                        {peer.currentlyReading.title}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#e5e7eb] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-g-blue-700"
                      style={{
                        width: `${Math.min(100, Math.max(0, peer.currentlyReading.progressPct ?? 0))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {peer.sharedReadingsNote && (
              <p className="w-full rounded-xl bg-[#f4efff] text-g-blue-700 text-sm font-semibold p-3">
                {peer.sharedReadingsNote}
              </p>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
