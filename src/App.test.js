import { render, screen } from '@testing-library/react';
import App from './App';

test('renders hero name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: /zeeshan kashif/i })).toBeInTheDocument();
});
