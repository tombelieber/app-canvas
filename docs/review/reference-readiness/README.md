# Reference readiness visual comparison

Before: fb8d08a6867fdb5909c3ec5a1e40f419ff616708.
After: fb41640f1d595c9ac4c4aa4d6489359c096513ee.

Desktop1440×1000 and phone390×844, DPR1, English viewer, original Chinese
synthetic capture-home UI, same selected button#manual and change request.
Camera, scroll, focus and fixture are matched within each pair. Both pairs are
byte-identical: the stable layout and copy did not change.

Point is now disabled until the camera/frame are ready, and entering point mode
no longer starts another camera movement. Physical-pointer, touch and slow-CPU
browser tests verify the changed readiness behavior. These original stills
verify there is no steady-state visual regression. No AI or production data is
used; no screenshot pixels were edited.
