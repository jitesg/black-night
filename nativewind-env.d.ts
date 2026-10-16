/// <reference types="nativewind/types" />

// Allow importing font files (.ttf / .otf) as asset numbers (Metro bundler resolves them).
declare module '*.ttf' {
  const resource: number;
  export default resource;
}
declare module '*.otf' {
  const resource: number;
  export default resource;
}
