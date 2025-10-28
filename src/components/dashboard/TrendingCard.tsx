import { TrendingUp, Users, Image as ImageIcon, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface TrendingWallet {
  address: string;
  aptBalance: string;
  nftCount: number;
}

interface PopularCollection {
  collection_name: string;
  creator_address: string;
  current_supply: number;
  max_supply: string;
  total_minted_v2: number;
}

interface TrendingCardProps {
  network?: "mainnet" | "testnet";
}

export function TrendingCard({ network = "mainnet" }: TrendingCardProps) {
  const [wallets, setWallets] = useState<TrendingWallet[]>([]);
  const [collections, setCollections] = useState<PopularCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendingData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch trending wallets
        const { data: walletsData, error: walletsError } = await supabase.functions.invoke('trending-data', {
          body: { network, type: 'wallets' }
        });

        if (walletsError) throw walletsError;
        if (walletsData?.wallets) setWallets(walletsData.wallets);

        // Fetch trending collections
        const { data: collectionsData, error: collectionsError } = await supabase.functions.invoke('trending-data', {
          body: { network, type: 'collections' }
        });

        if (collectionsError) throw collectionsError;
        if (collectionsData?.collections) setCollections(collectionsData.collections);

      } catch (err) {
        console.error('Error fetching trending data:', err);
        setError('Failed to load trending data');
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingData();
  }, [network]);

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
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">{error}</p>
            ) : wallets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No trending wallets found</p>
            ) : (
              wallets.map((wallet, idx) => (
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
                        {formatCompactNumber(parseFloat(wallet.aptBalance) / 100000000)} APT
                      </p>
                      <p className="text-muted-foreground">
                        {wallet.nftCount} NFTs
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
          
          <TabsContent value="collections" className="space-y-2">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">{error}</p>
            ) : collections.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No trending collections found</p>
            ) : (
              collections.map((collection, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 border border-border/30"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{idx + 1}
                      </Badge>
                      <p className="text-sm font-semibold text-foreground truncate">
                        {collection.collection_name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Supply</p>
                      <p className="text-foreground font-semibold">
                        {formatCompactNumber(collection.current_supply)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max Supply</p>
                      <p className="text-foreground font-semibold">
                        {formatCompactNumber(parseInt(collection.max_supply || "0"))}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 truncate font-mono">
                    {collection.creator_address.slice(0, 12)}...{collection.creator_address.slice(-8)}
                  </p>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
