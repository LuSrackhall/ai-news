#!/usr/bin/env python3
"""Synthesize v2 podcast audio using edge-tts with retry"""
import asyncio, json, subprocess, sys, time
from pathlib import Path

async def synthesize():
    audio_dir = Path("output/production/ai/2026-07-12-v2/audio/segments")
    audio_dir.mkdir(parents=True, exist_ok=True)

    with open("output/production/ai/2026-07-12-v2/script.json") as f:
        script = json.load(f)

    segments = []
    def flatten(items):
        if not items: return
        if isinstance(items, list) and items and isinstance(items[0], dict) and "dialogue" in items[0]:
            for item in items:
                if item.get("dialogue"):
                    segments.extend(item["dialogue"])
        elif isinstance(items, list):
            segments.extend(items)

    flatten(script.get("hook"))
    flatten(script.get("overview"))
    flatten(script.get("deep_items"))
    flatten(script.get("quick_items"))
    flatten(script.get("closing"))

    voices = {"M": "zh-CN-YunxiNeural", "F": "zh-CN-XiaoxiaoNeural"}
    output_files = []
    import edge_tts

    for i, seg in enumerate(segments):
        speaker = seg.get("speaker", "M")
        text = seg.get("text", "")
        voice = voices.get(speaker, voices["M"])
        filename = f"{i+1:03d}_{speaker}.mp3"
        out_path = audio_dir / filename

        # Retry up to 3 times
        for attempt in range(3):
            try:
                communicate = edge_tts.Communicate(text, voice)
                await communicate.save(str(out_path))
                sz = out_path.stat().st_size
                if sz > 0:
                    output_files.append(str(out_path))
                    sys.stdout.write(f"  [{i+1}/{len(segments)}] {filename} ok ({sz}B)\n")
                    sys.stdout.flush()
                    break
                else:
                    raise Exception("empty file")
            except Exception as e:
                if attempt < 2:
                    sys.stdout.write(f"  [{i+1}/{len(segments)}] {filename} retry {attempt+1}: {e}\n")
                    sys.stdout.flush()
                    await asyncio.sleep(1)
                else:
                    sys.stdout.write(f"  [{i+1}/{len(segments)}] {filename} FAILED after 3 attempts\n")
                    sys.stdout.flush()
                    raise

    # ffmpeg concat
    if not output_files:
        print("No segments generated, aborting")
        return

    merge_list = audio_dir.parent / "merge_list.txt"
    with open(merge_list, "w") as f:
        for fp in output_files:
            f.write(f"file '{Path(fp).absolute()}'\n")

    podcast_path = audio_dir.parent / "podcast.mp3"
    result = subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", str(merge_list), "-c", "copy", str(podcast_path)
    ], capture_output=True, text=True)

    if podcast_path.exists():
        dur = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(podcast_path)],
            capture_output=True, text=True
        ).stdout.strip().split(".")[0]
        print(f"\n✅ podcast.mp3 generated ({dur}s) - {podcast_path.stat().st_size / 1024:.0f}KB")
    else:
        print(f"\n❌ podcast.mp3 failed")
        print(result.stderr)

if __name__ == "__main__":
    asyncio.run(synthesize())
