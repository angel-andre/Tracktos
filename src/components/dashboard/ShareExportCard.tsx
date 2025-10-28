import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share2, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface WalletIdentityData {
  activeDays: number;
  totalGasSpent: string;
  badges: Array<{
    name: string;
    description: string;
    icon: string;
  }>;
}

interface ShareExportCardProps {
  address: string;
  portfolioValue: number;
  transactionCount: number;
  tokenCount: number;
  nftCount: number;
  walletAge?: string;
  walletIdentity: WalletIdentityData | null;
}

export function ShareExportCard({
  address,
  portfolioValue,
  transactionCount,
  tokenCount,
  nftCount,
  walletAge,
  walletIdentity,
}: ShareExportCardProps) {
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const formatAddress = (addr: string) => {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getWalletAge = (firstTxTimestamp?: string): string => {
    if (!firstTxTimestamp) return 'Unknown';
    
    const firstTx = new Date(firstTxTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - firstTx.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      if (remainingMonths > 0) {
        return `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
      }
      return `${years} year${years > 1 ? 's' : ''}`;
    }
  };

  const calculatePercentile = (value: number, thresholds: number[]): number => {
    for (let i = 0; i < thresholds.length; i++) {
      if (value >= thresholds[i]) {
        return i + 1;
      }
    }
    return thresholds.length + 1;
  };

  const getPercentileLabel = (percentile: number): string => {
    if (percentile === 1) return 'Top 1%';
    if (percentile === 2) return 'Top 5%';
    if (percentile === 3) return 'Top 10%';
    if (percentile === 4) return 'Top 25%';
    if (percentile === 5) return 'Top 50%';
    return 'Active';
  };

  const generateSnapshot = async () => {
    setGeneratingImage(true);
    try {
      const gasSpent = parseFloat(walletIdentity?.totalGasSpent || '0');
      const formattedWalletAge = getWalletAge(walletAge);
      
      // Calculate percentiles
      const portfolioPercentile = calculatePercentile(portfolioValue, [100000, 50000, 10000, 1000, 100]);
      const txPercentile = calculatePercentile(transactionCount, [10000, 5000, 1000, 500, 100]);
      const activityPercentile = calculatePercentile(walletIdentity?.activeDays || 0, [365, 180, 90, 30, 7]);
      const gasPercentile = calculatePercentile(gasSpent, [100, 50, 20, 10, 1]);
      const diversityPercentile = calculatePercentile(tokenCount, [50, 25, 15, 10, 5]);

      // Create a temporary container for the snapshot
      const snapshotDiv = document.createElement("div");
      snapshotDiv.style.position = "absolute";
      snapshotDiv.style.left = "-9999px";
      snapshotDiv.style.width = "900px";
      snapshotDiv.style.padding = "40px";
      snapshotDiv.style.background = "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)";
      snapshotDiv.style.borderRadius = "16px";
      snapshotDiv.style.fontFamily = "system-ui, -apple-system, sans-serif";

      const badgesHtml = walletIdentity?.badges?.length 
        ? walletIdentity.badges.map(badge => `
            <div style="background: rgba(96,165,250,0.15); padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(96,165,250,0.3); display: inline-block; margin: 6px;">
              <span style="font-size: 13px; font-weight: 600; color: #60a5fa;">🏆 ${badge.name}</span>
            </div>
          `).join('')
        : '<p style="font-size: 13px; color: #9ca3af; text-align: center;">No badges earned yet</p>';

      snapshotDiv.innerHTML = `
        <div style="color: white;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="font-size: 40px; font-weight: bold; margin-bottom: 6px; color: #60a5fa;">Tracktos</h1>
            <p style="font-size: 15px; color: #9ca3af;">Wallet Milestones & Analytics</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 10px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1);">
            <p style="font-size: 12px; color: #9ca3af; margin-bottom: 6px;">Wallet Address</p>
            <p style="font-size: 14px; font-weight: 500; word-break: break-all;">${address}</p>
          </div>

          <div style="margin-bottom: 20px;">
            <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #60a5fa;">📊 Key Metrics</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px;">
              <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                <p style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Wallet Age</p>
                <p style="font-size: 18px; font-weight: bold;">${formattedWalletAge}</p>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                <p style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Active Days</p>
                <p style="font-size: 18px; font-weight: bold;">${walletIdentity?.activeDays || 0}</p>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                <p style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Transactions</p>
                <p style="font-size: 18px; font-weight: bold;">${transactionCount.toLocaleString()}</p>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                <p style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">Gas Spent</p>
                <p style="font-size: 18px; font-weight: bold;">${gasSpent.toFixed(2)} APT</p>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #60a5fa;">🏅 Comparative Rankings</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div style="background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #e5e7eb;">Portfolio Value</span>
                <span style="font-size: 12px; font-weight: bold; color: #fbbf24;">${getPercentileLabel(portfolioPercentile)}</span>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #e5e7eb;">Transaction Volume</span>
                <span style="font-size: 12px; font-weight: bold; color: #fbbf24;">${getPercentileLabel(txPercentile)}</span>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #e5e7eb;">Activity Level</span>
                <span style="font-size: 12px; font-weight: bold; color: #fbbf24;">${getPercentileLabel(activityPercentile)}</span>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #e5e7eb;">Gas Contribution</span>
                <span style="font-size: 12px; font-weight: bold; color: #fbbf24;">${getPercentileLabel(gasPercentile)}</span>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #e5e7eb;">Token Diversity</span>
                <span style="font-size: 12px; font-weight: bold; color: #fbbf24;">${getPercentileLabel(diversityPercentile)}</span>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #e5e7eb;">Portfolio Value</span>
                <span style="font-size: 12px; font-weight: bold; color: #60a5fa;">$${portfolioValue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #60a5fa;">🎖️ Achievement Badges</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;">
              ${badgesHtml}
            </div>
          </div>

          <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
            <p style="font-size: 11px; color: #9ca3af;">Generated with Tracktos • Aptos Wallet Analytics</p>
          </div>
        </div>
      `;

      document.body.appendChild(snapshotDiv);

      const canvas = await html2canvas(snapshotDiv, {
        backgroundColor: null,
        scale: 2,
      });

      document.body.removeChild(snapshotDiv);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `tracktos-wallet-${formatAddress(address)}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          toast.success("Wallet snapshot downloaded!");
        }
      }, "image/png");
    } catch (error) {
      console.error("Error generating snapshot:", error);
      toast.error("Failed to generate snapshot");
    } finally {
      setGeneratingImage(false);
    }
  };

  const generatePDF = async () => {
    setGeneratingPdf(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const gasSpent = parseFloat(walletIdentity?.totalGasSpent || '0');
      const formattedWalletAge = getWalletAge(walletAge);

      // Calculate percentiles
      const portfolioPercentile = calculatePercentile(portfolioValue, [100000, 50000, 10000, 1000, 100]);
      const txPercentile = calculatePercentile(transactionCount, [10000, 5000, 1000, 500, 100]);
      const activityPercentile = calculatePercentile(walletIdentity?.activeDays || 0, [365, 180, 90, 30, 7]);
      const gasPercentile = calculatePercentile(gasSpent, [100, 50, 20, 10, 1]);
      const diversityPercentile = calculatePercentile(tokenCount, [50, 25, 15, 10, 5]);

      // Header
      pdf.setFillColor(96, 165, 250);
      pdf.rect(0, 0, pageWidth, 40, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("Tracktos", pageWidth / 2, 20, { align: "center" });
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text("Wallet Milestones & Analytics Report", pageWidth / 2, 30, { align: "center" });

      // Wallet Address
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.text("Wallet Address:", 20, 55);
      pdf.setFontSize(9);
      pdf.text(address, 20, 62);

      // Key Metrics
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Key Metrics", 20, 80);
      pdf.setDrawColor(96, 165, 250);
      pdf.line(20, 82, pageWidth - 20, 82);

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      let yPos = 95;
      
      pdf.text(`Wallet Age: ${formattedWalletAge}`, 20, yPos);
      yPos += 10;
      pdf.text(`Active Days: ${walletIdentity?.activeDays || 0}`, 20, yPos);
      yPos += 10;
      pdf.text(`Total Transactions: ${transactionCount.toLocaleString()}`, 20, yPos);
      yPos += 10;
      pdf.text(`Gas Spent: ${gasSpent.toFixed(2)} APT`, 20, yPos);
      yPos += 10;
      pdf.text(`Portfolio Value: $${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, yPos);

      // Comparative Rankings
      yPos += 20;
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Comparative Rankings", 20, yPos);
      pdf.line(20, yPos + 2, pageWidth - 20, yPos + 2);
      yPos += 15;

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`• Portfolio Value: ${getPercentileLabel(portfolioPercentile)}`, 20, yPos);
      yPos += 10;
      pdf.text(`• Transaction Volume: ${getPercentileLabel(txPercentile)}`, 20, yPos);
      yPos += 10;
      pdf.text(`• Activity Level: ${getPercentileLabel(activityPercentile)}`, 20, yPos);
      yPos += 10;
      pdf.text(`• Gas Contribution: ${getPercentileLabel(gasPercentile)}`, 20, yPos);
      yPos += 10;
      pdf.text(`• Token Diversity: ${getPercentileLabel(diversityPercentile)}`, 20, yPos);

      // Achievement Badges
      if (walletIdentity?.badges && walletIdentity.badges.length > 0) {
        yPos += 20;
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Achievement Badges", 20, yPos);
        pdf.line(20, yPos + 2, pageWidth - 20, yPos + 2);
        yPos += 15;

        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        walletIdentity.badges.forEach((badge) => {
          pdf.text(`• ${badge.name}: ${badge.description}`, 20, yPos);
          yPos += 10;
        });
      }

      // Assets Breakdown
      yPos += 20;
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Assets Breakdown", 20, yPos);
      pdf.line(20, yPos + 2, pageWidth - 20, yPos + 2);
      yPos += 15;

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`• ${tokenCount} different tokens across the Aptos ecosystem`, 20, yPos);
      yPos += 10;
      pdf.text(`• ${nftCount} NFTs from various collections`, 20, yPos);
      yPos += 10;
      pdf.text(`• ${transactionCount.toLocaleString()} total on-chain interactions`, 20, yPos);

      // Footer
      pdf.setFontSize(9);
      pdf.setTextColor(128, 128, 128);
      pdf.text("Generated with Tracktos • Aptos Wallet Analytics", pageWidth / 2, pageHeight - 10, { align: "center" });
      pdf.text(new Date().toLocaleString(), pageWidth / 2, pageHeight - 5, { align: "center" });

      pdf.save(`tracktos-report-${formatAddress(address)}.pdf`);
      toast.success("PDF report downloaded!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const shareOnTwitter = () => {
    const gasSpent = parseFloat(walletIdentity?.totalGasSpent || '0');
    const formattedWalletAge = getWalletAge(walletAge);
    
    const portfolioPercentile = calculatePercentile(portfolioValue, [100000, 50000, 10000, 1000, 100]);
    const txPercentile = calculatePercentile(transactionCount, [10000, 5000, 1000, 500, 100]);
    
    const text = `Check out my Aptos wallet milestones! 🏆\n\n💰 Portfolio: $${portfolioValue.toLocaleString()}\n📊 Transactions: ${transactionCount.toLocaleString()}\n⚡ Active Days: ${walletIdentity?.activeDays || 0}\n🔥 Gas Spent: ${gasSpent.toFixed(2)} APT\n🏅 Rankings: ${getPercentileLabel(portfolioPercentile)} Portfolio, ${getPercentileLabel(txPercentile)} Activity\n\nAnalyze your wallet at Tracktos!`;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
  };

  return (
    <Card className="backdrop-blur-xl bg-card/50 border-border/50 shadow-xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-primary" />
          <CardTitle>Export & Share</CardTitle>
        </div>
        <CardDescription>Share your wallet analytics or export reports</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            onClick={generateSnapshot}
            disabled={generatingImage}
            className="w-full gap-2"
            variant="outline"
          >
            {generatingImage ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4" />
                Snapshot
              </>
            )}
          </Button>

          <Button
            onClick={generatePDF}
            disabled={generatingPdf}
            className="w-full gap-2"
            variant="outline"
          >
            {generatingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                PDF Report
              </>
            )}
          </Button>

          <Button
            onClick={shareOnTwitter}
            className="w-full gap-2"
            variant="default"
          >
            <Share2 className="w-4 h-4" />
            Share on X
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2">
          Generate a shareable image, export a detailed PDF report, or share your stats on X (Twitter)
        </div>
      </CardContent>
    </Card>
  );
}
