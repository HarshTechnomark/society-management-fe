/** "1 flat", "3 flats": the noun in singular for exactly one. */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
