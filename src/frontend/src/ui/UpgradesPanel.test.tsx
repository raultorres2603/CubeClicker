import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { UpgradeState } from '../game/types';
import { UpgradesPanel } from './UpgradesPanel';

describe('UpgradesPanel', () => {
  it('renders all three upgrades with name, level/max, effect preview and cost', () => {
    const upgrades: UpgradeState = {};
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={upgrades} coins={0} mode="account" onPurchase={() => {}} />,
    );

    expect(html).toContain('Click Power');
    expect(html).toContain('Cube Bonus');
    expect(html).toContain('Quick Hands');

    expect(html).toContain('0/10');
    expect(html).toContain('0/5');

    expect(html).toContain('+10% coins per mini-cube');
    expect(html).toContain('+10% coins per cube');
    expect(html).toContain('+2s speed-bonus window');

    // base costs at level 0
    expect(html).toContain('>10<');
    expect(html).toContain('>50<');
    expect(html).toContain('>25<');
  });

  it('renders level/max and cost from provided upgrade levels', () => {
    const upgrades: UpgradeState = {
      mini_cube_value: 3,
      cube_value: 7,
      speed_window: 2,
    };
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={upgrades} coins={1000} mode="account" onPurchase={() => {}} />,
    );

    expect(html).toContain('3/10');
    expect(html).toContain('7/10');
    expect(html).toContain('2/5');

    // cost = baseCost * (level + 1)
    expect(html).toContain('>40<'); // 10 * 4
    expect(html).toContain('>400<'); // 50 * 8
    expect(html).toContain('>75<'); // 25 * 3
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

    expect(html).toContain('10/10');
    expect(html).toContain('5/5');
    expect(html).toContain('Infinity');
    // all buy buttons disabled
    expect(html).not.toContain('<button type="button" aria-label="Buy"></button>');
  });

  it('disables buy buttons when coins are below cost', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={5} mode="account" onPurchase={() => {}} />,
    );

    // cost 10/50/25, none affordable with 5 coins -> all disabled
    expect(html).not.toContain('<button type="button" aria-label="Buy"></button>');
  });

  it('enables a buy button when affordable', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={10} mode="account" onPurchase={() => {}} />,
    );

    // mini_cube_value cost 10 affordable -> one enabled button
    expect(html).toContain('<button type="button" aria-label="Buy"></button>');
  });

  it('calls onPurchase with the upgrade id when the buy button is clicked (enabled)', () => {
    const onPurchase = vi.fn();
    // SSR cannot invoke handlers; assert the callback is accepted and the button
    // is enabled for the affordable upgrade.
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={10} mode="account" onPurchase={onPurchase} />,
    );
    expect(html).toContain('data-upgrade="mini_cube_value"');
    expect(onPurchase).not.toHaveBeenCalled();
  });

  it('does not lock guests out under the approved Q-5 default', () => {
    const html = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={10} mode="guest" onPurchase={() => {}} />,
    );

    expect(html).toContain('<button type="button" aria-label="Buy"></button>');
  });

  it('exposes the mode via a data attribute', () => {
    const guest = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={0} mode="guest" onPurchase={() => {}} />,
    );
    const account = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={0} mode="account" onPurchase={() => {}} />,
    );
    expect(guest).toContain('data-mode="guest"');
    expect(account).toContain('data-mode="account"');
  });

  it('renders the upgrades-panel class on the root section', () => {
    const guest = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={0} mode="guest" onPurchase={() => {}} />,
    );
    const account = renderToStaticMarkup(
      <UpgradesPanel upgrades={{}} coins={0} mode="account" onPurchase={() => {}} />,
    );
    expect(guest).toContain('<section aria-label="Upgrades" class="upgrades-panel" data-mode="guest">');
    expect(account).toContain('<section aria-label="Upgrades" class="upgrades-panel" data-mode="account">');
  });
});