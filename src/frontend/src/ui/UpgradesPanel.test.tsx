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
  level: number;
  maxLevel: number;
  effect: string;
  cost: string;
  /** Drives both `data-affordable` and the buy button's disabled state (AC-20). */
  affordable: boolean;
}

/** The `aria-hidden` level track: exactly `maxLevel` dots, the first `level` filled. */
function pips(maxLevel: number, level: number): string {
  return (
    '<span class="upgrade-pips" aria-hidden="true">' +
    Array.from(
      { length: maxLevel },
      (_, index) =>
        `<span class="upgrade-pip" data-filled="${index < level ? 'true' : 'false'}"></span>`,
    ).join('') +
    '</span>'
  );
}

function row({ id, name, level, maxLevel, effect, cost, affordable }: RowFixture): string {
  return (
    `<li class="upgrade-row" data-upgrade="${id}" data-affordable="${affordable ? 'true' : 'false'}">` +
    ROW_ICONS[id] +
    `<span data-name="true">${name}</span>` +
    `<span data-level="true">${level}/${maxLevel}</span>` +
    `<span data-effect="true">${effect}</span>` +
    DIAMOND_ICON +
    `<span data-cost="true">${cost}</span>` +
    pips(maxLevel, level) +
    `<button type="button" class="upgrade-buy" aria-label="Buy"${affordable ? '' : ' disabled=""'}></button>` +
    '</li>'
  );
}

function panel(mode: 'guest' | 'account', coins: number, rows: readonly RowFixture[]): string {
  const coinsText = coins.toFixed(2);
  return (
    `<section aria-label="Upgrades" class="upgrades-panel" data-mode="${mode}">` +
    '<h2 class="upgrades-title">Upgrades</h2>' +
    `<p class="upgrades-balance" data-coins="${coinsText}">Coins ${coinsText}</p>` +
    `<ul>${rows.map(row).join('')}</ul>` +
    '</section>'
  );
}

const ZERO_ROWS: readonly RowFixture[] = [
  {
    id: 'mini_cube_value',
    name: 'Click Power',
    level: 0,
    maxLevel: 10,
    effect: '+10% coins per mini-cube',
    cost: '10',
    affordable: false,
  },
  {
    id: 'cube_value',
    name: 'Cube Bonus',
    level: 0,
    maxLevel: 10,
    effect: '+10% coins per cube',
    cost: '50',
    affordable: false,
  },
  {
    id: 'speed_window',
    name: 'Quick Hands',
    level: 0,
    maxLevel: 5,
    effect: '+2s speed-bonus window',
    cost: '25',
    affordable: false,
  },
];

describe('UpgradesPanel', () => {
  it('renders the pinned zero-state markup with title, balance, pips, icons and disabled buys', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={0} mode="account" onPurchase={() => {}} />,
    );

    expect(html).toBe(panel('account', 0, ZERO_ROWS));

    // One decorative row icon and one decorative cost diamond per row (AC-6, AC-19).
    expect(html.match(/ data-icon="upgrade-click"/g)).toHaveLength(1);
    expect(html.match(/ data-icon="upgrade-cube"/g)).toHaveLength(1);
    expect(html.match(/ data-icon="upgrade-speed"/g)).toHaveLength(1);
    expect(html.match(/ data-icon="diamond"/g)).toHaveLength(3);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(9);
    expect(html.match(/focusable="false"/g)).toHaveLength(6);

    // 10 + 10 + 5 pips, none filled at level 0 (AC-20).
    expect(html.match(/class="upgrade-pip"/g)).toHaveLength(25);
    expect(html.match(/data-filled="true"/g)).toBeNull();
    expect(html.match(/data-affordable="false"/g)).toHaveLength(3);
  });

  it('renders level/max, the level-scaled cost and one filled pip per level', () => {
    const upgrades: UpgradeState = {
      mini_cube_value: 3,
      cube_value: 7,
      speed_window: 2,
    };
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={upgrades} coins={1000} mode="account" onPurchase={() => {}} />,
    );

    expect(html).toBe(
      panel('account', 1000, [
        {
          id: 'mini_cube_value',
          name: 'Click Power',
          level: 3,
          maxLevel: 10,
          effect: '+10% coins per mini-cube',
          cost: '40', // 10 * (3 + 1)
          affordable: true,
        },
        {
          id: 'cube_value',
          name: 'Cube Bonus',
          level: 7,
          maxLevel: 10,
          effect: '+10% coins per cube',
          cost: '400', // 50 * (7 + 1)
          affordable: true,
        },
        {
          id: 'speed_window',
          name: 'Quick Hands',
          level: 2,
          maxLevel: 5,
          effect: '+2s speed-bonus window',
          cost: '75', // 25 * (2 + 1)
          affordable: true,
        },
      ]),
    );

    // 3 + 7 + 2 filled dots across the three tracks.
    expect(html.match(/data-filled="true"/g)).toHaveLength(12);
    expect(html.match(/data-filled="false"/g)).toHaveLength(13);
  });

  it('renders Infinity cost, full pips and a disabled buy button at max level', () => {
    const upgrades: UpgradeState = {
      mini_cube_value: 10,
      cube_value: 10,
      speed_window: 5,
    };
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={upgrades} coins={10000} mode="account" onPurchase={() => {}} />,
    );

    expect(html).toBe(
      panel('account', 10000, [
        {
          id: 'mini_cube_value',
          name: 'Click Power',
          level: 10,
          maxLevel: 10,
          effect: '+10% coins per mini-cube',
          cost: 'Infinity',
          affordable: false,
        },
        {
          id: 'cube_value',
          name: 'Cube Bonus',
          level: 10,
          maxLevel: 10,
          effect: '+10% coins per cube',
          cost: 'Infinity',
          affordable: false,
        },
        {
          id: 'speed_window',
          name: 'Quick Hands',
          level: 5,
          maxLevel: 5,
          effect: '+2s speed-bonus window',
          cost: 'Infinity',
          affordable: false,
        },
      ]),
    );

    // A maxed row is never affordable and every dot is filled.
    expect(html.match(/data-affordable="true"/g)).toBeNull();
    expect(html.match(/data-filled="true"/g)).toHaveLength(25);
  });

  it('disables buy buttons when coins are below cost', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={5} mode="account" onPurchase={() => {}} />,
    );

    // Costs 10/50/25, none affordable with 5 coins.
    expect(html).toBe(panel('account', 5, ZERO_ROWS));
  });

  it('enables only the affordable buy button when coins are 10', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={10} mode="account" onPurchase={() => {}} />,
    );

    expect(html).toBe(
      panel('account', 10, [
        { ...ZERO_ROWS[0], affordable: true },
        { ...ZERO_ROWS[1], affordable: false },
        { ...ZERO_ROWS[2], affordable: false },
      ]),
    );
  });

  it('does not lock guests out under the approved Q-5 default', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={10} mode="guest" onPurchase={() => {}} />,
    );

    expect(html).toBe(
      panel('guest', 10, [
        { ...ZERO_ROWS[0], affordable: true },
        { ...ZERO_ROWS[1], affordable: false },
        { ...ZERO_ROWS[2], affordable: false },
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
      '<section aria-label="Upgrades" class="upgrades-panel" data-mode="guest">' +
        '<h2 class="upgrades-title">Upgrades</h2>' +
        '<p class="upgrades-balance" data-coins="0.00">Coins 0.00</p>',
    );
    expect(account).toContain(
      '<section aria-label="Upgrades" class="upgrades-panel" data-mode="account">' +
        '<h2 class="upgrades-title">Upgrades</h2>' +
        '<p class="upgrades-balance" data-coins="0.00">Coins 0.00</p>',
    );
  });

  it('renders the Upgrades heading and the two-decimal coin balance (AC-20, AC-29)', () => {
    render(<UpgradesPanel upgrades={{}} coins={12.5} mode="account" onPurchase={() => {}} />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Upgrades' });
    expect(heading.tagName).toBe('H2');
    expect(heading.className).toBe('upgrades-title');

    const balance = screen.getByText('Coins 12.50');
    expect(balance.tagName).toBe('P');
    expect(balance.className).toBe('upgrades-balance');
    expect(balance.getAttribute('data-coins')).toBe('12.50');
  });

  it('marks exactly the rows whose cost the balance covers as data-affordable', () => {
    const { container } = render(
      <UpgradesPanel upgrades={{}} coins={25} mode="account" onPurchase={() => {}} />,
    );
    const affordable = (id: RowId): string | null | undefined =>
      container
        .querySelector(`li[data-upgrade="${id}"]`)
        ?.getAttribute('data-affordable');

    expect(affordable('mini_cube_value')).toBe('true');
    expect(affordable('cube_value')).toBe('false');
    expect(affordable('speed_window')).toBe('true');
  });

  it('renders one aria-hidden pip track per row with maxLevel dots and the level filled', () => {
    const { container } = render(
      <UpgradesPanel
        upgrades={{ mini_cube_value: 3, cube_value: 0, speed_window: 5 }}
        coins={0}
        mode="account"
        onPurchase={() => {}}
      />,
    );

    const rows = container.querySelectorAll('li.upgrade-row');
    expect(rows).toHaveLength(3);

    const rowPips = (index: number): Element[] =>
      Array.from(rows[index]!.querySelectorAll('.upgrade-pips .upgrade-pip'));
    const filled = (dots: readonly Element[]): number =>
      dots.filter((dot) => dot.getAttribute('data-filled') === 'true').length;

    expect(rowPips(0)).toHaveLength(10);
    expect(filled(rowPips(0))).toBe(3);
    expect(rowPips(1)).toHaveLength(10);
    expect(filled(rowPips(1))).toBe(0);
    expect(rowPips(2)).toHaveLength(5);
    expect(filled(rowPips(2))).toBe(5);

    const tracks = container.querySelectorAll('.upgrade-pips');
    expect(tracks).toHaveLength(3);
    for (const track of tracks) {
      expect(track.getAttribute('aria-hidden')).toBe('true');
    }
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
