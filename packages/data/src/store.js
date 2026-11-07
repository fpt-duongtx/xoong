// @ts-check
import { signal, batch } from '@xoong/core/signals';
import { setPointer } from './pointer.js';

/** A reference to a stored entity: { $ref: "User#42" } */
export const isRef = (v) => !!v && typeof v === 'object' && typeof v.$ref === 'string';
export const refKey = (name, id) => `${name}#${id}`;
const shallowEqual = (a, b) => {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.is(a[k], b[k]));
};

/**
 * Normalized entity store. Every entity is one signal, so a change made by a
 * mutation, a refetch or a stream event is seen by every screen reading it.
 *
 * @param {Record<string, { id: string, props?: Record<string, any> }>} [entityDefs]
 */
export function createStore(entityDefs = {}) {
  /**
   * One signal per entity key, kept even after deletion (value undefined) so that
   * readers stay subscribed and see an entity that is deleted and later re-created.
   * @type {Map<string, import('@xoong/core/signals').Signal<any>>}
   */
  const entities = new Map();
  /** @type {Map<string, Set<string>>} entity name -> ids that currently exist */
  const ids = new Map();
  /** @type {Map<string, import('@xoong/core/signals').Signal<number>>} */
  const indexTick = new Map();
  /** Last applied stream version per entity; deletes keep theirs so late events cannot resurrect. */
  const versions = new Map();

  const tick = (name) => {
    let s = indexTick.get(name);
    if (!s) indexTick.set(name, (s = signal(0)));
    return s;
  };
  const bump = (name) => { const s = tick(name); s.value = s.peek() + 1; };
  const slot = (key) => {
    let s = entities.get(key);
    if (!s) entities.set(key, (s = signal(undefined)));
    return s;
  };
  const exists = (key) => entities.get(key)?.peek() !== undefined;

  const store = {
    defs: entityDefs,

    /** Insert or merge an entity record (already normalized: nested entities are refs). */
    upsert(name, id, record) {
      const key = refKey(name, id);
      const sig = slot(key);
      const current = sig.peek();
      if (current !== undefined) {
        const next = { ...current, ...record };
        if (!shallowEqual(current, next)) sig.value = next;
      } else {
        batch(() => {
          sig.value = { ...record };
          if (!ids.has(name)) ids.set(name, new Set());
          ids.get(name).add(String(id));
          bump(name);
        });
      }
      return { $ref: key };
    },

    /** Remove an entity. References to it resolve to undefined afterwards. */
    remove(name, id) {
      const key = refKey(name, id);
      if (!exists(key)) return;
      batch(() => {
        ids.get(name)?.delete(String(id));
        entities.get(key).value = undefined; // notify readers; the slot stays for re-creation
        bump(name);
      });
    },

    /** Tracked read of one entity record (nested entities remain refs). Tracks even when absent. */
    read(key) {
      return slot(key).value;
    },

    /**
     * Tracked existence check. Subscribes to adds/removes of that entity type
     * only (not to field changes), so lists can drop deleted rows cheaply.
     */
    has(ref) {
      const name = ref.$ref.slice(0, ref.$ref.indexOf('#'));
      tick(name).value;
      return exists(ref.$ref);
    },

    /** Resolve a ref to its record (tracked); other values pass through. */
    deref(v) {
      return isRef(v) ? store.read(v.$ref) : v;
    },

    /** Tracked list of all loaded entity refs of a type. */
    refs(name) {
      tick(name).value; // subscribe to adds/removes
      return [...(ids.get(name) ?? [])].map((id) => ({ $ref: refKey(name, id) }));
    },

    /** Deeply resolve refs into plain objects (tracked). Cycles are cut. */
    denormalize(v, seen = new Set()) {
      if (isRef(v)) {
        if (seen.has(v.$ref)) return v;
        const rec = store.read(v.$ref);
        if (rec === undefined) return undefined;
        const next = new Set(seen).add(v.$ref);
        return store.denormalize(rec, next);
      }
      if (Array.isArray(v)) {
        // References to deleted entities drop out of lists instead of leaving holes.
        return v.map((x) => store.denormalize(x, seen)).filter((x, i) => !(x === undefined && isRef(v[i])));
      }
      if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v)) {
          Object.defineProperty(out, k, { value: store.denormalize(v[k], seen), enumerable: true, writable: true, configurable: true });
        }
        return out;
      }
      return v;
    },

    /**
     * Apply one stream event. Returns true if applied, false if dropped
     * (stale version, unknown entity, malformed).
     * Events: {type:'patch'|'upsert'|'delete', entity, id, path?, value?, version?}
     */
    applyEvent(ev) {
      if (!ev || typeof ev !== 'object' || typeof ev.entity !== 'string' || ev.id == null) return false;
      const key = refKey(ev.entity, ev.id);
      if (typeof ev.version === 'number') {
        const seen = versions.get(key);
        if (seen !== undefined && ev.version <= seen) return false;
      }
      let applied = false;
      if (ev.type === 'delete') {
        if (exists(key)) { store.remove(ev.entity, ev.id); applied = true; }
      } else if (ev.type === 'upsert') {
        if (ev.value && typeof ev.value === 'object') {
          store.upsert(ev.entity, ev.id, normalizeRecord(store, ev.entity, ev.value));
          applied = true;
        }
      } else if (ev.type === 'patch') {
        const sig = entities.get(key);
        if (sig && exists(key) && typeof ev.path === 'string') {
          const next = setPointer(sig.peek(), ev.path, ev.value);
          if (!shallowEqual(sig.peek(), next)) sig.value = next;
          applied = true;
        }
      }
      if (applied && typeof ev.version === 'number') versions.set(key, ev.version);
      return applied;
    },

    clear() {
      batch(() => {
        for (const sig of entities.values()) sig.value = undefined;
        ids.clear(); versions.clear();
        for (const name of indexTick.keys()) bump(name);
      });
    },
  };
  return store;
}

/** Normalize a plain entity object into a record whose nested entities are refs. */
export function normalizeRecord(store, name, value, touched) {
  const def = store.defs[name];
  const record = { ...value };
  if (def?.props) {
    for (const [k, desc] of Object.entries(def.props)) {
      if (k in record) record[k] = normalize(store, desc, record[k], touched);
    }
  }
  return record;
}

/**
 * Walk `value` using a schema descriptor, storing entities and returning the
 * normalized tree. `touched` (optional Set) collects the keys of every entity written. Descriptors: {t:'entity',name} | {t:'array',items} | {t:'object',props} | {t:'union',key,map,default?}
 */
export function normalize(store, desc, value, touched) {
  if (!desc || value == null) return value;
  switch (desc.t) {
    case 'entity': {
      if (typeof value !== 'object') return value;
      const def = store.defs[desc.name];
      const id = def ? value[def.id] : undefined;
      if (id === undefined || id === null) return value; // no identity: keep inline
      const ref = store.upsert(desc.name, id, normalizeRecord(store, desc.name, value, touched));
      touched?.add(ref.$ref);
      return ref;
    }
    case 'array':
      return Array.isArray(value) ? value.map((x) => normalize(store, desc.items, x, touched)) : value;
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) return value;
      const out = { ...value };
      for (const [k, d] of Object.entries(desc.props ?? {})) if (k in out) out[k] = normalize(store, d, out[k], touched);
      return out;
    }
    case 'union': {
      // Pick the member by its tag property; anything else (a plain id string, an unknown tag) stays as received.
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const member = (value[desc.key] !== undefined ? desc.map[value[desc.key]] : undefined) ?? desc.default;
      return member ? normalize(store, member, value, touched) : value;
    }
    default:
      return value;
  }
}
