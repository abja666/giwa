# giwa
# ⚡ GIWA Bridge CLI (Termux-friendly)

CLI sederhana untuk bridging ETH antara **Ethereum Sepolia (L1)** dan **GIWA Sepolia (L2)**.  
Dibuat dengan [viem](https://viem.sh/) + [OP-Stack actions](https://viem.sh/op-stack), bisa jalan di **Termux** maupun Linux biasa.

---

## ✨ Fitur
- [x] **Deposit ETH** (L1 → L2) — mekanisme *lock & mint*  
- [x] **Withdraw ETH** (L2 → L1) — mekanisme *burn & unlock*  
- [x] **CLI Interaktif** (pilih menu: deposit, withdraw, cek saldo)  
- [x] **Warna & log detail** untuk pantau status tiap langkah  
- [x] **Termux-friendly** (ringan, tanpa GUI)  

---

## 📦 Instalasi

### 1. Clone repo
```bash
git clone https://github.com/<username>/giwa-bridge.git
cd giwa-bridge

2. Install dependencies

pnpm install

> Pastikan sudah ada Node.js & pnpm.
Di Termux:

pkg install nodejs-lts git -y
npm i -g pnpm



3. Setup environment

Buat file .env dari template:

cp .env.example .env

Edit .env lalu isi:

TEST_PRIVATE_KEY=0xPRIVATE_KEY_ANDA


---

▶️ Cara Pakai

Jalankan CLI interaktif

pnpm start

Menu:

Deposit (L1 → L2)
Withdraw (L2 → L1)
Cek Saldo
Keluar

Jalankan langsung script

pnpm run deposit   # deposit ETH L1 → L2
pnpm run withdraw  # withdraw ETH L2 → L1


---

⚠️ Catatan Penting

Gunakan Sepolia ETH dari faucet untuk gas & deposit.

Deposit biasanya butuh 1–3 menit sampai muncul di L2.

Withdraw:

Step prove bisa makan waktu ~2 jam.

Ada challenge period ~7 hari sebelum finalize di L1.


Jangan commit .env. Hanya commit .env.example untuk template.

Untuk RPC lebih stabil, bisa pakai Alchemy/Infura (Sepolia) + RPC custom GIWA.



---
