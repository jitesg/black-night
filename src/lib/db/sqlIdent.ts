/**
 * Column / table names that go into SQL text (never user input — values always go through `?`).
 * Guard: anything that is not a plain identifier throws instead of reaching the query.
 */
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
export function sqlIdent(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Invalid SQL identifier: ${name.slice(0, 40)}`);
  return name;
}
