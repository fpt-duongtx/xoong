import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import * as api from './api.js';

const required = 'Please fill in this field.';
const schema = z.object({
  name: z.string().trim().min(1, required).max(60),
  email: z.string().min(1, required).email('Enter a valid e-mail address.'),
  role: z.enum(['admin', 'member'], { errorMap: () => ({ message: required }) }),
});
const PAGE_SIZES = [10, 100, 1000, 10000];
const ARIA_SORT = { asc: 'ascending', desc: 'descending' };

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
  { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row, table }) => <button onClick={() => table.options.meta.disable(row.original.id)}>Disable</button> },
];

function useDebounced(value, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function AddPerson({ dialog }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', role: '' } });
  const create = useMutation({
    mutationFn: api.createPerson,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['people'] }); dialog.current.close(); },
    onError: (e) => Object.entries(e.fields ?? {}).forEach(([field, message]) => setError(field, { message })),
  });
  const field = (name) => ({ ...register(name), 'aria-invalid': errors[name] ? 'true' : undefined, 'aria-describedby': errors[name] ? `${name}-error` : undefined });
  const hint = (name) => errors[name] && <small id={`${name}-error`}>{errors[name].message}</small>;
  return (
    <dialog ref={dialog} onClose={() => reset()}>
      <form onSubmit={handleSubmit((values) => create.mutate(values))} noValidate>
        <h2>Add a person</h2>
        <label>Name *<input {...field('name')} /></label>{hint('name')}
        <label>Email *<input type="email" {...field('email')} /></label>{hint('email')}
        <label>Role *
          <select {...field('role')}><option value="" disabled></option><option>admin</option><option>member</option></select>
        </label>{hint('role')}
        <div className="row">
          <button type="submit" disabled={create.isPending}>Add</button>
          <button type="button" onClick={() => dialog.current.close()}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}

function People() {
  const queryClient = useQueryClient();
  const confirm = useRef(null);
  const [text, setText] = useState('');
  const q = useDebounced(text);
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [rowSelection, setRowSelection] = useState({});

  // a new search, sort or page size starts again from the first page with nothing ticked
  const restart = () => { setRowSelection({}); setPagination((p) => ({ ...p, pageIndex: 0 })); };
  useEffect(restart, [q]);

  const params = { q, sort: sorting[0] && (sorting[0].desc ? '-' : '') + sorting[0].id, limit: pagination.pageSize, offset: pagination.pageIndex * pagination.pageSize };
  const { data, error, isLoading } = useQuery({ queryKey: ['people', params], queryFn: () => api.listPeople(params), placeholderData: keepPreviousData });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['people'] });
  const remove = useMutation({ mutationFn: api.deletePeople, onSuccess: () => { setRowSelection({}); confirm.current.close(); refresh(); } });
  // the answer is the changed person: put it into the cached pages instead of fetching them again
  const disable = useMutation({
    mutationFn: api.disablePerson,
    onSuccess: (person) => queryClient.setQueriesData({ queryKey: ['people'] }, (page) => page && { ...page, items: page.items.map((p) => (p.id === person.id ? person : p)) }),
  });

  const table = useReactTable({
    data: data?.items ?? [], columns, getRowId: (row) => String(row.id), getCoreRowModel: getCoreRowModel(),
    manualSorting: true, manualPagination: true, rowCount: data?.total ?? 0,
    state: { sorting, pagination, rowSelection },
    onSortingChange: (updater) => { setSorting(updater); restart(); },
    onPaginationChange: (updater) => { setPagination(updater); setRowSelection({}); },
    onRowSelectionChange: setRowSelection,
    meta: { disable: disable.mutate },
  });
  const selected = Object.keys(rowSelection).map(Number);
  const { pageIndex, pageSize } = pagination;
  const total = data?.total ?? 0;

  return (
    <>
      {isLoading && <p role="status">Loading…</p>}
      {error && <p className="error" role="alert">{error.code}: {error.message}</p>}
      <div className="filters">
        {selected.length > 0 && <><span>{selected.length} selected</span><button className="danger" onClick={() => confirm.current.showModal()}>Delete selected</button></>}
        <input type="search" aria-label="Search" placeholder="Search" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <table>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map(({ id, column, getContext }) => (
                <th key={id} scope="col" aria-sort={ARIA_SORT[column.getIsSorted()]}>
                  {column.getCanSort() ? <button className="sort" onClick={column.getToggleSortingHandler()}>{column.columnDef.header}</button> : flexRender(column.columnDef.header, getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {!isLoading && !error && !total && <p>No people found</p>}
      <nav aria-label="Pagination" className="pager">
        <span>{`${total ? pageIndex * pageSize + 1 : 0}–${Math.min(total, (pageIndex + 1) * pageSize)} of ${total}`}</span>
        <label>Rows per page
          <select value={pageSize} onChange={(e) => table.setPageSize(Number(e.target.value))}>{PAGE_SIZES.map((n) => <option key={n}>{n}</option>)}</select>
        </label>
        {table.getCanPreviousPage() && <button onClick={table.previousPage}>Previous</button>}
        {table.getCanNextPage() && <button onClick={table.nextPage}>Next</button>}
      </nav>
      <dialog ref={confirm} role="alertdialog" aria-label="Delete the selected people?">
        <p>Delete the selected people?</p>
        <div className="row">
          <button onClick={() => confirm.current.close()}>Cancel</button>
          <button className="danger" onClick={() => remove.mutate(selected)}>Delete</button>
        </div>
      </dialog>
    </>
  );
}

export function App() {
  const addDialog = useRef(null);
  return (
    <>
      <header><strong>Team admin</strong></header>
      <nav aria-label="Main"><a href="/" aria-current="page">People</a></nav>
      <main>
        <h1>People</h1>
        <button onClick={() => addDialog.current.showModal()}>Add a person</button>
        <People />
        <AddPerson dialog={addDialog} />
      </main>
    </>
  );
}
