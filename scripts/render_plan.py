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


LOOKS = {
    "cinematic": "eq=contrast=1.12:saturation=1.12:gamma=0.97,colorbalance=rs=-0.04:bs=0.06:rh=0.05:bh=-0.04,vignette=PI/5",
    "warm": "colorbalance=rs=0.08:gs=0.02:bs=-0.08:rh=0.05:bh=-0.05,eq=saturation=1.08",
    "cool": "colorbalance=rs=-0.06:bs=0.08:rh=-0.04:bh=0.06,eq=saturation=1.05",
    "bw": "hue=s=0,eq=contrast=1.1",
    "vivid": "eq=saturation=1.4:contrast=1.06",
}
SIZES = {"small": 26, "medium": 18, "large": 12}   # fontsize = min(width, height) / value
COLORS = {"white": "white", "yellow": "yellow", "black": "black"}


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

    # --- text (each line is centered on its own; works on every FFmpeg version) ---
    text = plan.get("text") or {}
    content = str(text.get("content", "")).strip()[:200]
    if content:
        font = pick_font()
        size = SIZES.get(text.get("size", "medium"), 18)
        fs = max(int(min(w, h) / size), 12)
        per_line = max(int(0.86 * w / (0.58 * fs)), 8)
        lines = textwrap.wrap(content, width=per_line) or [content]
        lh = int(fs * 1.3)
        n = len(lines)
        color = COLORS.get(text.get("color", "white"), "white")
        pos = text.get("position", "bottom")
        style = text.get("style", "clean")
        fi = clamp(text.get("fade_in", 0.5), 0, 3, 0.5)
        alpha = f":alpha='min(t/{fi},1)'" if fi > 0 else ""
        if style == "box":
            deco = f"box=1:boxcolor=black@0.5:boxborderw={max(fs // 3, 8)}"
        elif style == "outline":
            deco = f"borderw={max(fs // 14, 2)}:bordercolor=black@0.9"
        else:  # clean: soft shadow, no box (TikTok / CapCut look)
            deco = f"borderw={max(fs // 30, 1)}:bordercolor=black@0.35:shadowcolor=black@0.55:shadowx={max(fs // 24, 1)}:shadowy={max(fs // 24, 1)}"
        for i, line in enumerate(lines):
            fname = f"caption_{i}.txt"
            with open(fname, "w", encoding="utf-8") as f:
                f.write(line)
            if pos == "top":
                y = f"h/12+{i * lh}"
            elif pos == "center":
                y = f"(h-{n * lh})/2+{i * lh}"
            else:
                y = f"h-h/9-{(n - i) * lh}"
            vf.append(
                f"drawtext=fontfile={font}:textfile={fname}:expansion=none:"
                f"fontcolor={color}:fontsize={fs}:{deco}:x=(w-text_w)/2:y={y}{alpha}")

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

    print("Applied:", {k: plan[k] for k in plan if k in ("text", "look", "zoom", "speed", "trim", "fade_in", "fade_out")})
    print("Filters:", ",".join(vf) or "(none)")
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    main()
