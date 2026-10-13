#!/bin/sh
# Potong rekaman mentah TechDemo jadi klip public/clips/tech/*.mp4 (dari folder video/).
# Rekaman mentah dibuat dengan src/tech/record.mjs (14 Okt 2026, akun demo 0x7FA1BaC4c04070d65A3aD1f6808b1Ce7d8bd30ce):
#   take1 = alur aplikasi di movemarket-chess.vercel.app (Chrome headless, virtual authenticator WebAuthn PRF)
#   take2 = Monadscan (Chrome headed; headless kena pemeriksaan Cloudflare)
# Render: npx remotion render TechDemo out/tech/raw.mp4 --codec h264 --crf 17 --audio-codec aac --gl angle
#         sh finish.sh out/tech/raw.mp4 out/movemarket-technical.mp4
set -e
T=out/tech/take1.mp4 U=out/tech/take2.mp4
mkdir -p public/clips/tech
cut() { ffmpeg -v error -y -ss "$2" -i "$1" -t "$3" -an -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -r 30 "public/clips/tech/$4.mp4"; }
cut $T 10 8 landing     # juga latar intro (diblur)
cut $T 20 6 onbA;      cut $T 27 14 onbB        # klik Create account di 28,1 s, akun siap di 32,4 s
cut $T 309 15 stake;   cut $T 393 9 stake2      # batch plies 109-112, lalu 113-116
cut $T 404 8.5 lock;   cut $T 468 14 prov       # lock di 409 s, provisional ply 112 di 472 s
cut $T 530 13 final;   cut $T 566 12 details    # final YES 538 s (report 0x2b80...bcdc)
cut $U 33 16 scan;     cut $U 57.5 6 cli;  cut $U 65.3 6.5 lm
cut $T 614 5 meA;      cut $T 627.3 4.2 meB;  cut $T 641.3 7.5 meC   # claim all 0xc93c...c2a9
cut $T 667.5 7 lb
