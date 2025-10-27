import React from "react";
import { Gem, ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/formatters";

interface NFT {
  name: string;
  collection: string;
  image: string;
  price?: string;
  tokenDataId?: string;
}

interface PremiumNFTsCardProps {
  nfts: NFT[] | null;
  loading: boolean;
  network?: "mainnet" | "testnet";
}

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
    if (/^(Qm|bafy)[A-Za-z0-9]+/.test(u)) return u;
  }
  return null;
};

const buildImageCandidates = (u: string): string[] => {
  if (!u) return [];
  const list: string[] = [];
  const pushUnique = (s: string) => { if (s && !list.includes(s)) list.push(s); };

  pushUnique(u);

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
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [finalSrc, setFinalSrc] = React.useState<string | null>(null);
  const loadedRef = React.useRef(false);
  const src = srcs[i];

  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setFinalSrc(null);
    let cancelled = false;
    loadedRef.current = false;

    const advance = () => {
      setI((prev) => (prev + 1 < srcs.length ? prev + 1 : prev));
    };

    const loadImage = async () => {
      if (!src) return;
      try {
        const shouldAssumeJson = src.endsWith('.json');
        let res: Response | null = null;
        try {
          res = await fetch(src, { 
            headers: { accept: 'application/json,image/*' },
            signal: AbortSignal.timeout(5000)
          });
        } catch {
          // If CORS or timeout, try the URL directly as an image
          if (!cancelled) setFinalSrc(src);
          return;
        }

        if (res && res.ok) {
          const ctype = res.headers.get('content-type') || '';
          const isJson = shouldAssumeJson || ctype.includes('application/json') || ctype.includes('text/plain');
          
          if (isJson) {
            let metadata: any = null;
            try {
              const text = await res.text();
              metadata = JSON.parse(text);
            } catch {
              // If JSON parsing fails, try the URL as an image
              if (!cancelled) setFinalSrc(src);
              return;
            }
            
            // Try multiple possible image field names
            const imageUrl: string | undefined = 
              metadata?.image || 
              metadata?.image_url || 
              metadata?.imageUrl || 
              metadata?.imageURI || 
              metadata?.uri || 
              metadata?.media ||
              metadata?.animation_url ||
              metadata?.properties?.image ||
              metadata?.properties?.files?.[0]?.uri;
              
            if (imageUrl && !cancelled) {
              // Build all gateway candidates and replace current srcs with them
              const newCandidates = buildImageCandidates(imageUrl);
              if (newCandidates.length > 0) {
                // Replace srcs array and restart from first candidate
                srcs.splice(0, srcs.length, ...newCandidates);
                setI(0);
                setFinalSrc(newCandidates[0]);
              } else {
                setFinalSrc(imageUrl);
              }
            } else {
              // No image found in metadata, try next candidate
              advance();
            }
          } else {
            // Not JSON, use as image directly
            if (!cancelled) setFinalSrc(src);
          }
        } else {
          // Response not OK, try next candidate
          advance();
        }
      } catch {
        // Any error, try the URL directly
        if (!cancelled) setFinalSrc(src);
      }
    };

    loadImage();

    const timer = setTimeout(() => {
      if (!loadedRef.current && !cancelled) {
        advance();
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [src, srcs.length]);

  const onError = () => {
    setI((prev) => {
      const next = prev + 1;
      if (next < srcs.length) return next;
      setFailed(true);
      return prev;
    });
  };
  const onLoad = () => { setLoaded(true); loadedRef.current = true; };

  if (failed || !src) {
    return <ImageIcon className="w-12 h-12 text-muted-foreground" />;
  }

  if (!finalSrc) {
    return <div className="w-full h-full animate-pulse bg-muted/30" />;
  }

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onLoad={onLoad}
      onError={onError}
    />
  );
};

export function PremiumNFTsCard({ nfts, loading, network = "mainnet" }: PremiumNFTsCardProps) {
  // Show top 6 NFTs as premium (expects server to sort by price desc)
  const premiumNFTs = nfts?.slice(0, 6) || [];

  if (loading) {
    return (
      <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <Gem className="w-5 h-5 text-primary" />
            </div>
            Most Expensive NFTs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <div className="p-2 rounded-lg bg-primary/10">
            <Gem className="w-5 h-5 text-primary" />
          </div>
          Most Expensive NFTs
          {nfts && nfts.length > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              Top {premiumNFTs.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {premiumNFTs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {premiumNFTs.map((nft, idx) => {
              const explorerUrl = nft.tokenDataId
                ? `https://explorer.aptoslabs.com/object/${nft.tokenDataId}?network=${network}`
                : undefined;

              const CardInner = (
                <>
                  <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden relative">
                    {nft.image ? (
                      <FallbackImage
                        srcs={buildImageCandidates(nft.image)}
                        alt={`${nft.name} - ${nft.collection}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <ImageIcon className="w-12 h-12 text-muted-foreground" />
                    )}
                    <div className="absolute top-2 right-2 bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-full p-1.5">
                      <Gem className="w-3 h-3 text-primary" />
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-t from-background/80 to-transparent">
                    <p className="text-sm font-bold text-foreground truncate">{nft.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{nft.collection}</p>
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <p className="text-xs text-muted-foreground">
                        {nft.price && parseFloat(nft.price.toString().split(' ')[0]) > 0 
                          ? 'Value:' 
                          : 'Est. Value:'}
                      </p>
                      <p className="text-sm font-bold text-primary">
                        {nft.price ? (
                          parseFloat(nft.price.toString().split(' ')[0]) === 0
                            ? 'Free Mint'
                            : `${formatNumber(nft.price.toString().split(' ')[0], 2)} APT`
                        ) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </>
              );

              return explorerUrl ? (
                <a
                  key={idx}
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative border border-border/50 rounded-xl overflow-hidden bg-secondary/20 hover:bg-secondary/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl block cursor-pointer"
                >
                  {CardInner}
                </a>
              ) : (
                <div
                  key={idx}
                  className="group relative border border-border/50 rounded-xl overflow-hidden bg-secondary/20 hover:bg-secondary/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl"
                >
                  {CardInner}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Gem className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">
              {nfts === null ? "Enter an address to view featured NFTs" : "No NFTs found"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
