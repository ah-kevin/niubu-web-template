import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  DataTable,
  RowActions,
  createDataTableLabels,
  createTreeColumnHelper,
  type ExpandedState,
  type RowSelectionState,
} from '@niubu/common-ui/data-table';
import { Modal } from '@niubu/common-ui/overlay';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { Badge } from '@niubu/shadcn-ui/badge';
import { ExamplePage, ExampleSection } from '../ExamplePage';
import { treeCopy } from './tree-copy';

type Node = {
  id: string;
  parentId?: string;
  labelKey?: string;
  name?: string;
  prefixParent?: boolean;
  count: number;
  kind: 'farm' | 'zone' | 'pen';
  status: 'active' | 'full' | 'disabled';
  disabled?: boolean;
  lazy?: boolean;
};
type TreeState = { nodes: Record<string, Node>; children: Record<string, string[]> };
type Editor = { kind: 'add' | 'edit'; nodeId: string; name: string; count: string; error?: string };
const createTree = (): TreeState => ({
  nodes: {
    farm: { id: 'farm', kind: 'farm', status: 'active', labelKey: 'farm', count: 80 },
    zone: { id: 'zone', kind: 'zone', status: 'active', parentId: 'farm', labelKey: 'zone', count: 50 },
    one: { id: 'one', kind: 'pen', status: 'full', parentId: 'zone', labelKey: 'one', count: 30 },
    locked: {
      id: 'locked',
      kind: 'pen',
      status: 'disabled',
      parentId: 'zone',
      labelKey: 'locked',
      count: 20,
      disabled: true,
    },
    lazy: { id: 'lazy', kind: 'zone', status: 'active', parentId: 'farm', labelKey: 'lazy', count: 30, lazy: true },
    retry: {
      id: 'retry',
      kind: 'zone',
      status: 'active',
      parentId: 'farm',
      labelKey: 'retryNode',
      count: 0,
      lazy: true,
    },
    empty: {
      id: 'empty',
      kind: 'zone',
      status: 'active',
      parentId: 'farm',
      labelKey: 'emptyNode',
      count: 0,
      lazy: true,
    },
  },
  children: { farm: ['zone', 'lazy', 'retry', 'empty'], zone: ['one', 'locked'] },
});
const helper = createTreeColumnHelper<Node>();
const getRowId = (row: Node) => row.id;
const ActionsContext = createContext<{
  owner: number;
  label: (node: Node) => string;
  open: (kind: Editor['kind'], node: Node) => void;
  canAdd: (node: Node) => boolean;
  isBranch: (node: Node) => boolean;
} | null>(null);

function NodeActions({ node }: { node: Node }) {
  const context = useContext(ActionsContext);
  const { t } = useTranslation('app', treeCopy);
  if (!context) return null;
  const edit = {
    id: 'edit',
    label: t('examples.treeCapabilities.edit'),
    disabled: node.disabled,
    onSelect: () => context.open('edit', node),
  };
  const add = {
    id: 'add',
    label: t('examples.treeCapabilities.add'),
    disabled: !context.canAdd(node),
    onSelect: () => context.open('add', node),
  };
  return (
    <RowActions
      ownerKey={`tree-demo:${context.owner}:${node.id}`}
      rowLabel={context.label(node)}
      actions={context.isBranch(node) ? [add, edit] : [edit, add]}
    />
  );
}

export function TreeCapabilities() {
  const { t } = useTranslation('app', treeCopy);
  const [tree, setTree] = useState(createTree);
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState(0);
  const [selected, setSelected] = useState<RowSelectionState>({ one: true, zone: true });
  const [expanded, setExpanded] = useState<ExpandedState>({ farm: true, zone: true });
  const [editor, setEditor] = useState<Editor | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const nextId = useRef(0);
  const attempts = useRef(new Set<string>());
  const roots = useMemo(() => [tree.nodes.farm], [tree.nodes.farm]);
  const getSubRows = useCallback((node: Node) => tree.children[node.id]?.map(id => tree.nodes[id]), [tree]);
  const getRowLabel = useCallback(
    function label(node: Node): string {
      if (node.name !== undefined) return node.name;
      const text = t(`examples.treeCapabilities.${node.labelKey}`);
      return node.prefixParent && node.parentId ? `${label(tree.nodes[node.parentId])} · ${text}` : text;
    },
    [tree.nodes, t],
  );
  const headers = {
    name: t('examples.treeCapabilities.name'),
    count: t('examples.treeCapabilities.count'),
    kind: t('examples.treeCapabilities.kind'),
    status: t('examples.treeCapabilities.status'),
    actions: t('examples.treeCapabilities.actions'),
  };
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor(getRowLabel, { id: 'name', header: t('examples.treeCapabilities.name'), size: 420 }),
        helper.accessor('kind', {
          id: 'kind',
          header: t('examples.treeCapabilities.kind'),
          cell: context => t(`examples.treeCapabilities.kind.${context.getValue()}`),
        }),
        helper.accessor('status', {
          id: 'status',
          header: t('examples.treeCapabilities.status'),
          cell: context => (
            <Badge
              variant={
                context.getValue() === 'active' ? 'success' : context.getValue() === 'full' ? 'warning' : 'neutral'
              }
            >
              {t(`examples.treeCapabilities.status.${context.getValue()}`)}
            </Badge>
          ),
        }),
        helper.accessor('count', { id: 'count', header: t('examples.treeCapabilities.count'), size: 120 }),
        helper.display({
          id: 'actions',
          header: t('examples.treeCapabilities.actions'),
          size: 180,
          cell: context => <NodeActions node={context.row.original} />,
        }),
      ]),
    [t, getRowLabel],
  );
  const openEditor = (kind: Editor['kind'], node: Node) =>
    setEditor({
      kind,
      nodeId: node.id,
      name: kind === 'edit' ? getRowLabel(node) : '',
      count: kind === 'edit' ? String(node.count) : '0',
    });
  function saveNode() {
    if (!editor) return;
    const name = editor.name.trim();
    const count = Number(editor.count);
    if (!name || !editor.count.trim() || !Number.isSafeInteger(count) || count < 0) {
      setEditor({ ...editor, error: t('examples.treeCapabilities.invalidNode') });
      return;
    }
    const id = editor.kind === 'add' ? `added-${++nextId.current}` : editor.nodeId;
    setTree(previous => {
      const node: Node =
        editor.kind === 'add'
          ? {
              id,
              parentId: editor.nodeId,
              name,
              count,
              kind: previous.nodes[editor.nodeId].kind === 'farm' ? 'zone' : 'pen',
              status: 'active',
            }
          : { ...previous.nodes[id], name, count };
      const nodes = { ...previous.nodes, [id]: node };
      // Replacing affected ancestors makes native row caches consume the new child objects.
      for (let ancestor = node.parentId; ancestor; ancestor = nodes[ancestor].parentId)
        nodes[ancestor] = { ...nodes[ancestor] };
      return {
        nodes,
        children:
          editor.kind === 'add'
            ? { ...previous.children, [editor.nodeId]: [...(previous.children[editor.nodeId] ?? []), id] }
            : previous.children,
      };
    });
    if (editor.kind === 'add') {
      setSelected(previous => (previous[editor.nodeId] ? { ...previous, [id]: true } : previous));
      const path: Record<string, boolean> = {};
      for (let ancestor: string | undefined = editor.nodeId; ancestor; ancestor = tree.nodes[ancestor].parentId)
        path[ancestor] = true;
      setExpanded(previous => (previous === true ? true : { ...previous, ...path }));
      setQuery('');
    }
    setEditor(null);
  }
  return (
    <ExampleSection
      className="xl:col-span-2"
      title={t('examples.treeCapabilities.title')}
      description={t('examples.treeCapabilities.description')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-64"
          value={query}
          aria-label={t('examples.treeCapabilities.search')}
          placeholder={t('examples.treeCapabilities.search')}
          onChange={event => setQuery(event.target.value)}
        />
        <Button variant="outline" onClick={() => setQuery('')}>
          {t('examples.treeCapabilities.clear')}
        </Button>
        <Button
          variant="outline"
          disabled={!!query.trim()}
          aria-label={`${t('examples.treeCapabilities.expand')} · ${t('examples.treeCapabilities.title')}`}
          onClick={() => setExpanded(true)}
        >
          {t('examples.treeCapabilities.expand')}
        </Button>
        <Button
          variant="outline"
          disabled={!!query.trim()}
          aria-label={`${t('examples.treeCapabilities.collapse')} · ${t('examples.treeCapabilities.title')}`}
          onClick={() => setExpanded({})}
        >
          {t('examples.treeCapabilities.collapse')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setOwner(value => value + 1);
            setTree(createTree());
            setEditor(null);
            setQuery('');
            setExpanded({ farm: true, zone: true });
            setSelected({ one: true, zone: true });
          }}
        >
          {t('examples.treeCapabilities.reset')}
        </Button>
        <span role="status" className="text-sm text-muted-foreground">
          {t('examples.treeCapabilities.selected', { count: Object.values(selected).filter(Boolean).length })}
        </span>
      </div>
      <ActionsContext
        value={{
          owner,
          label: getRowLabel,
          open: openEditor,
          canAdd: node => !node.disabled && (!node.lazy || tree.children[node.id] !== undefined),
          isBranch: node => !!node.lazy || !!tree.children[node.id]?.length,
        }}
      >
        <DataTable
          profile="tree-list"
          caption={t('examples.treeCapabilities.title')}
          columns={columns}
          model={{ kind: 'client', rows: roots }}
          getRowId={getRowId}
          getRowLabel={getRowLabel}
          getSubRows={getSubRows}
          treeColumnId="name"
          readState="ready"
          sourceCount={Object.keys(tree.nodes).length}
          resultCount={Object.keys(tree.nodes).length}
          labels={createDataTableLabels(t, headers)}
          columnAlign={{ count: 'end' }}
          expanded={{ kind: 'controlled', value: expanded, onChange: setExpanded }}
          tree={{
            search: { query, matchCountLabel: count => t('examples.treeCapabilities.matches', { count }) },
            selection: {
              state: { kind: 'controlled', value: selected, onChange: setSelected },
              isDisabled: node => !!node.disabled,
              labels: {
                selectAll: t('examples.treeCapabilities.all'),
                selectRow: node => t('examples.treeCapabilities.select', { name: getRowLabel(node) }),
              },
            },
            lazy: {
              ownerKey: `tree-demo:${owner}`,
              hasChildren: node => !!node.lazy,
              labels: {
                loading: t('examples.treeCapabilities.loading'),
                error: t('examples.treeCapabilities.error'),
                retry: t('examples.treeCapabilities.retry'),
                empty: t('examples.treeCapabilities.empty'),
              },
              loadChildren: (node, { signal }) =>
                new Promise((resolve, reject) => {
                  const abort = () => {
                    clearTimeout(timer);
                    signal.removeEventListener('abort', abort);
                    reject(new DOMException('Cancelled', 'AbortError'));
                  };
                  const timer = setTimeout(() => {
                    signal.removeEventListener('abort', abort);
                    const key = `${owner}:${node.id}`;
                    if (node.id === 'retry' && !attempts.current.has(key)) {
                      attempts.current.add(key);
                      reject(Error('Synthetic failure'));
                      return;
                    }
                    const children: Node[] =
                      node.id === 'empty'
                        ? []
                        : [
                            {
                              id: `${node.id}-child`,
                              kind: 'pen',
                              status: 'active',
                              parentId: node.id,
                              labelKey: 'child',
                              prefixParent: true,
                              count: node.count,
                            },
                          ];
                    setTree(previous => ({
                      nodes: { ...previous.nodes, ...Object.fromEntries(children.map(child => [child.id, child])) },
                      children: { ...previous.children, [node.id]: children.map(child => child.id) },
                    }));
                    resolve(children);
                  }, 700);
                  if (signal.aborted) abort();
                  else signal.addEventListener('abort', abort, { once: true });
                }),
            },
          }}
        />
      </ActionsContext>
      <Modal
        open={editor !== null}
        title={t(editor?.kind === 'add' ? 'examples.treeCapabilities.add' : 'examples.treeCapabilities.edit')}
        onOpenChange={open => {
          if (!open) setEditor(null);
        }}
        onConfirm={() => form.current?.requestSubmit()}
        confirmLabel={t('examples.treeCapabilities.save')}
        cancelLabel={t('examples.treeCapabilities.cancel')}
      >
        {editor && (
          <form
            ref={form}
            className="grid gap-3"
            onSubmit={event => {
              event.preventDefault();
              saveNode();
            }}
          >
            <label className="grid gap-1">
              {t('examples.treeCapabilities.name')}
              <Input
                aria-label={t('examples.treeCapabilities.name')}
                required
                value={editor.name}
                onChange={event => setEditor({ ...editor, name: event.target.value, error: undefined })}
              />
            </label>
            <label className="grid gap-1">
              {t('examples.treeCapabilities.count')}
              <Input
                aria-label={t('examples.treeCapabilities.count')}
                type="number"
                min={0}
                step={1}
                required
                value={editor.count}
                onChange={event => setEditor({ ...editor, count: event.target.value, error: undefined })}
              />
            </label>
            {editor.error && (
              <p role="alert" className="text-destructive-text">
                {editor.error}
              </p>
            )}
          </form>
        )}
      </Modal>
    </ExampleSection>
  );
}

export function TreeCapabilitiesPage() {
  const { t } = useTranslation('app', treeCopy);
  return (
    <ExamplePage title={t('examples.treeCapabilities.title')}>
      <TreeCapabilities />
    </ExamplePage>
  );
}
