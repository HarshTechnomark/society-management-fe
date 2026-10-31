import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { DataTable, type Column } from './DataTable';

interface Row {
  id: number;
  name: string;
  age: number;
}
const cols: Column<Row>[] = [
  { key: 'name', label: 'Name', render: r => r.name, sortValue: r => r.name },
  { key: 'age', label: 'Age', render: r => String(r.age), sortValue: r => r.age },
];
const rows: Row[] = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  name: `Person ${String(i).padStart(2, '0')}`,
  age: 20 + i,
}));

const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[0].textContent);

describe('DataTable', () => {
  it('paginates, sorts and searches', async () => {
    render(
      <DataTable caption="People" columns={cols} rows={rows} rowKey={r => r.id} searchText={r => r.name} />,
    );
    expect(names()).toHaveLength(10);
    expect(screen.getByText('1 to 10 of 25')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(names()[0]).toBe('Person 10');
    await userEvent.click(screen.getByRole('button', { name: /^Age/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Age/ }));
    expect(names()[0]).toBe('Person 24');
    expect(screen.getByRole('columnheader', { name: /Age/ })).toHaveAttribute('aria-sort', 'descending');
    await userEvent.type(screen.getByRole('searchbox'), 'person 03');
    expect(names()).toEqual(['Person 03']);
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('shows skeleton rows while loading, the empty state, and an error with the request id', () => {
    const { rerender } = render(
      <DataTable caption="P" columns={cols} rows={[]} rowKey={r => r.id} loading />,
    );
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(5);
    rerender(
      <DataTable
        caption="P"
        columns={cols}
        rows={[]}
        rowKey={r => r.id}
        empty={{ title: 'Only you so far' }}
      />,
    );
    expect(screen.getByText('Only you so far')).toBeInTheDocument();
    rerender(
      <DataTable
        caption="P"
        columns={cols}
        rows={[]}
        rowKey={r => r.id}
        error={new ApiError(500, 'INTERNAL_ERROR', 'Boom', undefined, 'req_9')}
      />,
    );
    expect(screen.getByText('req_9')).toBeInTheDocument();
  });

  it('calls onRowClick for a row click and for the keyboard button', async () => {
    const onRow = vi.fn();
    render(
      <DataTable
        caption="P"
        columns={cols}
        rows={rows.slice(0, 2)}
        rowKey={r => r.id}
        onRowClick={onRow}
        rowLabel={r => r.name}
      />,
    );
    await userEvent.click(screen.getByText('20'));
    expect(onRow).toHaveBeenCalledWith(rows[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Open Person 01' }));
    expect(onRow).toHaveBeenCalledTimes(2);
  });

  it('scrolls sideways inside its own wrapper', () => {
    render(<DataTable caption="P" columns={cols} rows={rows} rowKey={r => r.id} />);
    expect(screen.getByTestId('table-scroll')).toHaveClass('overflow-x-auto');
  });
});
