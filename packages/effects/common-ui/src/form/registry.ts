import { Input } from '@niubu/shadcn-ui/input';
import { Textarea } from '@niubu/shadcn-ui/textarea';
import { NumberInput } from '@niubu/shadcn-ui/number-input';
import { Select } from '@niubu/shadcn-ui/select';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { RadioGroup } from '@niubu/shadcn-ui/radio-group';
import { Switch } from '@niubu/shadcn-ui/switch';
import type { BuiltinFieldKind } from './types';
/** Fixed primitive mapping, never merged with application renderers. */
export const builtinFields = Object.freeze({
  text: Input,
  textarea: Textarea,
  number: NumberInput,
  password: Input,
  select: Select,
  checkbox: Checkbox,
  'checkbox-group': Checkbox,
  radio: RadioGroup,
  switch: Switch,
  date: Input,
  'date-range': Input,
} satisfies Record<BuiltinFieldKind, unknown>);
export function isBuiltinFieldKind(kind: string): kind is BuiltinFieldKind {
  return Object.hasOwn(builtinFields, kind);
}
export function assertCustomFields(customFields?: object): void {
  for (const key of Object.keys(customFields ?? {})) {
    if (!key.startsWith('custom:') || key.length === 'custom:'.length)
      throw new Error(`Custom fields must use custom: names; cannot override ${key}`);
    if (typeof Reflect.get(customFields!, key) !== 'function')
      throw new Error(`Custom field ${key} must be a render function`);
  }
}
export function getCustomFieldRenderer(kind: string, customFields?: object): unknown {
  assertCustomFields(customFields);
  if (!kind.startsWith('custom:') || !customFields || !Object.hasOwn(customFields, kind))
    throw new Error(`Unknown field kind: ${kind}`);
  return Reflect.get(customFields, kind);
}
