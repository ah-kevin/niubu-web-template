import { createElement, type SVGProps } from 'react';

export {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleAlert,
  CircleHelp,
  CircleSlash,
  ClipboardList,
  Database,
  FileQuestion,
  Fingerprint,
  HeartPulse,
  Globe,
  Clock,
  Maximize,
  RefreshCw,
  Info,
  LayoutGrid,
  Leaf,
  ListChecks,
  LockKeyhole,
  MailX,
  Menu,
  Monitor,
  Moon,
  Pin,
  PinOff,
  Pipette,
  PlugZap,
  Plus,
  Search,
  SearchX,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  Sun,
  Tractor,
  TriangleAlert,
  Users,
  Wrench,
  X,
  XIcon,
} from 'lucide-react';

// Element Plus icons used by Vben v5.7.0's header toggle (ep:fold / ep:expand).
// Source: https://github.com/element-plus/element-plus-icons/tree/master/packages/svg
export function MenuFold(props: SVGProps<SVGSVGElement>) {
  return createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: 16,
      height: 16,
      viewBox: '0 0 1024 1024',
      'data-icon': 'ep:fold',
      ...props,
    },
    createElement('path', {
      fill: 'currentColor',
      d: 'M896 192H128v128h768zm0 256H384v128h512zm0 256H128v128h768zM320 384 128 512l192 128z',
    }),
  );
}
export function MenuExpand(props: SVGProps<SVGSVGElement>) {
  return createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: 16,
      height: 16,
      viewBox: '0 0 1024 1024',
      'data-icon': 'ep:expand',
      ...props,
    },
    createElement('path', {
      fill: 'currentColor',
      d: 'M128 192h768v128H128zm0 256h512v128H128zm0 256h768v128H128zm576-352 192 160-192 128z',
    }),
  );
}

export { createIconRegistry } from './registry';
export type { IconComponent, IconEntry, IconRegistry, IconRegistryOptions } from './registry';
