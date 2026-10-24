// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExercisePicker } from '../components/ExercisePicker';
import { useWorkoutStore } from '../store/useWorkoutStore';

afterEach(cleanup);

const openPicker = () => {
  const onPick = vi.fn();
  const onCustom = vi.fn();
  const onClose = vi.fn();
  render(<ExercisePicker open onClose={onClose} onPick={onPick} onCustom={onCustom} />);
  return { onPick, onCustom, onClose };
};

const search = (text: string) => fireEvent.change(screen.getByLabelText('搜索动作或别名'), { target: { value: text } });

describe('ExercisePicker', () => {
  it('renders in Chinese and lists the library', () => {
    useWorkoutStore.setState({ language: 'zh' });
    openPicker();
    expect(screen.getByText('动作库')).toBeTruthy();
    expect(screen.getByText('Barbell Bench Press')).toBeTruthy();
    expect(screen.getByText(/个动作/)).toBeTruthy();
  });

  it('filters by search text, including aliases', () => {
    useWorkoutStore.setState({ language: 'zh' });
    openPicker();
    search('pullup');
    expect(screen.getByText('Pull Up')).toBeTruthy();
    expect(screen.queryByText('Barbell Bench Press')).toBeNull();
  });

  it('shows the how-to and hands the exercise back on add', () => {
    useWorkoutStore.setState({ language: 'zh' });
    const { onPick } = openPicker();
    search('barbell bench press');
    fireEvent.click(screen.getByText('Barbell Bench Press'));
    expect(screen.getByText('动作步骤')).toBeTruthy();
    expect(screen.getByText(/杠铃/)).toBeTruthy();

    fireEvent.click(screen.getByText('加入模板'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].id).toBe('barbell-bench-press');
  });

  it('filters by muscle group', () => {
    useWorkoutStore.setState({ language: 'zh' });
    openPicker();
    fireEvent.click(screen.getByText('腿与臀'));
    // Only leg exercises remain: no chest pressing left in the list.
    expect(screen.queryByText('Barbell Bench Press')).toBeNull();
    expect(screen.getByText('Barbell Back Squat')).toBeTruthy();
  });

  it('falls back to a custom exercise when nothing matches', () => {
    useWorkoutStore.setState({ language: 'zh' });
    const { onCustom } = openPicker();
    search('Zombie Press');
    expect(screen.getByText('没有匹配的动作。')).toBeTruthy();
    fireEvent.click(screen.getByText('使用自定义动作「Zombie Press」'));
    expect(onCustom).toHaveBeenCalledWith('Zombie Press');
  });
});
