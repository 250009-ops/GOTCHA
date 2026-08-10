import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { AuthShell } from '../components/AuthShell';
import { api, clearTokens } from '../lib/api';
import { MARKETING_URL } from '../lib/links';

/** Set a new password from the emailed token (`?token=`). */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [missingToken] = useState(!token);

  useEffect(() => {
    clearTokens();
  }, []);

  const goHome = () => {
    window.location.assign(MARKETING_URL);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error('Reset link is missing or invalid');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
      toast.success('Password updated — you can sign in now');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full max-w-[448px] min-w-0">
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 flex flex-col gap-5 shadow-[0_18px_20px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)]">
          {done ? (
            <>
              <div className="flex flex-col gap-1.5 text-center">
                <div className="flex justify-center mb-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-extrabold text-[#101828] leading-8">Password updated</h2>
                <p className="text-[#6b7280] text-sm leading-5">
                  Your password has been changed. Sign in with your new password to continue.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full h-11 rounded-[14px] bg-[#7f22fe] hover:bg-[#6b1fd8] font-bold text-sm shadow-[0_10px_12px_rgba(127,34,254,0.2)]"
              >
                Sign in
              </Button>
            </>
          ) : missingToken ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-extrabold text-[#101828] leading-8">Link invalid</h2>
                <p className="text-[#6b7280] text-sm leading-5">
                  This reset link is missing or incomplete. Request a new one from the forgot password
                  page.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="w-full h-11 rounded-[14px] bg-[#7f22fe] hover:bg-[#6b1fd8] font-bold text-sm shadow-[0_10px_12px_rgba(127,34,254,0.2)]"
              >
                Reset password
              </Button>
              <div className="flex items-center justify-between text-[13px] whitespace-nowrap">
                <span className="text-[#6b7280]">Already have an account?</span>
                <Link to="/login" className="text-[#7f22fe] font-bold hover:text-[#6b1fd8]">
                  Sign in
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-extrabold text-[#101828] leading-8">Choose a new password</h2>
                <p className="text-[#6b7280] text-sm leading-5">
                  Enter a new password for your GOTCHA account. Use at least 8 characters.
                </p>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#4a5565]">New password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="w-full h-11 pl-3.5 pr-11 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#7f22fe]/20 focus:border-[#7f22fe] focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9ca3af] hover:text-[#4a5565]"
                      aria-label={showPass ? 'Hide password' : 'Show password'}
                    >
                      {showPass ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-[#4a5565]">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat your new password"
                      autoComplete="new-password"
                      className="w-full h-11 pl-3.5 pr-11 bg-[#f9fafb] border border-[#e5e7eb] rounded-[14px] text-sm text-[#101828] placeholder:text-[#9ca3af] outline-none focus:ring-2 focus:ring-[#7f22fe]/20 focus:border-[#7f22fe] focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9ca3af] hover:text-[#4a5565]"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? (
                        <EyeOff className="w-[18px] h-[18px]" />
                      ) : (
                        <Eye className="w-[18px] h-[18px]" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-[14px] bg-[#7f22fe] hover:bg-[#6b1fd8] font-bold text-sm shadow-[0_10px_12px_rgba(127,34,254,0.2)]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    'Update password'
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
          )}
        </div>
      </div>
    </AuthShell>
  );
}
