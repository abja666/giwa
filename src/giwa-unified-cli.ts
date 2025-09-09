// src/giwa-unified-cli.ts
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import solc from 'solc';
import prompts from 'prompts';
import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';
import ora from 'ora';
import {
  account,
  publicClientL1,
  publicClientL2,
  walletClientL1,
  walletClientL2,
} from './config';
import { parseUnits, parseEther } from 'viem';
import { getL2TransactionHashes } from 'viem/op-stack';

// ───────────────── helpers ─────────────────
function assertEnv() {
  if (!process.env.TEST_PRIVATE_KEY) {
    console.error('TEST_PRIVATE_KEY belum di-set. export TEST_PRIVATE_KEY=0x... atau isi .env');
    process.exit(1);
  }
}

function banner() {
  const ascii = figlet.textSync('GIWA BOT', { font: 'Big' });
  console.log(gradient.cristal.multiline(ascii));

  // "bot by 0xb" selalu center & rainbow
  const credit = 'Bot by Bazzz';
  const width = process.stdout.columns || 80;
  const pad = Math.max(0, Math.floor((width - credit.length) / 2));
  console.log(gradient.rainbow(' '.repeat(pad) + credit) + '\n');

  const box = boxen(
    `Bridge + Deploy ERC20\nWallet: ${account.address}`,
    { padding: 1, borderStyle: 'round', borderColor: 'cyan' }
  );
  console.log(box);
}

const hr = (label?: string) =>
  console.log(gradient.pastel.multiline('─'.repeat(40) + (label ? ` ${label} ` : '') + '─'.repeat(40)));

function compileERC20(filePath: string, contractName: string) {
  const spinner = ora('Compiling ERC20 template…').start();
  const source = fs.readFileSync(filePath, 'utf8');
  const input = {
    language: 'Solidity',
    sources: { [path.basename(filePath)]: { content: source } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const errs = output.errors.filter((e: any) => e.severity === 'error');
    if (errs.length) {
      spinner.fail('Compile failed');
      errs.forEach((e: any) => console.error(e.formattedMessage));
      process.exit(1);
    }
  }
  const c = output.contracts[path.basename(filePath)][contractName];
  spinner.succeed('Compile OK');
  return { abi: c.abi, bytecode: c.evm.bytecode.object };
}

// ───────────────── Bridge ─────────────────
async function bridgeDepositInteractive() {
  const { amount } = await prompts({
    type: 'text',
    name: 'amount',
    message: 'Jumlah deposit (ETH) L1 → L2',
    initial: '0.001',
    validate: (v) => (+v > 0 ? true : 'Masukkan angka > 0'),
  });

  const s1 = ora('Mempersiapkan deposit…').start();
  const depositArgs = await publicClientL2.buildDepositTransaction({
    mint: parseEther(String(amount)),
    to: account.address,
  });
  s1.succeed('Argumen siap');

  const s2 = ora('Mengirim tx di L1…').start();
  const l1Hash = await walletClientL1.depositTransaction(depositArgs);
  s2.succeed(`L1 tx: ${l1Hash}`);

  const s3 = ora('Menunggu konfirmasi L1…').start();
  const l1Rcpt = await publicClientL1.waitForTransactionReceipt({ hash: l1Hash });
  s3.succeed(`L1 confirmed (block ${l1Rcpt.blockNumber})`);

  const [l2Hash] = getL2TransactionHashes(l1Rcpt);
  ora().info(`L2 tx (predicted): ${l2Hash}`);

  const s4 = ora('Menunggu konfirmasi L2 (±1–3 menit)…').start();
  const l2Rcpt = await publicClientL2.waitForTransactionReceipt({ hash: l2Hash });
  s4.succeed(`L2 confirmed (block ${l2Rcpt.blockNumber})`);

  console.log(boxen('Deposit completed 🎉', { padding: 1, borderStyle: 'double', borderColor: 'green' }));
}

async function bridgeWithdrawInitiateInteractive() {
  const { amount } = await prompts({
    type: 'text',
    name: 'amount',
    message: 'Jumlah withdraw (ETH) L2 → L1 (INITIATE)',
    initial: '0.00005',
    validate: (v) => (+v > 0 ? true : 'Masukkan angka > 0'),
  });

  const s1 = ora('Mempersiapkan initiateWithdrawal…').start();
  const withdrawalArgs = await publicClientL1.buildInitiateWithdrawal({
    to: account.address,
    value: parseEther(String(amount)),
  });
  s1.succeed('Argumen siap');

  const s2 = ora('Mengirim tx di L2…').start();
  const l2Hash = await walletClientL2.initiateWithdrawal(withdrawalArgs);
  s2.succeed(`L2 tx: ${l2Hash}`);

  const s3 = ora('Menunggu konfirmasi L2…').start();
  await publicClientL2.waitForTransactionReceipt({ hash: l2Hash });
  s3.succeed('L2 confirmed (initiated)');

  console.log(boxen('Simpan hash L2 untuk PROVE/FINALIZE ✅', { padding: 1, borderStyle: 'round', borderColor: 'yellow' }));
}

async function bridgeWithdrawProveInteractive() {
  const { l2hash } = await prompts({
    type: 'text',
    name: 'l2hash',
    message: 'Masukkan L2 withdrawal tx hash (INITIATE)',
    validate: (v) => /^0x[0-9a-fA-F]{64}$/.test(v) || 'Hash tidak valid',
  });

  const s0 = ora('Ambil receipt L2…').start();
  const l2Rcpt = await publicClientL2.waitForTransactionReceipt({ hash: l2hash as `0x${string}` });
  s0.succeed('Receipt OK');

  const s1 = ora('waitToProve…').start();
  const { output, withdrawal } = await publicClientL1.waitToProve({
    receipt: l2Rcpt,
    targetChain: walletClientL2.chain,
  });
  s1.succeed('Bisa di-prove');

  const s2 = ora('proveWithdrawal di L1…').start();
  const proveArgs = await publicClientL2.buildProveWithdrawal({ output, withdrawal });
  const proveHash = await walletClientL1.proveWithdrawal(proveArgs);
  s2.succeed(`L1 prove tx: ${proveHash}`);

  const s3 = ora('Menunggu konfirmasi L1…').start();
  await publicClientL1.waitForTransactionReceipt({ hash: proveHash });
  s3.succeed('L1 confirmed (proved)');

  console.log(boxen('Prove done ✅ — lanjut FINALIZE setelah challenge period', { padding: 1, borderStyle: 'round', borderColor: 'cyan' }));
}

async function bridgeWithdrawFinalizeInteractive() {
  const { l2hash } = await prompts({
    type: 'text',
    name: 'l2hash',
    message: 'Masukkan L2 withdrawal tx hash (yang sudah PROVED)',
    validate: (v) => /^0x[0-9a-fA-F]{64}$/.test(v) || 'Hash tidak valid',
  });

  const s0 = ora('Ambil receipt L2…').start();
  const l2Rcpt = await publicClientL2.waitForTransactionReceipt({ hash: l2hash as `0x${string}` });
  s0.succeed('Receipt OK');

  const s1 = ora('Menunggu bisa FINALIZE (challenge period)…').start();
  const { withdrawal } = await publicClientL1.waitToProve({
    receipt: l2Rcpt,
    targetChain: walletClientL2.chain,
  });
  await publicClientL1.waitToFinalize({
    targetChain: walletClientL2.chain,
    withdrawalHash: withdrawal.withdrawalHash,
  });
  s1.succeed('Bisa finalize');

  const s2 = ora('finalizeWithdrawal di L1…').start();
  const finalizeHash = await walletClientL1.finalizeWithdrawal({
    targetChain: walletClientL2.chain,
    withdrawal,
  });
  await publicClientL1.waitForTransactionReceipt({ hash: finalizeHash });
  s2.succeed(`Finalized! L1 tx: ${finalizeHash}`);

  console.log(boxen('Withdrawal finalized 🎉', { padding: 1, borderStyle: 'double', borderColor: 'green' }));
}

// ───────────────── Deploy ─────────────────
async function deployERC20FromTemplate() {
  const { name, symbol, supply } = await prompts([
    { type: 'text', name: 'name', message: 'Token name', initial: 'My Token' },
    { type: 'text', name: 'symbol', message: 'Token symbol', initial: 'MTK' },
    {
      type: 'text',
      name: 'supply',
      message: 'Initial supply (tanpa desimal, 18 decimals)',
      initial: '1000000',
      validate: (v) => (+v > 0 ? true : 'Masukkan angka > 0'),
    },
  ]);

  const { abi, bytecode } = compileERC20('contracts/MyToken.sol', 'MyToken');
  const initWei = parseUnits(String(supply).replace(/_/g, ''), 18);

  const s = ora('Deploying to GIWA Sepolia…').start();
  const txHash = await walletClientL2.deployContract({
    abi,
    bytecode: `0x${bytecode}`,
    account,
    args: [name, symbol, initWei],
  });
  s.text = `Tx sent: ${txHash}`;
  const rcpt = await publicClientL2.waitForTransactionReceipt({ hash: txHash });
  s.succeed(`Deployed at ${rcpt.contractAddress}`);
  hr();
}

// ───────────────── Main ─────────────────
async function main() {
  assertEnv();
  banner();

  while (true) {
    const { choice } = await prompts({
      type: 'select',
      name: 'choice',
      message: 'Pilih menu',
      choices: [
        { title: '🟢 Bridge ETH', value: 'bridge' },
        { title: '🛠️  Deploy ERC20 (template)', value: 'deploy' },
        { title: '🚪 Keluar', value: 'exit' },
      ],
      initial: 0,
    });

    if (!choice || choice === 'exit') {
      console.log(gradient.vice('Sampai jumpa! 👋'));
      break;
    }

    try {
      if (choice === 'bridge') {
        const { b } = await prompts({
          type: 'select',
          name: 'b',
          message: 'Bridge menu',
          choices: [
            { title: '↗️  Deposit (L1 → L2)', value: 'dep' },
            { title: '🔥 Withdraw INITIATE (L2 → L1)', value: 'win' },
            { title: '🧾 Withdraw PROVE', value: 'wpr' },
            { title: '🔓 Withdraw FINALIZE', value: 'wfi' },
            { title: '⬅️  Kembali', value: 'back' },
          ],
          initial: 0,
        });
        if (b === 'dep') await bridgeDepositInteractive();
        if (b === 'win') await bridgeWithdrawInitiateInteractive();
        if (b === 'wpr') await bridgeWithdrawProveInteractive();
        if (b === 'wfi') await bridgeWithdrawFinalizeInteractive();
      }

      if (choice === 'deploy') {
        await deployERC20FromTemplate();
      }
    } catch (e: any) {
      ora().fail(e?.shortMessage || e?.message || String(e));
    }

    hr('Main Menu');
  }
}

main();
