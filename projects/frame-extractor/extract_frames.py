#!/usr/bin/env python3
"""
Frame extractor — розкладає відео на кадри.

Standalone tool: decomposes a video file into individual image frames and
saves them to disk. Uses the static ffmpeg binary shipped with the
`imageio-ffmpeg` package, so no system-wide ffmpeg install is required.

Usage:
    python extract_frames.py INPUT [options]

Examples:
    # Every frame (full decomposition) into ./output/<name>/
    python extract_frames.py sample.mp4

    # 1 frame per second, PNG, custom output dir
    python extract_frames.py sample.mp4 --fps 1 --format png --out frames/

    # Every 5th frame, scaled to 320px wide
    python extract_frames.py sample.mp4 --every 5 --width 320
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def ffmpeg_exe() -> str:
    """Return a usable ffmpeg binary path (prefers imageio-ffmpeg's static build)."""
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        # Fall back to a system ffmpeg on PATH.
        from shutil import which

        exe = which("ffmpeg")
        if not exe:
            sys.exit(
                "ffmpeg not found. Install it with `pip install imageio-ffmpeg` "
                "or add ffmpeg to your PATH."
            )
        return exe


def probe(ff: str, path: Path) -> dict:
    """Best-effort metadata (duration, size, fps) parsed from ffmpeg stderr."""
    proc = subprocess.run(
        [ff, "-hide_banner", "-i", str(path)],
        capture_output=True,
        text=True,
    )
    info: dict = {}
    for line in proc.stderr.splitlines():
        line = line.strip()
        if line.startswith("Duration:"):
            dur = line.split("Duration:")[1].split(",")[0].strip()
            info["duration"] = dur
        if "Video:" in line and "fps" in line:
            for tok in line.split(","):
                tok = tok.strip()
                if tok.endswith("fps"):
                    info["fps"] = tok.replace(" fps", "")
                if "x" in tok and tok.split("x")[0].strip().isdigit():
                    info["resolution"] = tok.split(" ")[0].split("[")[0]
    return info


def build_filters(args) -> str | None:
    """Assemble the -vf filter chain from CLI options."""
    filters = []
    if args.fps:
        filters.append(f"fps={args.fps}")
    elif args.every and args.every > 1:
        # Keep every Nth frame regardless of timing.
        filters.append(f"select='not(mod(n\\,{args.every}))'")
    if args.width or args.height:
        w = args.width or -1
        h = args.height or -1
        filters.append(f"scale={w}:{h}")
    return ",".join(filters) if filters else None


def main() -> int:
    p = argparse.ArgumentParser(
        description="Decompose a video into individual frame images.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("input", help="Path to the input video file.")
    p.add_argument(
        "--out",
        default=None,
        help="Output directory (default: ./output/<video-name>/).",
    )
    p.add_argument(
        "--format",
        default="jpg",
        choices=["jpg", "jpeg", "png", "bmp", "webp"],
        help="Image format for the saved frames (default: jpg).",
    )
    p.add_argument(
        "--fps",
        type=float,
        default=None,
        help="Sample this many frames per second (e.g. 1 = one frame/sec). "
        "Omit to keep every frame.",
    )
    p.add_argument(
        "--every",
        type=int,
        default=None,
        help="Keep every Nth frame (ignored if --fps is set).",
    )
    p.add_argument("--width", type=int, default=None, help="Resize output width (px).")
    p.add_argument(
        "--height", type=int, default=None, help="Resize output height (px)."
    )
    p.add_argument(
        "--quality",
        type=int,
        default=2,
        help="JPEG/WebP quality, 1 (best) .. 31 (worst). Default 2.",
    )
    p.add_argument(
        "--prefix", default="frame", help="Filename prefix (default: frame)."
    )
    args = p.parse_args()

    src = Path(args.input).expanduser().resolve()
    if not src.exists():
        sys.exit(f"Input not found: {src}")

    ff = ffmpeg_exe()

    out_dir = (
        Path(args.out).expanduser().resolve()
        if args.out
        else Path(__file__).parent / "output" / src.stem
    )
    out_dir.mkdir(parents=True, exist_ok=True)

    meta = probe(ff, src)
    print(f"ffmpeg   : {ff}")
    print(f"input    : {src}")
    print(f"metadata : {meta}")
    print(f"output   : {out_dir}")

    ext = "jpg" if args.format == "jpeg" else args.format
    pattern = str(out_dir / f"{args.prefix}_%05d.{ext}")

    cmd = [ff, "-hide_banner", "-loglevel", "error", "-i", str(src)]

    vf = build_filters(args)
    if vf:
        cmd += ["-vf", vf]
    # `select` filter needs vsync passthrough so kept frames aren't duplicated.
    if args.every and not args.fps:
        cmd += ["-vsync", "vfr"]

    if ext in ("jpg", "webp"):
        cmd += ["-q:v", str(args.quality)]

    cmd += [pattern]

    print(f"command  : {' '.join(cmd)}")
    print("extracting…")
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr)
        return proc.returncode

    frames = sorted(out_dir.glob(f"{args.prefix}_*.{ext}"))
    total_bytes = sum(f.stat().st_size for f in frames)

    manifest = {
        "source": src.name,
        "output_dir": str(out_dir),
        "frame_count": len(frames),
        "format": ext,
        "metadata": meta,
        "options": {
            "fps": args.fps,
            "every": args.every,
            "width": args.width,
            "height": args.height,
            "quality": args.quality,
        },
        "total_bytes": total_bytes,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    mb = total_bytes / (1024 * 1024)
    print(f"done     : {len(frames)} frames, {mb:.1f} MB → {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
