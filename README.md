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
