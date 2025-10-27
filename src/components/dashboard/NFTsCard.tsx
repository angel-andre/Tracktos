import React from "react";
import { ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface NFT {
  name: string;
  collection: string;
  image: string;
  price?: string;
}

interface NFTsCardProps {
  nfts: NFT[] | null;
  loading: boolean;
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
  const src = srcs[i];

  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!loaded && !cancelled) {
        setI((prev) => (prev + 1 < srcs.length ? prev + 1 : prev));
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [src, srcs.length, loaded]);

  const onError = () => {
    setI((prev) => {
      const next = prev + 1;
      if (next < srcs.length) return next;
      setFailed(true);
      return prev;
    });
  };
  const onLoad = () => setLoaded(true);

  if (failed || !src) {
    return <ImageIcon className="w-8 h-8 text-muted-foreground" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onLoad={onLoad}
      onError={onError}
    />
  );
};

export function NFTsCard({ nfts, loading }: NFTsCardProps) {
  if (loading) {
    return (
      <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
            NFT Collection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-3 w-3/4" />
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
            <ImageIcon className="w-5 h-5 text-primary" />
          </div>
          NFT Collection
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nfts && nfts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {nfts.map((nft, idx) => (
              <div 
                key={idx} 
                className="group border border-border/50 rounded-lg p-2 bg-secondary/20 hover:bg-secondary/40 hover:scale-105 transition-all duration-300 hover:shadow-lg"
              >
                <div className="aspect-square bg-muted/30 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                  {nft.image ? (
                    <FallbackImage
                      srcs={buildImageCandidates(nft.image)}
                      alt={`${nft.name} - ${nft.collection}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs font-semibold text-foreground truncate">{nft.name}</p>
                <p className="text-xs text-muted-foreground truncate">{nft.collection}</p>
                {nft.price && (
                  <p className="text-xs text-primary font-semibold mt-1">{nft.price}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            {nfts === null ? "Enter an address to view NFTs" : "No NFTs found"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
