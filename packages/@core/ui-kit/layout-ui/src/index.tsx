import type { ReactNode } from 'react';
export { BusinessLayout } from './BusinessLayout';
export type { AppLayoutProps, LayoutLabels, SidebarControls } from './BusinessLayout';
export { PendingOverlay } from './PendingOverlay';
export type { BusinessLayoutModel } from './layout-model';
export type PublicLayoutProps = {
  children: ReactNode;
  skipContent: string;
  logo?: ReactNode;
  topActions?: ReactNode;
  story?: ReactNode;
  footer?: ReactNode;
  density: 'standard' | 'compact';
  sidebarCollapsed: boolean;
};
export function PublicLayout(p: PublicLayoutProps) {
  return (
    <div
      className="public-shell flex min-h-dvh flex-col bg-card"
      data-layout-density={p.density}
      data-sidebar-collapsed={p.sidebarCollapsed}
    >
      <a
        className="skip-link fixed top-[12px] left-[12px] z-[100] -translate-y-[150%] rounded-[8px] border border-ring bg-card px-[20px] py-[12px] text-primary-text focus:translate-y-0"
        href="#main-content"
      >
        {p.skipContent}
      </a>
      <header className="public-header flex h-[96px] items-center justify-between px-[56px]">
        {p.logo}
        {p.topActions}
      </header>
      <div className="public-grid grid min-h-[610px] flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {p.story}
        <main id="main-content" className="public-main grid place-items-center p-[45px]" tabIndex={-1}>
          {p.children}
        </main>
      </div>
      <footer className="public-footer flex items-center justify-between gap-[20px] px-[56px] py-[25px] text-[9px] text-muted-foreground">
        {p.footer}
      </footer>
    </div>
  );
}
export type AccountLayoutProps = {
  children: ReactNode;
  skipContent: string;
  logo?: ReactNode;
  topActions?: ReactNode;
  backAction?: ReactNode;
  heading?: ReactNode;
  tabs?: ReactNode;
  density: 'standard' | 'compact';
  sidebarCollapsed: boolean;
};
export function AccountLayout(p: AccountLayoutProps) {
  return (
    <div
      className="account-shell min-h-dvh"
      data-layout-density={p.density}
      data-sidebar-collapsed={p.sidebarCollapsed}
    >
      <a
        className="skip-link fixed top-[12px] left-[12px] z-[100] -translate-y-[150%] rounded-[8px] border border-ring bg-card px-[20px] py-[12px] text-primary-text focus:translate-y-0"
        href="#main-content"
      >
        {p.skipContent}
      </a>
      <header className="account-header flex items-center justify-between gap-[20px] border-b border-border bg-card px-[48px] py-[24px] [&>div]:flex [&>div]:items-center [&>div]:gap-[20px]">
        {p.logo}
        <div>
          {p.topActions}
          {p.backAction}
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="account-container mx-auto max-w-[1050px] px-[32px] py-[48px]">
        {p.heading}
        <div className="account-grid grid grid-cols-[175px_minmax(0,1fr)] gap-[40px]">
          {p.tabs}
          <div>{p.children}</div>
        </div>
      </main>
    </div>
  );
}
