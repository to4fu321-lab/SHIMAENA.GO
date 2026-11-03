#!/usr/bin/env python3
"""3分デモ動画の BGM を、プログラム（numpy）だけで作る。外部の音源は使わない。
使い方: python3 scripts/make-music.py docs/video/bgm.wav
場面（秒）: 0-60 静かで孤独 / 60-120 にぎやか・バトル / 120-160 あたたかい / 160-180 ゆかい
"""
import sys
import numpy as np

SR = 44100
DUR = 180
rng = np.random.default_rng(7)
L = np.zeros(DUR * SR + SR * 4)
R = np.zeros_like(L)
WL = np.zeros_like(L)  # リバーブに送る分
WR = np.zeros_like(L)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def put(sig, t, pan=0.0, wet=0.3, gain=1.0):
    i = int(t * SR)
    if i < 0 or i >= len(L):
        return
    n = min(len(sig), len(L) - i)
    s = sig[:n] * gain
    lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + n] += s * lg
    R[i:i + n] += s * rg
    WL[i:i + n] += s * lg * wet
    WR[i:i + n] += s * rg * wet


def tt(d):
    return np.arange(int(d * SR)) / SR


def piano(m, d=2.5, v=1.0):
    t = tt(d)
    f = hz(m)
    s = np.zeros_like(t)
    for k in range(1, 8):
        s += (1 / k ** 1.3) * np.sin(2 * np.pi * f * k * t * (1 + 0.0004 * k * k)) * np.exp(-t * (1.2 + 1.4 * k) / (d * 0.55))
    s *= np.minimum(1, t / 0.006) * np.exp(-t * 0.9)
    return s * 0.28 * v


def pluck(m, d=0.5, v=1.0, bright=1.0):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.5 * bright * np.sin(4 * np.pi * f * t) * np.exp(-t * 14) + 0.25 * np.sin(6 * np.pi * f * t) * np.exp(-t * 20)
    return s * np.exp(-t * 9) * np.minimum(1, t / 0.003) * 0.3 * v


def pad(ms, d, v=1.0, att=2.0):
    t = tt(d)
    s = np.zeros_like(t)
    for m in ms:
        for det in (-0.07, 0.0, 0.08):
            f = hz(m) * 2 ** (det / 12)
            s += np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / att) * np.minimum(1, (d - t) / (att * 1.2))
    return s * env * 0.045 * v / max(1, len(ms) / 3)


def bass(m, d=0.4, v=1.0):
    t = tt(d)
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)
    return s * np.minimum(1, t / 0.01) * np.exp(-t * 4) * 0.5 * v


def bell(m, d=3.0, v=1.0):
    t = tt(d)
    f = hz(m)
    s = np.zeros_like(t)
    for r, a in ((1, 1), (2.76, .5), (5.4, .25), (8.9, .12)):
        s += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * (1.6 + r))
    return s * 0.18 * v * np.minimum(1, t / 0.002)


def kick(v=1.0):
    t = tt(0.3)
    f = 120 * np.exp(-t * 25) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14) * 0.9 * v


def noise_hit(d, hp=0.0, decay=30, v=1.0):
    t = tt(d)
    n = rng.standard_normal(len(t))
    if hp:
        n = n - np.convolve(n, np.ones(int(hp)) / hp, mode='same')
    return n * np.exp(-t * decay) * 0.25 * v


def snare(v=1.0):
    return noise_hit(0.2, 6, 22, v) + 0.4 * np.sin(2 * np.pi * 190 * tt(0.2)) * np.exp(-tt(0.2) * 25) * v


def hat(v=1.0):
    return noise_hit(0.06, 3, 70, v * 0.5)


def clap(v=1.0):
    return noise_hit(0.12, 10, 30, v * 0.9)


def boing(m0=60, m1=84, d=0.35, v=1.0):
    t = tt(d)
    f = hz(m0) * (hz(m1) / hz(m0)) ** (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6) * 0.3 * v


def wind(t0, t1, v=0.04):
    n = int((t1 - t0) * SR)
    x = rng.standard_normal(n)
    k = 600
    x = np.convolve(x, np.ones(k) / k, mode='same') * 8
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * np.arange(n) / SR / 9)
    env = np.minimum(1, np.arange(n) / (SR * 4)) * np.minimum(1, (n - np.arange(n)) / (SR * 5))
    put(x * lfo * env * v, t0, wet=0.2)


# ---- 第1部 0-60秒: Am - Fmaj7 - C - G（ゆっくり・まばら）----
chords1 = [[57, 60, 64], [53, 57, 60, 64], [55, 60, 64], [55, 59, 62]]
bass1 = [45, 41, 48, 43]
mel1 = {  # 8秒ごとのコードの上で、間をあけて鳴らす
    0: [(1.0, 76), (3.5, 72), (6.0, 69)],
    1: [(0.5, 72), (3.0, 69), (5.5, 65)],
    2: [(1.0, 72), (3.2, 76), (5.8, 74)],
    3: [(0.8, 74), (3.6, 71), (6.2, 67)],
}
wind(0, 36, 0.05)
wind(40, 60, 0.03)
for b in range(8):
    t0 = b * 7.5
    if t0 >= 60:
        break
    c = b % 4
    if t0 >= 7:
        put(pad(chords1[c], 8.5, 0.9 if b < 6 else 1.2, att=2.5), t0, wet=0.5)
    put(bass(bass1[c] if b < 7 else 41, 3.0, 0.6), t0 + 0.2, wet=0.2)
    if t0 < 52:
        for dt, m in mel1[c]:
            put(piano(m, 4.0, 0.7), t0 + dt, pan=0.2, wet=0.55)
# 52-60: 希望のきざし（C - G - F）に向かって明るく
for dt, m in [(0, 72), (1.2, 76), (2.4, 79), (3.6, 84), (5.2, 83), (6.4, 79)]:
    put(piano(m, 3.5, 0.8), 52 + dt, wet=0.55)
put(pad([53, 57, 60, 65], 8.5, 1.4, 3), 52, wet=0.6)
put(bell(88, 4, 1.0), 57.0, pan=0.3, wet=0.6)
put(bell(91, 4, 0.8), 58.0, pan=-0.3, wet=0.6)

# ---- 第2部 60-120秒: 112bpm  C - G - Am - F ----
bpm = 112
beat = 60 / bpm
bar = beat * 4
prog = [([60, 64, 67], 36, [72, 76, 79, 76]), ([59, 62, 67], 43, [71, 74, 79, 74]),
        ([57, 60, 64], 45, [69, 72, 76, 72]), ([57, 60, 65], 41, [69, 72, 77, 72])]
t = 60.0
nbar = 0
while t < 120 - 0.01:
    ch, bm, arp = prog[nbar % 4]
    intensity = 0 if t < 72 else (1 if t < 96 else 2)
    for e in range(8):  # 8分でアルペジオ
        put(pluck(arp[e % 4] + (12 if e == 7 and intensity == 2 else 0), 0.45, 0.8 + 0.2 * intensity), t + e * beat / 2, pan=-0.3 + 0.1 * (e % 4), wet=0.3)
    if t >= 64:
        put(pad(ch, bar + 0.3, 0.8, att=0.4), t, wet=0.4)
    for b in range(4):
        tb = t + b * beat
        put(bass(bm if b % 2 == 0 else bm + (7 if intensity else 0), beat * 0.9, 0.8), tb, wet=0.1)
        put(kick(0.9), tb, wet=0.05) if (intensity or t >= 66) and b % 2 == 0 else None
        if t >= 72 and b % 2 == 1:
            put(snare(0.8 if intensity == 1 else 1.0), tb, wet=0.2)
            if intensity == 2:
                put(clap(0.6), tb, wet=0.3)
        if t >= 66:
            put(hat(1.0), tb + beat / 2, pan=0.4, wet=0.1)
            if intensity == 2:
                put(hat(0.6), tb, pan=0.4, wet=0.1)
                put(hat(0.5), tb + beat * 0.25, pan=-0.4, wet=0.1)
    # 主旋律（バトルで高く）
    if t >= 72:
        mel = [ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24]
        for k, m in enumerate(mel):
            put(piano(m + (12 if intensity == 2 and k == 3 else 0), 1.4, 0.55), t + k * beat, pan=0.25, wet=0.4)
    if intensity == 2 and nbar % 4 == 3:  # 4小節ごとのフィル
        for k in range(4):
            put(snare(0.6), t + beat * 3 + k * beat / 4, wet=0.2)
    t += bar
    nbar += 1

# ---- 第3部 120-160秒: 84bpm  F - C - Dm - Bb（あたたかい）----
bpm = 84
beat = 60 / bpm
bar = beat * 4
prog3 = [([53, 57, 60], 41, [65, 69, 72, 77]), ([55, 60, 64], 48, [64, 67, 72, 76]),
         ([53, 57, 62], 50, [65, 69, 74, 77]), ([58, 62, 65], 46, [65, 70, 74, 77])]
t = 120.0
nbar = 0
while t < 160 - 0.01:
    ch, bm, arp = prog3[nbar % 4]
    put(pad(ch + [ch[0] + 12], bar + 1.0, 1.2, att=1.2), t, wet=0.5)
    put(bass(bm, bar * 0.9, 0.7), t, wet=0.2)
    for e in range(8):
        put(piano(arp[e % 4], 2.2, 0.55 + 0.1 * (e == 0)), t + e * beat / 2, pan=-0.2 + 0.08 * (e % 4), wet=0.5)
    if nbar % 2 == 1:
        put(bell(arp[3] + 12, 3.0, 0.8), t + beat * 2, pan=0.4, wet=0.6)
    t += bar
    nbar += 1
# 140秒あたりで少し盛り上がる主旋律
for k, (dt, m) in enumerate([(0, 72), (1, 74), (2, 77), (3, 79), (5, 77), (7, 74), (9, 72), (11, 77)]):
    put(piano(m, 3.0, 0.7), 142 + dt * beat, pan=0.3, wet=0.55)

# ---- 第4部 160-180秒: 124bpm  C - F - G - C（ゆかい）----
bpm = 124
beat = 60 / bpm
bar = beat * 4
prog4 = [([60, 64, 67], 36), ([60, 65, 69], 41), ([59, 62, 67], 43), ([60, 64, 67], 36)]
t = 160.0
nbar = 0
while t < 178 - 0.01:
    ch, bm = prog4[nbar % 4]
    for b in range(4):
        tb = t + b * beat
        put(bass(bm + (12 if b % 2 else 0), beat * 0.45, 0.8), tb, wet=0.1)
        put(kick(0.8), tb, wet=0.05) if b % 2 == 0 else put(clap(0.8), tb, wet=0.2)
        put(hat(0.8), tb + beat / 2, pan=0.4, wet=0.1)
        for off in (0.5,):
            for m in ch:
                put(pluck(m + 12, 0.3, 0.6, 1.4), tb + off * beat, pan=-0.3, wet=0.2)
    t += bar
    nbar += 1
put(boing(55, 79), 165.3, wet=0.2)
put(boing(79, 50, 0.5), 170.2, wet=0.2)
put(boing(60, 88, 0.3), 174.5, wet=0.2)
# ラストのひと鳴き（C）
for m, dt in ((72, 0), (76, 0.05), (79, 0.1), (84, 0.15)):
    put(piano(m, 4.0, 1.0), 178.0 + dt, wet=0.5)
put(bell(96, 3.5, 1.0), 178.2, wet=0.6)
put(kick(1.0), 178.0, wet=0.1)
put(pad([48, 60, 64, 67], 3.5, 1.8, 0.05), 178.0, wet=0.5)

# ---- リバーブ（ノイズを減衰させた残響を畳み込む）----
n_ir = int(2.2 * SR)
ir = rng.standard_normal(n_ir) * np.exp(-np.arange(n_ir) / SR * 2.6)
ir[:int(0.012 * SR)] *= 0
size = 1 << int(np.ceil(np.log2(len(L) + n_ir)))
F = np.fft.rfft(ir, size)
rl = np.fft.irfft(np.fft.rfft(WL, size) * F, size)[:len(L)]
rr = np.fft.irfft(np.fft.rfft(WR, size) * np.fft.rfft(ir[::-1].copy(), size), size)[:len(L)]
L = L + rl * 0.035
R = R + rr * 0.035

# ---- 仕上げ（フェードと音量）----
n = DUR * SR
L, R = L[:n], R[:n]
fade_in, fade_out = int(2 * SR), int(1.8 * SR)
env = np.ones(n)
env[:fade_in] = np.linspace(0, 1, fade_in)
env[-fade_out:] = np.linspace(1, 0, fade_out)
peak = max(np.abs(L).max(), np.abs(R).max())
out = np.stack([L * env, R * env], 1) / peak * 0.85
out = np.tanh(out * 1.1)
import wave
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'bgm.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((out * 32767).astype('<i2').tobytes())
print('できた', out.shape[0] / SR, '秒')
