#!/bin/sh
# Rekaman terminal untuk video CRE (CreDemo). Dijalankan di dalam asciinema:
#   asciinema rec --headless --window-size 150x42 -c "sh src/cre/record.sh" public/cre/sim.cast
# Menunggu ResolutionRequested berikutnya dari LiveMarket produksi, menunggu bloknya finalized,
# lalu langsung mensimulasikan tx itu (local-simulation, lalu staging-settings tanpa --broadcast).
# Harus cepat: resolver produksi (CRE_MODE=mock) menyelesaikan pasar sekitar 20 detik setelah request,
# dan workflow hanya me-resolve pasar yang masih OPEN di blok finalized. Karena itu WASM di-build dulu.
# Tanpa --broadcast: tidak ada transaksi dan key tidak dipakai untuk menandatangani apa pun.
# Output cre di-pipe ke cat: TUI cre menanyakan warna latar terminal (OSC 11) dan macet di pty headless asciinema.
set -e
RPC=https://testnet-rpc.monad.xyz
LM=0xA40F0D8f2e70bfd8F52B4d08089bD083cBdDB9a9
TOPIC=0xee0a59e1d791944ec08c9b8362a29a47dea1e8b5c268d11762fbbd929632a586 # sot/abi.json ResolutionRequested
cd "$(dirname "$0")/../../../../backend/cre"
G='\033[32m'; D='\033[2m'; B='\033[1m'; N='\033[0m'
say() { printf "${G}\$${N} ${B}%s${N}\n" "$1"; }

say "cre workflow build ./resolver-workflow --target staging-settings"
cre workflow build ./resolver-workflow --target staging-settings --non-interactive 2>&1 | cat

printf "\n${D}# waiting for the next ResolutionRequested on LiveMarket %s (Monad Testnet)${N}\n" "$LM"
from=$(cast block-number --rpc-url $RPC)
while :; do
  to=$(cast block-number --rpc-url $RPC)
  [ "$to" -lt "$from" ] && { sleep 0.4; continue; }
  hit=$(cast logs --rpc-url $RPC --from-block "$from" --to-block "$to" --address $LM $TOPIC --json 2>/dev/null | jq -r '.[0] | select(.) | "\(.transactionHash) \(.blockNumber)"')
  [ -n "$hit" ] && break
  from=$((to + 1)); sleep 0.4
done
H=${hit% *}; BLK=$(printf %d "${hit#* }")
IDX=$(cast receipt "$H" --rpc-url $RPC --json | jq --arg t $TOPIC '[.logs[].topics[0]] | index($t)')
printf "${D}# requestResolution tx %s in block %s, waiting for finality...${N}\n" "$H" "$BLK"
until [ "$(cast block finalized -f number --rpc-url $RPC)" -ge "$BLK" ]; do sleep 0.2; done
printf "${D}# block %s finalized${N}\n\n" "$BLK"

say "cre workflow simulate resolver-workflow --target local-simulation --non-interactive --trigger-index 0 --evm-tx-hash $H --evm-event-index $IDX --wasm \$PWD/resolver-workflow/binary.wasm"
cre workflow simulate resolver-workflow --target local-simulation --non-interactive --trigger-index 0 \
  --evm-tx-hash "$H" --evm-event-index "$IDX" --wasm "$PWD/resolver-workflow/binary.wasm" 2>&1 | cat

printf "\n"
say "cre workflow simulate resolver-workflow --target staging-settings --non-interactive --trigger-index 0 --evm-tx-hash $H --evm-event-index $IDX --wasm \$PWD/resolver-workflow/binary.wasm -g"
cre workflow simulate resolver-workflow --target staging-settings --non-interactive --trigger-index 0 \
  --evm-tx-hash "$H" --evm-event-index "$IDX" --wasm "$PWD/resolver-workflow/binary.wasm" -g 2>&1 | cat
