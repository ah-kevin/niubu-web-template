import { describe, expect, it } from 'vitest';
import { parseQuery, writeQuery, parseTab, mergeQuery } from '@niubu/core-shared';

describe('restorable query contracts', () => {
  it('normalizes illegal pages, sizes, sorts, direction and duplicate scalar parameters', () => {
    expect(parseQuery(new URLSearchParams('page=-3&pageSize=999&sort=bad&direction=sideways'), ['name'])).toMatchObject({ page: 1, pageSize: 25, sort: 'name', direction: 'asc' });
    expect(parseQuery(new URLSearchParams('page=2&page=3&pageSize=50&pageSize=100&q=a&q=b'), ['name'])).toMatchObject({ page: 1, pageSize: 25, q: '' });
    for (const page of ['0', '1.5', 'Infinity', '1e3', '9007199254740992']) expect(parseQuery(new URLSearchParams({ page }), ['name']).page).toBe(1);
  });
  it('rejects noncanonical numeric size syntax and unknown domain filters', () => {
    for (const pageSize of ['5e1', '050', '50.0', '+50', ' 50']) expect(parseQuery(new URLSearchParams({ pageSize }), ['name']).pageSize).toBe(25);
    expect(parseQuery(new URLSearchParams('filter.status=active&filter.status=archived&filter.other=x'), ['name'], { status: ['active'] }).filters).toEqual({ status: ['active'] });
  });
  it('round-trips bounded search and independent deduplicated multi-filters', () => {
    const query = parseQuery(new URLSearchParams('q=%20订单%20&page=2&pageSize=50&sort=name&direction=desc&filter.status=active&filter.status=active&filter.status=archived&filter.warehouse=B2&filter.__proto__=x&filter.constructor=y'), ['name']);
    expect(query).toEqual({ q: '订单', page: 2, pageSize: 50, sort: 'name', direction: 'desc', filters: { warehouse: ['B2'], status: ['active', 'archived'] } });
    expect(parseQuery(writeQuery(query), ['name'])).toEqual(query);
    expect(parseQuery(new URLSearchParams('q=bad%00value&filter.status=x%0Ay'), ['name'])).toMatchObject({ q: '', filters: {} });
  });
  it('whitelists tabs and preserves scope, returnTo and view while replacing only list state', () => {
    expect(parseTab(new URLSearchParams('tab=details'), ['summary', 'details'], 'summary')).toBe('details');
    expect(parseTab(new URLSearchParams('tab=details&tab=summary'), ['summary', 'details'], 'summary')).toBe('summary');
    expect(parseTab(new URLSearchParams('tab=unknown'), ['summary', 'details'], 'summary')).toBe('summary');
    const params = mergeQuery(new URLSearchParams('view=items&scopeKind=workspace&scopeId=workspace-a&returnTo=%2Fsales%2Forders&filter.old=old&page=6'), parseQuery(new URLSearchParams('q=单单'), ['name']));
    expect(params.get('view')).toBe('items');
    expect(params.get('scopeId')).toBe('workspace-a');
    expect(params.get('returnTo')).toBe('/sales/orders');
    expect(params.has('filter.old')).toBe(false);
    expect(params.get('q')).toBe('单单');
  });
});
