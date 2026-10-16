import { useTranslation } from '@niubu/locales/react';
import { useState } from 'react';
import { writeQuery } from '@niubu/core-shared';
import { Search, X } from '@niubu/icons';
import type { QueryState } from '@niubu/core-typings';
import { Button } from '@niubu/shadcn-ui/button';
import { Input } from '@niubu/shadcn-ui/input';

export type FilterDefinition = Readonly<{
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
}>;

export function FilterBar({
  query,
  onQueryChange,
  filters = [],
}: {
  query: QueryState;
  onQueryChange: (q: QueryState) => void;
  filters?: readonly FilterDefinition[];
}) {
  const { t } = useTranslation();
  const queryKey = writeQuery(query).toString();
  const [edit, setEdit] = useState(() => ({
    text: query.q,
    sourceKey: queryKey,
    publishedKey: null as string | null,
  }));
  // URL acknowledgements may normalize trailing whitespace. Preserve that active
  // edit, but adopt meaningful external URL changes before committing child UI.
  if (edit.sourceKey !== queryKey) {
    setEdit({
      text: edit.publishedKey === queryKey ? edit.text : query.q,
      sourceKey: queryKey,
      publishedKey: null,
    });
  }
  const active = Boolean(edit.text || Object.values(query.filters).some(values => values.length));
  return (
    <section className="pattern-filter-bar" aria-label={t('filter.region')}>
      <div className="pattern-search-field">
        <Search size={17} aria-hidden="true" />
        <Input
          type="search"
          aria-label={t('filter.search')}
          placeholder={t('filter.search')}
          maxLength={200}
          value={edit.text}
          onChange={event => {
            const next = { ...query, q: event.target.value, page: 1 };
            setEdit({ text: event.target.value, sourceKey: queryKey, publishedKey: writeQuery(next).toString() });
            onQueryChange(next);
          }}
        />
      </div>
      {filters.map(filter => (
        <fieldset className="pattern-filter-group" key={filter.id}>
          <legend>{filter.label}</legend>
          {filter.options.map(option => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={query.filters[filter.id]?.includes(option.value) ?? false}
                onChange={event => {
                  const old = query.filters[filter.id] ?? [];
                  const next = event.target.checked
                    ? [...new Set([...old, option.value])]
                    : old.filter(value => value !== option.value);
                  const updated = { ...query.filters };
                  if (next.length) updated[filter.id] = next;
                  else delete updated[filter.id];
                  onQueryChange({ ...query, page: 1, filters: updated });
                }}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      ))}
      {active && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const next = { ...query, q: '', filters: {}, page: 1 };
            setEdit({ text: '', sourceKey: queryKey, publishedKey: writeQuery(next).toString() });
            onQueryChange(next);
          }}
        >
          <X size={15} aria-hidden="true" />
          {t('clearFilters')}
        </Button>
      )}
    </section>
  );
}
