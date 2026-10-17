/**
 * withHighRefreshRate — asks Android to run the app at the display's highest
 * refresh rate (90/120 Hz) instead of the 60 Hz many phones give apps by
 * default. Makes scrolling and animations feel smoother.
 *
 * Adds a few lines to MainActivity.onCreate during `expo prebuild`.
 */
const { withMainActivity } = require('expo/config-plugins');

const MARKER = '// @generated high-refresh-rate';

const SNIPPET = `
    ${MARKER}
    // Prefer the highest refresh rate the screen supports at its current resolution.
    try {
      @Suppress("DEPRECATION")
      val display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) this.display else windowManager.defaultDisplay
      display?.let { d ->
        val current = d.mode
        val best = d.supportedModes
          .filter { it.physicalWidth == current.physicalWidth && it.physicalHeight == current.physicalHeight }
          .maxByOrNull { it.refreshRate }
        if (best != null && best.modeId != current.modeId) {
          val params = window.attributes
          params.preferredDisplayModeId = best.modeId
          window.attributes = params
        }
      }
    } catch (e: Throwable) {
      // Never block startup over a refresh-rate preference.
    }`;

module.exports = function withHighRefreshRate(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (cfg.modResults.language !== 'kt' || src.includes(MARKER)) return cfg;
    const anchor = 'super.onCreate(null)';
    if (!src.includes(anchor)) return cfg; // template changed — skip safely
    src = src.replace(anchor, anchor + SNIPPET);
    if (!src.includes('import android.os.Build')) {
      src = src.replace(/^(package .*\n)/, '$1import android.os.Build\n');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};
