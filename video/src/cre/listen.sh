#!/bin/sh
# Rekaman kedua untuk video CRE: simulator dalam mode --listen (engine sudah siap sebelum event datang).
# Alasan: resolver produksi (CRE_MODE=mock) menyelesaikan pasar sekitar 2 detik setelah ResolutionRequested,
# sedangkan workflow hanya me-resolve pasar yang masih OPEN di blok finalized. Mode --listen memproses log
# begitu finalized, jadi getMarkets masih melihat OPEN. Tanpa --broadcast: tidak ada transaksi.
#   asciinema rec --headless --window-size 150x42 -c "sh src/cre/listen.sh local-simulation" public/cre/listen-local.cast
#   asciinema rec --headless --window-size 150x42 -c "sh src/cre/listen.sh staging-settings -g" public/cre/listen-staging.cast
# Output cre di-pipe ke cat: TUI cre menanyakan warna latar terminal (OSC 11) dan macet di pty headless asciinema.
T=$1; shift
cd "$(dirname "$0")/../../../../backend/cre"
printf '\033[32m$\033[0m \033[1m%s\033[0m\n' "cre workflow simulate resolver-workflow --target $T --non-interactive --trigger-index 0 --listen --wasm \$PWD/resolver-workflow/binary.wasm $*"
cre workflow simulate resolver-workflow --target "$T" --non-interactive --trigger-index 0 --listen \
  --wasm "$PWD/resolver-workflow/binary.wasm" "$@" 2>&1 | cat
