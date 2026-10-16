import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from '@niubu/locales/react';
import { ArrowUpRight, Search } from '@niubu/icons';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@niubu/shadcn-ui/dialog';
import type { ObjectSearchResult, SearchDialogProps, SearchItem, WidgetLinkRenderer } from './types';
export default function CommandSearchDialog({
  pages,
  locale,
  loadObjects,
  renderLink,
  description,
  scopeNote,
  contentId,
  onClose,
  returnFocus,
}: SearchDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const failure = t('shell:search.failure');
  const request = useMemo(() => ({ loadObjects, failure }), [loadObjects, failure]);
  const [loaded, setLoaded] = useState<{ request: typeof request; result: ObjectSearchResult } | null>(null);
  const catalog = loaded?.request === request ? loaded.result : null;
  const resultsRef = useRef<HTMLDivElement>(null),
    inputRef = useRef<HTMLInputElement>(null);
  const needle = query.trim().toLocaleLowerCase(locale);
  const matches = (item: SearchItem) =>
    `${item.title} ${item.description ?? ''}`.toLocaleLowerCase(locale).includes(needle);
  const pageMatches = pages.filter(matches);
  const objects = catalog?.status === 'ready' ? catalog.data.filter(matches) : [];
  const changeOpen = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose();
        setQuery('');
        setLoaded(null);
      }
    },
    [onClose],
  );
  useEffect(() => {
    if (!request.loadObjects) return;
    const controller = new AbortController();
    let current = true;
    void Promise.resolve()
      .then(() => {
        if (!current) return undefined;
        return request.loadObjects?.(controller.signal);
      })
      .then(result => {
        if (current && result) setLoaded({ request, result });
      })
      .catch(() => {
        if (current) setLoaded({ request, result: { status: 'error', message: request.failure } });
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [request]);
  const move = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const links = [...(resultsRef.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [])];
    const index = links.indexOf(event.currentTarget),
      next = event.key === 'ArrowDown' ? links[index + 1] : links[index - 1];
    if (next) next.focus();
    else if (event.key === 'ArrowUp') inputRef.current?.focus();
  };

  return (
    <Dialog open onOpenChange={changeOpen}>
      <DialogContent
        closeLabel={t('common:close')}
        id={contentId}
        className="command-dialog"
        onCloseAutoFocus={event => {
          event.preventDefault();
          returnFocus();
        }}
        onOpenAutoFocus={event => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle>{t('shell:search.title')}</DialogTitle>
        <DialogDescription>{description ?? t('shell:search.description')}</DialogDescription>
        <div className="command-input">
          <Search size={20} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            aria-label={t('shell:search.input')}
            placeholder={t('shell:search.placeholder')}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                resultsRef.current?.querySelector('a')?.focus();
              }
            }}
          />
        </div>
        <div className="command-results" ref={resultsRef}>
          <p className="eyebrow">
            {query ? t('shell:search.matches', { count: pageMatches.length }) : t('shell:search.accessible')}
          </p>
          {pageMatches.map(item => (
            <SearchResult
              key={item.id}
              item={item}
              renderLink={renderLink}
              onSelect={() => changeOpen(false)}
              onKeyDown={move}
            />
          ))}
          {!pageMatches.length && <p className="empty-search">{t('shell:search.noPages')}</p>}
          {scopeNote && <p className="eyebrow">{scopeNote}</p>}
          {loadObjects && !catalog && <p role="status">{t('shell:search.loading')}</p>}
          {catalog?.status === 'error' && <p role="status">{catalog.message}</p>}
          {catalog?.status === 'ready' && (
            <>
              <p className="command-object-count">{t('shell:search.objectMatches', { count: objects.length })}</p>
              {objects.slice(0, 50).map(item => (
                <SearchResult
                  key={item.id}
                  item={item}
                  renderLink={renderLink}
                  onSelect={() => changeOpen(false)}
                  onKeyDown={move}
                />
              ))}
              {objects.length > 50 && <p>{t('shell:search.first50')}</p>}
              {!objects.length && <p>{t('shell:search.noObjects')}</p>}
            </>
          )}
        </div>
        <div className="command-footer">
          {t('shell:search.keyboard')}
          <span>{t('shell:search.escape')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchResult({
  item,
  renderLink,
  onSelect,
  onKeyDown,
}: {
  item: SearchItem;
  renderLink: WidgetLinkRenderer;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLAnchorElement>) => void;
}) {
  return renderLink({
    href: item.href,
    onClick: onSelect,
    onKeyDown,
    children: (
      <>
        <span>
          <strong>{item.title}</strong>
          {item.description && <small>{item.description}</small>}
        </span>
        <ArrowUpRight size={17} aria-hidden="true" />
      </>
    ),
  });
}
