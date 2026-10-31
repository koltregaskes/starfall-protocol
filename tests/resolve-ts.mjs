// Node resolve hook for the tests: the game's sources import each other without file
// extensions (Vite's "bundler" resolution), which Node's own ESM loader rejects. A
// relative specifier with no extension is retried as `<specifier>.ts`. Node strips
// the TypeScript types itself (tsconfig has erasableSyntaxOnly), so nothing is built.
export function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return nextResolve(`${specifier}.ts`, context);
    } catch {
      // fall through to the default resolution and its error
    }
  }
  return nextResolve(specifier, context);
}
