import React from 'react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn('ui-input', className)} {...props} />
));

Input.displayName = 'Input';

export { Input };
