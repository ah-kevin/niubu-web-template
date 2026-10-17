import { useTranslation } from '@niubu/locales/react';
import { useState } from 'react';
import { writeQuery } from '@niubu/core-shared';
import { Search, X } from '@niubu/icons';
import type { QueryState } from '@niubu/core-typings';
import { Button } from '@niubu/shadcn-ui/button';
import { Checkbox } from '@niubu/shadcn-ui/checkbox';
import { Label } from '@niubu/shadcn-ui/label';
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
    <section
      className="pattern-filter-bar flex min-w-0 flex-wrap items-center gap-x-[var(--workspace-section-gap)] gap-y-[var(--workspace-heading-gap)] py-[var(--workspace-card-padding)] mb-[8px]"
      aria-label={t('filter.region')}
    >
      <div className="pattern-search-field relative min-w-0 max-w-[360px] flex-[1_1_210px] [@media(max-width:700px)]:max-w-none [@media(max-width:700px)]:basis-full [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:left-[12px] [&>svg]:top-1/2 [&>svg]:-translate-y-1/2 [&>svg]:text-muted-foreground">
        <Search size={17} aria-hidden="true" />
        <Input
          className="h-[var(--workspace-control-height)] border-[var(--control-border)] bg-card dark:bg-card pl-[38px] text-[length:var(--workspace-body-font-size)] md:text-[length:var(--workspace-body-font-size)] text-foreground placeholder:text-[var(--placeholder)] placeholder:opacity-100"
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
        <fieldset
          className="pattern-filter-group m-0 flex min-w-0 flex-wrap items-center gap-[6px] border-0 p-0"
          key={filter.id}
        >
          <legend className="float-left mr-[7px] pt-[8px] text-[length:var(--workspace-caption-font-size)] text-muted-foreground">
            {filter.label}
          </legend>
          {filter.options.map(option => (
            <Label
              className="flex cursor-pointer items-center gap-[6px] rounded-[var(--radius-md)] border border-border px-[8px] py-[6px] text-[length:var(--workspace-caption-font-size)] has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-[var(--nav-active)] has-[[data-state=checked]]:text-[var(--primary-text)]"
              key={option.value}
            >
              <Checkbox
                type="button"
                checked={query.filters[filter.id]?.includes(option.value) ?? false}
                onCheckedChange={checked => {
                  const old = query.filters[filter.id] ?? [];
                  const next =
                    checked === true
                      ? [...new Set([...old, option.value])]
                      : old.filter(value => value !== option.value);
                  const updated = { ...query.filters };
                  if (next.length) updated[filter.id] = next;
                  else delete updated[filter.id];
                  onQueryChange({ ...query, page: 1, filters: updated });
                }}
              />
              {option.label}
            </Label>
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
