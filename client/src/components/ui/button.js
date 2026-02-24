import React from 'react';
import { cn } from '../../lib/utils';

const buttonVariants = {
  default: 'ui-button ui-button-default',
  secondary: 'ui-button ui-button-secondary',
  destructive: 'ui-button ui-button-destructive',
  outline: 'ui-button ui-button-outline',
  ghost: 'ui-button ui-button-ghost',
};

const buttonSizes = {
  default: 'ui-button-md',
  sm: 'ui-button-sm',
  lg: 'ui-button-lg',
  icon: 'ui-button-icon',
};

const Button = React.forwardRef(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    return (
      <button
        type={type}
        className={cn(buttonVariants[variant], buttonSizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
