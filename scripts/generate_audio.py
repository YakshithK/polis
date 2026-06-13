"""
Generate ambient audio clips for Algopolis using ElevenLabs Sound Effects API.

Run once before the demo:
  ELEVENLABS_API_KEY=your_key python scripts/generate_audio.py

Writes to frontend/public/audio/:
  baseline.mp3  — 20s looping crowd murmur
  cheer.mp3     — 15s looping crowd celebration
  groan.mp3     — 6s one-shot crowd disappointment
"""

import os
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

API_KEY = os.getenv("ELEVENLABS_API_KEY") or os.getenv("XI_API_KEY")
if not API_KEY:
    print("ERROR: set ELEVENLABS_API_KEY env var")
    sys.exit(1)

OUT_DIR = Path(__file__).parent.parent / "frontend" / "public" / "audio"
OUT_DIR.mkdir(parents=True, exist_ok=True)

CLIPS = [
    {
        "filename": "baseline.mp3",
        "text": "outdoor stadium crowd murmuring quietly, distant chatter, ambient city noise, game day atmosphere, gentle background hum",
        "duration_seconds": 20,
        "loop": True,
        "prompt_influence": 0.4,
    },
    {
        "filename": "cheer.mp3",
        "text": "stadium crowd erupting in loud cheers and celebration, excited sports fans screaming, goal celebration, roaring crowd",
        "duration_seconds": 15,
        "loop": True,
        "prompt_influence": 0.5,
    },
    {
        "filename": "groan.mp3",
        "text": "stadium crowd groaning in collective disappointment and frustration, collective sigh, tense silence after a missed chance",
        "duration_seconds": 6,
        "loop": False,
        "prompt_influence": 0.5,
    },
]


def generate(clip: dict) -> None:
    out_path = OUT_DIR / clip["filename"]
    print(f"Generating {clip['filename']} ({clip['duration_seconds']}s, loop={clip['loop']})...")

    body = {
        "text": clip["text"],
        "duration_seconds": clip["duration_seconds"],
        "loop": clip["loop"],
        "prompt_influence": clip["prompt_influence"],
        "model_id": "eleven_text_to_sound_v2",
    }

    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
        data=json.dumps(body).encode(),
        headers={
            "xi-api-key": API_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            audio_bytes = resp.read()
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()}")
        sys.exit(1)

    out_path.write_bytes(audio_bytes)
    size_kb = len(audio_bytes) // 1024
    print(f"  Saved {out_path} ({size_kb}KB)")


if __name__ == "__main__":
    for clip in CLIPS:
        generate(clip)
    print("\nDone. Files in frontend/public/audio/")
