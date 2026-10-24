import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutTemplate } from '../types/workout';
import { sessionElapsed } from '../utils/workout';

/**
 * Minimal localStorage stand-in so the real persisted store can be exercised
 * outside a browser.
 */
class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
}

const stubStorage = () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
};

/** Re-import the store, exactly like a page reload: fresh state from storage. */
async function reload() {
  vi.resetModules();
  const mod = await import('../store/useWorkoutStore');
  return mod.useWorkoutStore;
}

const push: WorkoutTemplate = {
  id: 't1',
  name: 'Push',
  numberOfSets: 2,
  exercises: [{ id: 'e1', name: 'Bench Press', reps: 10, type: 'reps', targetMuscles: [] }],
};

describe('active session persistence', () => {
  beforeEach(async () => {
    stubStorage();
    await reload(); // start from a clean, empty storage
  });

  it('survives a reload with its completed sets and logged numbers', async () => {
    const store = await reload();
    store.getState().startSession(push);
    store.getState().toggleSet('e1-set-1');
    store.getState().logSet('e1-set-1', { weightKg: 60, reps: 8 });
    store.getState().patchSession({ currentId: 'e1-set-2' });

    const after = await reload();
    expect(after.getState().session?.template.name).toBe('Push');
    expect(after.getState().session?.completedIds).toEqual(['e1-set-1']);
    expect(after.getState().session?.logs['e1-set-1']).toEqual({ weightKg: 60, reps: 8 });
    expect(after.getState().session?.currentId).toBe('e1-set-2');
  });

  it('reopens behind the resume prompt instead of taking over the screen', async () => {
    const store = await reload();
    store.getState().startSession(push);
    expect(store.getState().sessionOpen).toBe(true);

    const after = await reload();
    expect(after.getState().session).not.toBeNull();
    expect(after.getState().sessionOpen).toBe(false);
  });

  it('keeps the elapsed time across a reload', async () => {
    const store = await reload();
    store.getState().startSession(push);
    store.getState().patchSession({ lastTickAt: Date.now() - 90_000 });
    store.getState().commitSessionTime();

    const after = await reload();
    const elapsed = sessionElapsed(after.getState().session!);
    expect(elapsed).toBeGreaterThanOrEqual(90_000);
    expect(elapsed).toBeLessThan(90_000 + 5_000);
  });

  it('clears the session for good when it is discarded', async () => {
    const store = await reload();
    store.getState().startSession(push);
    store.getState().toggleSet('e1-set-1');
    store.getState().discardSession();

    const after = await reload();
    expect(after.getState().session).toBeNull();
    expect(after.getState().workouts).toHaveLength(0);
  });

  it('ignores session updates when no session is running', async () => {
    const store = await reload();
    store.getState().toggleSet('e1-set-1');
    store.getState().commitSessionTime();
    expect(store.getState().session).toBeNull();
  });
});
