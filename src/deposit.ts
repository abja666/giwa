import { publicClientL1, publicClientL2, account, walletClientL1 } from "./config";
import { formatEther, parseEther } from "viem";
import { getL2TransactionHashes } from "viem/op-stack";

/**
 * Deposit ETH (Ethereum -> GIWA)
 * Mekanisme: Lock-and-Mint — ETH ke OptimismPortal di L1, lalu dimint di L2.
 */
async function main() {
  console.log(`👛 Wallet: ${account.address}`);

  const l1Balance = await publicClientL1.getBalance({ address: account.address });
  console.log(`L1 Balance: ${formatEther(l1Balance)} ETH`);

  // Ubah jumlah sesuai kebutuhan (ETH)
  const amount = "0.001";

  // Build argumen deposit (dibuat via L2 client, dikirim via L1 wallet)
  const depositArgs = await publicClientL2.buildDepositTransaction({
    mint: parseEther(amount),
    to: account.address,
  });

  // Kirim tx deposit di L1 (ke OptimismPortal)
  const depositHash = await walletClientL1.depositTransaction(depositArgs);
  console.log(`🔁 L1 deposit tx: ${depositHash}`);

  // Tunggu konfirmasi L1
  const depositReceipt = await publicClientL1.waitForTransactionReceipt({ hash: depositHash });
  console.log("✅ L1 confirmed");

  // Ambil hash L2 yang berkaitan dari receipt L1
  const [l2Hash] = getL2TransactionHashes(depositReceipt);
  console.log(`↗️  L2 deposit tx (predicted): ${l2Hash}`);

  // Tunggu konfirmasi di L2 (biasanya 1–3 menit)
  const l2Receipt = await publicClientL2.waitForTransactionReceipt({ hash: l2Hash });
  console.log("✅ L2 confirmed");
  console.log("🎉 Deposit completed successfully!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
