// A part of the page that is shown with other colors than the rest of it (previews in the settings)
import type { CSSProperties, ReactNode } from 'react';
import { scopedTheme, type ColorSettings } from '../lib/theme';

export const ThemeScope = ({
  colors,
  className,
  label,
  children,
}: {
  colors: ColorSettings;
  className?: string;
  label?: string;
  children: ReactNode;
}) => {
  const { classes, variables } = scopedTheme(colors);
  return (
    <div
      className={['theme-scope', className, ...classes].filter(Boolean).join(' ')}
      style={variables as CSSProperties}
      aria-label={label}
    >
      {children}
    </div>
  );
};
