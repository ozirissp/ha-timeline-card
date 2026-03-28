import { describe, it, expect } from 'vitest';
import { normalizeGroup } from '../../src/utils.js';

describe('normalizeGroup', () => {
  it('normalizes a bare string entity', () => {
    const g = normalizeGroup('calendar.test', '#ff0000');
    expect(g.entities).toEqual(['calendar.test']);
    expect(g.color).toBe('#ff0000');
    expect(g.label).toBe('test');
  });

  it('normalizes legacy { entity } format', () => {
    const g = normalizeGroup({ entity: 'calendar.foo', color: '#aabbcc', label: 'Foo' }, '#fff');
    expect(g.entities).toEqual(['calendar.foo']);
    expect(g.color).toBe('#aabbcc');
    expect(g.label).toBe('Foo');
  });

  it('normalizes { entities[] } format', () => {
    const g = normalizeGroup(
      { entities: ['calendar.a', 'calendar.b'], color: '#123456', label: 'AB' },
      '#fff',
    );
    expect(g.entities).toEqual(['calendar.a', 'calendar.b']);
    expect(g.color).toBe('#123456');
    expect(g.label).toBe('AB');
  });

  it('filters out empty/falsy entities', () => {
    const g = normalizeGroup({ entities: ['calendar.a', '', null, 'calendar.b'] }, '#fff');
    expect(g.entities).toEqual(['calendar.a', 'calendar.b']);
  });

  it('returns empty entities array when neither entity nor entities provided', () => {
    const g = normalizeGroup({ color: '#fff', label: 'X' }, '#fff');
    expect(g.entities).toEqual([]);
  });

  it('uses fallback color when no color provided', () => {
    const g = normalizeGroup({ entity: 'calendar.x' }, '#fallback');
    expect(g.color).toBe('#fallback');
  });

  it('uses first entity as label when no label provided', () => {
    const g = normalizeGroup({ entity: 'calendar.xyz' }, '#fff');
    expect(g.label).toBe('calendar.xyz');
  });

  it('uses first entity from entities[] as label when no label provided', () => {
    const g = normalizeGroup({ entities: ['calendar.a', 'calendar.b'] }, '#fff');
    expect(g.label).toBe('calendar.a');
  });
});
