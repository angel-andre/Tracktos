import React, { useState } from "react";
import axios from "axios";
import html2canvas from "html2canvas";

interface JourneyData {
  address: string;
  totalTxs: number;
  firstDate: string;
  nftCount: number;
}

const AptosJourneyCard: React.FC = () => {
  const [address, setAddress] = useState("");
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchJourney = async () => {
    if (!address) return setError("Please enter a wallet address");
    setError("");
    setLoading(true);

    try {
      // Fetch up to 1000 transactions
      const txRes = await axios.get(`https://api.mainnet.aptoslabs.com/v1/accounts/${address}/transactions?limit=1000`);
      const txs = txRes.data;

      if (!txs || txs.length === 0) {
        setError("No transactions found for this address.");
        setJourney(null);
        return;
      }

      // Total transactions
      const totalTxs = txs.length;

      // Fix microsecond timestamp -> milliseconds
      const oldestTx = txs[txs.length - 1];
      const microTs = Number(oldestTx.timestamp);
      const firstDate = new Date(microTs / 1_000_000).toDateString();

      // Fetch NFTs owned
      const nftRes = await axios.get(
        `https://api.mainnet.aptoslabs.com/v1/accounts/${address}/current_token_ownerships?limit=1000`,
      );

      const ownedNfts = Array.isArray(nftRes.data)
        ? nftRes.data.filter((nft: any) => nft.current_token_data?.metadata_uri)
        : [];

      const nftCount = ownedNfts.length;

      setJourney({
        address,
        totalTxs,
        firstDate,
        nftCount,
      });
    } catch (err) {
      console.error(err);
      setError("Error fetching data. Please verify the wallet address.");
      setJourney(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadCard = () => {
    const card = document.getElementById("journey-card");
    if (!card) return;
    html2canvas(card).then((canvas) => {
      const link = document.createElement("a");
      link.download = "aptos-journey-card.png";
      link.href = canvas.toDataURL();
      link.click();
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#EEEDCA] via-[#D5FAD3] to-[#20211C] text-white px-4">
      <h1 className="text-3xl font-bold mb-4">Aptos Journey Card</h1>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter Aptos wallet address"
          className="px-4 py-2 rounded-lg text-black w-80"
        />
        <button
          onClick={fetchJourney}
          disabled={loading}
          className="bg-emerald-500 px-5 py-2 rounded-lg hover:bg-emerald-400 transition"
        >
          {loading ? "Loading..." : "Generate"}
        </button>
      </div>

      {error && <p className="text-red-300 mb-2">{error}</p>}

      {journey && (
        <div id="journey-card" className="bg-white text-black p-6 rounded-2xl shadow-xl w-96 text-center mt-4">
          <h2 className="text-xl font-semibold mb-3">Aptos Journey</h2>
          <p className="break-words text-xs mb-2">
            <strong>Wallet:</strong> {journey.address}
          </p>
          <p>
            <strong>First Transaction:</strong> {journey.firstDate}
          </p>
          <p>
            <strong>Total Transactions:</strong> {journey.totalTxs}
          </p>
          <p>
            <strong>NFTs Owned:</strong> {journey.nftCount}
          </p>
        </div>
      )}

      {journey && (
        <button onClick={downloadCard} className="mt-4 bg-blue-500 px-5 py-2 rounded-lg hover:bg-blue-400">
          Download Card
        </button>
      )}
    </div>
  );
};

export default AptosJourneyCard;
