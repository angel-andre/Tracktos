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
      const query = `
      query GetAccountData($address: String!) {
        account_transaction_aggregate(where: {account_address: {_eq: $address}}) {
          aggregate { count }
        }
        current_token_ownerships_v2_aggregate(where: {owner_address: {_eq: $address}}) {
          aggregate { count }
        }
        account_transactions(
          where: {account_address: {_eq: $address}},
          order_by: {timestamp: asc},
          limit: 1
        ) {
          timestamp
        }
      }
    `;

      const res = await axios.post(
        "https://indexer.mainnet.aptoslabs.com/v1/graphql",
        { query, variables: { address } },
        { headers: { "Content-Type": "application/json" } },
      );

      console.log("API Response:", res.data);

      // Check if response has errors
      if (res.data?.errors) {
        const errorMsg = res.data.errors[0]?.message || "GraphQL query failed";
        console.error("GraphQL errors:", res.data.errors);
        throw new Error(errorMsg);
      }

      // Check if response has the expected structure
      if (!res.data?.data) {
        console.error("Unexpected response structure:", res.data);
        throw new Error("Invalid API response structure");
      }

      const data = res.data.data;

      // Safely access nested properties with optional chaining and defaults
      const totalTxs = data.account_transaction_aggregate?.aggregate?.count ?? 0;
      const nftCount = data.current_token_ownerships_v2_aggregate?.aggregate?.count ?? 0;
      const firstTx = data.account_transactions?.[0]?.timestamp || Date.now().toString();
      const firstDate = new Date(Number(firstTx) / 1000).toDateString();

      setJourney({
        address,
        totalTxs,
        firstDate,
        nftCount,
      });
    } catch (err: any) {
      console.error("API error:", err.message);
      setError("Could not fetch data from Aptos Indexer. Try again later.");
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
