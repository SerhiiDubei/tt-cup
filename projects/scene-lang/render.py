#!/usr/bin/env python3
"""
scene-lang — intuitive reproduction of the @seaeees pixel-art "build" video.

The source video is, in effect, an *instruction*: a scene assembled from
nothing to a finished frame. This renderer reproduces that "language"
procedurally — a 1-point-perspective pixel-art room that constructs itself
through the same stages the video walks through:

    SKELETON -> CLAY -> COLOR -> LIGHT -> POST

built out of three depth layers (BACKGROUND / MIDGROUND / FOREGROUND), with
ordered (Bayer) dithering and the signature blurred-letterbox framing.

Outputs an MP4 plus per-stage stills. Uses the static ffmpeg from
imageio-ffmpeg (no system ffmpeg needed).

    python render.py            # render out/scene-build.mp4 + stills
    python render.py --stills   # only the stage stills (fast, for iterating)
    DEBUG=1 python render.py --stills   # also dump a surface-classification map
"""
from __future__ import annotations

import os
import subprocess
import sys

import numpy as np
import imageio_ffmpeg

# ----------------------------------------------------------------------------
# Resolution
# ----------------------------------------------------------------------------
BW, BH = 192, 108          # scene band, 16:9 (low-res pixel grid)
FW, FH = 192, 342          # full 9:16 frame (low-res)
BAND_Y0 = (FH - BH) // 2   # vertical position of the sharp band
BAND_Y1 = BAND_Y0 + BH
SCALE = 3                  # nearest-neighbour upscale -> 576 x 1026

# ----------------------------------------------------------------------------
# 1-point perspective room geometry (normalised band coords, 0..1)
# ----------------------------------------------------------------------------
VP = np.array([0.60, 0.46])          # vanishing point
BX0, BX1 = 0.34, 0.80                # back wall rectangle
BY0, BY1 = 0.22, 0.66

# Surface ids
S_BACK, S_CEIL, S_FLOOR, S_LEFT, S_RIGHT = 0, 1, 2, 3, 4

# Albedo palette (linear 0..1) per surface
ALBEDO = {
    S_BACK:  (0.28, 0.33, 0.29),
    S_CEIL:  (0.29, 0.30, 0.33),
    S_FLOOR: (0.36, 0.31, 0.25),
    S_LEFT:  (0.44, 0.46, 0.45),
    S_RIGHT: (0.22, 0.24, 0.23),
}

BAYER4 = np.array([
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
], dtype=np.float32) / 16.0


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a + 1e-9), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def side(px, py, ax, ay, bx, by):
    """Signed area — which side of line A->B the point P is on."""
    return (bx - ax) * (py - ay) - (by - ay) * (px - ax)


def build_grids(zoom, pan):
    """Normalised U,V grids for the band, with a small camera push toward VP."""
    xs = (np.arange(BW) + 0.5) / BW
    ys = (np.arange(BH) + 0.5) / BH
    U, V = np.meshgrid(xs, ys)
    # zoom toward the vanishing point
    U = VP[0] + (U - VP[0]) / zoom + pan
    V = VP[1] + (V - VP[1]) / zoom
    return U, V


def classify(U, V):
    """Assign every band pixel to a room surface."""
    inBack = (U >= BX0) & (U <= BX1) & (V >= BY0) & (V <= BY1)
    dTL = side(U, V, 0, 0, BX0, BY0)
    dTR = side(U, V, 1, 0, BX1, BY0)
    dBL = side(U, V, 0, 1, BX0, BY1)
    dBR = side(U, V, 1, 1, BX1, BY1)

    ceil = (dTL < 0) & (dTR > 0)
    floor = (dBL > 0) & (dBR < 0)
    left = (dTL > 0) & (dBL < 0)
    right = (dTR < 0) & (dBR > 0)

    surf = np.full((BH, BW), S_BACK, dtype=np.int32)
    # priority: walls, then ceil/floor, then back (back already default)
    surf[left] = S_LEFT
    surf[right] = S_RIGHT
    surf[ceil] = S_CEIL
    surf[floor] = S_FLOOR
    surf[inBack] = S_BACK
    return surf


def surface_edges(surf):
    """Boolean mask of surface boundaries (for the wireframe/skeleton look)."""
    e = np.zeros_like(surf, dtype=bool)
    e[:, 1:] |= surf[:, 1:] != surf[:, :-1]
    e[1:, :] |= surf[1:, :] != surf[:-1, :]
    return e


def perspective_grid(U, V):
    """Faint radial guide-lines from the vanishing point (skeleton stage)."""
    ang = np.arctan2(V - VP[1], U - VP[0])
    spokes = np.abs(((ang * 8 / np.pi) % 1.0) - 0.5) < 0.02
    r = np.hypot(U - VP[0], V - VP[1])
    rings = np.abs((r * 9 % 1.0) - 0.5) < 0.03
    return spokes | rings


def window_masks(U, V, surf):
    """Left-wall window (light source) + its mullions."""
    win = (surf == S_LEFT) & (U > 0.05) & (U < 0.30) & (V > 0.27) & (V < 0.63)
    mull = win & (
        (np.abs((U * 34 % 1.0) - 0.5) < 0.10) | (np.abs((V * 26 % 1.0) - 0.5) < 0.10)
    )
    return win, mull


def light_shaft(U, V, surf):
    """Warm light thrown across the floor from the window."""
    s = (U - 0.16) - 0.9 * (V - 0.66)      # diagonal coordinate
    band = np.exp(-((s) ** 2) / 0.010)
    shaft = band * (surf == S_FLOOR).astype(np.float32)
    return np.clip(shaft, 0, 1)


def grass_mask(U, V, surf):
    """Vegetation reclaiming the floor front (foreground detail)."""
    depth = smoothstep(0.66, 1.0, V)        # denser toward camera
    h = (np.sin(U * 90.7) * 43758.5).astype(np.float32)
    h = h - np.floor(h)
    blades = (h < (0.28 * depth)) & (surf == S_FLOOR)
    return blades, depth


def character(U, V):
    """Small seated silhouette on the floor, right of centre (mid/foreground)."""
    cx, cy = 0.66, 0.70
    body = (np.abs(U - cx) < 0.035 * smoothstep(0.55, 0.78, V)) & (V > 0.60) & (V < 0.78)
    head = (np.hypot((U - cx) * 1.4, (V - 0.585)) < 0.028)
    return body | head


def render_looks(U, V):
    """Compute the four 'looks' (wire, clay, color, lit) as float RGB images."""
    surf = classify(U, V)
    edges = surface_edges(surf)
    grid = perspective_grid(U, V)
    win, mull = window_masks(U, V, surf)
    shaft = light_shaft(U, V, surf)
    grass, gdepth = grass_mask(U, V, surf)
    char = character(U, V)

    # ---- albedo (flat colour) ----
    albedo = np.zeros((BH, BW, 3), np.float32)
    for sid, col in ALBEDO.items():
        albedo[surf == sid] = col
    albedo[grass] = (0.26, 0.52, 0.19)
    albedo[win] = (0.86, 0.91, 1.0)
    albedo[mull] = (0.10, 0.11, 0.13)
    albedo[char] = (0.05, 0.06, 0.09)

    # ---- ambient occlusion / depth shading ----
    r = np.hypot(U - VP[0], V - VP[1])
    ao = 0.55 + 0.65 * smoothstep(0.0, 0.6, r)          # darker toward vp
    ao = np.clip(ao, 0.0, 1.15)

    # ---- lighting ----
    light = ao.copy()
    light += 1.5 * shaft                                 # warm floor shaft
    light += 0.25 * smoothstep(0.30, 0.0, np.abs(U - 0.30)) * (surf == S_LEFT)
    lit = albedo * light[..., None]
    lit[win] = (0.95, 0.98, 1.0)                         # window stays bright
    # warm tint the shaft
    lit[..., 0] += 0.22 * shaft
    lit[..., 1] += 0.14 * shaft
    # rim light on the character from the window side
    rim = char & (np.roll(char, 1, axis=1) == False)
    lit[rim] = (0.45, 0.55, 0.72)
    lit = np.clip(lit, 0, 1)

    # ---- clay (grayscale blockout + AO, no colour, no emissive) ----
    g = np.clip(ao * 0.5 + 0.12, 0, 1)
    clay = np.stack([g, g, g], -1)
    clay[win] = 0.85
    clay[edges] = np.clip(clay[edges] + 0.18, 0, 1)

    # ---- color (flat albedo + weak ambient, pre-lighting) ----
    color = np.clip(albedo * (0.55 + 0.25 * ao[..., None]), 0, 1)
    color[win] = (0.9, 0.93, 1.0)

    # ---- wireframe / skeleton ----
    wire = np.zeros((BH, BW, 3), np.float32)
    wire[grid] = (0.10, 0.16, 0.22)
    wire[edges] = (0.55, 0.75, 0.85)
    winframe = win & (np.roll(win, 1, 1) ^ win) | mull
    wire[winframe] = (0.35, 0.55, 0.65)
    return wire, clay, color, lit


def dither_quantize(img, levels=6, amp=0.55):
    """Ordered (Bayer) dithering -> posterised, retro pixel-art gradients."""
    by = np.tile(BAYER4, (BH // 4 + 1, BW // 4 + 1))[:BH, :BW]
    d = (by - 0.5) * (amp / levels)
    out = np.clip(img + d[..., None], 0, 1)
    out = np.round(out * (levels - 1)) / (levels - 1)
    return out


def blend_looks(looks, p):
    """Cross-fade wire->clay->color->lit by global progress p in [0,1]."""
    wire, clay, color, lit = looks
    # segment boundaries
    if p < 0.20:
        img = wire * smoothstep(0.0, 0.14, p)            # fade up from black
    elif p < 0.38:
        t = smoothstep(0.20, 0.38, p)
        img = wire * (1 - t) + clay * t
    elif p < 0.56:
        t = smoothstep(0.38, 0.56, p)
        img = clay * (1 - t) + color * t
    elif p < 0.78:
        t = smoothstep(0.56, 0.78, p)
        img = color * (1 - t) + lit * t
    else:
        img = lit
    return img


def box_blur(img, k):
    """Cheap separable box blur via cumulative sums."""
    a = img.astype(np.float32)
    for axis in (0, 1):
        c = np.cumsum(a, axis=axis)
        pad = np.zeros_like(np.take(c, [0], axis=axis))
        c = np.concatenate([pad, c], axis=axis)
        n = a.shape[axis]
        idx = np.arange(n)
        lo = np.clip(idx - k, 0, n)
        hi = np.clip(idx + k + 1, 0, n)
        take_hi = np.take(c, hi, axis=axis)
        take_lo = np.take(c, lo, axis=axis)
        cnt = (hi - lo).reshape([-1 if ax == axis else 1 for ax in range(a.ndim)])
        a = (take_hi - take_lo) / np.maximum(cnt, 1)
    return a


def compose_frame(band, p):
    """Place the sharp band into the 9:16 frame with blurred letterbox bars."""
    frame = np.zeros((FH, FW, 3), np.float32)
    frame[BAND_Y0:BAND_Y1] = band

    # blurred, zoomed, darkened copies fill the top/bottom bars
    blur = box_blur(band, 6)
    top_h = BAND_Y0
    bot_h = FH - BAND_Y1
    # zoom the blur a touch by cropping center then resizing via repeat/mean
    def fill_bar(h):
        src = blur
        # simple vertical resample to bar height
        idx = (np.linspace(0, BH - 1, h)).astype(int)
        return src[idx] * 0.45
    frame[:top_h] = fill_bar(top_h)
    frame[BAND_Y1:] = fill_bar(bot_h)

    # soft seam between band and bars
    for yy, sgn in ((BAND_Y0, 1), (BAND_Y1 - 1, -1)):
        pass

    # ---- post grade (ramps up in the POST stage) ----
    gp = smoothstep(0.80, 1.0, p)
    # contrast + warm grade
    frame = np.clip((frame - 0.5) * (1.0 + 0.12 * gp) + 0.5, 0, 1)
    frame[..., 0] *= 1.0 + 0.05 * gp
    frame[..., 2] *= 1.0 - 0.04 * gp

    # vignette
    yy, xx = np.mgrid[0:FH, 0:FW]
    vig = 1.0 - 0.35 * (((xx / FW - 0.5) ** 2 + (yy / FH - 0.5) ** 2))
    frame *= vig[..., None]

    # grain
    if gp > 0:
        g = (np.sin((xx * 12.9 + yy * 78.2)) * 43758.5)
        g = (g - np.floor(g)) - 0.5
        frame += (g[..., None] * 0.03 * gp)

    return np.clip(frame, 0, 1)


def upscale(frame):
    out = np.repeat(np.repeat(frame, SCALE, 0), SCALE, 1)
    return (out * 255).astype(np.uint8)


def render_frame(p):
    ease = smoothstep(0.0, 1.0, p)
    zoom = 1.0 + 0.06 * ease
    pan = 0.010 * ease
    U, V = build_grids(zoom, pan)
    looks = render_looks(U, V)
    band = blend_looks(looks, p)
    band = dither_quantize(band, levels=6, amp=0.6)
    frame = compose_frame(band, p)
    return upscale(frame)


def save_png(rgb, path):
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    h, w = rgb.shape[:2]
    p = subprocess.Popen(
        [ff, "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pixel_format", "rgb24", "-video_size", f"{w}x{h}", "-i", "-",
         "-frames:v", "1", path],
        stdin=subprocess.PIPE,
    )
    p.communicate(rgb.tobytes())


def debug_surfaces(path):
    U, V = build_grids(1.0, 0.0)
    surf = classify(U, V)
    palette = np.array([
        [200, 80, 80], [80, 160, 200], [90, 200, 120],
        [230, 200, 90], [160, 110, 200]], np.uint8)
    img = palette[surf]
    save_png(np.repeat(np.repeat(img, SCALE, 0), SCALE, 1), path)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    stills_dir = os.path.join(here, "stills")
    out_dir = os.path.join(here, "out")
    os.makedirs(stills_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)

    stills_only = "--stills" in sys.argv

    if os.environ.get("DEBUG"):
        debug_surfaces(os.path.join(stills_dir, "debug_surfaces.png"))
        print("wrote debug_surfaces.png")

    # stage stills
    for name, p in [("1_skeleton", 0.15), ("2_clay", 0.30),
                    ("3_color", 0.48), ("4_light", 0.72), ("5_post", 0.95)]:
        save_png(render_frame(p), os.path.join(stills_dir, f"stage_{name}.png"))
    print(f"wrote 5 stage stills -> {stills_dir}")
    if stills_only:
        return

    # animation: intro hold -> build -> outro hold
    fps = 24
    build_s, hold_end = 8.0, 1.4
    n_build = int(build_s * fps)
    n_hold = int(hold_end * fps)
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    out_path = os.path.join(out_dir, "scene-build.mp4")
    enc = subprocess.Popen(
        [ff, "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
         "-pixel_format", "rgb24", "-video_size", f"{FW*SCALE}x{FH*SCALE}",
         "-framerate", str(fps), "-i", "-", "-c:v", "libx264", "-pix_fmt",
         "yuv420p", "-crf", "20", out_path],
        stdin=subprocess.PIPE,
    )
    for i in range(n_build):
        p = i / (n_build - 1)
        enc.stdin.write(render_frame(p).tobytes())
    last = render_frame(1.0).tobytes()
    for _ in range(n_hold):
        enc.stdin.write(last)
    enc.stdin.close()
    enc.wait()
    print(f"wrote {out_path}  ({n_build + n_hold} frames @ {fps}fps)")


if __name__ == "__main__":
    main()
