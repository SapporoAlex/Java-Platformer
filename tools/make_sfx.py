"""Generates the game's sound effects into sfx/ as .wav files.

Voice lines (the heroine's kiai shouts and cries, the boss roar) start from
Windows' built-in Japanese text-to-speech voice (Microsoft Haruka) and are
then processed into short, punchy shouts. Everything else is synthesized
here from scratch. These are placeholders you can keep or replace: drop a
real recording in sfx/ under the same name and the game uses it instead.

Numbered variants (attack.wav, attack2.wav, attack3.wav, ...) are played at
random, so repeated swings don't all sound the same.

Usage (Windows, needs numpy + scipy):  python tools/make_sfx.py
"""
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter, resample

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "sfx"
SR = 44100
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- helpers
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env(n, attack=0.005, decay=0.2, curve=4.0):
    """Fast attack, exponential decay envelope of length n."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    d = np.exp(-curve * np.maximum(t - attack, 0) / max(decay, 1e-4))
    return a * d


def lowpass(x, hz, order=2):
    b, a = butter(order, min(hz, SR / 2 - 100) / (SR / 2), "low")
    return lfilter(b, a, x)


def highpass(x, hz, order=2):
    b, a = butter(order, hz / (SR / 2), "high")
    return lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], "band")
    return lfilter(b, a, x)


def sweep_noise(dur, f0, f1, q=0.6):
    """Noise through a band-pass whose center sweeps f0 -> f1 (a whoosh)."""
    n = int(dur * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    block = 512
    for i in range(0, n, block):
        k = i / max(n - 1, 1)
        fc = f0 * (f1 / f0) ** k
        seg = noise[max(0, i - 2048): i + block]
        filt = bandpass(seg, fc * (1 - q / 2), fc * (1 + q / 2))
        out[i: i + block] = filt[-len(out[i: i + block]):]
    return out


def tone(freqs, dur, decay=0.3, attack=0.002, kind="sine"):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for f, amp in freqs:
        if kind == "square":
            x += amp * np.sign(np.sin(2 * np.pi * f * t))
        else:
            x += amp * np.sin(2 * np.pi * f * t)
    return x * env(len(t), attack, decay)


def pluck(freq, dur, brightness=0.5, damping=0.996):
    """Karplus-Strong plucked string - koto / shamisen-ish."""
    n = int(dur * SR)
    period = int(SR / freq)
    buf = rng.uniform(-1, 1, period)
    buf = lowpass(buf, 1500 + 6000 * brightness)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        nxt = buf[(i + 1) % period]
        buf[i % period] = damping * 0.5 * (out[i] + nxt)
    return out * env(n, 0.001, dur, 3)


def mix(*parts):
    n = max(len(p) for p, _ in parts)
    out = np.zeros(n)
    for p, offset in parts:
        start = int(offset * SR)
        end = min(n, start + len(p))
        if start < n:
            out[start:end] += p[: end - start]
    return out


def pad(x, dur):
    return np.concatenate([x, np.zeros(int(dur * SR))])


def saturate(x, drive=2.0):
    return np.tanh(drive * x) / np.tanh(drive)


def reverb(x, length=0.35, mix_amt=0.18, tone_hz=5000):
    n = int(length * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.0 / length))
    ir = lowpass(ir, tone_hz)
    ir /= np.sqrt(np.sum(ir ** 2))
    wet = np.convolve(x, ir)  # length len(x) + n - 1
    dry = np.concatenate([x, np.zeros(n - 1)])
    return dry + mix_amt * wet


def fade_out(x, dur=0.03):
    n = min(len(x), int(dur * SR))
    x = x.copy()
    x[-n:] *= np.linspace(1, 0, n)
    return x


def normalize(x, peak=0.89):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def save(name, x):
    OUT.mkdir(exist_ok=True)
    x = normalize(fade_out(x))
    wavfile.write(OUT / f"{name}.wav", SR, (x * 32767).astype(np.int16))
    print(f"  {name}.wav  {len(x) / SR:.2f}s")


# ---------------------------------------------------------------- voice
def tts(text, pitch="x-high", rate="fast", voice="Microsoft Haruka Desktop"):
    """Renders Japanese text with Windows SAPI, returns mono float samples."""
    tmp = Path(tempfile.gettempdir()) / f"sfx_tts_{abs(hash((text, pitch, rate)))}.wav"
    ssml = (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ja-JP">'
        f'<prosody pitch="{pitch}" rate="{rate}" volume="x-loud">{text}</prosody></speak>'
    )
    # The SSML goes through a UTF-8 file: Japanese text on a PowerShell
    # command line gets mangled by the console code page.
    ssml_path = tmp.with_suffix(".ssml")
    ssml_path.write_text(ssml, encoding="utf-8")
    ps = (
        "Add-Type -AssemblyName System.Speech;"
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;"
        f"$s.SelectVoice('{voice}');"
        "$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo("
        f"{SR}, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono);"
        f"$s.SetOutputToWaveFile('{tmp}', $fmt);"
        f"$s.SpeakSsml((Get-Content -Raw -Encoding UTF8 '{ssml_path}'));"
        "$s.Dispose();"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)
    ssml_path.unlink(missing_ok=True)
    sr, data = wavfile.read(tmp)
    tmp.unlink(missing_ok=True)
    x = data.astype(np.float64) / 32768
    return trim(x)


def trim(x, threshold=0.02):
    idx = np.where(np.abs(x) > threshold * np.max(np.abs(x)))[0]
    if not len(idx):
        return x
    return x[max(0, idx[0] - 200): idx[-1] + 400]


def pitch_shift(x, factor):
    """Raise pitch by `factor` (also shortens it - snappier for shouts)."""
    return resample(x, max(16, int(len(x) / factor)))


def vibrato(x, depth=0.004, rate_hz=9.0):
    """Wobbles playback position - turns a held vowel into a frantic scream."""
    n = len(x)
    t = np.arange(n) / SR
    pos = np.arange(n) + depth * SR * np.sin(2 * np.pi * rate_hz * t)
    pos = np.clip(pos, 0, n - 1)
    return np.interp(pos, np.arange(n), x)


def shout(text, shift=1.12, drive=2.4, max_len=0.42, verb=0.16):
    x = tts(text)
    x = pitch_shift(x, shift)
    x = x[: int(max_len * SR)]
    x = highpass(x, 140)
    x *= env(len(x), 0.004, max_len * 0.9, 1.6)  # punchy front, quick tail
    x = saturate(normalize(x), drive)
    return reverb(x, 0.3, verb)


def scream(text, shift=1.2, length=1.1):
    x = tts(text, pitch="x-high", rate="slow")
    x = pitch_shift(x, shift)
    x = vibrato(x[: int(length * SR)], 0.003, 7)
    x = highpass(x, 180)
    x *= env(len(x), 0.01, length, 1.3)
    x = saturate(normalize(x), 2.8)
    return reverb(x, 0.6, 0.25)


# ---------------------------------------------------------------- effects
def swish(dur=0.2, f0=900, f1=4200, level=1.0):
    x = sweep_noise(dur, f0, f1, 0.9) * env(int(dur * SR), dur * 0.35, dur * 0.4, 3)
    return x * level


def thud(freq=110, dur=0.25, drop=0.5):
    t = t_axis(dur)
    f = freq * (1 - drop * t / dur)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, dur * 0.5, 4)
    click = lowpass(rng.standard_normal(len(t)), 1800) * env(len(t), 0.001, 0.03, 5)
    return body + 0.5 * click


def wood_block(freq=900, dur=0.12):
    t = t_axis(dur)
    x = (np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(2 * np.pi * freq * 2.76 * t)) * env(len(t), 0.0005, 0.05, 5)
    return x + 0.3 * bandpass(rng.standard_normal(len(t)), freq * 0.8, freq * 3) * env(len(t), 0.0005, 0.01, 5)


def gong(freq=98, dur=3.0):
    partials = [(1, 1), (1.47, 0.6), (2.09, 0.45), (2.56, 0.3), (3.2, 0.22), (4.1, 0.12)]
    t = t_axis(dur)
    x = np.zeros_like(t)
    for ratio, amp in partials:
        wob = 1 + 0.002 * np.sin(2 * np.pi * 3 * t)
        x += amp * np.sin(2 * np.pi * freq * ratio * wob * t) * np.exp(-t * (1.1 + ratio * 0.5))
    return x * np.clip(t / 0.01, 0, 1)


def taiko(dur=0.9):
    return thud(85, dur, 0.55) + 0.25 * lowpass(rng.standard_normal(int(dur * SR)), 400) * env(int(dur * SR), 0.002, 0.15, 4)


# Japanese pentatonic (miyako-bushi-ish) notes for the plucked jingles.
D4, EB4, G4, A4, BB4, D5, EB5, G5 = 293.7, 311.1, 392.0, 440.0, 466.2, 587.3, 622.3, 784.0
C5, E5, A5 = 523.3, 659.3, 880.0


def main():
    print("Voice (Microsoft Haruka TTS, processed):")
    save("attack", shout("ヤッ"))
    save("attack2", shout("ハッ", shift=1.15))
    save("attack3", shout("エイッ", shift=1.1, max_len=0.48))
    save("attack4", shout("ヤァッ", shift=1.12, max_len=0.5))
    save("hurt", shout("キャッ", shift=1.18, drive=3.0, max_len=0.45, verb=0.2))
    save("hurt2", shout("アッ", shift=1.2, drive=3.0, max_len=0.4, verb=0.2))
    save("hurt3", shout("イタッ", shift=1.15, drive=3.0, max_len=0.5, verb=0.2))
    save("die", pad(scream("キャアアアアア"), 0.2))
    roar = tts("グオオオオオ", pitch="x-low", rate="slow")
    roar = pitch_shift(roar, 0.55)[: int(1.6 * SR)]
    roar = saturate(normalize(lowpass(roar, 2500)), 4.0) * env(len(roar), 0.05, 1.6, 1.2)
    save("bossRoar", reverb(mix((roar, 0), (taiko(1.2) * 0.8, 0)), 0.9, 0.3))

    print("Effects (synthesized):")
    save("slash", swish(0.18, 1200, 5200))
    save("slash2", swish(0.17, 1000, 4600))
    save("jump", mix((swish(0.16, 500, 1800, 0.6), 0), (0.3 * tone([(330, 1)], 0.12, 0.08), 0)))
    save("land", thud(95, 0.16, 0.4) * 0.8)
    save("hit", mix((thud(140, 0.18, 0.6), 0), (highpass(rng.standard_normal(int(0.07 * SR)), 2500) * env(int(0.07 * SR), 0.001, 0.03, 4), 0)))
    save("hit2", mix((thud(120, 0.2, 0.5), 0), (bandpass(rng.standard_normal(int(0.09 * SR)), 1500, 7000) * env(int(0.09 * SR), 0.001, 0.04, 4), 0)))
    save("enemyDie", reverb(mix(
        (sweep_noise(0.45, 2500, 300, 1.0) * env(int(0.45 * SR), 0.01, 0.35, 3), 0),
        (thud(70, 0.4, 0.6) * 0.8, 0.0),
        (tone([(G5, 0.3), (D5, 0.3)], 0.4, 0.25), 0.05),
    ), 0.5, 0.2))
    save("coin", reverb(mix(
        (tone([(2093, 1), (4186, 0.3), (6280, 0.12)], 0.12, 0.05), 0),
        (tone([(2637, 1), (5274, 0.3), (7900, 0.12)], 0.35, 0.18), 0.06),
    ), 0.25, 0.12))
    save("heal", reverb(mix(*[(pluck(f, 0.8, 0.6), i * 0.09) for i, f in enumerate([D5, EB5, G5, A5])]), 0.6, 0.25))
    save("buy", reverb(mix(
        (pluck(G4, 0.7, 0.7), 0), (pluck(BB4, 0.7, 0.7), 0.1), (pluck(D5, 1.0, 0.7), 0.2),
        (tone([(2637, 0.4), (5274, 0.1)], 0.4, 0.2), 0.3),
    ), 0.5, 0.2))
    slide = bandpass(rng.standard_normal(int(0.42 * SR)), 200, 1400) * env(int(0.42 * SR), 0.12, 0.35, 2)
    save("door", reverb(mix((slide * 0.6, 0), (wood_block(420, 0.15), 0.38)), 0.4, 0.2))
    save("locked", mix((wood_block(300, 0.1), 0), (wood_block(280, 0.12), 0.11)))
    save("fireball", sweep_noise(0.45, 400, 1600, 1.2) * env(int(0.45 * SR), 0.02, 0.35, 2.5)
         + 0.4 * lowpass(rng.standard_normal(int(0.45 * SR)), 300) * env(int(0.45 * SR), 0.01, 0.3, 3))
    t = t_axis(0.55)
    shimmer = np.sin(2 * np.pi * (600 + 1400 * t / 0.55) * t) * np.sin(2 * np.pi * 7 * t) ** 2
    save("windup", reverb(shimmer * np.clip(t / 0.45, 0, 1) * 0.6 + 0.3 * sweep_noise(0.55, 3000, 7000, 0.3), 0.4, 0.2))
    save("bossSlash", reverb(mix((swish(0.32, 400, 3000, 1.0), 0), (thud(70, 0.3, 0.5) * 0.7, 0.05)), 0.5, 0.2))
    save("bossDefeat", reverb(mix((taiko(1.0), 0), (taiko(1.0) * 0.8, 0.28), (gong(98, 3.2) * 0.7, 0.55)), 1.2, 0.3))
    save("pause", mix((wood_block(1100, 0.1), 0), (wood_block(800, 0.12), 0.09)))
    save("menu", wood_block(1300, 0.07) * 0.6)
    print(f"Done - files are in {OUT}")


if __name__ == "__main__":
    main()
