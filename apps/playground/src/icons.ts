import {
  LayoutGrid,
  ArrowRight,
  ArrowUpRight,
  Monitor,
  FileQuestion,
  Users,
  ShieldCheck,
  Menu,
  Building2,
  Settings2,
  createIconRegistry,
} from '@niubu/icons';
export const icons = createIconRegistry(
  [
    { name: 'home', icon: LayoutGrid },
    { name: 'arrow-right-left', icon: ArrowRight },
    { name: 'external-link', icon: ArrowUpRight },
    { name: 'monitor', icon: Monitor },
    { name: 'users', icon: Users },
    { name: 'shield-check', icon: ShieldCheck },
    { name: 'menu', icon: Menu },
    { name: 'building-2', icon: Building2 },
    { name: 'settings', icon: Settings2 },
  ],
  { fallback: FileQuestion },
);
