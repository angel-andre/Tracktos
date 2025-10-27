import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wallet, Coins, Activity, Image as ImageIcon } from "lucide-react";

interface AccountData {
  address: string;
  aptBalance: string;
  stakedApt: string;
}

interface Token {
  name: string;
  symbol: string;
  balance: string;
}

interface NFT {
  name: string;
  collection: string;
  image: string;
}

interface Transaction {
  hash: string;
  type: string;
  success: boolean;
  timestamp: string;
}

interface AptosData {
  account: AccountData;
  tokens: Token[];
  nfts: NFT[];
  activity: Transaction[];
}

export default function IndexPage() {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<AptosData | null>(null);

  const loadStats = async () => {
    if (!address.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    setError("");
    setLoading(true);
    setData(null);

    try {
      const { data: responseData, error: functionError } = await supabase.functions.invoke(
        'aptos',
        {
          body: { address: address.trim(), network },
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (responseData.error) {
        throw new Error(responseData.error);
      }

      setData(responseData as AptosData);
    } catch (err: any) {
      console.error("Error fetching Aptos data:", err);
      setError(err.message || "Failed to load wallet data. Please check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadStats();
    }
  };

  // NFT image helpers with gateway fallbacks
  const extractIpfsPath = (u: string): string | null => {
    if (!u) return null;
    if (u.startsWith('ipfs://')) {
      return u.replace(/^ipfs:\/\//, '').replace(/^ipfs\//, '');
    }
    try {
      const url = new URL(u);
      const match = url.pathname.match(/\/ipfs\/(.+)/);
      if (match && match[1]) return match[1];
    } catch {
      // If it's a raw CID
      if (/^(Qm|bafy)[A-Za-z0-9]+/.test(u)) return u;
    }
    return null;
  };

  const buildImageCandidates = (u: string): string[] => {
    if (!u) return [];
    const list: string[] = [];
    const pushUnique = (s: string) => { if (s && !list.includes(s)) list.push(s); };

    // Original first
    pushUnique(u);

    // IPFS gateways
    const ipfsPath = extractIpfsPath(u);
    if (ipfsPath) {
      const gateways = [
        `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`,
        `https://ipfs.io/ipfs/${ipfsPath}`,
        `https://nftstorage.link/ipfs/${ipfsPath}`,
        `https://dweb.link/ipfs/${ipfsPath}`,
        `https://gateway.pinata.cloud/ipfs/${ipfsPath}`,
        `https://ipfs.cf-ipfs.com/ipfs/${ipfsPath}`,
        `https://gw3.io/ipfs/${ipfsPath}`,
      ];
      gateways.forEach(pushUnique);
    }

    // Arweave alternates
    try {
      const url = new URL(u);
      if (url.hostname.endsWith('arweave.net')) {
        const path = url.pathname.replace(/^\/+/, '');
        [
          `https://arweave.net/${path}`,
          `https://ar-io.net/${path}`,
          `https://gateway.irys.xyz/${path}`,
        ].forEach(pushUnique);
      }
    } catch {}

    return list;
  };

  const FallbackImage = ({ srcs, alt, className }: { srcs: string[]; alt: string; className?: string }) => {
    const [i, setI] = React.useState(0);
    const onError = () => setI((prev) => (prev + 1 < srcs.length ? prev + 1 : prev));
    const src = srcs[i];
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
        onError={onError}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEEDCA] via-[#D5FAD3] to-[#20211C] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-900">
          Aptos Journey Card
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setNetwork("mainnet")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  network === "mainnet"
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Mainnet
              </button>
              <button
                onClick={() => setNetwork("testnet")}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  network === "testnet"
                    ? "bg-emerald-500 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Testnet
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter Aptos wallet address (0x...)"
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900"
                disabled={loading}
              />
              <button
                onClick={loadStats}
                disabled={loading || !address.trim()}
                className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load Stats"
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Account Card */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-800">Account</h2>
            </div>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : data?.account ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-mono text-xs break-all text-gray-900">{data.account.address}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">APT Balance (Liquid)</p>
                  <p className="text-xl font-bold text-emerald-600">{data.account.aptBalance} APT</p>
                </div>
                {data.account.stakedApt !== '0' && (
                  <div>
                    <p className="text-sm text-gray-600">Staked APT</p>
                    <p className="text-lg font-semibold text-blue-600">{data.account.stakedApt} APT</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">Enter an address and click "Load Stats"</p>
            )}
          </div>

          {/* Tokens Card */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">Tokens</h2>
            </div>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : data?.tokens ? (
              data.tokens.length > 0 ? (
                <div className="space-y-2">
                  {data.tokens.map((token, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="font-medium text-gray-900">{token.symbol}</p>
                        <p className="text-xs text-gray-500">{token.name}</p>
                      </div>
                      <p className="font-mono text-sm text-gray-700">{token.balance}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No tokens found</p>
              )
            ) : (
              <p className="text-gray-400">Enter an address and click "Load Stats"</p>
            )}
          </div>

          {/* Recent Activity Card */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-800">Recent Activity</h2>
            </div>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : data?.activity ? (
              data.activity.length > 0 ? (
                <div className="space-y-3">
                  {data.activity.map((tx, idx) => (
                    <div key={idx} className="py-2 border-b border-gray-100 last:border-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-mono text-xs break-all text-gray-700 flex-1 mr-2">
                          {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                        </p>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            tx.success
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {tx.success ? "Success" : "Failed"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{tx.type}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(tx.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No recent transactions</p>
              )
            ) : (
              <p className="text-gray-400">Enter an address and click "Load Stats"</p>
            )}
          </div>

          {/* NFTs Card */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-800">NFTs</h2>
            </div>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : data?.nfts ? (
              data.nfts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {data.nfts.map((nft, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-2">
                      <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                        {nft.image ? (
                          <FallbackImage
                            srcs={buildImageCandidates(nft.image)}
                            alt={`${nft.name} - ${nft.collection}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-900 truncate">{nft.name}</p>
                      <p className="text-xs text-gray-500 truncate">{nft.collection}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No NFTs found</p>
              )
            ) : (
              <p className="text-gray-400">Enter an address and click "Load Stats"</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
