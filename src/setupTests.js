// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe(element) {
    this.callback([{ isIntersecting: true, target: element }], this);
  }

  unobserve() {}

  disconnect() {}
}

global.IntersectionObserver = MockIntersectionObserver;
