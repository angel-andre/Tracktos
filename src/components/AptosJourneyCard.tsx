import { useState } from "react";
import axios from "axios";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface JourneyData {
  address: string;
  totalTxs: number;
  firstDate: string;
  nftCount: number;
}

export default function AptosJourneyCard() {
  const [address, setAddress] = useState("");
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchJourney = async () => {
    if (!address) return setError("Please enter a wallet address");
    setError("");
    setLoading(true);

    try {
      const txRes = await axios.get(
        `https://api.mainnet.aptoslabs.com/v1/accounts/${address}/transactions`
      );
      const txs = txRes.data;
      if (!txs.length) {
        setError("No transactions found for this address.");
        setJourney(null);
        return;
      }

      const totalTxs = txs.length;
      const firstTx = txs[txs.length - 1].timestamp;
      const firstDate = new Date(Number(firstTx) / 1000).toDateString();

      const res = await axios.get(
        `https://api.mainnet.aptoslabs.com/v1/accounts/${address}/resources`
      );
      const nftResources = res.data.filter((r: any) =>
        r.type.includes("Token")
      );
      const nftCount = nftResources.length;

      setJourney({
        address,
        totalTxs,
        firstDate,
        nftCount,
      });
    } catch (e) {
      console.error(e);
      setError("Error fetching data. Check address and try again.");
      setJourney(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadCard = () => {
    const cardElement = document.querySelector("#journey-card");
    if (cardElement) {
      html2canvas(cardElement as HTMLElement).then(canvas => {
        const link = document.createElement("a");
        link.download = "aptos-journey-card.png";
        link.href = canvas.toDataURL();
        link.click();
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background via-primary to-secondary px-4">
      <h1 className="text-3xl font-bold mb-4 text-foreground">Aptos Journey Card</h1>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Enter Aptos wallet address"
          className="w-80"
        />
        <Button
          onClick={fetchJourney}
          disabled={loading}
          variant="default"
        >
          {loading ? "Loading..." : "Generate"}
        </Button>
      </div>

      {error && <p className="text-destructive mb-2">{error}</p>}

      {journey && (
        <Card
          id="journey-card"
          className="bg-card text-card-foreground p-6 rounded-2xl shadow-glow-lg w-96 text-center mt-4"
        >
          <h2 className="text-xl font-semibold mb-3">Aptos Journey</h2>
          <p className="break-words text-xs mb-2">
            <strong>Wallet:</strong> {journey.address}
          </p>
          <p><strong>First Transaction:</strong> {journey.firstDate}</p>
          <p><strong>Total Transactions:</strong> {journey.totalTxs}</p>
          <p><strong>NFTs Owned:</strong> {journey.nftCount}</p>
        </Card>
      )}

      {journey && (
        <Button
          onClick={downloadCard}
          className="mt-4"
          variant="secondary"
        >
          Download Card
        </Button>
      )}
    </div>
  );
}
