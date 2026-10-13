// Passkey backup (SOT D27, bagian 12a): id vault dan pesan EIP-191 yang ditandatangani akun. Dipakai frontend
// (menandatangani) dan resolver (memverifikasi), jadi format hanya ditulis di sini dan di sot/constants.json.
import { keccak256, stringToHex, type Address, type Hex } from "viem";
import constants from "../../sot/constants.json";

export type BackupAction = "add" | "remove";

/** keccak256 dari JSON vault persis seperti dikirim (tanpa kanonikalisasi ulang). */
export const vaultId = (vaultJson: string): Hex => keccak256(stringToHex(vaultJson));

/** Pesan yang ditandatangani untuk POST /vault (add) dan DELETE /vault/:address/:id (remove). */
export function backupMessage(p: { action: BackupAction; address: Address; vaultId: Hex; timestamp: number }): string {
  const vars: Record<string, string> = {
    action: p.action,
    address: p.address.toLowerCase(),
    vaultId: p.vaultId.toLowerCase(),
    timestamp: String(p.timestamp),
    chainId: String(constants.network.chainId),
  };
  return constants.account.backup.message.replace(/\{(\w+)\}/g, (_, k: string) => vars[k]!);
}
