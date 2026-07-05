import { describe, it, expect } from 'vitest';
import { startError } from './eligibility';

describe('startError', () => {
  it('same player twice', () => expect(startError('A', 'A', [], null)).toBe('same_player'));
  it('empty queue → anyone', () => expect(startError('A', 'B', [], null)).toBeNull());
  it('non-empty queue → both must be queued', () =>
    expect(startError('A', 'X', ['A', 'B'], null)).toBe('not_in_queue'));
  it('last winner is exempt', () =>
    expect(startError('W', 'A', ['A', 'B'], 'W')).toBeNull());
  it('two from queue ok', () => expect(startError('A', 'B', ['A', 'B', 'C'], 'W')).toBeNull());
  it('last winner rule covers only the winner', () =>
    expect(startError('W', 'X', ['A'], 'W')).toBe('not_in_queue'));
});
