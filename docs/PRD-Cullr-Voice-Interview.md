# PRD — Cullr Voice Interview

**Product:** Cullr  
**Versi:** 0.1  
**Tanggal:** 26 Juli 2026  
**Status:** Draft — perencanaan  
**Terkait:** Fase 2.5 async video (`PRD-Platform-Rekrutmen-AI.md`)

---

## 1. Ringkasan

**Cullr Voice Interview** = interview async **dua arah bersuara**: AI berbicara (TTS) ↔ kandidat menjawab (mic + STT), dengan follow-up otomatis.

Bukan pengganti total video async. Video tetap opsi untuk bukti/identitas. Voice jadi mode baru yang lebih natural untuk role komunikasi (CS, sales, dll).

**One-liner:** *Talk with Cullr — short voice screen, scored like an interview, not a monologue.*

---

## 2. Masalah

| Pain | Hari ini (video async) |
|---|---|
| Kandidat hanya monolog ke kamera | Terasa kaku, drop-off tinggi |
| Tidak ada probing | Jawaban dangkal sulit digali |
| Recruiter butuh sinyal soft-skill | Video panjang mahal ditonton |
| Biaya/latency video + identity | Berat untuk volume agency |

Voice 2 arah menyelesaikan “tidak saling bicara”, tetap async (kandidat kerjakan kapan saja).

---

## 3. Goals & non-goals

### Goals (MVP)
1. Kandidat menyelesaikan sesi voice 6–10 menit tanpa app install.
2. AI memberi 4–6 pertanyaan + max 2 follow-up per jawaban lemah.
3. Output ke recruiter: **skor**, **ringkasan singkat**, **transkrip**, **highlight clips opsional (audio)**.
4. Masuk Compare / Ranking sama seperti async video hari ini.
5. Quota AI terpisah/terukur (`voice_turn` / `voice_session`).

### Non-goals (MVP)
- Video real-time face-to-face dengan AI avatar full.
- Interview sinkron live dengan manusia.
- Ganti total pipeline video (tetap hidup sebagai mode A).
- Scoring dari “nada suara emosional” sebagai sinyal utama (terlalu noisy di v1).

---

## 4. Personas

- **Kandidat** — ingin cepat, natural, mobile-friendly.
- **Recruiter agency** — ingin sinyal komunikasi + konsistensi antar kandidat.
- **Admin agency** — kontrol biaya, retensi audio, brand voice.
- **Client viewer** — baca skor/summary saja (read-only).

---

## 5. Mode interview di Cullr

| Mode | Nama | Kapan dipakai |
|---|---|---|
| A | **Video async** (sudah ada) | Butuh bukti wajah + jawaban terekam visual |
| B | **Voice conversation** (baru) | Soft skill / probing / volume tinggi |
| C | **Hybrid** (fase 2) | Selfie + challenge singkat, lalu voice full |

Recruiter pilih mode per job atau per invite link.

---

## 6. User flow (MVP)

### 6.1 Recruiter
1. Buka kandidat → **Buat Interview**.
2. Pilih mode: `Video` | `Voice`.
3. (Opsional) atur bahasa ID/EN, durasi max, jumlah pertanyaan.
4. Dapat link invite → kirim ke kandidat.
5. Setelah selesai: skor + summary muncul di detail / Compare / Ranking (auto-poll seperti sekarang).

### 6.2 Kandidat (Voice)
```
Buka link → izin mic → (opsional) selfie 1x
→ AI sapa + jelaskan aturan (TTS)
→ Loop:
    AI tanya (TTS)
    Kandidat jawab (hold/push-to-talk atau auto VAD)
    STT → LLM nilai + putuskan follow-up / next
→ Selesai → layar thank-you
→ Backend finalize skor + summary
```

### 6.3 Guardrails sesi
- Max durasi sesi: **10 menit** default.
- Max pertanyaan inti: **5**.
- Max follow-up total: **4**.
- Silence > 8 dtk → AI prompt singkat (“Masih di situ?”) lalu skip.
- Kandidat bisa **Ulangi jawaban terakhir** 1x.
- Jaringan putus → resume dari turn terakhir (session state).

---

## 7. Requirements

### Functional
| ID | Requirement |
|---|---|
| F1 | Generate pertanyaan dari job + CV summary (reuse logic async) |
| F2 | TTS AI dalam ID (default) / EN |
| F3 | STT realtime atau near-realtime untuk jawaban kandidat |
| F4 | LLM turn: score partial + decide `follow_up` \| `next` \| `end` |
| F5 | Simpan turn log: `{role, text, audio_path?, latency_ms}` |
| F6 | Overall score 0–100 + summary singkat (reuse band skor Cullr) |
| F7 | Tampil di Compare & Ranking (field sama: interview score/summary) |
| F8 | Quota consume per sesi / per turn |
| F9 | Retensi audio mengikuti setting video retention (hari) |

### Non-functional
| ID | Target |
|---|---|
| N1 | First AI speech < 2.5s setelah kandidat siap |
| N2 | STT partial visible < 1s (best effort) |
| N3 | Mobile Chrome/Safari modern |
| N4 | Fail soft: jika TTS/STT down → fallback teks (baca pertanyaan + ketik/rekam audio saja) |
| N5 | Privacy: audio di storage private; tidak expose URL publik |

---

## 8. UX singkat

**Kandidat UI (1 layar):**
- Waveform / status: *Listening* · *Thinking* · *Speaking*
- Teks pertanyaan terakhir (accessibility)
- Tombol: Mulai · Selesai bicara · Ulangi · Keluar
- Progress: `Pertanyaan 2/5`

**Recruiter UI:**
- Badge mode: `Voice` vs `Video`
- Summary 2–3 kalimat + skor
- Transkrip expandable (bukan wall of text di list)
- Tidak ada copy panjang “AI sedang memproses…” — spinner singkat saja

---

## 9. Arsitektur (high level)

```
Browser (mic)
  → WebRTC/MediaRecorder chunks atau streaming STT
  → API /api/voice/turn  (auth: invite token)
      → STT provider
      → LLM (question policy + scoring)
      → TTS provider → audio URL / stream
  → Client plays AI audio
Session finalize
  → /api/voice/complete → overall score + summary
  → async_interview_sessions (reuse) + voice_turns (baru)
```

### Data (usulan)
- Reuse `async_interview_sessions` + kolom `mode: 'video' | 'voice' | 'hybrid'`
- Tabel baru `voice_interview_turns`:
  - `session_id`, `turn_index`, `role` (`ai`|`candidate`)
  - `text`, `audio_path`, `partial_score`, `created_at`

### Providers (fleksibel via env)
| Layer | Opsi awal |
|---|---|
| LLM | OpenRouter (sama stack sekarang; model cepat untuk turn) |
| STT | OpenAI Whisper / Deepgram / vendor OpenRouter-compatible |
| TTS | OpenAI TTS / ElevenLabs / OpenRouter audio jika ada |

Pilih 1 STT + 1 TTS di MVP; abstraksi `VoiceProvider` agar bisa diganti.

---

## 10. Skor & integritas

**Skor (v1):** dari **teks transkrip** (sama filosofi video sekarang), bukan visual.

Dimensi usulan:
- Relevansi jawaban (35%)
- Kejelasan komunikasi (25%)
- Kedalaman / contoh konkret (25%)
- Konsistensi antar turn (15%)

**Integritas (MVP ringan):**
- Selfie sekali di awal (opsional per job setting)
- Challenge code diucapkan lisan 1x (“Sebutkan kode …”)
- Deteksi jawaban terlalu pendek / copy-paste pattern di teks
- Fase 2: browser integrity signals (tab focus) — jangan blokir dulu

---

## 11. Rollout

### MVP (Voice Mode A)
- Link voice interview
- 5 pertanyaan + follow-up terbatas
- TTS/STT ID
- Skor + summary + transkrip
- Quota + retensi audio

### Fase 2
- Hybrid selfie + voice
- EN + ID auto-detect
- Interrupt / barge-in (kandidat potong AI)
- Recruiter custom opening script / brand name di TTS

### Fase 3
- Live coaching hints untuk recruiter (bukan ke kandidat)
- Evaluasi multi-agent (tech vs behavioral)
- Library rubrik per job family

---

## 12. Sukses metrics

| Metric | Target awal |
|---|---|
| Completion rate voice vs video | Voice ≥ video +10 poin |
| Median session duration | 6–9 menit |
| Recruiter “usefulness” (thumbs) | ≥ 70% useful |
| Cost per completed session | Tercatat & < threshold admin |
| Time-to-score setelah selesai | < 30 dtk p50 |

---

## 13. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| AI suara kaku / latency | Model TTS cepat + kalimat pendek; prefetch next audio |
| Biaya meledak | Cap turn + hard session timeout + quota |
| Curang (orang lain / script) | Selfie opsional + kode lisan + review manual flag |
| STT salah (aksen/ID campur) | Tampilkan teks ke kandidat untuk koreksi singkat |
| Kandidat tidak nyaman mic | Fallback teks tetap tersedia |

---

## 14. Open questions

1. Default mode per job: Voice atau Video?
2. Wajib selfie di Voice MVP atau benar-benar optional?
3. Provider TTS/STT final (biaya vs kualitas ID)?
4. Apakah client viewer boleh dengar audio, atau summary saja?
5. Brand voice: 1 suara global Cullr atau custom per agency (nanti)?

---

## 15. Keputusan produk (usulan)

| Keputusan | Usulan |
|---|---|
| Ganti video total? | **Tidak** — Voice = mode baru |
| MVP interaction | Push-to-talk dulu (lebih stabil daripada full VAD) |
| Scoring source | Transkrip teks |
| Identitas MVP | Selfie opsional + kode lisan 1x |
| UI bahasa | Ikut toggle ID/EN dashboard + setting job |

---

## 16. Next implementation slice (engineering)

1. Migration: `mode` + `voice_interview_turns`
2. `POST /api/voice/session/start` · `POST /api/voice/turn` · `POST /api/voice/complete`
3. Public page `/interview/voice/[token]`
4. Provider adapters: `stt`, `tts`, `dialogue`
5. Wire score ke Compare/Ranking (reuse fields)
6. Quota event `voice_turn` / `voice_session`

**Out of scope slice pertama:** barge-in, avatar, mobile native app.
