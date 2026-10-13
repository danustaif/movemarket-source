import { expect, test } from "bun:test";
import { backupMessage, vaultId } from "./backup.ts";

test("vaultId = keccak256 of the exact UTF-8 vault JSON (known keccak vectors)", () => {
  expect(vaultId("")).toBe("0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470");
  expect(vaultId("abc")).toBe("0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
});

test("backupMessage: canonical lines, lowercase address, chain id from SOT", () => {
  const msg = backupMessage({
    action: "add",
    address: "0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    vaultId: "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    timestamp: 1_790_000_000,
  });
  expect(msg).toBe(
    "MoveMarket backup passkey\n" +
      "Action: add\n" +
      "Account: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266\n" +
      "Vault: 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470\n" +
      "Issued: 1790000000\n" +
      "Chain: 10143",
  );
});
