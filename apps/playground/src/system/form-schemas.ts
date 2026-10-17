import { z } from 'zod';
import type { FieldOption, FormFieldConfig, SchemaFormOptions } from '@niubu/common-ui/form';
import type { InputByResource, RecordByResource, ResourceKind } from './contracts';
import { safeMenuHref } from './schemas';
import { excludedDescendants, referenceOptions, type Lookups, type Translate } from './resource-config';

export type EditorValues = {
  name: string;
  email: string;
  roleId: string;
  departmentId: string;
  code: string;
  description: string;
  title: string;
  kind: 'group' | 'page' | 'external';
  parentId: string;
  order: number | null;
  pageId: string;
  href: string;
  openInNewWindow: boolean;
  enabled: boolean;
};
export type QueryValues = {
  keyword: string;
  enabled: string;
  roleId: string;
  departmentId: string;
  kind: string;
  parentId: string;
};
export type QueryCriteria = {
  keyword?: string;
  enabled?: boolean;
  roleId?: string;
  departmentId?: string;
  kind?: 'group' | 'page' | 'external';
  parentId?: string | null;
};
const queryLayout = { columns: 2, labelWidth: 'auto' };
export function editorDefaults<K extends ResourceKind>(resource: K, record?: RecordByResource[K]): EditorValues {
  const defaults: EditorValues = {
    name: '',
    email: '',
    roleId: '',
    departmentId: '',
    code: '',
    description: '',
    title: '',
    kind: 'group',
    parentId: '',
    order: 0,
    pageId: '',
    href: '',
    openInNewWindow: false,
    enabled: true,
  };
  if (!record) return defaults;
  for (const key of Object.keys(defaults) as (keyof EditorValues)[])
    if (key in record)
      Object.assign(defaults, {
        [key]: key === 'parentId' ? (record[key as keyof typeof record] ?? '') : record[key as keyof typeof record],
      });
  void resource;
  return defaults;
}
export function createEditorOptions<K extends ResourceKind>(
  resource: K,
  t: Translate,
  lookups: Lookups,
  record?: RecordByResource[K],
  current = editorDefaults(resource, record),
): SchemaFormOptions<EditorValues, InputByResource[K]> {
  const message = t('system.invalidField');
  const text = z.string().trim().min(1, message).max(80, message);
  const code = z.string().regex(/^[a-z][a-z0-9:_-]{1,63}$/, t('system.invalidCode'));
  const field = (
    name: keyof EditorValues,
    kind: FormFieldConfig<EditorValues>['kind'],
    schema?: z.ZodType,
    required = false,
  ): FormFieldConfig<EditorValues> => ({
    name,
    kind,
    label: t(`system.field.${name}`),
    schema,
    required,
    group: 'record',
    resolveMessage: value => (value === 'validation:checkField' ? message : value),
  });
  const select = (
    name: keyof EditorValues,
    options: readonly FieldOption[],
    required = false,
  ): FormFieldConfig<EditorValues> => ({
    ...field(name, 'select', required ? z.string().min(1, message) : z.string(), required),
    componentProps: { options, placeholder: t('system.choose') },
  });
  const refs = (kind: 'roles' | 'departments', value: string) =>
    referenceOptions(lookups[kind], row => lookups[kind].find(item => item.id === row.id)?.name ?? row.id, value, t);
  let fields: FormFieldConfig<EditorValues>[];
  if (resource === 'users')
    fields = [
      field('name', 'text', text, true),
      field('email', 'text', z.string().email(t('system.invalidEmail')), true),
      select('roleId', refs('roles', current.roleId), true),
      select('departmentId', refs('departments', current.departmentId), true),
    ];
  else if (resource === 'roles')
    fields = [
      field('name', 'text', text, true),
      field('code', 'text', code, true),
      { ...field('description', 'textarea', z.string().max(500, message)), colSpan: 2, componentProps: { rows: 3 } },
    ];
  else if (resource === 'departments') {
    const excluded = excludedDescendants(lookups.departments, record?.id);
    fields = [
      field('name', 'text', text, true),
      field('code', 'text', code, true),
      select('parentId', [
        { value: '', label: t('system.noParent') },
        ...referenceOptions(
          lookups.departments,
          row => {
            const names: string[] = [];
            const visited = new Set<string>();
            let node = lookups.departments.find(item => item.id === row.id);
            while (node && !visited.has(node.id)) {
              visited.add(node.id);
              names.unshift(node.name);
              node = lookups.departments.find(item => item.id === node?.parentId);
            }
            return names.join(' / ');
          },
          current.parentId,
          t,
          excluded,
        ),
      ]),
    ];
  } else {
    const excluded = excludedDescendants(lookups.menus, record?.id);
    const groups = lookups.menus.filter(row => row.kind === 'group');
    const pageOptions = ['home', 'request', 'system.users', 'system.roles', 'system.menus', 'system.departments'].map(
      id => ({ value: `playground.${id}`, label: t(id.startsWith('system.') ? id : id) }),
    );
    fields = [
      field('title', 'text', text, true),
      {
        ...select(
          'kind',
          ['group', 'page', 'external'].map(value => ({ value, label: t(`system.kind.${value}`) })),
          true,
        ),
        schema: z.enum(['group', 'page', 'external'], { error: message }),
      },
      select('parentId', [
        { value: '', label: t('system.noParent') },
        ...referenceOptions(
          groups,
          row => groups.find(item => item.id === row.id)?.title ?? row.id,
          current.parentId,
          t,
          excluded,
        ),
      ]),
      field(
        'order',
        'number',
        z
          .number({ error: t('system.invalidOrder') })
          .int(t('system.invalidOrder'))
          .min(0, t('system.invalidOrder'))
          .max(9999, t('system.invalidOrder')),
        true,
      ),
      {
        ...select('pageId', pageOptions),
        dependencies: {
          fields: ['kind'],
          derive: values => ({
            visible: values.kind === 'page',
            required: values.kind === 'page',
            schema: z
              .string()
              .refine(value => pageOptions.some(option => option.value === value), t('system.invalidPage')),
            componentProps: { options: pageOptions },
          }),
        },
      },
      {
        ...field('href', 'text'),
        dependencies: {
          fields: ['kind'],
          derive: values => ({
            visible: values.kind === 'external',
            required: values.kind === 'external',
            schema: z.string().refine(safeMenuHref, t('system.invalidHref')),
            componentProps: { placeholder: 'https://example.test' },
          }),
        },
      },
      {
        ...field('openInNewWindow', 'switch', z.boolean()),
        dependencies: { fields: ['kind'], derive: values => ({ visible: values.kind === 'external' }) },
      },
    ];
  }
  fields.push(field('enabled', 'switch', z.boolean()));
  return {
    fields,
    defaultValues: editorDefaults(resource, record),
    groups: [{ id: 'record', title: t('system.recordFields') }],
    layout: { columns: 1, labelWidth: 'auto' },
    transform: values => {
      let output: InputByResource[ResourceKind];
      if (resource === 'users')
        output = {
          name: values.name!,
          email: values.email!,
          roleId: values.roleId!,
          departmentId: values.departmentId!,
          enabled: values.enabled!,
        };
      else if (resource === 'roles')
        output = {
          name: values.name!,
          code: values.code!,
          description: values.description ?? '',
          enabled: values.enabled!,
        };
      else if (resource === 'departments')
        output = {
          name: values.name!,
          code: values.code!,
          parentId: values.parentId || null,
          enabled: values.enabled!,
        };
      else {
        const base = {
          title: values.title!,
          parentId: values.parentId || null,
          order: values.order!,
          enabled: values.enabled!,
        };
        output =
          values.kind === 'page'
            ? { ...base, kind: 'page', pageId: values.pageId! }
            : values.kind === 'external'
              ? { ...base, kind: 'external', href: values.href!, openInNewWindow: values.openInNewWindow ?? false }
              : { ...base, kind: 'group' };
      }
      return output as InputByResource[K];
    },
  };
}
export function createQueryOptions(
  resource: ResourceKind,
  t: Translate,
  lookups: Lookups,
  current?: QueryValues,
): SchemaFormOptions<QueryValues, QueryCriteria> {
  const options = (name: keyof QueryValues, values: readonly FieldOption[]): FormFieldConfig<QueryValues> => {
    const choices = [...values];
    const selected = current?.[name];
    if (selected && !choices.some(option => option.value === selected))
      choices.push({ value: selected, label: t('system.missingReference', { id: selected }), disabled: true });
    return {
      name,
      label: t(`system.field.${name}`),
      kind: 'select',
      componentProps: { options: [{ value: '', label: t('system.all') }, ...choices] },
    };
  };
  const fields: FormFieldConfig<QueryValues>[] = [
    {
      name: 'keyword',
      label: t('system.field.keyword'),
      kind: 'text',
      schema: z.string().max(100, t('system.invalidKeyword')),
    },
    options('enabled', [
      { value: 'true', label: t('system.enabled') },
      { value: 'false', label: t('system.disabled') },
    ]),
  ];
  if (resource === 'users')
    fields.push(
      options(
        'roleId',
        lookups.roles.map(row => ({
          value: row.id,
          label: row.enabled ? row.name : t('system.disabledReference', { name: row.name }),
        })),
      ),
      options(
        'departmentId',
        lookups.departments.map(row => ({
          value: row.id,
          label: row.enabled ? row.name : t('system.disabledReference', { name: row.name }),
        })),
      ),
    );
  if (resource === 'menus')
    fields.push(
      options(
        'kind',
        ['group', 'page', 'external'].map(value => ({ value, label: t(`system.kind.${value}`) })),
      ),
    );
  if (resource === 'departments')
    fields.push(
      options('parentId', [
        { value: 'null', label: t('system.noParent') },
        ...lookups.departments.map(row => ({ value: row.id, label: row.name })),
      ]),
    );
  return {
    fields,
    defaultValues: { keyword: '', enabled: '', roleId: '', departmentId: '', kind: '', parentId: '' },
    layout: { ...queryLayout, collapsedRows: 2 },
    transform: values => ({
      ...(values.keyword ? { keyword: values.keyword } : {}),
      ...(values.enabled ? { enabled: values.enabled === 'true' } : {}),
      ...(resource === 'users' && values.roleId ? { roleId: values.roleId } : {}),
      ...(resource === 'users' && values.departmentId ? { departmentId: values.departmentId } : {}),
      ...(resource === 'menus' && values.kind ? { kind: values.kind as 'group' | 'page' | 'external' } : {}),
      ...(resource === 'departments' && values.parentId
        ? { parentId: values.parentId === 'null' ? null : values.parentId }
        : {}),
    }),
  };
}
