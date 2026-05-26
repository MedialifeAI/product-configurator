'use client';

import { SiteConfigProvider } from '@/context/SiteConfigProvider';
import AdminPortal from '@/components/admin/AdminPortal';

export default function AdminPage() {
  return (
    <SiteConfigProvider enableSceneAutoSave={false}>
      <AdminPortal />
    </SiteConfigProvider>
  );
}
