'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminTenantsPage() {
  const router = useRouter();
  useEffect(() => {
    router.push('/admin/users');
  }, [router]);
  return null;
}
