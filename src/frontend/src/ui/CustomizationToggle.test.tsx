/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CustomizationToggle } from './CustomizationToggle';

afterEach(() => {
  cleanup();
});

const GEAR_ICON =
  '<svg aria-hidden="true" data-icon="gear" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<path d="M12 3.2l2.49 2.79 3.73-.21-.21 3.73L20.8 12l-2.79 2.49.21 3.73-3.73-.21L12 20.8l-2.49-2.79-3.73.21.21-3.73L3.2 12l2.79-2.49-.21-3.73 3.73.21z"></path>' +
  '<circle cx="12" cy="12" r="3.2"></circle>' +
  '</svg>';

const SHIP_ICON =
  '<svg aria-hidden="true" data-icon="ship" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
  '<path d="M12 2.6c2.7 2.5 4.1 5.8 4.1 9.3l2.7 3.4-3.2-.7a6.2 6.2 0 01-7.2 0l-3.2.7 2.7-3.4c0-3.5 1.4-6.8 4.1-9.3z"></path>' +
  '<circle cx="12" cy="8.8" r="1.5"></circle>' +
  '<path d="M10 18.7l2 2.7 2-2.7"></path>' +
  '</svg>';

/** The exact toggle markup: real button, gear + ship, exact label, aria-expanded state. */
function toggleMarkup(open: boolean): string {
  return (
    `<button type="button" class="customization-toggle" aria-expanded="${open}">` +
    `${GEAR_ICON}${SHIP_ICON}Spaceship customization` +
    '</button>'
  );
}

describe('CustomizationToggle markup (AC-7, AC-19)', () => {
  it('renders the closed toggle with the pinned class, both decorative icons and the exact label', () => {
    const html = renderToStaticMarkup(<CustomizationToggle open={false} onToggle={() => {}} />);

    expect(html).toBe(toggleMarkup(false));
  });

  it('sets aria-expanded to true when open', () => {
    const html = renderToStaticMarkup(<CustomizationToggle open onToggle={() => {}} />);

    expect(html).toBe(toggleMarkup(true));
  });

  it('renders a single native button with exactly two hidden, unfocusable svg icons before the label', () => {
    const { container } = render(<CustomizationToggle open={false} onToggle={() => {}} />);
    const button = screen.getByRole('button', { name: 'Spaceship customization' });
    const icons = Array.from(button.querySelectorAll('svg'));

    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('class')).toBe('customization-toggle');
    expect(button.textContent).toBe('Spaceship customization');
    expect(icons.map((icon) => icon.getAttribute('data-icon'))).toEqual(['gear', 'ship']);
    expect(icons.map((icon) => icon.getAttribute('aria-hidden'))).toEqual(['true', 'true']);
    expect(icons.map((icon) => icon.getAttribute('focusable'))).toEqual(['false', 'false']);
    expect(icons.map((icon) => icon.getAttribute('fill'))).toEqual(['none', 'none']);
    expect(icons.map((icon) => icon.getAttribute('viewBox'))).toEqual(['0 0 24 24', '0 0 24 24']);
  });

  it('reflects the open prop on aria-expanded across a re-render', () => {
    const { rerender } = render(<CustomizationToggle open={false} onToggle={() => {}} />);
    const button = screen.getByRole('button', { name: 'Spaceship customization' });

    expect(button.getAttribute('aria-expanded')).toBe('false');

    rerender(<CustomizationToggle open onToggle={() => {}} />);

    expect(button.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('CustomizationToggle interaction (AC-7)', () => {
  it('calls onToggle exactly once per click', async () => {
    const handler = vi.fn();
    render(<CustomizationToggle open={false} onToggle={handler} />);
    const button = screen.getByRole('button', { name: 'Spaceship customization' });

    await userEvent.click(button);
    expect(handler).toHaveBeenCalledTimes(1);

    await userEvent.click(button);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('is keyboard operable: tab focus plus Enter activates the toggle once', async () => {
    const handler = vi.fn();
    render(<CustomizationToggle open={false} onToggle={handler} />);
    const button = screen.getByRole('button', { name: 'Spaceship customization' });

    await userEvent.tab();
    expect(document.activeElement).toBe(button);

    await userEvent.keyboard('{Enter}');
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
