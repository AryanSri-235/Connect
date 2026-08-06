'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn"
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await fetch('/api/session', { method: 'DELETE' });
          router.replace('/login');
          router.refresh();
        })
      }
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
