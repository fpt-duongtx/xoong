import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { listPeople, deletePeople, disablePerson } from './api.js';
import { Dialog } from './Dialog.jsx';

const PAGE_SIZES = [10, 100, 1000, 10000];

export function PeopleTable() {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState([]);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [rowSelection, setRowSelection] = useState({});
  const [confirming, setConfirming] = useState(false);

  // Typing is applied 250 ms after it pauses (xoong's search boxes wait the same time), so a request is not sent per keystroke.
  useEffect(() => {
    if (text === q) return;
    const timer = setTimeout(() => { setQ(text); setPagination((p) => ({ ...p, pageIndex: 0 })); setRowSelection({}); }, 250);
    return () => clearTimeout(timer);
  }, [text, q]);

  const sort = sorting[0] ? (sorting[0].desc ? '-' : '') + sorting[0].id : undefined;
  const params = { q, sort, limit: pagination.pageSize, offset: pagination.pageIndex * pagination.pageSize };
  const { data, error, isLoading } = useQuery({ queryKey: ['people', params], queryFn: () => listPeople(params), placeholderData: keepPreviousData });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['people'] });
  const remove = useMutation({ mutationFn: deletePeople, onSuccess: () => { setRowSelection({}); setConfirming(false); refresh(); } });
  // the server answers with the changed person: put it into every cached page instead of fetching the page again
  const disable = useMutation({
    mutationFn: disablePerson,
    onSuccess: (person) => queryClient.setQueriesData({ queryKey: ['people'] }, (page) => page && { ...page, items: page.items.map((p) => (p.id === person.id ? person : p)) }),
  });

  const columns = [
    {
      id: 'select',
      header: ({ table }) => <input type="checkbox" aria-label="Select all rows" checked={table.getIsAllRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} />,
      cell: ({ row }) => <input type="checkbox" aria-label="Select row" checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />,
      enableSorting: false,
    },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'E-mail' },
    { accessorKey: 'role', header: 'Role' },
    { accessorKey: 'status', header: 'Status' },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => <button onClick={() => disable.mutate(row.original.id)}>Disable</button> },
  ];
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const table = useReactTable({
    data: items,
    columns,
    getRowId: (row) => String(row.id),
    state: { sorting, rowSelection },
    manualSorting: true,
    onSortingChange: (updater) => { setSorting(updater); setPagination((p) => ({ ...p, pageIndex: 0 })); setRowSelection({}); },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  });
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]).map(Number);
  const from = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const to = Math.min(total, pagination.pageIndex * pagination.pageSize + items.length);

  return (
    <>
      {isLoading && <p role="status">Loading…</p>}
      {error && <p className="error" role="alert">{error.code}: {error.message}</p>}
      <div className="filters">
        {selectedIds.length > 0 && (
          <>
            <span>{selectedIds.length} selected</span>
            <button className="danger" onClick={() => setConfirming(true)}>Delete selected</button>
          </>
        )}
        <input type="search" aria-label="Search" placeholder="Search" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <table>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} scope="col" aria-sort={header.column.getIsSorted() ? (header.column.getIsSorted() === 'desc' ? 'descending' : 'ascending') : undefined}>
                  {header.column.getCanSort()
                    ? <button className="sort" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}</button>
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!isLoading && !error && items.length === 0 && <p>No people found</p>}
      <nav aria-label="Pagination" className="pager">
        <span>{`${from}–${to} of ${total}`}</span>
        <label>Rows per page
          <select value={pagination.pageSize} onChange={(e) => { setPagination({ pageIndex: 0, pageSize: Number(e.target.value) }); setRowSelection({}); }}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        {pagination.pageIndex > 0 && <button onClick={() => { setPagination((p) => ({ ...p, pageIndex: p.pageIndex - 1 })); setRowSelection({}); }}>Previous</button>}
        {to < total && <button onClick={() => { setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 })); setRowSelection({}); }}>Next</button>}
      </nav>
      <Dialog open={confirming} onClose={() => setConfirming(false)} role="alertdialog" label="Delete the selected people?">
        <p>Delete the selected people?</p>
        <div className="row">
          <button onClick={() => setConfirming(false)}>Cancel</button>
          <button className="danger" onClick={() => remove.mutate(selectedIds)}>Delete</button>
        </div>
      </Dialog>
    </>
  );
}
