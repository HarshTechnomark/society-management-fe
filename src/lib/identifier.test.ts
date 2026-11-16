import { describe, expect, it } from 'vitest';
import { identifierKind } from './identifier';

describe('identifierKind', () => {
  it.each([
    ['', 'none'],
    ['   ', 'none'],
    ['rajesh', 'none'],
    ['98200 11111', 'mobile'],
    ['9820011111', 'mobile'],
    ['+91 98200 11111', 'mobile'],
    ['98200-11111', 'mobile'],
    ['9820', 'mobile'], // not enough digits yet, but it is going to be a number
    ['chairman@skyheights.in', 'email'],
    ['  Chairman@SkyHeights.in ', 'email'],
    ['a@', 'email'],
    ['9820011111@x.in', 'email'],
    ['98200 abc', 'none'],
  ])('%j is %s', (value, kind) => {
    expect(identifierKind(value)).toBe(kind);
  });
});
