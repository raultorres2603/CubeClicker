import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

import { SpaceshipCustomizationPanel } from './SpaceshipCustomizationPanel';
import type { CustomizationState } from '../game/types';

const EMPTY: CustomizationState = { lootboxes: 0, keys: 0, parts: {}, appearance: {} };

describe('SpaceshipCustomizationPanel (SSR contract)', () => {
  it('renders a section with aria-label "Spaceship customization"', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel customization={EMPTY} mode="guest" onOpenLootbox={() => undefined} onEquip={() => undefined} />,
    );
    expect(html).toContain('<section');
    expect(html).toContain('aria-label="Spaceship customization"');
  });

  it('renders lootbox and key counts', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel customization={{ lootboxes: 3, keys: 2, parts: {}, appearance: {} }} mode="guest" onOpenLootbox={() => undefined} onEquip={() => undefined} />,
    );
    expect(html).toContain('Lootboxes: 3');
    expect(html).toContain('Keys: 2');
  });

  it('renders an Open lootbox button', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel customization={EMPTY} mode="guest" onOpenLootbox={() => undefined} onEquip={() => undefined} />,
    );
    expect(html).toContain('Open lootbox');
  });

  it('disables Open lootbox when lootboxes === 0', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel customization={{ lootboxes: 0, keys: 5, parts: {}, appearance: {} }} mode="guest" onOpenLootbox={() => undefined} onEquip={() => undefined} />,
    );
    expect(html).toContain('disabled');
  });

  it('disables Open lootbox when keys === 0', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel customization={{ lootboxes: 5, keys: 0, parts: {}, appearance: {} }} mode="guest" onOpenLootbox={() => undefined} onEquip={() => undefined} />,
    );
    expect(html).toContain('disabled');
  });

  it('enables Open lootbox when both counts > 0', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel customization={{ lootboxes: 1, keys: 1, parts: {}, appearance: {} }} mode="guest" onOpenLootbox={() => undefined} onEquip={() => undefined} />,
    );
    const disabledCount = (html.match(/disabled/g) ?? []).length;
    expect(disabledCount).toBe(0);
  });

  it('renders one li per owned part with Equip button', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel
        customization={{ lootboxes: 1, keys: 1, parts: { 'nose-crimson': 2, 'body-gold': 1 }, appearance: {} }}
        mode="guest"
        onOpenLootbox={() => undefined}
        onEquip={() => undefined}
      />,
    );
    const liCount = (html.match(/<li /g) ?? []).length;
    expect(liCount).toBe(2);
    const equipCount = (html.match(/Equip/g) ?? []).length;
    expect(equipCount).toBe(2);
  });

  it('renders part names', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel
        customization={{ lootboxes: 1, keys: 1, parts: { 'nose-crimson': 1 }, appearance: {} }}
        mode="guest"
        onOpenLootbox={() => undefined}
        onEquip={() => undefined}
      />,
    );
    expect(html).toContain('Crimson Nose');
  });

  it('renders a SpaceshipPreview canvas', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel customization={EMPTY} mode="guest" onOpenLootbox={() => undefined} onEquip={() => undefined} />,
    );
    expect(html).toContain('spaceship-preview');
    expect(html).toContain('<canvas');
  });

  it('records mode on the section', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel customization={EMPTY} mode="account" onOpenLootbox={() => undefined} onEquip={() => undefined} />,
    );
    expect(html).toContain('data-mode="account"');
  });

  it('supports direct props', () => {
    const html = renderToString(
      <SpaceshipCustomizationPanel lootboxes={2} keys={3} parts={{ 'engine-blue': 1 }} appearance={{ engine: 'engine-blue' }} mode="guest" onOpenLootbox={() => undefined} onEquip={() => undefined} />,
    );
    expect(html).toContain('Lootboxes: 2');
    expect(html).toContain('Keys: 3');
  });
});
