/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOTION } from '../game/motion';
import type { UpgradeState } from '../game/types';
import { UpgradesPanel } from './UpgradesPanel';

afterEach(() => {
  cleanup();
});

const ICON_PREFIX =
  '<svg aria-hidden="true" data-icon="';
const ICON_SUFFIX =
  '" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round"' +
  ' stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">';

const UPGRADE_CLICK_ICON =
  ICON_PREFIX +
  'upgrade-click' +
  ICON_SUFFIX +
  '<path d="M6 3.2l10.4 5.7-4.4 1.1-2 4.6z" fill="currentColor" stroke-width="1.1"></path>' +
  '<path d="M17.4 14.6v6.2M14.3 17.7h6.2"></path>' +
  '</svg>';

const UPGRADE_CUBE_ICON =
  ICON_PREFIX +
  'upgrade-cube' +
  ICON_SUFFIX +
  '<path d="M8.4 3.4l6 3.2v6.8l-6 3.2-6-3.2V6.6z"></path>' +
  '<path d="M2.4 6.6L8.4 9.8l6-3.2M8.4 9.8v6.8"></path>' +
  '<path d="M18.6 13v6.6M15.3 16.3h6.6"></path>' +
  '</svg>';

const UPGRADE_SPEED_ICON =
  ICON_PREFIX +
  'upgrade-speed' +
  ICON_SUFFIX +
  '<path d="M13.2 2.6L4.8 14.1h6.1L10.8 21.4l8.4-11.5h-6.1z" fill="currentColor" stroke-width="1.1"></path>' +
  '</svg>';

const DIAMOND_ICON =
  ICON_PREFIX +
  'diamond' +
  ICON_SUFFIX +
  '<path d="M7.2 3.4h9.6l3.8 5.4L12 20.8 3.4 8.8z"></path>' +
  '<path d="M3.4 8.8h17.2M7.2 3.4L12 8.8l4.8-5.4M12 20.8V8.8"></path>' +
  '</svg>';

type RowId = 'mini_cube_value' | 'cube_value' | 'speed_window';

const ROW_ICONS: Record<RowId, string> = {
  mini_cube_value: UPGRADE_CLICK_ICON,
  cube_value: UPGRADE_CUBE_ICON,
  speed_window: UPGRADE_SPEED_ICON,
};

interface RowFixture {
  id: RowId;
  name: string;
  level: string;
  effect: string;
  cost: string;
  enabled: boolean;
}

function row({ id, name, level, effect, cost, enabled }: RowFixture): string {
  return (
    `<li class="upgrade-row" data-upgrade="${id}">` +
    ROW_ICONS[id] +
    `<span data-name="true">${name}</span>` +
    `<span data-level="true">${level}</span>` +
    `<span data-effect="true">${effect}</span>` +
    DIAMOND_ICON +
    `<span data-cost="true">${cost}</span>` +
    `<button type="button" class="upgrade-buy" aria-label="Buy"${enabled ? '' : ' disabled=""'}></button>` +
    '</li>'
  );
}

function panel(mode: 'guest' | 'account', rows: readonly RowFixture[]): string {
  return (
    `<section aria-label="Upgrades" class="upgrades-panel" data-mode="${mode}">` +
    `<ul>${rows.map(row).join('')}</ul>` +
    '</section>'
  );
}

const ZERO_ROWS: readonly RowFixture[] = [
  {
    id: 'mini_cube_value',
    name: 'Click Power',
    level: '0/10',
    effect: '+10% coins per mini-cube',
    cost: '10',
    enabled: false,
  },
  {
    id: 'cube_value',
    name: 'Cube Bonus',
    level: '0/10',
    effect: '+10% coins per cube',
    cost: '50',
    enabled: false,
  },
  {
    id: 'speed_window',
    name: 'Quick Hands',
    level: '0/5',
    effect: '+2s speed-bonus window',
    cost: '25',
    enabled: false,
  },
];

describe('UpgradesPanel', () => {
  it('renders the pinned zero-state markup with row icons, cost diamonds and disabled buys', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={0} mode="account" onPurchase={() => {}} />,
    );

    expect(html).toBe(panel('account', ZERO_ROWS));

    // One decorative row icon and one decorative cost diamond per row (AC-6, AC-19).
    expect(html.match(/ data-icon="upgrade-click"/g)).toHaveLength(1);
    expect(html.match(/ data-icon="upgrade-cube"/g)).toHaveLength(1);
    expect(html.match(/ data-icon="upgrade-speed"/g)).toHaveLength(1);
    expect(html.match(/ data-icon="diamond"/g)).toHaveLength(3);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(6);
    expect(html.match(/focusable="false"/g)).toHaveLength(6);
  });

  it('renders level/max and the level-scaled cost for every upgrade', () => {
    const upgrades: UpgradeState = {
      mini_cube_value: 3,
      cube_value: 7,
      speed_window: 2,
    };
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={upgrades} coins={1000} mode="account" onPurchase={() => {}} />,
    );

    expect(html).toBe(
      panel('account', [
        {
          id: 'mini_cube_value',
          name: 'Click Power',
          level: '3/10',
          effect: '+10% coins per mini-cube',
          cost: '40', // 10 * (3 + 1)
          enabled: true,
        },
        {
          id: 'cube_value',
          name: 'Cube Bonus',
          level: '7/10',
          effect: '+10% coins per cube',
          cost: '400', // 50 * (7 + 1)
          enabled: true,
        },
        {
          id: 'speed_window',
          name: 'Quick Hands',
          level: '2/5',
          effect: '+2s speed-bonus window',
          cost: '75', // 25 * (2 + 1)
          enabled: true,
        },
      ]),
    );
  });

  it('renders Infinity cost and a disabled buy button at max level', () => {
    const upgrades: UpgradeState = {
      mini_cube_value: 10,
      cube_value: 10,
      speed_window: 5,
    };
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={upgrades} coins={10000} mode="account" onPurchase={() => {}} />,
    );

    expect(html).toBe(
      panel('account', [
        {
          id: 'mini_cube_value',
          name: 'Click Power',
          level: '10/10',
          effect: '+10% coins per mini-cube',
          cost: 'Infinity',
          enabled: false,
        },
        {
          id: 'cube_value',
          name: 'Cube Bonus',
          level: '10/10',
          effect: '+10% coins per cube',
          cost: 'Infinity',
          enabled: false,
        },
        {
          id: 'speed_window',
          name: 'Quick Hands',
          level: '5/5',
          effect: '+2s speed-bonus window',
          cost: 'Infinity',
          enabled: false,
        },
      ]),
    );
  });

  it('disables buy buttons when coins are below cost', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={5} mode="account" onPurchase={() => {}} />,
    );

    // Costs 10/50/25, none affordable with 5 coins.
    expect(html).toBe(panel('account', ZERO_ROWS));
  });

  it('enables only the affordable buy button when coins are 10', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={10} mode="account" onPurchase={() => {}} />,
    );

    expect(html).toBe(
      panel('account', [
        { ...ZERO_ROWS[0], enabled: true },
        { ...ZERO_ROWS[1], enabled: false },
        { ...ZERO_ROWS[2], enabled: false },
      ]),
    );
  });

  it('does not lock guests out under the approved Q-5 default', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={10} mode="guest" onPurchase={() => {}} />,
    );

    expect(html).toBe(
      panel('guest', [
        { ...ZERO_ROWS[0], enabled: true },
        { ...ZERO_ROWS[1], enabled: false },
        { ...ZERO_ROWS[2], enabled: false },
      ]),
    );
  });

  it('exposes the mode via a data attribute', () => {
    const guest = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={0} mode="guest" onPurchase={() => {}} />,
    );
    const account = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={0} mode="account" onPurchase={() => {}} />,
    );

    expect(guest).toContain(
      '<section aria-label="Upgrades" class="upgrades-panel" data-mode="guest">',
    );
    expect(account).toContain(
      '<section aria-label="Upgrades" class="upgrades-panel" data-mode="account">',
    );
  });

  it('calls onPurchase once with the upgrade id when an enabled buy control is clicked', async () => {
    const user = userEvent.setup();
    const onPurchase = vi.fn();
    render(<UpgradesPanel upgrades={{}} coins={10} mode="account" onPurchase={onPurchase} />);

    const buyButtons = screen.getAllByRole('button', { name: 'Buy' }) as HTMLButtonElement[];
    expect(buyButtons).toHaveLength(3);
    expect(buyButtons[0].disabled).toBe(false);
    expect(buyButtons[1].disabled).toBe(true);
    expect(buyButtons[2].disabled).toBe(true);

    await user.click(buyButtons[0]);
    expect(onPurchase).toHaveBeenCalledTimes(1);
    expect(onPurchase).toHaveBeenCalledWith('mini_cube_value');

    // A disabled max/affordability button never reaches the purchase callback.
    await user.click(buyButtons[1]);
    await user.click(buyButtons[2]);
    expect(onPurchase).toHaveBeenCalledTimes(1);
    expect(onPurchase).toHaveBeenCalledWith('mini_cube_value');
  });
});

describe('UpgradesPanel purchase pulse (AC-43, AC-48)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets data-purchased on the upgraded row for exactly 260 ms', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <UpgradesPanel upgrades={{}} coins={100} mode="account" onPurchase={() => {}} />,
    );
    const row = (): HTMLElement | null =>
      container.querySelector<HTMLElement>('li[data-upgrade="mini_cube_value"]');

    expect(row()?.getAttribute('data-purchased')).toBeNull();

    rerender(
      <UpgradesPanel
        upgrades={{ mini_cube_value: 1 }}
        coins={90}
        mode="account"
        onPurchase={() => {}}
      />,
    );
    expect(row()?.getAttribute('data-purchased')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(259);
    });
    expect(row()?.getAttribute('data-purchased')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(row()?.getAttribute('data-purchased')).toBeNull();
  });

  it('pulses only the row whose level increased', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <UpgradesPanel upgrades={{}} coins={100} mode="account" onPurchase={() => {}} />,
    );

    rerender(
      <UpgradesPanel
        upgrades={{ cube_value: 1 }}
        coins={50}
        mode="account"
        onPurchase={() => {}}
      />,
    );

    expect(
      container.querySelector('li[data-upgrade="mini_cube_value"]')?.getAttribute('data-purchased'),
    ).toBeNull();
    expect(
      container.querySelector('li[data-upgrade="cube_value"]')?.getAttribute('data-purchased'),
    ).toBe('true');
    expect(
      container.querySelector('li[data-upgrade="speed_window"]')?.getAttribute('data-purchased'),
    ).toBeNull();
  });

  it('adds no purchase pulse under reduced motion', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <UpgradesPanel
        upgrades={{}}
        coins={100}
        mode="account"
        reducedMotion
        onPurchase={() => {}}
      />,
    );

    rerender(
      <UpgradesPanel
        upgrades={{ mini_cube_value: 1 }}
        coins={90}
        mode="account"
        reducedMotion
        onPurchase={() => {}}
      />,
    );

    expect(
      container.querySelector('li[data-upgrade="mini_cube_value"]')?.getAttribute('data-purchased'),
    ).toBeNull();
  });

  it('uses the pinned 260 ms pulse token', () => {
    expect(MOTION.upgradePulseMs).toBe(260);
  });
});
