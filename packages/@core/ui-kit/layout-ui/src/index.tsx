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
    <div className="public-shell" data-layout-density={p.density} data-sidebar-collapsed={p.sidebarCollapsed}>
      <a className="skip-link" href="#main-content">
        {p.skipContent}
      </a>
      <header className="public-header">
        {p.logo}
        {p.topActions}
      </header>
      <div className="public-grid">
        {p.story}
        <main id="main-content" className="public-main" tabIndex={-1}>
          {p.children}
        </main>
      </div>
      <footer className="public-footer">{p.footer}</footer>
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
    <div className="account-shell" data-layout-density={p.density} data-sidebar-collapsed={p.sidebarCollapsed}>
      <a className="skip-link" href="#main-content">
        {p.skipContent}
      </a>
      <header className="account-header">
        {p.logo}
        <div>
          {p.topActions}
          {p.backAction}
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="account-container">
        {p.heading}
        <div className="account-grid">
          {p.tabs}
          <div>{p.children}</div>
        </div>
      </main>
    </div>
  );
}
