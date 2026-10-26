# Locale alignment visual review

Before: ff16b1d380d8a6033d6f23fb3eed13e548492327 (comparison base).
After: 9e08bed3b7ea79a1c77d90b7dd0e0ae98ad799a0 (qualified runtime and matching product build,0.16.1).

Desktop1440×1000; phone390×844; device scale1. Original PNG bytes from actual synthetic runtime; matching route, locale, case, typed request, camera and scroll. Landing images were decoded before capture.

English landing and reference views show the fully English example, including catalog, flows and embedded app. Traditional Chinese reference pairs show translated controls with the original Chinese app. Japanese landing pairs represent the shared omission policy for nine locales without matching screenshot assets; explicit demo-language labels replace mismatched Chinese images. Structural and browser checks cover every locale.

These16 images are engineering review evidence, not generated mockups or translated overlays. The evidence commit adds only this folder after the captured runtime revision. Historical device and previous PR captures remain unchanged.
