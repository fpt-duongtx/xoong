<script setup>
import { computed, ref, watch } from 'vue';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { FlexRender, getCoreRowModel, useVueTable } from '@tanstack/vue-table';
import { listPeople, deletePeople, disablePerson } from './api.js';

const PAGE_SIZES = [10, 100, 1000, 10000];
const queryClient = useQueryClient();
const sorting = ref([]);
const text = ref('');
const q = ref('');
const pagination = ref({ pageIndex: 0, pageSize: 10 });
const rowSelection = ref({});
const confirm = ref(null);

const sort = computed(() => (sorting.value[0] ? (sorting.value[0].desc ? '-' : '') + sorting.value[0].id : undefined));
const params = computed(() => ({ q: q.value, sort: sort.value, limit: pagination.value.pageSize, offset: pagination.value.pageIndex * pagination.value.pageSize }));
const { data, error, isLoading } = useQuery({ queryKey: computed(() => ['people', params.value]), queryFn: () => listPeople(params.value), placeholderData: keepPreviousData });
const refresh = () => queryClient.invalidateQueries({ queryKey: ['people'] });
const remove = useMutation({ mutationFn: deletePeople, onSuccess: () => { rowSelection.value = {}; confirm.value.close(); refresh(); } });
// the server answers with the changed person: put it into every cached page instead of fetching the page again
const disable = useMutation({
  mutationFn: disablePerson,
  onSuccess: (person) => queryClient.setQueriesData({ queryKey: ['people'] }, (page) => page && { ...page, items: page.items.map((p) => (p.id === person.id ? person : p)) }),
});

const columns = [
  { id: 'select', enableSorting: false },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'E-mail' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: 'Actions', enableSorting: false },
];
const items = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);
const update = (state) => (updater) => { state.value = typeof updater === 'function' ? updater(state.value) : updater; };
const table = useVueTable({
  get data() { return items.value; },
  columns,
  getRowId: (row) => String(row.id),
  state: { get sorting() { return sorting.value; }, get rowSelection() { return rowSelection.value; } },
  manualSorting: true,
  onSortingChange: (u) => { update(sorting)(u); pagination.value = { ...pagination.value, pageIndex: 0 }; rowSelection.value = {}; },
  onRowSelectionChange: update(rowSelection),
  getCoreRowModel: getCoreRowModel(),
});
const selectedIds = computed(() => Object.keys(rowSelection.value).filter((id) => rowSelection.value[id]).map(Number));
const from = computed(() => (total.value === 0 ? 0 : pagination.value.pageIndex * pagination.value.pageSize + 1));
const to = computed(() => Math.min(total.value, pagination.value.pageIndex * pagination.value.pageSize + items.value.length));
const sortState = (column) => (column.getIsSorted() ? (column.getIsSorted() === 'desc' ? 'descending' : 'ascending') : undefined);
const goto = (delta) => { pagination.value = { ...pagination.value, pageIndex: pagination.value.pageIndex + delta }; rowSelection.value = {}; };
// Typing is applied 250 ms after it pauses (xoong's search boxes wait the same time), so a request is not sent per keystroke.
let timer;
watch(text, (value) => {
  clearTimeout(timer);
  timer = setTimeout(() => { q.value = value; pagination.value = { ...pagination.value, pageIndex: 0 }; rowSelection.value = {}; }, 250);
});
const setSize = (n) => { pagination.value = { pageIndex: 0, pageSize: Number(n) }; rowSelection.value = {}; };
</script>

<template>
  <p v-if="isLoading" role="status">Loading…</p>
  <p v-if="error" class="error" role="alert">{{ error.code }}: {{ error.message }}</p>
  <div class="filters">
    <template v-if="selectedIds.length > 0">
      <span>{{ selectedIds.length }} selected</span>
      <button class="danger" @click="confirm.showModal()">Delete selected</button>
    </template>
    <input type="search" aria-label="Search" placeholder="Search" v-model="text">
  </div>
  <table>
    <thead>
      <tr v-for="group in table.getHeaderGroups()" :key="group.id">
        <th v-for="header in group.headers" :key="header.id" scope="col" :aria-sort="sortState(header.column)">
          <input v-if="header.column.id === 'select'" type="checkbox" aria-label="Select all rows" :checked="table.getIsAllRowsSelected()" @change="table.getToggleAllRowsSelectedHandler()($event)">
          <button v-else-if="header.column.getCanSort()" class="sort" @click="header.column.getToggleSortingHandler()($event)">
            <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
          </button>
          <FlexRender v-else :render="header.column.columnDef.header" :props="header.getContext()" />
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in table.getRowModel().rows" :key="row.id">
        <td v-for="cell in row.getVisibleCells()" :key="cell.id">
          <input v-if="cell.column.id === 'select'" type="checkbox" aria-label="Select row" :checked="row.getIsSelected()" @change="row.getToggleSelectedHandler()($event)">
          <button v-else-if="cell.column.id === 'actions'" @click="disable.mutate(row.original.id)">Disable</button>
          <template v-else>{{ cell.getValue() }}</template>
        </td>
      </tr>
    </tbody>
  </table>
  <p v-if="!isLoading && !error && items.length === 0">No people found</p>
  <nav aria-label="Pagination" class="pager">
    <span>{{ `${from}–${to} of ${total}` }}</span>
    <label>Rows per page
      <select :value="pagination.pageSize" @change="setSize($event.target.value)">
        <option v-for="n in PAGE_SIZES" :key="n" :value="n">{{ n }}</option>
      </select>
    </label>
    <button v-if="pagination.pageIndex > 0" @click="goto(-1)">Previous</button>
    <button v-if="to < total" @click="goto(1)">Next</button>
  </nav>
  <dialog ref="confirm" role="alertdialog" aria-label="Delete the selected people?">
    <p>Delete the selected people?</p>
    <div class="row">
      <button @click="confirm.close()">Cancel</button>
      <button class="danger" @click="remove.mutate(selectedIds)">Delete</button>
    </div>
  </dialog>
</template>
