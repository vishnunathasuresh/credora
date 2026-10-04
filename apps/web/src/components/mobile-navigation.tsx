'use client';
import { useState } from 'react';
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

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="mobile-menu-trigger" aria-label="Open navigation">
          <MenuIcon /> Menu
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Explore Credora</DialogTitle>
          <DialogDescription>Verify publicly or open your workspace.</DialogDescription>
        </DialogHeader>
        <nav className="mobile-menu-links" aria-label="Mobile navigation">
          {[
            ['/verify', 'Verify a credential'],
            ['/wallet', 'My credentials & wallet setup'],
            ['/dashboard', 'Choose workspace'],
            ['/org', 'Organization workspace'],
            ['/issuer', 'Issue a credential'],
            ['/superadmin', 'Superadmin control'],
            ['/demo', 'Explore demo data'],
            ['/#how-it-works', 'How it works'],
          ].map(([href, label]) => (
            <Button asChild variant="ghost" key={href}>
              <a href={href} onClick={() => setOpen(false)}>
                {label}
              </a>
            </Button>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
