# @niubu/icons

Private version 0.1.0 workspace source package. Consumers use only the explicit exports in package.json.

The root export lists named Lucide icons used by the app and public UI. Business icon maps stay in the app. React is a host peer; no icon namespace or full-library import is needed.

`createIconRegistry(entries, options?)` creates an independent registry from `readonly { name: string; icon: IconComponent }[]`. `IconComponent` accepts SVG props, including existing named Lucide components. No icon is registered implicitly, and the registry copies the supplied entries.

Names must start with an ASCII letter, digit or underscore, followed by letters, digits, underscores, dots, colons or hyphens. Empty, whitespace-containing or path-like names throw; exact duplicate names throw instead of overwriting. Tokens are case-sensitive. Prototype property names are ordinary tokens.

`registry.resolve(name)` returns the exact registered component. Unknown names call `options.onUnknown(name)` if supplied, then return `options.fallback` or `undefined`. Both options are captured at creation; no global diagnostics, business defaults or dynamic imports are installed.

```tsx
import { createIconRegistry, FileQuestion, MenuFold } from '@niubu/icons';

const icons = createIconRegistry([{ name: 'ep:fold', icon: MenuFold }], {
  fallback: FileQuestion,
  onUnknown: name => reportUnknownIcon(name),
});
const Icon = icons.resolve(menu.icon);
```

产品专属图标由 app 自身具名引入并登记；公共包不持有业务默认映射。
