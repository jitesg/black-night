/**
 * Print / A4 preview WebViews show only local HTML we build ourselves. A link inside that text must not
 * turn the preview into a browser: http(s) / other navigations are refused, the local page still loads.
 */
export function onlyLocalWebViewNav(req: { url: string }): boolean {
  const u = req.url || '';
  if (!u) return true; // some Android versions report the inline page with no url
  return u === 'about:blank' || u.startsWith('about:') || u.startsWith('data:') || u.startsWith('file:');
}
