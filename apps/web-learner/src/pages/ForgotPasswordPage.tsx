import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { AuthShell } from '../components/AuthShell';
import { api, clearTokens } from '../lib/api';
import { MARKETING_URL } from '../lib/links';

/** Figma 187:8 — Reset password request (email → send link). */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    clearTokens();
  }, []);

  const goHome = () => {
    window.location.assign(MARKETING_URL);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
      toast.success('Check your inbox for a reset link');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send reset link');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      toast.success('Reset email sent again — check your inbox');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not resend email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full max-w-[448px] min-w-0">
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 flex flex-col gap-5 shadow-[0_18px_20px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)]">
          {!sent ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-extrabold text-[#101828] leading-8">Reset password</h2>
                <p className="text-[#6b7280] text-sm leading-5">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#4a5565]">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full h-11 px-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#7f22fe]/20 focus:border-[#7f22fe] focus:bg-white transition-all"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-[14px] bg-[#7f22fe] hover:bg-[#6b1fd8] font-bold text-sm shadow-[0_10px_12px_rgba(127,34,254,0.2)]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending…
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-between text-[13px] whitespace-nowrap">
                <span className="text-[#6b7280]">Already have an account?</span>
                <Link to="/login" className="text-[#7f22fe] font-bold hover:text-[#6b1fd8]">
                  Sign in
                </Link>
              </div>

              <button
                type="button"
                onClick={goHome}
                className="flex items-center justify-center gap-2 text-[13px] text-[#9ca3af] hover:text-[#4a5565] w-full"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to homepage
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 text-center">
                <h2 className="text-2xl font-extrabold text-[#101828] leading-8">Check your email</h2>
                <p className="text-[#6b7280] text-sm leading-5">
                  If an account exists for that address, we sent a password reset link. It expires in 1
                  hour.
                </p>
              </div>

              <div className="flex justify-center py-2">
                <div className="flex items-center justify-center size-16 rounded-2xl bg-[#f3f0ff] text-[#7f22fe]">
                  <Mail className="w-8 h-8" />
                </div>
              </div>

              {email && (
                <div className="flex w-full items-center gap-2.5 rounded-[14px] border border-[#e5e7eb] bg-[#f3f4f6] px-4 py-3">
                  <span className="text-sm font-bold text-[#101828] truncate">{email}</span>
                </div>
              )}

              <Button
                type="button"
                onClick={() => {
                  window.location.href = 'mailto:';
                }}
                className="w-full h-11 rounded-[14px] bg-[#7f22fe] hover:bg-[#6b1fd8] font-bold text-sm shadow-[0_10px_12px_rgba(127,34,254,0.2)]"
              >
                Open Email App
              </Button>

              <p className="text-sm text-center text-[#6b7280]">
                Didn&apos;t receive it?{' '}
                <button
                  type="button"
                  onClick={() => void resend()}
                  disabled={loading}
                  className="text-[#7f22fe] font-semibold underline underline-offset-2 disabled:opacity-60"
                >
                  {loading ? 'Sending…' : 'Resend email'}
                </button>
              </p>

              <div className="flex items-center justify-between text-[13px] whitespace-nowrap">
                <span className="text-[#6b7280]">Already have an account?</span>
                <Link to="/login" className="text-[#7f22fe] font-bold hover:text-[#6b1fd8]">
                  Sign in
                </Link>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  navigate('/forgot-password');
                }}
                className="flex items-center justify-center gap-2 text-[13px] text-[#9ca3af] hover:text-[#4a5565] w-full"
              >
                <ArrowLeft className="w-4 h-4" />
                Use a different email
              </button>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
