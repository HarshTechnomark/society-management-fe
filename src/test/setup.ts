import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom has no layout engine; focus helpers and scrollIntoView are no-ops there.
Element.prototype.scrollIntoView = () => {};
