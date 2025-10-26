import { useState } from "react";
import axios from "axios";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Calendar, Hash, Image } from "lucide-react";

interface JourneyData {
  address: string;
  totalTxs: number;
  firstDate: string;
  nftCount: number;
}

const AptosJourneyCard = () => {
  const [address, setAddress] = useState("");
  const [journey, setJourney] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchJourney = async () => {
    if (!address) {
      setError("Please enter a wallet address");
      return;
    }
    
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

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Aptos Journey Card
          </h1>
          <p className="text-muted-foreground">
            Discover your Aptos blockchain journey
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Enter Aptos wallet address"
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && fetchJourney()}
          />
          <Button
            onClick={fetchJourney}
            disabled={loading}
            className="sm:w-auto w-full"
          >
            {loading ? "Loading..." : "Generate Card"}
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 animate-fade-in">
            <p className="text-destructive text-sm text-center">{error}</p>
          </div>
        )}

        {journey && (
          <div className="space-y-4 animate-fade-in">
            <Card
              id="journey-card"
              className="p-8 bg-card/80 backdrop-blur-xl border-2 border-primary/20 shadow-glow-lg"
            >
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Aptos Journey Card
                  </h2>
                  <p className="text-muted-foreground font-mono text-sm">
                    {formatAddress(journey.address)}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-muted/50 border border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-glow">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Hash className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-foreground">
                        {journey.totalTxs.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total Transactions
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-muted/50 border border-secondary/10 hover:border-secondary/30 transition-all duration-300 hover:shadow-glow">
                    <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-secondary" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-foreground">
                        {journey.firstDate}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        First Transaction
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center space-y-3 p-6 rounded-lg bg-muted/50 border border-primary/10 hover:border-primary/30 transition-all duration-300 hover:shadow-glow">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Image className="w-6 h-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-foreground">
                        {journey.nftCount.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        NFTs Owned
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Button
              onClick={downloadCard}
              variant="secondary"
              className="w-full sm:w-auto"
            >
              Download Card
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AptosJourneyCard;
