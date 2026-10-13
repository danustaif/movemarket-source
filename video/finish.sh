#!/bin/sh
# Normalisasi loudness dua tahap ke -14 LUFS, true peak -1 dBTP (target YouTube); video disalin tanpa encode ulang.
# sh finish.sh in.mp4 out.mp4
set -e
in=$1; out=$2
m=$(ffmpeg -hide_banner -i "$in" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$m" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
ffmpeg -hide_banner -v error -y -i "$in" -c:v copy -c:a aac -b:a 256k -ar 48000 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
  -movflags +faststart "$out"
ffmpeg -hide_banner -nostats -i "$out" -filter_complex ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p'
