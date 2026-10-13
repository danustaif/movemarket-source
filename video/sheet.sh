#!/bin/sh
# Lembar kontak: sh sheet.sh out.png kolom lebar_sel gambar...  (grid kiri-ke-kanan)
out=$1; cols=$2; w=$3; shift 3
n=$#; h=$((w * 9 / 16)); inputs=""; layout=""; i=0; chain=""
for f in "$@"; do
  inputs="$inputs -i $f"; chain="$chain[$i:v]scale=$w:$h[s$i];"
  layout="$layout$((i % cols * w))_$((i / cols * h))|"; i=$((i + 1))
done
refs=""; i=0; while [ $i -lt $n ]; do refs="$refs[s$i]"; i=$((i + 1)); done
ffmpeg -v error -y $inputs -filter_complex "${chain}${refs}xstack=inputs=$n:layout=${layout%|}:fill=black" "$out"
