import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement Element.scrollIntoView (used by Chat.tsx to keep
// the latest message in view) — polyfill it as a no-op so components that
// call it don't crash under test. Real behavior only matters in a real browser.
// Guarded: this setup file also runs for test files using the "node"
// environment (e.g. the API route tests), where Element doesn't exist at all.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
