import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LEARNER_APP_URL } from '../lib/links';
import { referralCapture } from '../lib/referralCapture';

/** Public /r/:code. Sets the referral cookie and redirects. No page of its own. */
export default function ReferralCapturePage() {
  const { code = '' } = useParams();
  useEffect(() => {
    const next = referralCapture(code, `${LEARNER_APP_URL}/register`);
    if (!next) {
      window.location.replace(`${LEARNER_APP_URL}/register`);
      return;
    }
    document.cookie = next.cookie;
    window.location.replace(next.location);
  }, [code]);
  return null;
}
