import { Outlet, useSearchParams } from 'react-router-dom';
import { DevBanner } from '@/components/DevBanner';
import { Navbar } from '@/components/layout/Navbar';

export function NormalLayout() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');
  const shouldHideNavbar = view === 'preview' || view === 'diffs';

  return (
    <>
      <div className="flex flex-col min-h-screen min-h-[100dvh]">
        <DevBanner />
        {!shouldHideNavbar && <Navbar />}
        <div className="flex-1 overflow-auto min-h-0">
          <Outlet />
        </div>
      </div>
    </>
  );
}
