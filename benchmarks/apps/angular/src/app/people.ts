import { Component, ElementRef, computed, linkedSignal, resource, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { ApiError, Page, deletePeople, disablePerson, listPeople } from './api';

const COLUMNS = [['name', 'Name'], ['email', 'E-mail'], ['role', 'Role'], ['status', 'Status']] as const;

@Component({
  selector: 'app-people',
  templateUrl: './people.html',
})
export class People {
  protected readonly columns = COLUMNS;
  protected readonly pageSizes = [10, 100, 1000, 10000];
  protected readonly text = signal('');
  private readonly q = toSignal(toObservable(this.text).pipe(debounceTime(250)), { initialValue: '' });
  protected readonly sort = signal('');
  protected readonly pageSize = signal(10);
  protected readonly pageIndex = signal(0);
  protected readonly selected = signal<ReadonlySet<number>>(new Set());
  private readonly confirm = viewChild.required<ElementRef<HTMLDialogElement>>('confirm');

  private readonly list = resource({
    params: () => ({ q: this.q(), sort: this.sort(), limit: this.pageSize(), offset: this.pageIndex() * this.pageSize() }),
    loader: ({ params, abortSignal }) => listPeople(params, abortSignal),
  });
  // keep the previous page on screen while the next one loads
  protected readonly page = linkedSignal<Page | undefined, Page | undefined>({ source: () => this.list.hasValue() ? this.list.value() : undefined, computation: (next, previous) => next ?? previous?.value });
  protected readonly loading = computed(() => !this.page() && this.list.isLoading());
  protected readonly error = computed(() => { const e = this.list.error() as (Error & { cause?: unknown }) | undefined; const cause = e?.cause ?? e; return cause instanceof ApiError ? cause : undefined; });
  protected readonly total = computed(() => this.page()?.total ?? 0);
  protected readonly range = computed(() => `${this.total() ? this.pageIndex() * this.pageSize() + 1 : 0}–${Math.min(this.total(), (this.pageIndex() + 1) * this.pageSize())} of ${this.total()}`);
  protected readonly allSelected = computed(() => !!this.page()?.items.length && this.page()!.items.every((p) => this.selected().has(p.id)));

  reload() { this.list.reload(); }
  protected ariaSort(key: string) { const s = this.sort(); return s === key ? 'ascending' : s === `-${key}` ? 'descending' : null; }
  protected setSearch(value: string) { this.text.set(value); this.restart(); }
  protected toggleSort(key: string) { this.sort.update((s) => (s === key ? `-${key}` : s === `-${key}` ? '' : key)); this.restart(); }
  protected setSize(n: string) { this.pageSize.set(Number(n)); this.restart(); }
  protected go(delta: number) { this.pageIndex.update((i) => i + delta); this.selected.set(new Set()); }
  protected toggle(id: number) { this.selected.update((s) => { const next = new Set(s); next.delete(id) || next.add(id); return next; }); }
  protected toggleAll() { this.selected.set(this.allSelected() ? new Set() : new Set(this.page()!.items.map((p) => p.id))); }
  protected async remove() { await deletePeople([...this.selected()]); this.selected.set(new Set()); this.confirm().nativeElement.close(); this.reload(); }
  protected openConfirm() { this.confirm().nativeElement.showModal(); }
  protected closeConfirm() { this.confirm().nativeElement.close(); }
  protected async disable(id: number) {
    const person = await disablePerson(id);
    // the answer is the changed person: put it into the page instead of fetching it again
    this.page.update((p) => p && { ...p, items: p.items.map((x) => (x.id === person.id ? person : x)) });
  }
  private restart() { this.pageIndex.set(0); this.selected.set(new Set()); }
}
