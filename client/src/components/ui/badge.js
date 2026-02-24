import React from 'react';
import { cn } from '../../lib/utils';

function Badge({ className, variant = 'default', ...props }) {
  const variantClass = {
    default: 'ui-badge ui-badge-default',
    secondary: 'ui-badge ui-badge-secondary',
    outline: 'ui-badge ui-badge-outline',
  }[variant];

  return <span className={cn(variantClass, className)} {...props} />;
}

export { Badge };
