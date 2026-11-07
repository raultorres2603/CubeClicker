import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import * as icons from './icons';

interface IconCase {
  readonly name: string;
  readonly Icon: ComponentType<icons.IconProps>;
  /** Exact opening markup of a non-empty shape child (path/circle/polygon). */
  readonly shape: string;
  /** Exact number of path/circle/polygon children the icon renders. */
  readonly shapeCount: number;
}

const ICON_CASES: readonly IconCase[] = [
  {
    name: 'cursor',
    Icon: icons.CursorIcon,
    shape: '<path d="M5.5 3.2l14 7.6-6.3 1.6-2.9 6.4z"',
    shapeCount: 1,
  },
  {
    name: 'cube',
    Icon: icons.CubeIcon,
    shape: '<path d="M12 2.8l8 4.4v9.6l-8 4.4-8-4.4V7.2z"',
    shapeCount: 2,
  },
  {
    name: 'coin',
    Icon: icons.CoinIcon,
    shape: '<circle cx="12" cy="12" r="8.75"',
    shapeCount: 2,
  },
  {
    name: 'server',
    Icon: icons.ServerIcon,
    shape: '<path d="M11 7h6M11 17h6"',
    shapeCount: 3,
  },
  {
    name: 'cube-level',
    Icon: icons.CubeLevelIcon,
    shape: '<path d="M9 3.6l6.4 3.3v6.9L9 17.1l-6.4-3.3V6.9z"',
    shapeCount: 3,
  },
  {
    name: 'group',
    Icon: icons.GroupIcon,
    shape: '<circle cx="9" cy="8" r="3.1"',
    shapeCount: 4,
  },
  {
    name: 'gear',
    Icon: icons.GearIcon,
    shape: '<path d="M12 3.2l2.49 2.79 3.73-.21-.21 3.73L20.8 12l-2.79 2.49.21 3.73-3.73-.21L12 20.8l-2.49-2.79-3.73.21.21-3.73L3.2 12l2.79-2.49-.21-3.73 3.73.21z"',
    shapeCount: 2,
  },
  {
    name: 'ship',
    Icon: icons.ShipIcon,
    shape: '<path d="M12 2.6c2.7 2.5 4.1 5.8 4.1 9.3l2.7 3.4-3.2-.7a6.2 6.2 0 01-7.2 0l-3.2.7 2.7-3.4c0-3.5 1.4-6.8 4.1-9.3z"',
    shapeCount: 3,
  },
  {
    name: 'diamond',
    Icon: icons.DiamondIcon,
    shape: '<path d="M7.2 3.4h9.6l3.8 5.4L12 20.8 3.4 8.8z"',
    shapeCount: 2,
  },
  {
    name: 'upgrade-click',
    Icon: icons.UpgradeClickIcon,
    shape: '<path d="M6 3.2l10.4 5.7-4.4 1.1-2 4.6z"',
    shapeCount: 2,
  },
  {
    name: 'upgrade-cube',
    Icon: icons.UpgradeCubeIcon,
    shape: '<path d="M8.4 3.4l6 3.2v6.8l-6 3.2-6-3.2V6.6z"',
    shapeCount: 3,
  },
  {
    name: 'upgrade-speed',
    Icon: icons.UpgradeSpeedIcon,
    shape: '<path d="M13.2 2.6L4.8 14.1h6.1L10.8 21.4l8.4-11.5h-6.1z"',
    shapeCount: 1,
  },
];

describe.each(ICON_CASES)('$name icon', ({ name, Icon, shape, shapeCount }) => {
  it('renders a decorative 24×24 currentColor SVG with a non-empty shape child', () => {
    const html = renderToStaticMarkup(<Icon />);

    expect(html.startsWith('<svg ')).toBe(true);
    expect(html.endsWith('</svg>')).toBe(true);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('focusable="false"');
    expect(html).toContain(`data-icon="${name}"`);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain(shape);
    expect(html.match(/<(?:path|circle|polygon)\b/g)).toHaveLength(shapeCount);
    expect(html).not.toContain('class=');
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('href');
    expect(html).not.toContain('<use');
    expect(html).not.toContain('<image');
    expect(html).not.toContain('<foreignObject');
  });
});

describe('className forwarding', () => {
  it('adds the optional class to the SVG root', () => {
    const html = renderToStaticMarkup(<icons.GearIcon className="hud-icon" />);

    expect(html).toContain('<svg aria-hidden="true" class="hud-icon" data-icon="gear"');
  });

  it('renders no class attribute when className is omitted', () => {
    const html = renderToStaticMarkup(<icons.GroupIcon />);

    expect(html).not.toContain('class=');
  });
});

describe('module contract', () => {
  it('exports exactly the twelve pinned icon components', () => {
    expect(Object.keys(icons).sort()).toEqual([
      'CoinIcon',
      'CubeIcon',
      'CubeLevelIcon',
      'CursorIcon',
      'DiamondIcon',
      'GearIcon',
      'GroupIcon',
      'ServerIcon',
      'ShipIcon',
      'UpgradeClickIcon',
      'UpgradeCubeIcon',
      'UpgradeSpeedIcon',
    ]);
  });

  it('renders the complete cursor markup with inline shapes only', () => {
    expect(renderToStaticMarkup(<icons.CursorIcon />)).toBe(
      '<svg aria-hidden="true" data-icon="cursor" fill="none" focusable="false" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" viewBox="0 0 24 24">' +
        '<path d="M5.5 3.2l14 7.6-6.3 1.6-2.9 6.4z" fill="currentColor" stroke-width="1.1"></path>' +
        '</svg>',
    );
  });
});
