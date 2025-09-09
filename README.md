git clone https://github.com/abja666/giwa.git

# pastikan sudah di folder project
cd giwa

# dependency utama
pnpm add viem solc prompts colorette figlet gradient-string boxen ora

# dev dependencies (buat TSX/TypeScript jalan lancar)
pnpm add -D tsx typescript @types/node

pnpm run giwa:cli
