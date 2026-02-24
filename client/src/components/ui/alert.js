import React from 'react';
import { cn } from '../../lib/utils';

function Alert({ className, variant = 'default', children, ...props }) {
  const variantClass = {
    default: 'ui-alert ui-alert-default',
    destructive: 'ui-alert ui-alert-destructive',
  }[variant];

  return (
    <div role='alert' className={cn(variantClass, className)} {...props}>
      {children}
    </div>
  );
}

function AlertTitle({ className, ...props }) {
  return <div className={cn('ui-alert-title', className)} {...props} />;
}

function AlertDescription({ className, ...props }) {
  return <div className={cn('ui-alert-description', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
