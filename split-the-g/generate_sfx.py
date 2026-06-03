import math
import random
import struct
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).with_name("audio")
OUT.mkdir(exist_ok=True)


def clamp(value):
    return max(-1.0, min(1.0, value))


def envelope(i, n, attack=0.01, release=0.2):
    t = i / RATE
    total = n / RATE
    return min(1.0, t / max(attack, 0.001), max(0.0, (total - t) / max(release, 0.001)))


def sine(seconds, freq, volume=0.5, bend=0, attack=0.006, release=0.2):
    n = int(seconds * RATE)
    phase = 0.0
    samples = []
    for i in range(n):
        t = i / max(1, n - 1)
        phase += 2 * math.pi * (freq + bend * t) / RATE
        samples.append(math.sin(phase) * volume * envelope(i, n, attack, release))
    return samples


def noise(seconds, seed, volume=0.5, smooth=0.85, attack=0.004, release=0.22):
    random.seed(seed)
    n = int(seconds * RATE)
    value = 0.0
    samples = []
    for i in range(n):
        value = value * smooth + (random.random() * 2 - 1) * (1 - smooth)
        samples.append(value * volume * envelope(i, n, attack, release))
    return samples


def delay(track, seconds):
    return [0.0] * int(seconds * RATE) + track


def mix(*tracks):
    length = max(len(track) for track in tracks)
    output = [0.0] * length
    for track in tracks:
        for i, sample in enumerate(track):
            output[i] += sample
    peak = max(0.05, max(abs(sample) for sample in output))
    return [clamp(sample / peak * 0.92) for sample in output]


def write(name, samples):
    path = OUT / f"{name}.wav"
    with wave.open(str(path), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(b"".join(struct.pack("<h", int(clamp(sample) * 32767)) for sample in samples))
    return path


def crackle(seed, seconds, hits, volume=0.35):
    random.seed(seed)
    out = [0.0] * int(seconds * RATE)
    for _ in range(hits):
        start = random.randrange(0, max(1, len(out) - int(0.03 * RATE)))
        length = random.randrange(int(0.01 * RATE), int(0.04 * RATE))
        for j in range(length):
            idx = start + j
            if idx >= len(out):
                break
            t = j / max(1, length - 1)
            out[idx] += (random.random() * 2 - 1) * volume * ((1 - t) ** 2.5)
    return out


def pulse_train(seed, seconds, rate, volume=0.5, smooth=0.88):
    random.seed(seed)
    n = int(seconds * RATE)
    out = [0.0] * n
    pulse_spacing = int(RATE / rate)
    for start in range(0, n, pulse_spacing):
        length = random.randrange(int(0.045 * RATE), int(0.095 * RATE))
        value = 0.0
        for j in range(length):
            idx = start + j
            if idx >= n:
                break
            value = value * smooth + (random.random() * 2 - 1) * (1 - smooth)
            t = j / max(1, length - 1)
            out[idx] += value * volume * math.sin(math.pi * t)
    return out


def claps(seed, seconds, count, volume=0.55):
    random.seed(seed)
    out = [0.0] * int(seconds * RATE)
    for _ in range(count):
        start = random.randrange(0, max(1, len(out) - int(0.09 * RATE)))
        length = random.randrange(int(0.018 * RATE), int(0.055 * RATE))
        tone = random.choice((900, 1200, 1550, 1900))
        phase = random.random() * math.tau
        for j in range(length):
            idx = start + j
            if idx >= len(out):
                break
            t = j / max(1, length - 1)
            snap = (random.random() * 2 - 1) * (1 - t) ** 3
            body = math.sin(phase + math.tau * tone * j / RATE) * (1 - t) ** 4
            out[idx] += (snap * 0.72 + body * 0.28) * volume
    return out


def vowel(seconds, base, volume, formants, wobble=3.5):
    tracks = []
    for freq, amount in formants:
        tracks.append(sine(seconds, freq, volume * amount, math.sin(freq) * wobble, attack=0.08, release=0.35))
    tracks.append(sine(seconds, base, volume * 0.35, -base * 0.2, attack=0.06, release=0.4))
    return mix(*tracks)


write(
    "guzzle",
    mix(
        pulse_train(1, 1.05, 6.5, 0.85, 0.94),
        delay(noise(0.7, 2, 0.42, 0.985, attack=0.04, release=0.5), 0.04),
        delay(sine(0.82, 82, 0.2, -24, attack=0.06, release=0.5), 0.09),
        delay(crackle(3, 0.55, 18, 0.12), 0.18),
    ),
)

write(
    "bar-bell",
    mix(
        sine(1.8, 690, 0.9, -18, attack=0.001, release=1.55),
        sine(1.55, 1035, 0.42, -24, attack=0.001, release=1.35),
        sine(1.25, 1380, 0.24, -36, attack=0.001, release=1.05),
        delay(sine(1.2, 690, 0.58, -20, attack=0.001, release=1.0), 0.42),
        delay(sine(0.9, 1035, 0.28, -22, attack=0.001, release=0.78), 0.43),
    ),
)

write(
    "glass-clink",
    mix(
        sine(0.32, 1180, 0.65, -40, attack=0.001, release=0.28),
        delay(sine(0.28, 1720, 0.32, -60, attack=0.001, release=0.24), 0.02),
        delay(crackle(4, 0.18, 5, 0.16), 0.015),
    ),
)

write(
    "pub-cheer",
    mix(
        noise(3.1, 5, 0.34, 0.965, attack=0.06, release=1.2),
        claps(15, 3.0, 115, 0.42),
        delay(claps(16, 2.3, 76, 0.3), 0.34),
        vowel(1.65, 210, 0.45, [(700, 0.68), (1150, 0.5), (1900, 0.22)], wobble=8.0),
        delay(vowel(1.85, 260, 0.42, [(780, 0.7), (1320, 0.42), (2100, 0.2)], wobble=9.0), 0.28),
        delay(vowel(1.65, 320, 0.34, [(920, 0.62), (1520, 0.34), (2400, 0.16)], wobble=10.0), 0.72),
        delay(sine(0.9, 620, 0.12, 180, attack=0.02, release=0.5), 1.1),
    ),
)

write(
    "pub-boo",
    mix(
        noise(2.45, 7, 0.18, 0.975, attack=0.06, release=0.9),
        vowel(1.9, 112, 0.64, [(310, 1.0), (560, 0.62), (900, 0.32)], wobble=4.0),
        delay(vowel(1.78, 88, 0.58, [(270, 1.0), (480, 0.58), (760, 0.28)], wobble=5.0), 0.18),
        delay(vowel(1.55, 132, 0.48, [(360, 0.92), (620, 0.48), (940, 0.24)], wobble=5.5), 0.44),
        delay(vowel(1.18, 102, 0.38, [(300, 0.9), (520, 0.42), (780, 0.18)], wobble=6.0), 0.86),
        delay(sine(2.05, 76, 0.2, -18, attack=0.08, release=0.9), 0.05),
    ),
)

write(
    "pub-groan",
    mix(
        sine(0.72, 170, 0.45, -72, attack=0.04, release=0.55),
        sine(0.68, 118, 0.28, -40, attack=0.05, release=0.5),
        noise(0.55, 7, 0.22, 0.94, attack=0.08, release=0.46),
    ),
)

write(
    "camera-shutter",
    mix(
        crackle(8, 0.16, 9, 0.42),
        delay(noise(0.08, 9, 0.35, 0.45), 0.035),
    ),
)

print(f"Generated {len(list(OUT.glob('*.wav')))} WAV files in {OUT}")
