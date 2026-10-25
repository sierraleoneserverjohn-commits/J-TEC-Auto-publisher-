#!/usr/bin/env python3
"""Build and run one FFmpeg command from a validated edit plan.

Reads env PLAN (JSON) or CAPTION. Input: input.mp4  Output: output.mp4
Only whitelisted operations are applied. Unknown keys are ignored.
"""
import json, os, subprocess, sys, textwrap

FALLBACK_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_CHOICES = ["Montserrat:semibold", "Roboto:medium", "Open Sans:semibold"]


def pick_font():
    """Use the first clean sans font that is really installed, else DejaVu Bold."""
    for pattern in FONT_CHOICES:
        want = pattern.split(":")[0].lower()
        try:
            out = subprocess.check_output(["fc-match", "-f", "%{family}|%{file}", pattern], text=True)
            fam, path = out.split("|", 1)
            if want in fam.lower() and os.path.exists(path):
                return path
        except Exception:
            pass
    return FALLBACK_FONT
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from effects_lib import LOOKS, EFFECTS

SIZES = {"small": 26, "medium": 18, "large": 12}   # fontsize = min(width, height) / value
COLORS = {"white": "white", "yellow": "yellow", "black": "black"}
POS = {"bottom": "h-text_h-h/10", "center": "(h-text_h)/2", "top": "h/12"}


def clamp(v, lo, hi, default):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))


def probe():
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries",
        "stream=codec_type,width,height,r_frame_rate:format=duration",
        "-of", "json", "input.mp4"])
    d = json.loads(out)
    v = next(s for s in d["streams"] if s["codec_type"] == "video")
    has_audio = any(s["codec_type"] == "audio" for s in d["streams"])
    n, den = v["r_frame_rate"].split("/")
    fps = float(n) / float(den or 1)
    return int(v["width"]), int(v["height"]), fps, float(d["format"]["duration"]), has_audio


def main():
    raw = os.environ.get("PLAN", "").strip()
    if raw:
        plan = json.loads(raw)
    else:
        plan = {"text": {"content": os.environ.get("CAPTION", "")}}
    if not isinstance(plan, dict):
        sys.exit("Plan must be a JSON object.")

    w, h, fps, dur, has_audio = probe()
    w -= w % 2
    h -= h % 2

    # --- trim ---
    trim = plan.get("trim") or {}
    start = clamp(trim.get("start", 0), 0, dur, 0)
    end = clamp(trim.get("end", dur), 0, dur, dur)
    if end <= start:
        start, end = 0, dur
    seg = end - start

    # --- speed ---
    speed = clamp(plan.get("speed", 1), 0.5, 2.0, 1.0)
    out_dur = seg / speed

    vf, af = [], []

    # --- zoom (keeps original size; runs BEFORE speed so timing stays correct) ---
    zoom = plan.get("zoom", "none")
    if zoom in ("slow_in", "slow_out"):
        frames = max(int(seg * fps), 1)
        step = 0.15 / frames
        z = f"min(1+{step:.8f}*on,1.15)" if zoom == "slow_in" else f"max(1.15-{step:.8f}*on,1)"
        vf.append(f"zoompan=z='{z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps={fps:.3f}")

    # --- speed ---
    if speed != 1.0:
        vf.append(f"setpts=PTS/{speed}")
        af.append(f"atempo={speed}")

    # --- look ---
    look = plan.get("look", "none")
    if look in LOOKS:
        vf.append(LOOKS[look])

    # --- stackable effects (only names in EFFECTS are accepted) ---
    effects = plan.get("effects")
    if isinstance(effects, list):
        for name in effects[:6]:
            if name in EFFECTS:
                vf.append(EFFECTS[name](w, h))

    # --- text overlays (up to 6) + brand tag; each line is centered on its own ---
    texts = plan.get("texts")
    if not isinstance(texts, list):
        texts = [plan["text"]] if isinstance(plan.get("text"), dict) else []
    font = pick_font()
    LEGACY_Y = {"top": 0.12, "center": 0.5, "bottom": 0.84}
    file_no = 0

    def add_text(content, xf, yf, size_key, color, style, t0, t1, fi):
        nonlocal file_no
        size = SIZES.get(size_key, 18)
        fs = max(int(min(w, h) / size), 12)
        per_line = max(int(0.86 * w / (0.58 * fs)), 8)
        lines = textwrap.wrap(content, width=per_line) or [content]
        lh = int(fs * 1.3)
        n = len(lines)
        if style == "box":
            deco = f"box=1:boxcolor=black@0.5:boxborderw={max(fs // 3, 8)}"
        elif style == "outline":
            deco = f"borderw={max(fs // 14, 2)}:bordercolor=black@0.9"
        else:  # clean: soft shadow, no box (TikTok / CapCut look)
            deco = (f"borderw={max(fs // 30, 1)}:bordercolor=black@0.35:"
                    f"shadowcolor=black@0.55:shadowx={max(fs // 24, 1)}:shadowy={max(fs // 24, 1)}")
        enable = ""
        if t0 > 0 or t1 is not None:
            hi = f"{t1:.3f}" if t1 is not None else "999999"
            enable = f":enable='between(t,{t0:.3f},{hi})'"
        alpha = f":alpha='min((t-{t0:.3f})/{fi},1)'" if fi > 0 else ""
        for i, line in enumerate(lines):
            fname = f"caption_{file_no}.txt"
            file_no += 1
            with open(fname, "w", encoding="utf-8") as f:
                f.write(line)
            x = f"max(8,min(w-text_w-8,w*{xf:.4f}-text_w/2))"
            y = f"max(4,min(h-{lh}-4,h*{yf:.4f}-{n * lh / 2:.1f}+{i * lh}))"
            vf.append(
                f"drawtext=fontfile={font}:textfile={fname}:expansion=none:"
                f"fontcolor={color}:fontsize={fs}:{deco}:x='{x}':y='{y}'{enable}{alpha}")

    for t in texts[:6]:
        if not isinstance(t, dict):
            continue
        content = str(t.get("content", "")).strip()[:200]
        if not content:
            continue
        if "y" in t or "x" in t:
            xf = clamp(t.get("x", 0.5), 0.05, 0.95, 0.5)
            yf = clamp(t.get("y", 0.84), 0.05, 0.95, 0.84)
        else:
            xf, yf = 0.5, LEGACY_Y.get(t.get("position", "bottom"), 0.84)
        t0 = clamp(t.get("start", 0), 0, 3600, 0)
        t1 = t.get("end")
        t1 = clamp(t1, 0, 3600, None) if t1 not in (None, "") else None
        if t1 is not None and t1 <= t0:
            t1 = None
        add_text(content, xf, yf, t.get("size", "medium"),
                 COLORS.get(t.get("color", "white"), "white"),
                 t.get("style", "clean"), t0, t1, clamp(t.get("fade_in", 0.5), 0, 3, 0.5))

    brand = plan.get("brand")
    if isinstance(brand, dict):
        name = str(brand.get("content", "")).strip()[:30]
        if name:
            bpos = brand.get("position", "bottom_center")
            bx = {"bottom_left": 0.2, "bottom_right": 0.8}.get(bpos, 0.5)
            by = 0.1 if bpos == "top_center" else 0.9
            add_text(name, bx, by, "small", "white", "clean", 0, None, 0)

    # --- fades (last, so they cover everything) ---
    fin = clamp(plan.get("fade_in", 0), 0, 3, 0)
    fout = clamp(plan.get("fade_out", 0), 0, 3, 0)
    if fin > 0:
        vf.append(f"fade=t=in:st=0:d={fin}")
        af.append(f"afade=t=in:st=0:d={fin}")
    if fout > 0 and out_dur > fout:
        vf.append(f"fade=t=out:st={out_dur - fout:.3f}:d={fout}")
        af.append(f"afade=t=out:st={out_dur - fout:.3f}:d={fout}")

    cmd = ["ffmpeg", "-loglevel", "error", "-y"]
    if start > 0:
        cmd += ["-ss", f"{start:.3f}"]
    if end < dur:
        cmd += ["-to", f"{end:.3f}"]
    cmd += ["-i", "input.mp4"]
    if vf:
        cmd += ["-vf", ",".join(vf)]
    cmd += ["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p"]
    if has_audio:
        if af:
            cmd += ["-af", ",".join(af), "-c:a", "aac", "-b:a", "192k"]
        else:
            cmd += ["-c:a", "copy"]
    cmd += ["-movflags", "+faststart", "output.mp4"]

    print("Applied:", {k: plan[k] for k in plan if k in ("texts", "text", "brand", "look", "effects", "zoom", "speed", "trim", "fade_in", "fade_out")})
    print("Filters:", ",".join(vf) or "(none)")
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    main()
