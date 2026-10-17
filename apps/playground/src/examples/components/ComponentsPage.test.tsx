import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ComponentsPage } from './ComponentsPage';

beforeAll(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); });
afterAll(() => { vi.unstubAllGlobals(); });

describe('basic controls existing subset', () => {
  it('combines independent single and multiple choices into the applied output', async () => {
    render(<ComponentsPage />);
    await userEvent.click(screen.getByRole('radio', { name: 'Comfortable' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Email' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'SMS' }));
    await userEvent.click(screen.getByRole('button', { name: 'Apply choices' }));
    expect(screen.getByLabelText('Applied choices')).toHaveTextContent('Comfortable · Email, SMS');
    await userEvent.click(screen.getByRole('button', { name: 'Reset choices' }));
    expect(screen.getByRole('radio', { name: 'Compact' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Email' })).not.toBeChecked();
    expect(screen.getByLabelText('Applied choices')).toHaveTextContent('No choices applied');
  });

  it('only renders the conditional context action after enabling it', async () => {
    render(<ComponentsPage />);
    fireEvent.contextMenu(screen.getByText('Right-click this sample'));
    expect(screen.queryByRole('menuitem', { name: 'Archive sample' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Inspect sample' }));
    expect(screen.getByLabelText('Menu result')).toHaveTextContent('Inspected demo-7');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Allow archive action' }));
    fireEvent.contextMenu(screen.getByText('Right-click this sample'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Archive sample' }));
    expect(screen.getByLabelText('Menu result')).toHaveTextContent('Archived demo-7');
  });

  it('reveals the string tooltip from its focusable button', async () => {
    render(<ComponentsPage />);
    await userEvent.hover(screen.getByRole('button', { name: 'Tooltip example' }));
    expect(within(await screen.findByRole('tooltip')).getByText('A plain string tooltip')).toBeInTheDocument();
  });
});
