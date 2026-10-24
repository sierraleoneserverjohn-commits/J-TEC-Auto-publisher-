#!/usr/bin/env python3
"""Build and run one FFmpeg command from a validated edit plan.

Reads env PLAN (JSON) or CAPTION. Input: input.mp4  Output: output.mp4
Only whitelisted operations are applied. Unknown keys are ignored.
"""
import json, os, subprocess, sys, textwrap

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
LOOKS = {
    "cinematic": "eq=contrast=1.12:saturation=1.12:gamma=0.97,colorbalance=rs=-0.04:bs=0.06:rh=0.05:bh=-0.04,vignette=PI/5",
    "warm": "colorbalance=rs=0.08:gs=0.02:bs=-0.08:rh=0.05:bh=-0.05,eq=saturation=1.08",
    "cool": "colorbalance=rs=-0.06:bs=0.08:rh=-0.04:bh=0.06,eq=saturation=1.05",
    "bw": "hue=s=0,eq=contrast=1.1",
    "vivid": "eq=saturation=1.4:contrast=1.06",
}
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

    # --- text ---
    text = plan.get("text") or {}
    content = str(text.get("content", "")).strip()[:200]
    if content:
        size = SIZES.get(text.get("size", "medium"), 18)
        fs = max(int(min(w, h) / size), 12)
        per_line = max(int(0.88 * w / (0.62 * fs)), 8)
        wrapped = "\n".join(textwrap.wrap(content, width=per_line)) or content
        with open("caption.txt", "w", encoding="utf-8") as f:
            f.write(wrapped)
        color = COLORS.get(text.get("color", "white"), "white")
        pos = POS.get(text.get("position", "bottom"), POS["bottom"])
        fi = clamp(text.get("fade_in", 0.5), 0, 3, 0.5)
        alpha = f":alpha='min(t/{fi},1)'" if fi > 0 else ""
        vf.append(
            f"drawtext=fontfile={FONT}:textfile=caption.txt:expansion=none:"
            f"fontcolor={color}:fontsize={fs}:line_spacing=8:box=1:boxcolor=black@0.5:boxborderw=16:"
            f"x=(w-text_w)/2:y={pos}{alpha}")

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
