import { Link } from 'react-router-dom';
import { GotchaLogo } from './GotchaLogo';

/** Marketing-site brand link — renders the canonical learner-panel logo (see packages/shared/brand). */
export function Brand({ light = false, size = 'md' }: { light?: boolean; size?: 'sm' | 'md' }) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="GOTCHA">
      <GotchaLogo size={size === 'sm' ? 24 : 28} tone={light ? 'light' : 'ink'} />
    </Link>
  );
}
