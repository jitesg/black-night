/**
 * withHardwareKeys — tablet / Bluetooth keyboard keys (owner, sample क approved).
 *
 * Adds MainActivity.dispatchKeyEvent during `expo prebuild`. The activity sees every key before the views, so:
 *  - a typing box / the editor WebView has focus (onCheckIsTextEditor) → nothing changes, Android moves the cursor as before;
 *  - else ↓ ↑ = scroll a little, PgDn / PgUp / Space (Shift+Space) = one screen, Home / End (MOVE_HOME / MOVE_END, never the
 *    system HOME key) = top / bottom of the screen's main vertical list (the top-most visible ScrollView ≥ 25 % of the window —
 *    FlatList / ScrollView are android ScrollViews, horizontal rows are not), smooth scroll (ReactScrollView.reactSmoothScrollTo) so FlatList keeps loading;
 *  - Ctrl+F or "/" → JS event "investsuiteHardwareKey" {kind:"search"} (src/lib/hardwareKeys.ts focuses the screen's SearchBar).
 * Esc is NOT touched: Android already turns an unused Esc into Back. Modals (separate windows) are not reached by this.
 * Any error → the key goes to Android as before (try/catch around everything).
 */
const { withMainActivity } = require('expo/config-plugins');

const MARKER = '// @generated hardware-keys';

const METHODS = `
  ${MARKER}
  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    try {
      if (hkHandle(event)) return true
    } catch (e: Throwable) {
      // never break the keyboard over this
    }
    return super.dispatchKeyEvent(event)
  }

  private fun hkKind(event: KeyEvent): String? {
    val ctrl = event.isCtrlPressed
    val alt = event.isAltPressed
    val shift = event.isShiftPressed
    if (alt || event.isMetaPressed) return null
    return when (event.keyCode) {
      KeyEvent.KEYCODE_DPAD_DOWN -> if (ctrl) null else "down"
      KeyEvent.KEYCODE_DPAD_UP -> if (ctrl) null else "up"
      KeyEvent.KEYCODE_PAGE_DOWN -> "pageDown"
      KeyEvent.KEYCODE_PAGE_UP -> "pageUp"
      KeyEvent.KEYCODE_SPACE -> if (ctrl) null else if (shift) "pageUp" else "pageDown"
      KeyEvent.KEYCODE_MOVE_HOME -> "top"
      KeyEvent.KEYCODE_MOVE_END -> "bottom"
      KeyEvent.KEYCODE_F -> if (ctrl && !shift) "search" else null
      KeyEvent.KEYCODE_SLASH -> if (!ctrl && !shift) "search" else null
      else -> null
    }
  }

  private fun hkHandle(event: KeyEvent): Boolean {
    val focused = currentFocus
    if (focused != null && focused.onCheckIsTextEditor()) return false
    val kind = hkKind(event) ?: return false
    if (kind == "search") {
      if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
        val ctx = (application as? ReactApplication)?.reactHost?.currentReactContext ?: return false
        val args = Arguments.createMap()
        args.putString("kind", kind)
        ctx.emitDeviceEvent("investsuiteHardwareKey", args)
      }
      return true
    }
    val sv = hkFindScroll(window.decorView) ?: return false
    if (event.action != KeyEvent.ACTION_DOWN) return true
    val h = sv.height
    val step = (h * 0.15f).toInt().coerceAtLeast(80)
    val page = (h * 0.85f).toInt()
    val child = if (sv.childCount > 0) sv.getChildAt(0) else null
    val maxY = ((child?.height ?: 0) - h + sv.paddingTop + sv.paddingBottom).coerceAtLeast(0)
    val y = sv.scrollY
    val target = when (kind) {
      "down" -> y + step
      "up" -> y - step
      "pageDown" -> y + page
      "pageUp" -> y - page
      "top" -> 0
      else -> maxY
    }.coerceIn(0, maxY)
    // RN's own smooth scroll keeps the Fabric scroll state (taps, FlatList) in step; plain ScrollViews use Android's
    if (sv is ReactScrollView) sv.reactSmoothScrollTo(sv.scrollX, target) else sv.smoothScrollTo(sv.scrollX, target)
    return true
  }

  /** The top-most (drawn last) visible vertical ScrollView that can scroll and covers ≥ 25 % of the window. */
  private fun hkFindScroll(root: View): ScrollView? {
    val minArea = root.width.toLong() * root.height.toLong() / 4
    var best: ScrollView? = null
    val r = Rect()
    fun walk(v: View) {
      if (v.visibility != View.VISIBLE) return
      if (v is ScrollView && v.isShown && (v.canScrollVertically(1) || v.canScrollVertically(-1))) {
        if (v.getGlobalVisibleRect(r) && r.width().toLong() * r.height().toLong() >= minArea) best = v
      }
      if (v is ViewGroup) for (i in 0 until v.childCount) walk(v.getChildAt(i))
    }
    walk(root)
    return best
  }
`;

const IMPORTS = [
  'import android.graphics.Rect',
  'import android.view.KeyEvent',
  'import android.view.View',
  'import android.view.ViewGroup',
  'import android.widget.ScrollView',
  'import com.facebook.react.ReactApplication',
  'import com.facebook.react.bridge.Arguments',
  'import com.facebook.react.views.scroll.ReactScrollView',
];

module.exports = function withHardwareKeys(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (cfg.modResults.language !== 'kt' || src.includes(MARKER)) return cfg;
    // insert the methods right before the class's last closing brace
    const end = src.lastIndexOf('}');
    if (end < 0 || !/class MainActivity\s*:\s*ReactActivity\(\)/.test(src)) return cfg; // template changed — skip safely
    src = src.slice(0, end) + METHODS + src.slice(end);
    const missing = IMPORTS.filter((i) => !src.includes(i));
    if (missing.length) src = src.replace(/^(package .*\n)/, `$1${missing.join('\n')}\n`);
    cfg.modResults.contents = src;
    return cfg;
  });
};
