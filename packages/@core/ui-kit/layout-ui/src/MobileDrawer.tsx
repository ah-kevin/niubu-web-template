import type { ReactNode } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@niubu/shadcn-ui/sheet';
import {
  Navigation,
  type LinkRenderer,
  type NavigationItem,
  TreeNavigation,
  type TreeNavigationProps,
} from '@niubu/menu-ui';
import type { LayoutLabels } from './BusinessLayout';
export default function MobileDrawer(p: {
  contentId: string;
  brand: string;
  labels: Pick<LayoutLabels, 'close' | 'workspaceNavigation' | 'mobileNavigation'>;
  navigation?: readonly NavigationItem[];
  tree?: Pick<TreeNavigationProps, 'nodes' | 'expandedIds' | 'onExpand' | 'order' | 'onReorder'>;
  renderLink: LinkRenderer;
  onOpenChange: (open: boolean) => void;
  mobileAccount?: ReactNode;
  returnFocus: () => void;
}) {
  return (
    <Sheet open onOpenChange={p.onOpenChange}>
      <SheetContent
        data-theme-region="sidebar"
        closeLabel={p.labels.close}
        id={p.contentId}
        side="left"
        className="mobile-nav-sheet w-[min(320px,85vw)] pb-[20px]"
        onCloseAutoFocus={event => {
          event.preventDefault();
          p.returnFocus();
        }}
      >
        <SheetHeader>
          <SheetTitle>{p.brand}</SheetTitle>
          <SheetDescription>{p.labels.workspaceNavigation}</SheetDescription>
        </SheetHeader>
        {p.tree ? (
          <TreeNavigation
            {...p.tree}
            label={p.labels.mobileNavigation}
            renderLink={p.renderLink}
            onNavigate={() => p.onOpenChange(false)}
          />
        ) : (
          <Navigation
            items={p.navigation ?? []}
            label={p.labels.mobileNavigation}
            renderLink={p.renderLink}
            onNavigate={() => p.onOpenChange(false)}
          />
        )}
        {p.mobileAccount}
      </SheetContent>
    </Sheet>
  );
}
