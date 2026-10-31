import type { ReactNode } from 'react';

/** Figma Desktop — Landing Page (`8:2`) artboard / content max width. */
export const DESIGN_WIDTH = 1440;

/** Inner content column (1200) after 120px side insets on a 1440 artboard. */
export const CONTENT_WIDTH = 1200;

/**
 * Constrains page *content* to the Figma max width.
 * Header / footer stay full-bleed and use their own `.site-*-inner` caps.
 */
export function DesignFrame({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`design-frame ${className}`.trim()} style={{ maxWidth: DESIGN_WIDTH }}>
      {children}
    </div>
  );
}
