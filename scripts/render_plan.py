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
BRAND_POS = {
    "bottom_center": ("(w-text_w)/2", "h-text_h-h/18"),
    "bottom_left": ("w/18", "h-text_h-h/18"),
    "bottom_right": ("w-text_w-w/18", "h-text_h-h/18"),
    "top_center": ("(w-text_w)/2", "h/18"),
}


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
        plan = {"texts": [{"content": os.environ.get("CAPTION", ""), "x": 0.5, "y": 0.88, "size": "medium", "color": "white", "style": "box", "start": 0, "end": None, "fade_in": 0.5}]}
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

    # --- texts list ---
    texts = plan.get("texts") or []
    # Backwards compatibility with legacy text single object
    if not texts and plan.get("text"):
        legacy = plan["text"]
        if legacy.get("content"):
            pos = legacy.get("position", "bottom")
            y_val = 0.12 if pos == "top" else (0.5 if pos == "center" else 0.88)
            texts = [{
                "content": legacy.get("content", ""),
                "x": 0.5,
                "y": y_val,
                "size": legacy.get("size", "medium"),
                "color": legacy.get("color", "white"),
                "style": "box",
                "start": 0,
                "end": None,
                "fade_in": legacy.get("fade_in", 0.5),
            }]

    for idx, t in enumerate(texts[:6]):
        content = str(t.get("content", "")).strip()[:200]
        if not content:
            continue
        size = SIZES.get(t.get("size", "medium"), 18)
        fs = max(int(min(w, h) / size), 12)
        per_line = max(int(0.88 * w / (0.62 * fs)), 8)
        wrapped = "\n".join(textwrap.wrap(content, width=per_line)) or content
        txt_path = f"caption_{idx}.txt"
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(wrapped)

        color = COLORS.get(t.get("color", "white"), "white")
        style = t.get("style", "clean")
        x_frac = clamp(t.get("x", 0.5), 0.05, 0.95, 0.5)
        y_frac = clamp(t.get("y", 0.88), 0.05, 0.95, 0.88)
        x_expr = f"{x_frac:.3f}*w-text_w/2"
        y_expr = f"{y_frac:.3f}*h-text_h/2"

        # Style specifics
        style_params = []
        if style == "box":
            style_params.append("box=1:boxcolor=black@0.6:boxborderw=14")
        elif style == "outline":
            style_params.append("borderw=2:bordercolor=black")
        else: # clean
            style_params.append("shadowcolor=black@0.7:shadowx=2:shadowy=2")

        # Time range enable & fade
        t_start = clamp(t.get("start", 0), 0, out_dur, 0)
        t_end = t.get("end")
        if t_end is not None and t_end != "":
            t_end_val = clamp(t_end, t_start, out_dur, out_dur)
            enable_expr = f"between(t,{t_start:.2f},{t_end_val:.2f})"
        else:
            enable_expr = f"gte(t,{t_start:.2f})"

        fi = clamp(t.get("fade_in", 0), 0, 3, 0)
        alpha_expr = ""
        if fi > 0:
            alpha_expr = f":alpha='if(lt(t,{t_start:.2f}+{fi:.2f}),(t-{t_start:.2f})/{fi:.2f},1)'"

        sp_str = (":" + ":".join(style_params)) if style_params else ""
        vf.append(
            f"drawtext=fontfile={FONT}:textfile={txt_path}:expansion=none:"
            f"fontcolor={color}:fontsize={fs}:line_spacing=8"
            f"{sp_str}:x={x_expr}:y={y_expr}:enable='{enable_expr}'{alpha_expr}")

    # --- brand tag ---
    brand = plan.get("brand")
    if brand and isinstance(brand, dict):
        b_content = str(brand.get("content", "")).strip()[:30]
        if b_content:
            b_pos_key = brand.get("position", "bottom_center")
            b_x, b_y = BRAND_POS.get(b_pos_key, BRAND_POS["bottom_center"])
            b_size = max(int(min(w, h) / 36), 11)
            with open("brand.txt", "w", encoding="utf-8") as f:
                f.write(b_content)
            vf.append(
                f"drawtext=fontfile={FONT}:textfile=brand.txt:expansion=none:"
                f"fontcolor=white@0.9:fontsize={b_size}:box=1:boxcolor=black@0.5:boxborderw=8:"
                f"x={b_x}:y={b_y}")

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

    print("Applied:", {k: plan[k] for k in plan if k in ("texts", "brand", "look", "zoom", "speed", "trim", "fade_in", "fade_out")})
    print("Filters:", ",".join(vf) or "(none)")
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    main()
