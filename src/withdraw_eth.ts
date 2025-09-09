import {
  publicClientL1,
  publicClientL2,
  account,
  walletClientL1,
  walletClientL2,
} from "./config";
import { formatEther, parseEther } from "viem";

/**
 * Withdraw ETH (GIWA -> Ethereum)
 * Mekanisme: Burn-and-Unlock — ETH dibakar di L2 (L2ToL1MessagePasser),
 * lalu di-unlock di L1 (OptimismPortal) setelah prove + finalize.
 */
async function main() {
  console.log(`👛 Wallet: ${account.address}`);

  const l2Balance = await publicClientL2.getBalance({ address: account.address });
  console.log(`L2 Balance: ${formatEther(l2Balance)} ETH`);

  // Ubah jumlah sesuai kebutuhan (ETH)
  const amount = "0.00005";

  // 1) Initiate withdrawal di L2 (ETH ke L2ToL1MessagePasser = burn)
  const withdrawalArgs = await publicClientL1.buildInitiateWithdrawal({
    to: account.address,
    value: parseEther(amount),
  });
  const withdrawalHash = await walletClientL2.initiateWithdrawal(withdrawalArgs);
  console.log(`🔥 L2 withdraw init tx: ${withdrawalHash}`);

  // Tunggu konfirmasi L2
  const withdrawalReceipt = await publicClientL2.waitForTransactionReceipt({
    hash: withdrawalHash,
  });
  console.log("✅ L2 confirmed (withdrawal initiated)");

  // 2) Tunggu bisa di-prove di L1 (GIWA: bisa butuh sampai ~2 jam)
  const { output, withdrawal } = await publicClientL1.waitToProve({
    receipt: withdrawalReceipt,
    targetChain: walletClientL2.chain,
  });

  // 3) Prove di L1
  const proveArgs = await publicClientL2.buildProveWithdrawal({ output, withdrawal });
  const proveHash = await walletClientL1.proveWithdrawal(proveArgs);
  console.log(`🧾 L1 prove tx: ${proveHash}`);
  await publicClientL1.waitForTransactionReceipt({ hash: proveHash });
  console.log("✅ L1 confirmed (proved)");

  // 4) Tunggu challenge period (~7 hari) lalu finalize di L1
  await publicClientL1.waitToFinalize({
    targetChain: walletClientL2.chain,
    withdrawalHash: withdrawal.withdrawalHash,
  });

  const finalizeHash = await walletClientL1.finalizeWithdrawal({
    targetChain: walletClientL2.chain,
    withdrawal,
  });
  console.log(`🔓 L1 finalize tx: ${finalizeHash}`);
  await publicClientL1.waitForTransactionReceipt({ hash: finalizeHash });
  console.log("✅ L1 confirmed (finalized)");
  console.log("🎉 Withdrawal completed successfully!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
