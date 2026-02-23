import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const privateKey = process.env.X402_PRIVATE_KEY || 
  "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

const account = privateKeyToAccount(privateKey as `0x${string}`);

console.log("=== X402 PAYMENT WALLET ===\n");
console.log(`Private Key: ${privateKey}`);
console.log(`Address: ${account.address}`);
console.log("\nIMPORTANT:");
console.log("1. Save the private key securely!");
console.log("2. Add to .env: X402_PRIVATE_KEY=" + privateKey);
console.log("3. Add to .env: X402_WALLET_ADDRESS=" + account.address);
console.log("4. This wallet will receive USDC payments on Base");
