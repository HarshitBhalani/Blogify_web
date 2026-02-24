import React from 'react';
import { cn } from '../../lib/utils';

function Dialog({ open, children }) {
  if (!open) return null;
  return <>{children}</>;
}

function DialogContent({ className, children, ...props }) {
  return (
    <div className='ui-dialog-overlay'>
      <div className={cn('ui-dialog-content', className)} {...props}>
        {children}
      </div>
    </div>
  );
}

function DialogHeader({ className, ...props }) {
  return <div className={cn('ui-dialog-header', className)} {...props} />;
}

function DialogTitle({ className, ...props }) {
  return <div className={cn('ui-dialog-title', className)} {...props} />;
}

function DialogDescription({ className, ...props }) {
  return <p className={cn('ui-dialog-description', className)} {...props} />;
}

function DialogFooter({ className, ...props }) {
  return <div className={cn('ui-dialog-footer', className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
