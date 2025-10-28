import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share2, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface ShareExportCardProps {
  address: string;
  portfolioValue: number;
  transactionCount: number;
  tokenCount: number;
  nftCount: number;
  walletAge?: string;
}

export function ShareExportCard({
  address,
  portfolioValue,
  transactionCount,
  tokenCount,
  nftCount,
  walletAge,
}: ShareExportCardProps) {
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const formatAddress = (addr: string) => {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const generateSnapshot = async () => {
    setGeneratingImage(true);
    try {
      // Create a temporary container for the snapshot
      const snapshotDiv = document.createElement("div");
      snapshotDiv.style.position = "absolute";
      snapshotDiv.style.left = "-9999px";
      snapshotDiv.style.width = "800px";
      snapshotDiv.style.padding = "40px";
      snapshotDiv.style.background = "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)";
      snapshotDiv.style.borderRadius = "16px";
      snapshotDiv.style.fontFamily = "system-ui, -apple-system, sans-serif";

      snapshotDiv.innerHTML = `
        <div style="color: white;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="font-size: 36px; font-weight: bold; margin-bottom: 8px; color: #60a5fa;">Tracktos</h1>
            <p style="font-size: 16px; color: #9ca3af;">Aptos Wallet Analytics</p>
          </div>
          
          <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1);">
            <p style="font-size: 14px; color: #9ca3af; margin-bottom: 8px;">Wallet Address</p>
            <p style="font-size: 18px; font-weight: 600; word-break: break-all;">${address}</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
            <div style="background: rgba(96,165,250,0.1); padding: 20px; border-radius: 12px; border: 1px solid rgba(96,165,250,0.3);">
              <p style="font-size: 14px; color: #9ca3af; margin-bottom: 4px;">Portfolio Value</p>
              <p style="font-size: 28px; font-weight: bold; color: #60a5fa;">$${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div style="background: rgba(96,165,250,0.1); padding: 20px; border-radius: 12px; border: 1px solid rgba(96,165,250,0.3);">
              <p style="font-size: 14px; color: #9ca3af; margin-bottom: 4px;">Transactions</p>
              <p style="font-size: 28px; font-weight: bold; color: #60a5fa;">${transactionCount.toLocaleString()}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
              <p style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">Tokens</p>
              <p style="font-size: 20px; font-weight: bold;">${tokenCount}</p>
            </div>
            <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
              <p style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">NFTs</p>
              <p style="font-size: 20px; font-weight: bold;">${nftCount}</p>
            </div>
            <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.1);">
              <p style="font-size: 12px; color: #9ca3af; margin-bottom: 4px;">Age</p>
              <p style="font-size: 20px; font-weight: bold;">${walletAge || "N/A"}</p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
            <p style="font-size: 12px; color: #9ca3af;">Generated with Tracktos • Aptos Wallet Analytics</p>
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

      // Header
      pdf.setFillColor(96, 165, 250);
      pdf.rect(0, 0, pageWidth, 40, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("Tracktos", pageWidth / 2, 20, { align: "center" });
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text("Aptos Wallet Analytics Report", pageWidth / 2, 30, { align: "center" });

      // Wallet Address
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.text("Wallet Address:", 20, 55);
      pdf.setFontSize(9);
      pdf.text(address, 20, 62);

      // Portfolio Overview
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Portfolio Overview", 20, 80);
      pdf.setDrawColor(96, 165, 250);
      pdf.line(20, 82, pageWidth - 20, 82);

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      let yPos = 95;
      
      pdf.text(`Portfolio Value: $${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, yPos);
      yPos += 10;
      pdf.text(`Total Transactions: ${transactionCount.toLocaleString()}`, 20, yPos);
      yPos += 10;
      pdf.text(`Token Holdings: ${tokenCount}`, 20, yPos);
      yPos += 10;
      pdf.text(`NFT Holdings: ${nftCount}`, 20, yPos);
      yPos += 10;
      pdf.text(`Wallet Age: ${walletAge || "Unknown"}`, 20, yPos);

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
    const text = `Check out my Aptos wallet analytics!\n\n💰 Portfolio: $${portfolioValue.toLocaleString()}\n📊 Transactions: ${transactionCount.toLocaleString()}\n🪙 Tokens: ${tokenCount}\n🎨 NFTs: ${nftCount}\n\nAnalyze your wallet at Tracktos!`;
    
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
