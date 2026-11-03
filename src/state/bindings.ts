/** Lazy bindings keep the application owner while exposing narrow typed feature ports. */
export interface ReadBinding<T> {
  read(): T;
}
export interface WriteBinding<T> extends ReadBinding<T> {
  write(value: T): void;
}
export function field<T>(read: () => T): ReadBinding<T>;
export function field<T>(
  read: () => T,
  write: (value: T) => void,
): WriteBinding<T>;
export function field<T>(
  read: () => T,
  write?: (value: T) => void,
): ReadBinding<T> | WriteBinding<T> {
  return write ? { read, write } : { read };
}
type Value<B> = B extends ReadBinding<infer T> ? T : never;
type Bound<T> = {
  readonly [K in keyof T as T[K] extends { write: unknown } ? never : K]: Value<
    T[K]
  >;
} & {
  [K in keyof T as T[K] extends { write: unknown } ? K : never]: Value<T[K]>;
};
export function bindRuntime<T extends Record<string, ReadBinding<unknown>>>(
  bindings: T,
): Bound<T> {
  const target = {};
  for (const [key, binding] of Object.entries(bindings))
    Object.defineProperty(target, key, {
      enumerable: true,
      get: binding.read,
      ...("write" in binding
        ? { set: binding.write as (value: unknown) => void }
        : {}),
    });
  return target as Bound<T>;
}
