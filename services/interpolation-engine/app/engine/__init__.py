"""Hand-written interpolation math. NumPy only: no OpenCV, no learned models.

    image.py        grayscale, image gradients
    pyramid.py      Gaussian blur, box filter, image pyramid
    warp.py         bilinear sampling ("remap") and flow resizing
    flow.py         coarse-to-fine dense Lucas-Kanade optical flow
    occlusion.py    forward-backward consistency → occlusion masks
    interpolate.py  builds the in-between frame at time t

Conventions used everywhere:
  - images are float32 arrays (H, W) or (H, W, C); colour frames arrive as uint8 BGR (H, W, 3)
  - a flow field is float32 (H, W, 2): [..., 0] = x displacement, [..., 1] = y displacement, in pixels
  - F_a→b(x) means "the pixel at x in frame a is found at x + F_a→b(x) in frame b"
"""
