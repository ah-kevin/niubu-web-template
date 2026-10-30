import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DataTable,
  CellText,
  CollectionCell,
  RowActions,
  createDataTableLabels,
  createListColumnHelper,
  type TableAlignment,
} from '@niubu/common-ui/data-table';
import { Modal } from '@niubu/common-ui/overlay';
import { Select } from '@niubu/shadcn-ui/select';
import { useTranslation } from '@niubu/locales/react';
import { ExampleSection } from '../ExamplePage';
import { tablesCopy } from './copy';

type Sample = {
  id: string;
  name: string | null;
  description: string;
  tags: readonly { label: string; code: number }[];
};
type ActionKind = 'detail' | 'confirm';
const helper = createListColumnHelper<Sample>();
const ActionsContext = createContext<{ scope: string; onAction: (row: Sample, kind: ActionKind) => void } | null>(null);

// A scope change retires local dialog state as well as the row menu's pending work.
export function PresentationExample({ scope }: { scope: string }) {
  return <PresentationBody key={scope} scope={scope} />;
}
function PresentationActionCell({ row }: { row: { original: Sample } }) {
  const owner = useContext(ActionsContext);
  const { t } = useTranslation('app', tablesCopy);
  if (!owner) return null;
  const record = row.original;
  return (
    <RowActions
      ownerKey={`synthetic:${owner.scope}:${record.id}`}
      rowLabel={record.name ?? t('examples.tables.emptyRecord')}
      actions={[
        { id: 'view', label: t('examples.tables.viewDetails'), onSelect: () => owner.onAction(record, 'detail') },
        { id: 'dialog', label: t('examples.tables.openDialog'), onSelect: () => owner.onAction(record, 'detail') },
        { id: 'link', label: t('examples.tables.openLink'), href: '#table-presentation' },
        {
          id: 'unavailable',
          label: t('examples.tables.unavailableAction'),
          disabled: true,
          onSelect: () => owner.onAction(record, 'detail'),
        },
        {
          id: 'confirm',
          label: t('examples.tables.confirmDemo'),
          destructive: true,
          onSelect: () => owner.onAction(record, 'confirm'),
        },
      ]}
    />
  );
}
function PresentationBody({ scope }: { scope: string }) {
  const { t } = useTranslation('app', tablesCopy);
  const [align, setAlign] = useState<TableAlignment>('center');
  const [panel, setPanel] = useState<{ row: Sample; kind: ActionKind } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = (value: number) => {
      if (Number.isFinite(value) && value > 0) setWidth(Math.floor(value));
    };
    measure(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(entries => {
      const entry = entries.find(item => item.target === element);
      if (entry) measure(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const columnSize = Math.min(640, Math.max(160, Math.floor((width - 182) / 3)));
  const rows = useMemo<readonly Sample[]>(
    () => [
      {
        id: 'presentation-one',
        name: t('examples.tables.sampleRecord'),
        description: t('examples.tables.longDescription'),
        tags: [
          { label: 'North', code: 1 },
          { label: 'South', code: 2 },
        ],
      },
      { id: 'presentation-empty', name: null, description: '', tags: [] },
    ],
    [t],
  );
  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', {
          id: 'name',
          header: t('examples.tables.name'),
          size: columnSize,
          sortDescFirst: false,
          cell: info => <CellText value={info.getValue()} />,
        }),
        helper.accessor('description', {
          id: 'description',
          header: t('examples.tables.description'),
          size: columnSize,
          enableSorting: false,
          cell: info => <CellText value={info.getValue()} />,
        }),
        helper.accessor('tags', {
          id: 'tags',
          header: t('examples.tables.collection'),
          size: columnSize,
          enableSorting: false,
          cell: info => (
            <CollectionCell items={info.getValue()} describeItem={item => `${item.label} (${item.code})`} />
          ),
        }),
        helper.display({
          id: 'actions',
          header: t('examples.tables.actions'),
          size: 180,
          cell: PresentationActionCell,
        }),
      ]),
    [t, columnSize],
  );
  const labels = createDataTableLabels(t, {
    name: t('examples.tables.name'),
    description: t('examples.tables.description'),
    tags: t('examples.tables.collection'),
    actions: t('examples.tables.actions'),
  });
  return (
    <ExampleSection
      title={t('examples.tables.presentation')}
      description={t('examples.tables.presentationHelp')}
      className="xl:col-span-2"
    >
      <label className="grid w-fit gap-1 text-sm">
        {t('examples.tables.alignment')}
        <Select
          label={t('examples.tables.alignment')}
          value={align}
          onValueChange={value => {
            if (value === 'start' || value === 'center' || value === 'end') setAlign(value);
          }}
          options={[
            { value: 'start', label: t('examples.tables.alignStart') },
            { value: 'center', label: t('examples.tables.alignCenter') },
            { value: 'end', label: t('examples.tables.alignEnd') },
          ]}
        />
      </label>
      <ActionsContext value={{ scope, onAction: (row, kind) => setPanel({ row, kind }) }}>
        <div ref={container} className="min-w-0">
          <DataTable
            profile="list"
            caption={t('examples.tables.presentation')}
            model={{ kind: 'client', rows }}
            columns={columns}
            getRowId={row => row.id}
            readState="ready"
            sourceCount={rows.length}
            resultCount={rows.length}
            labels={labels}
            toolbar={{ title: null }}
            align={align}
            columnAlign={{ description: 'start' }}
          />
        </div>
      </ActionsContext>
      {confirmed && <p role="status">{t('examples.tables.confirmedDemo')}</p>}
      <Modal
        open={panel !== null}
        onOpenChange={open => {
          if (!open) setPanel(null);
        }}
        title={t(panel?.kind === 'confirm' ? 'examples.tables.confirmDemo' : 'examples.tables.recordDetails')}
        {...(panel?.kind === 'confirm'
          ? {
              onConfirm: () => {
                setConfirmed(true);
                setPanel(null);
              },
            }
          : { footer: null })}
      >
        <p>{panel?.row.name ?? t('examples.tables.emptyRecord')}</p>
        <p className="mt-3 text-sm text-muted-foreground">{t('examples.tables.localOnly')}</p>
      </Modal>
    </ExampleSection>
  );
}
