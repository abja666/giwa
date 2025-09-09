import 'dotenv/config';
import prompts from 'prompts';
import { bold, green, yellow, cyan, red, dim } from 'colorette';
import {
  account,
  publicClientL1,
  publicClientL2,
  walletClientL1,
  walletClientL2,
} from './config';
import { formatEther, parseEther } from 'viem';
import { getL2TransactionHashes } from 'viem/op-stack';

async function getBalances() {
  const [l1, l2] = await Promise.all([
    publicClientL1.getBalance({ address: account.address }),
    publicClientL2.getBalance({ address: account.address }),
  ]);
  return { l1, l2 };
}

async function doDeposit(amountEth: string) {
  console.log(dim('> buildDepositTransaction...'));
  const depositArgs = await publicClientL2.buildDepositTransaction({
    mint: parseEther(amountEth),
    to: account.address,
  });

  console.log(dim('> depositTransaction (L1)...'));
  const l1Hash = await walletClientL1.depositTransaction(depositArgs);
  console.log(`${green('✓')} L1 tx: ${l1Hash}`);

  console.log(dim('> waitForTransactionReceipt (L1)...'));
  const l1Rcpt = await publicClientL1.waitForTransactionReceipt({ hash: l1Hash });
  console.log(`${green('✓')} L1 confirmed (block ${l1Rcpt.blockNumber})`);

  const [l2Hash] = getL2TransactionHashes(l1Rcpt);
  console.log(`${yellow('↗')} L2 tx (predicted): ${l2Hash}`);

  console.log(dim('> waitForTransactionReceipt (L2)... ini bisa 1–3 menit'));
  const l2Rcpt = await publicClientL2.waitForTransactionReceipt({ hash: l2Hash });
  console.log(`${green('✓')} L2 confirmed (block ${l2Rcpt.blockNumber})`);

  console.log(bold(green('🎉 Deposit completed!')));
}

async function doWithdraw(amountEth: string) {
  console.log(dim('> build initiateWithdrawal...'));
  // Initiate withdrawal di L2
  const withdrawalArgs = await publicClientL1.buildInitiateWithdrawal({
    to: account.address,
    value: parseEther(amountEth),
  });

  console.log(dim('> initiateWithdrawal (L2)...'));
  const l2Hash = await walletClientL2.initiateWithdrawal(withdrawalArgs);
  console.log(`${green('✓')} L2 withdraw init tx: ${l2Hash}`);

  console.log(dim('> waitForTransactionReceipt (L2)...'));
  const l2Rcpt = await publicClientL2.waitForTransactionReceipt({ hash: l2Hash });
  console.log(`${green('✓')} L2 confirmed (withdrawal initiated)`);

  console.log(dim('> waitToProve... (bisa ~menit-jam)'));
  const { output, withdrawal } = await publicClientL1.waitToProve({
    receipt: l2Rcpt,
    targetChain: walletClientL2.chain,
  });

  console.log(dim('> buildProveWithdrawal... & proveWithdrawal (L1)...'));
  const proveArgs = await publicClientL2.buildProveWithdrawal({ output, withdrawal });
  const proveHash = await walletClientL1.proveWithdrawal(proveArgs);
  console.log(`${green('✓')} L1 prove tx: ${proveHash}`);
  await publicClientL1.waitForTransactionReceipt({ hash: proveHash });
  console.log(`${green('✓')} L1 confirmed (proved)`);

  console.log(
    dim('> waitToFinalize... (challenge period ~7 hari; script akan menunggu hingga bisa finalize)'),
  );
  await publicClientL1.waitToFinalize({
    targetChain: walletClientL2.chain,
    withdrawalHash: withdrawal.withdrawalHash,
  });

  console.log(dim('> finalizeWithdrawal (L1)...'));
  const finalizeHash = await walletClientL1.finalizeWithdrawal({
    targetChain: walletClientL2.chain,
    withdrawal,
  });
  console.log(`${green('✓')} L1 finalize tx: ${finalizeHash}`);
  await publicClientL1.waitForTransactionReceipt({ hash: finalizeHash });

  console.log(bold(green('🎉 Withdrawal finalized!')));
}

async function main() {
  if (!process.env.TEST_PRIVATE_KEY) {
    console.log(
      red('TEST_PRIVATE_KEY belum di-set.') +
        ' Gunakan ' +
        cyan('export TEST_PRIVATE_KEY=0x...') +
        ' atau isi file .env',
    );
    process.exit(1);
  }

  console.log(bold(`⚡ GIWA Bridge CLI`));
  console.log(`👛 ${account.address}\n`);

  const { l1, l2 } = await getBalances();
  console.log(`L1 (Sepolia): ${bold(formatEther(l1))} ETH`);
  console.log(`L2 (GIWA)   : ${bold(formatEther(l2))} ETH\n`);

  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: 'Pilih aksi',
    choices: [
      { title: 'Deposit (L1 → L2)', value: 'deposit' },
      { title: 'Withdraw (L2 → L1)', value: 'withdraw' },
      { title: 'Cek Saldo', value: 'balance' },
      { title: 'Keluar', value: 'exit' },
    ],
    initial: 0,
  });

  if (action === 'exit' || !action) process.exit(0);

  if (action === 'balance') {
    const { l1: l1b, l2: l2b } = await getBalances();
    console.log(`\nL1: ${bold(formatEther(l1b))} ETH`);
    console.log(`L2: ${bold(formatEther(l2b))} ETH`);
    process.exit(0);
  }

  const { amount } = await prompts({
    type: 'text',
    name: 'amount',
    message:
      action === 'deposit'
        ? 'Jumlah deposit (ETH) dari L1 ke L2'
        : 'Jumlah withdraw (ETH) dari L2 ke L1',
    initial: action === 'deposit' ? '0.001' : '0.00005',
    validate: (v: string) => (+v > 0 ? true : 'Masukkan angka > 0'),
  });

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: `${yellow('Konfirmasi')} kirim ${bold(amount)} ETH?`,
    initial: true,
  });
  if (!confirm) process.exit(0);

  try {
    if (action === 'deposit') await doDeposit(amount);
    else await doWithdraw(amount);
  } catch (e: any) {
    console.error(red('❌ Error:'), e?.shortMessage || e?.message || e);
    process.exit(1);
  }
}

main();
