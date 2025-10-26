import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Wallet, Coins, Activity } from "lucide-react";

interface AccountData {
  address: string;
  aptBalance: string;
}

interface Token {
  name: string;
  symbol: string;
  balance: string;
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
  activity: Transaction[];
}

export default function IndexPage() {
  const [address, setAddress] = useState("");
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
          body: { address: address.trim() },
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEEDCA] via-[#D5FAD3] to-[#20211C] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-900">
          Aptos Journey Card
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
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
                  <p className="text-sm text-gray-600">APT Balance</p>
                  <p className="text-xl font-bold text-emerald-600">{data.account.aptBalance} APT</p>
                </div>
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
        </div>
      </div>
    </div>
  );
}
