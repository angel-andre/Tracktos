import { TrendingUp, Users, Image as ImageIcon, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCompactNumber } from "@/lib/formatters";

interface TrendingWallet {
  address: string;
  label?: string;
  totalValue: number;
  change24h: number;
  nftCount: number;
}

interface PopularCollection {
  name: string;
  floorPrice: number;
  volume24h: number;
  change24h: number;
  itemCount: number;
  imageUrl?: string;
}

interface TrendingCardProps {
  network?: "mainnet" | "testnet";
}

// Sample trending data - in production, this would come from an API
const TRENDING_WALLETS: TrendingWallet[] = [
  {
    address: "0x632dad777e05538c1ce47fad67ad801d242b481e45adfbc058a45e59851c3907",
    label: "Whale Collector",
    totalValue: 125000,
    change24h: 12.5,
    nftCount: 342,
  },
  {
    address: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    label: "DeFi Master",
    totalValue: 98500,
    change24h: 8.3,
    nftCount: 156,
  },
  {
    address: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    label: "NFT Enthusiast",
    totalValue: 87200,
    change24h: -3.2,
    nftCount: 523,
  },
  {
    address: "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba",
    label: "Staking Pro",
    totalValue: 76400,
    change24h: 15.7,
    nftCount: 89,
  },
];

const POPULAR_COLLECTIONS: PopularCollection[] = [
  {
    name: "Aptos Monkeys",
    floorPrice: 45.5,
    volume24h: 12500,
    change24h: 23.4,
    itemCount: 8888,
  },
  {
    name: "Aptomingos",
    floorPrice: 32.8,
    volume24h: 9800,
    change24h: 15.2,
    itemCount: 7777,
  },
  {
    name: "Bruh Bears",
    floorPrice: 28.3,
    volume24h: 7600,
    change24h: -5.1,
    itemCount: 10000,
  },
  {
    name: "Aptos Punks",
    floorPrice: 52.1,
    volume24h: 15200,
    change24h: 31.8,
    itemCount: 5000,
  },
];

export function TrendingCard({ network = "mainnet" }: TrendingCardProps) {
  const handleWalletClick = (address: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('address', address);
    url.searchParams.set('network', network);
    window.location.href = url.toString();
  };

  return (
    <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <div className="p-2 rounded-lg bg-primary/10">
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          Trending & Popular
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="wallets" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="wallets" className="gap-2">
              <Users className="w-4 h-4" />
              Top Wallets
            </TabsTrigger>
            <TabsTrigger value="collections" className="gap-2">
              <ImageIcon className="w-4 h-4" />
              NFT Collections
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="wallets" className="space-y-2">
            {TRENDING_WALLETS.map((wallet, idx) => (
              <div
                key={idx}
                onClick={() => handleWalletClick(wallet.address)}
                className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 border border-border/30 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        #{idx + 1}
                      </Badge>
                      {wallet.label && (
                        <p className="text-sm font-semibold text-foreground">
                          {wallet.label}
                        </p>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground truncate group-hover:text-primary transition-colors">
                      {wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <p className="text-foreground font-semibold">
                      ${formatCompactNumber(wallet.totalValue)}
                    </p>
                    <p className="text-muted-foreground">
                      {wallet.nftCount} NFTs
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      wallet.change24h >= 0 ? 'text-primary' : 'text-destructive'
                    }`}>
                      {wallet.change24h >= 0 ? '+' : ''}{wallet.change24h.toFixed(1)}%
                    </p>
                    <p className="text-muted-foreground">24h</p>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
          
          <TabsContent value="collections" className="space-y-2">
            {POPULAR_COLLECTIONS.map((collection, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 border border-border/30"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      #{idx + 1}
                    </Badge>
                    <p className="text-sm font-semibold text-foreground">
                      {collection.name}
                    </p>
                  </div>
                  <p className={`text-xs font-medium ${
                    collection.change24h >= 0 ? 'text-primary' : 'text-destructive'
                  }`}>
                    {collection.change24h >= 0 ? '+' : ''}{collection.change24h.toFixed(1)}%
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Floor</p>
                    <p className="text-foreground font-semibold">
                      {collection.floorPrice} APT
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Volume</p>
                    <p className="text-foreground font-semibold">
                      ${formatCompactNumber(collection.volume24h)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Items</p>
                    <p className="text-foreground font-semibold">
                      {formatCompactNumber(collection.itemCount)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
