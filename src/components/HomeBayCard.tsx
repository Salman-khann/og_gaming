'use client';
import { useState, type ReactNode } from 'react';
import { BayDetailsDialog } from './BayDetailsDialog';
import type { BayDetails } from '@/lib/home-bays';

export function HomeBayCard({
  bay,
  contactUrl,
  className,
  children,
}: {
  bay: BayDetails;
  contactUrl: string;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        style={{ textAlign: 'left' }}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <BayDetailsDialog
        bay={open ? bay : null}
        contactUrl={contactUrl}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
