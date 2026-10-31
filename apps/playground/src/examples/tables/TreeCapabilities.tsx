import { useMemo, useRef, useState } from 'react';
import {
  DataTable,
  createDataTableLabels,
  createTreeColumnHelper,
  type ExpandedState,
  type RowSelectionState,
} from '@niubu/common-ui/data-table';
import { useTranslation } from '@niubu/locales/react';
import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';
import { ExampleSection } from '../ExamplePage';
import { treeCopy } from './tree-copy';

type Node = { id: string; name: string; count: number; disabled?: boolean; lazy?: boolean; children?: Node[] };
const helper = createTreeColumnHelper<Node>();
const getRowId = (row: Node) => row.id;
const getRowLabel = (row: Node) => row.name;
const getSubRows = (row: Node) => row.children;

export function TreeCapabilities() {
  const { t } = useTranslation('app', treeCopy);
  const [query, setQuery] = useState('');
  const [owner, setOwner] = useState(0);
  const [selected, setSelected] = useState<RowSelectionState>({ one: true });
  const [expanded, setExpanded] = useState<ExpandedState>({ farm: true, zone: true });
  const attempts = useRef(new Set<string>());
  const rows = useMemo<Node[]>(
    () => [
      {
        id: 'farm',
        name: t('examples.treeCapabilities.farm'),
        count: 80,
        children: [
          {
            id: 'zone',
            name: t('examples.treeCapabilities.zone'),
            count: 50,
            children: [
              { id: 'one', name: t('examples.treeCapabilities.one'), count: 30 },
              { id: 'locked', name: t('examples.treeCapabilities.locked'), count: 20, disabled: true },
            ],
          },
          { id: 'lazy', name: t('examples.treeCapabilities.lazy'), count: 30, lazy: true },
          { id: 'retry', name: t('examples.treeCapabilities.retryNode'), count: 0, lazy: true },
          { id: 'empty', name: t('examples.treeCapabilities.emptyNode'), count: 0, lazy: true },
        ],
      },
    ],
    [t],
  );
  const headers = { name: t('examples.treeCapabilities.name'), count: t('examples.treeCapabilities.count') };
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', { id: 'name', header: t('examples.treeCapabilities.name'), size: 420 }),
        helper.accessor('count', { id: 'count', header: t('examples.treeCapabilities.count'), size: 120 }),
      ]),
    [t],
  );
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
        <Button variant="outline" disabled={!!query.trim()} onClick={() => setExpanded(true)}>
          {t('examples.treeCapabilities.expand')}
        </Button>
        <Button variant="outline" disabled={!!query.trim()} onClick={() => setExpanded({})}>
          {t('examples.treeCapabilities.collapse')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setOwner(value => value + 1);
            setExpanded({ farm: true, zone: true });
            setSelected({ one: true });
          }}
        >
          {t('examples.treeCapabilities.reset')}
        </Button>
        <span role="status" className="text-sm text-muted-foreground">
          {t('examples.treeCapabilities.selected', { count: Object.values(selected).filter(Boolean).length })}
        </span>
      </div>
      <DataTable
        profile="tree-list"
        caption={t('examples.treeCapabilities.title')}
        columns={columns}
        model={{ kind: 'client', rows }}
        getRowId={getRowId}
        getRowLabel={getRowLabel}
        getSubRows={getSubRows}
        treeColumnId="name"
        readState="ready"
        sourceCount={7}
        resultCount={7}
        labels={createDataTableLabels(t, headers)}
        columnAlign={{ count: 'end' }}
        expanded={{ kind: 'controlled', value: expanded, onChange: setExpanded }}
        tree={{
          search: { query },
          selection: {
            state: { kind: 'controlled', value: selected, onChange: setSelected },
            isDisabled: row => !!row.disabled,
            labels: {
              selectAll: t('examples.treeCapabilities.all'),
              selectRow: row => t('examples.treeCapabilities.select', { name: row.name }),
            },
          },
          lazy: {
            ownerKey: `tree-demo:${owner}`,
            hasChildren: row => !!row.lazy,
            labels: {
              loading: t('examples.treeCapabilities.loading'),
              error: t('examples.treeCapabilities.error'),
              retry: t('examples.treeCapabilities.retry'),
              empty: t('examples.treeCapabilities.empty'),
            },
            loadChildren: (row, { signal }) =>
              new Promise((resolve, reject) => {
                const abort = () => {
                  clearTimeout(timer);
                  signal.removeEventListener('abort', abort);
                  reject(new DOMException('Cancelled', 'AbortError'));
                };
                const timer = setTimeout(() => {
                  signal.removeEventListener('abort', abort);
                  const key = `${owner}:${row.id}`;
                  if (row.id === 'retry' && !attempts.current.has(key)) {
                    attempts.current.add(key);
                    reject(Error('Synthetic failure'));
                    return;
                  }
                  resolve(
                    row.id === 'empty'
                      ? []
                      : [
                          {
                            id: `${row.id}-child`,
                            name: `${row.name} · ${t('examples.treeCapabilities.child')}`,
                            count: row.count,
                          },
                        ],
                  );
                }, 700);
                if (signal.aborted) abort();
                else signal.addEventListener('abort', abort, { once: true });
              }),
          },
        }}
      />
    </ExampleSection>
  );
}
