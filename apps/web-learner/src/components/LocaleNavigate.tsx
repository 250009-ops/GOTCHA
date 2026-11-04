import { Navigate, useLocation } from 'react-router-dom';
import { withLocaleParams } from '../lib/authRoutes';

/** <Navigate> that keeps ?lang / ?ui so a redirect never resets the visitor's language. */
export function LocaleNavigate({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={withLocaleParams(to, search)} replace />;
}
