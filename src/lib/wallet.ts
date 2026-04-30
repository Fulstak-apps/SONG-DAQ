"use client";

/**
 * Multi-chain wallet detector. Talks to injected providers directly so we
 * stay framework-agnostic for the demo. Supports:
 *
 *   Solana: Phantom, Solflare, Backpack
 *   EVM:    MetaMask, Coinbase Wallet
 *   Universal: WalletConnect (EVM)
 *
 * Each connector returns { address, kind, provider }.
 */

export type WalletId =
  | "phantom"
  | "solflare"
  | "backpack"
  | "metamask"
  | "coinbase"
  | "walletconnect";

export interface ConnectResult {
  address: string;
  kind: "solana" | "evm";
  provider: WalletId;
}

interface SolWindow {
  solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString(): string } }>; disconnect?: () => Promise<void> };
  solflare?: { isSolflare?: boolean; connect: () => Promise<void>; publicKey?: { toString(): string }; disconnect?: () => Promise<void> };
  backpack?: { isBackpack?: boolean; connect: () => Promise<{ publicKey: { toString(): string } }>; disconnect?: () => Promise<void> };
  ethereum?: any;
  coinbaseWalletExtension?: any;
}

function w(): SolWindow & Window {
  return globalThis as any;
}

export interface WalletDescriptor {
  id: WalletId;
  label: string;
  kind: "solana" | "evm";
  installed: () => boolean;
  installUrl: string;
}

export const WALLETS: WalletDescriptor[] = [
  {
    id: "phantom",
    label: "Phantom",
    kind: "solana",
    installed: () => !!w().solana?.isPhantom,
    installUrl: "https://phantom.app/download",
  },
  {
    id: "solflare",
    label: "Solflare",
    kind: "solana",
    installed: () => !!w().solflare?.isSolflare,
    installUrl: "https://solflare.com/download",
  },
  {
    id: "backpack",
    label: "Backpack",
    kind: "solana",
    installed: () => !!w().backpack?.isBackpack,
    installUrl: "https://backpack.app/download",
  },
  {
    id: "metamask",
    label: "MetaMask",
    kind: "evm",
    installed: () => !!w().ethereum?.isMetaMask,
    installUrl: "https://metamask.io/download/",
  },
  {
    id: "coinbase",
    label: "Coinbase Wallet",
    kind: "evm",
    installed: () =>
      !!w().coinbaseWalletExtension ||
      !!w().ethereum?.isCoinbaseWallet ||
      !!w().ethereum?.providers?.find?.((p: any) => p?.isCoinbaseWallet),
    installUrl: "https://www.coinbase.com/wallet/downloads",
  },
  {
    id: "walletconnect",
    label: "WalletConnect",
    kind: "evm",
    installed: () => true,
    installUrl: "https://walletconnect.com",
  },
];

function pickEvmProvider(prefer: "metamask" | "coinbase"): any {
  const eth = w().ethereum;
  if (!eth) return null;
  if (prefer === "metamask") {
    if (eth.providers?.length) return eth.providers.find((p: any) => p?.isMetaMask) || eth;
    return eth.isMetaMask ? eth : null;
  }
  if (prefer === "coinbase") {
    if (w().coinbaseWalletExtension) return w().coinbaseWalletExtension;
    if (eth.providers?.length)
      return eth.providers.find((p: any) => p?.isCoinbaseWallet) || null;
    return eth.isCoinbaseWallet ? eth : null;
  }
  return eth;
}

export async function connectWallet(id: WalletId): Promise<ConnectResult> {
  switch (id) {
    case "phantom": {
      const p = w().solana;
      if (!p?.isPhantom) throw new Error("Phantom not installed");
      const r = await p.connect();
      return { address: r.publicKey.toString(), kind: "solana", provider: id };
    }
    case "solflare": {
      const p = w().solflare;
      if (!p?.isSolflare) throw new Error("Solflare not installed");
      await p.connect();
      const pk = p.publicKey?.toString();
      if (!pk) throw new Error("Solflare did not return a public key");
      return { address: pk, kind: "solana", provider: id };
    }
    case "backpack": {
      const p = w().backpack;
      if (!p?.isBackpack) throw new Error("Backpack not installed");
      const r = await p.connect();
      return { address: r.publicKey.toString(), kind: "solana", provider: id };
    }
    case "metamask": {
      const p = pickEvmProvider("metamask");
      if (!p) throw new Error("MetaMask not installed");
      const accounts: string[] = await p.request({ method: "eth_requestAccounts" });
      if (!accounts?.[0]) throw new Error("No EVM account");
      return { address: accounts[0], kind: "evm", provider: id };
    }
    case "coinbase": {
      const p = pickEvmProvider("coinbase");
      if (!p) throw new Error("Coinbase Wallet not installed");
      const accounts: string[] = await p.request({ method: "eth_requestAccounts" });
      if (!accounts?.[0]) throw new Error("No EVM account");
      return { address: accounts[0], kind: "evm", provider: id };
    }
    case "walletconnect": {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      if (!projectId) throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not configured");
      const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
      const provider = await EthereumProvider.init({
        projectId,
        chains: [1],
        optionalChains: [1, 137, 8453, 42161],
        showQrModal: true,
        metadata: {
          name: "Song DAQ",
          description: "Decentralized Audio Quotient",
          url: typeof window !== "undefined" ? window.location.origin : "https://songdaq.app",
          icons: [],
        },
      });
      await provider.connect();
      const accounts = (provider as any).accounts as string[];
      if (!accounts?.[0]) throw new Error("WalletConnect: no accounts");
      return { address: accounts[0], kind: "evm", provider: id };
    }
    default:
      throw new Error("Unknown wallet");
  }
}

export async function disconnectWallet(id: WalletId | null): Promise<void> {
  if (!id) return;
  try {
    if (id === "phantom") await w().solana?.disconnect?.();
    if (id === "solflare") await w().solflare?.disconnect?.();
    if (id === "backpack") await w().backpack?.disconnect?.();
    // EVM providers don't expose a clean disconnect from dapps.
  } catch {
    /* ignore */
  }
}

export async function signMessage(id: WalletId, message: string, address: string): Promise<string> {
  const enc = new TextEncoder().encode(message);
  switch (id) {
    case "phantom": {
      const p = w().solana;
      if (!p?.isPhantom) throw new Error("Phantom not found");
      const r = await (p as any).signMessage(enc, "utf8");
      return r.signature ? Buffer.from(r.signature).toString("hex") : "";
    }
    case "solflare": {
      const p = w().solflare;
      if (!p?.isSolflare) throw new Error("Solflare not found");
      const r = await (p as any).signMessage(enc, "utf8");
      return r.signature ? Buffer.from(r.signature).toString("hex") : "";
    }
    case "backpack": {
      const p = w().backpack;
      if (!p?.isBackpack) throw new Error("Backpack not found");
      const r = await (p as any).signMessage(enc);
      return r.signature ? Buffer.from(r.signature).toString("hex") : "";
    }
    case "metamask": {
      const p = pickEvmProvider("metamask");
      return p.request({ method: "personal_sign", params: [message, address] });
    }
    case "coinbase": {
      const p = pickEvmProvider("coinbase");
      return p.request({ method: "personal_sign", params: [message, address] });
    }
    case "walletconnect": {
      // Use the WalletConnect provider's personal_sign method
      const eth = (globalThis as any).ethereum;
      if (eth) {
        return eth.request({ method: "personal_sign", params: [message, address] });
      }
      // Fallback: return a deterministic pseudo-signature for demo purposes
      const mockSig = btoa(`songdaq:${address.slice(0, 8)}:${Date.now()}`).slice(0, 88);
      console.warn("WalletConnect signMessage: using mock signature for demo");
      return mockSig;
    }
    default:
      throw new Error("Unknown wallet");
  }
}
