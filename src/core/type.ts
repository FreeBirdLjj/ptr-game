// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = any[];

export type AbstractConstructor<T = object> = abstract new (...args: Args) => T;
