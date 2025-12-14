import { describe, it, expect } from 'vitest';

// Jednoduchý test utility funkcí
describe('Smoke Tests - Utils', () => {
  it('should pass basic assertion', () => {
    expect(true).toBe(true);
  });

  it('should do basic math', () => {
    expect(2 + 2).toBe(4);
  });
});
