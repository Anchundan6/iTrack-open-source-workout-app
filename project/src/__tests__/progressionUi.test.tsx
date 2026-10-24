// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ActiveWorkout } from '../components/ActiveWorkout';
import { useWorkoutStore } from '../store/useWorkoutStore';
import type { Workout, WorkoutTemplate } from '../types/workout';

afterEach(cleanup);

// jsdom has no layout, so nothing scrolls.
Element.prototype.scrollIntoView = vi.fn();

const push: WorkoutTemplate = {
  id: 't1',
  name: 'Push',
  numberOfSets: 1,
  exercises: [{ id: 'e1', name: 'Bench Press', reps: 10, type: 'reps', targetMuscles: [] }],
};

/** A past session of the same routine: 60 kg × 10 — target reached. */
const pastWorkout = (weight: number, reps: number): Workout => ({
  id: 'w1',
  name: 'Push',
  templateId: 't1',
  date: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  duration: 1800,
  completionPercentage: 100,
  completed: true,
  exercises: [
    {
      id: 'e1-set-1',
      name: 'Bench Press',
      reps: 10,
      type: 'reps',
      targetMuscles: [],
      setNumber: 1,
      sets: [{ id: 's1', reps, weight, completed: true }],
    },
  ],
});

beforeEach(() => {
  useWorkoutStore.setState({ workouts: [], templates: [], session: null, sessionOpen: false, language: 'en', weightUnit: 'kg' });
  useWorkoutStore.getState().startSession(push);
});

const open = () => {
  const onFinish = vi.fn();
  render(<ActiveWorkout session={useWorkoutStore.getState().session!} onFinish={onFinish} />);
  return onFinish;
};

describe('progression suggestion in the workout sheet', () => {
  it('shows why, in words, when the target was reached', () => {
    useWorkoutStore.setState({ workouts: [pastWorkout(60, 10)] });
    open();
    expect(screen.getByText(/up to 62.5 kg/)).toBeTruthy();
  });

  it('suggests one more rep when the target was missed', () => {
    useWorkoutStore.setState({ workouts: [pastWorkout(60, 8)] });
    open();
    expect(screen.getByText(/go for 9/)).toBeTruthy();
  });

  it('says it is the first time when there is no history', () => {
    open();
    expect(screen.getByText(/First time/)).toBeTruthy();
    // Nothing to change yet, so there is nothing to accept.
    expect(screen.queryByText('Use')).toBeNull();
  });

  it('fills the inputs only when the user accepts the suggestion', () => {
    useWorkoutStore.setState({ workouts: [pastWorkout(60, 10)] });
    open();
    const weight = screen.getByLabelText('Weight (kg)') as HTMLInputElement;
    const reps = screen.getByLabelText('Reps') as HTMLInputElement;
    // Prefilled from history, not from the suggestion.
    expect(weight.value).toBe('60');
    expect(reps.value).toBe('10');

    fireEvent.click(screen.getByText('Use'));
    expect(weight.value).toBe('62.5');
    expect(reps.value).toBe('8');
  });

  it('never writes the suggestion into history', () => {
    useWorkoutStore.setState({ workouts: [pastWorkout(60, 10)] });
    open();
    fireEvent.click(screen.getByText('Use'));
    fireEvent.click(screen.getByText('Complete set'));

    const store = useWorkoutStore.getState();
    // The past session is untouched…
    expect(store.workouts[0].exercises[0].sets[0]).toEqual({ id: 's1', reps: 10, weight: 60, completed: true });
    // …and the suggestion only landed in this session's log, via the button.
    expect(store.session?.logs['e1-set-1']).toEqual({ weightKg: 62.5, reps: 8 });
    expect(store.session?.completedIds).toEqual(['e1-set-1']);
  });
});
