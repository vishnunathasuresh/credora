'use client';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { MenuIcon } from './icons';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

type MobileNavigationProps = { mode?: 'public' | 'workspace' };

export function MobileNavigation({ mode = 'public' }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const links =
    mode === 'workspace'
      ? ([
          ['/profile', 'My profile'],
          ['/credentials', 'My credentials'],
          ['/dashboard', 'Workspace home'],
          ['/settings/wallets', 'Linked wallets'],
          ['/org', 'Organization'],
          ['/issuer', 'Issue credentials'],
          ['/verify', 'Verify a credential'],
        ] as const)
      : ([
          ['/join', 'Create a profile'],
          ['/verify', 'Verify a credential'],
          ['/credentials', 'My credentials'],
        ] as const);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="mobile-menu-trigger" aria-label="Open menu">
          <MenuIcon /> Menu
        </Button>
      </DialogTrigger>
      <DialogContent className="mobile-nav-sheet">
        <DialogHeader>
          <DialogTitle>{mode === 'workspace' ? 'Your workspace' : 'Explore Credora'}</DialogTitle>
          <DialogDescription>
            {mode === 'workspace'
              ? 'Go to your profile, credentials or workspace.'
              : 'Build a profile or check a credential.'}
          </DialogDescription>
        </DialogHeader>
        <nav className="mobile-menu-links" aria-label="Mobile navigation">
          {links.map(([href, label]) => (
            <Link className="mobile-menu-link" key={href} to={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
