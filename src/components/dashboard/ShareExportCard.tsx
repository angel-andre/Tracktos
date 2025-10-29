import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share2, Image as ImageIcon, FileText, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import pepeCardBg from "@/assets/pepe-card-bg.png";
import aptosLogoWhite from "@/assets/aptos-logo-white.png";

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

      // Use static background image
      const backgroundImage = pepeCardBg;

      // Create a temporary container for the snapshot (16:9 aspect ratio)
      const snapshotDiv = document.createElement("div");
      snapshotDiv.style.position = "absolute";
      snapshotDiv.style.left = "-9999px";
      snapshotDiv.style.width = "1200px";
      snapshotDiv.style.height = "675px";
      snapshotDiv.style.padding = "40px";
      snapshotDiv.style.backgroundImage = `url(${backgroundImage})`;
      snapshotDiv.style.backgroundSize = "cover";
      snapshotDiv.style.backgroundPosition = "center";
      snapshotDiv.style.borderRadius = "16px";
      snapshotDiv.style.fontFamily = "system-ui, -apple-system, sans-serif";
      snapshotDiv.style.position = "relative";
      snapshotDiv.style.display = "flex";
      snapshotDiv.style.flexDirection = "column";
      snapshotDiv.style.justifyContent = "space-between";
      
      // Add a semi-transparent overlay for better text readability
      const overlay = document.createElement("div");
      overlay.style.position = "absolute";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.right = "0";
      overlay.style.bottom = "0";
      overlay.style.background = "rgba(0, 0, 0, 0.4)";
      overlay.style.borderRadius = "16px";

      const badgesHtml = walletIdentity?.badges?.length 
        ? walletIdentity.badges.map(badge => `
            <div style="background: rgba(96,165,250,0.15); padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(96,165,250,0.3); display: inline-block; margin: 6px;">
              <span style="font-size: 13px; font-weight: 600; color: #60a5fa;">🏆 ${badge.name}</span>
            </div>
          `).join('')
        : '<p style="font-size: 13px; color: #9ca3af; text-align: center;">No badges earned yet</p>';

      snapshotDiv.appendChild(overlay);
      
      // Add Aptos logo in top right corner
      const logoDiv = document.createElement("div");
      logoDiv.style.position = "absolute";
      logoDiv.style.top = "20px";
      logoDiv.style.right = "20px";
      logoDiv.style.zIndex = "2";
      
      const logoImg = document.createElement("img");
      logoImg.src = aptosLogoWhite;
      logoImg.style.width = "60px";
      logoImg.style.height = "60px";
      logoImg.style.opacity = "0.9";
      logoImg.alt = "Aptos";
      logoDiv.appendChild(logoImg);
      snapshotDiv.appendChild(logoDiv);
      
      const contentDiv = document.createElement("div");
      contentDiv.style.position = "relative";
      contentDiv.style.zIndex = "1";
      contentDiv.style.height = "100%";
      contentDiv.style.display = "flex";
      contentDiv.style.flexDirection = "column";
      
      // ==================== Security: Safe DOM Construction ====================
      // Create content structure using DOM methods instead of innerHTML
      const mainContainer = document.createElement("div");
      mainContainer.style.cssText = "color: white; max-width: 60%; padding-right: 40px; height: 100%; display: flex; flex-direction: column;";
      
      // Header section
      const headerSection = document.createElement("div");
      headerSection.style.cssText = "text-align: left; margin-bottom: 14px;";
      const title = document.createElement("h1");
      title.style.cssText = "font-size: 40px; font-weight: bold; margin-bottom: 6px; color: #22c55e; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);";
      title.textContent = "Tracktos";
      const subtitle = document.createElement("p");
      subtitle.style.cssText = "font-size: 14px; color: #e5e7eb; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);";
      subtitle.textContent = "Wallet Milestones & Analytics";
      headerSection.appendChild(title);
      headerSection.appendChild(subtitle);
      
      // Address section
      const addressBox = document.createElement("div");
      addressBox.style.cssText = "background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 10px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.1);";
      const addressLabel = document.createElement("p");
      addressLabel.style.cssText = "font-size: 10px; color: #9ca3af; margin-bottom: 3px;";
      addressLabel.textContent = "Wallet Address";
      const addressValue = document.createElement("p");
      addressValue.style.cssText = "font-size: 12px; font-weight: 500; word-break: break-all;";
      addressValue.textContent = address;
      addressBox.appendChild(addressLabel);
      addressBox.appendChild(addressValue);
      
      mainContainer.appendChild(headerSection);
      mainContainer.appendChild(addressBox);
      
      // Key Metrics section
      const metricsSection = document.createElement("div");
      metricsSection.style.cssText = "margin-bottom: 12px;";
      const metricsTitle = document.createElement("h2");
      metricsTitle.style.cssText = "font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #22c55e;";
      metricsTitle.textContent = "📊 Key Metrics";
      metricsSection.appendChild(metricsTitle);
      
      const metricsGrid = document.createElement("div");
      metricsGrid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 8px;";
      
      const metrics = [
        { label: "Wallet Age", value: formattedWalletAge },
        { label: "Active Days", value: String(walletIdentity?.activeDays || 0) },
        { label: "Transactions", value: transactionCount.toLocaleString() },
        { label: "Gas Spent", value: `${gasSpent.toFixed(2)} APT` }
      ];
      
      metrics.forEach(metric => {
        const box = document.createElement("div");
        box.style.cssText = "background: rgba(255,255,255,0.05); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);";
        const label = document.createElement("p");
        label.style.cssText = "font-size: 9px; color: #9ca3af; margin-bottom: 3px;";
        label.textContent = metric.label;
        const value = document.createElement("p");
        value.style.cssText = "font-size: 14px; font-weight: bold;";
        value.textContent = metric.value;
        box.appendChild(label);
        box.appendChild(value);
        metricsGrid.appendChild(box);
      });
      
      metricsSection.appendChild(metricsGrid);
      mainContainer.appendChild(metricsSection);
      
      // Comparative Rankings section
      const rankingsSection = document.createElement("div");
      rankingsSection.style.cssText = "margin-bottom: 12px;";
      const rankingsTitle = document.createElement("h2");
      rankingsTitle.style.cssText = "font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #22c55e;";
      rankingsTitle.textContent = "🏅 Comparative Rankings";
      rankingsSection.appendChild(rankingsTitle);
      
      const rankingsGrid = document.createElement("div");
      rankingsGrid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 6px;";
      
      const rankings = [
        { label: "Portfolio Value", value: getPercentileLabel(portfolioPercentile) },
        { label: "Transaction Volume", value: getPercentileLabel(txPercentile) },
        { label: "Activity Level", value: getPercentileLabel(activityPercentile) },
        { label: "Gas Contribution", value: getPercentileLabel(gasPercentile) },
        { label: "Token Diversity", value: getPercentileLabel(diversityPercentile) },
        { label: "NFT Holdings", value: `${nftCount} NFTs` }
      ];
      
      rankings.forEach(ranking => {
        const box = document.createElement("div");
        box.style.cssText = "background: rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;";
        const label = document.createElement("span");
        label.style.cssText = "font-size: 10px; color: #e5e7eb;";
        label.textContent = ranking.label;
        const value = document.createElement("span");
        value.style.cssText = "font-size: 10px; font-weight: bold; color: #fbbf24;";
        value.textContent = ranking.value;
        box.appendChild(label);
        box.appendChild(value);
        rankingsGrid.appendChild(box);
      });
      
      rankingsSection.appendChild(rankingsGrid);
      mainContainer.appendChild(rankingsSection);
      
      // Achievement Badges section
      const badgesSection = document.createElement("div");
      badgesSection.style.cssText = "margin-bottom: 12px; flex-shrink: 0;";
      const badgesTitle = document.createElement("h2");
      badgesTitle.style.cssText = "font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #22c55e;";
      badgesTitle.textContent = "🎖️ Achievement Badges";
      badgesSection.appendChild(badgesTitle);
      
      const badgesContainer = document.createElement("div");
      badgesContainer.style.cssText = "display: flex; flex-wrap: wrap; gap: 5px;";
      
      if (walletIdentity?.badges?.length) {
        walletIdentity.badges.forEach(badge => {
          const badgeBox = document.createElement("div");
          badgeBox.style.cssText = "background: rgba(96,165,250,0.15); padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(96,165,250,0.3); display: inline-block; margin: 6px;";
          const badgeText = document.createElement("span");
          badgeText.style.cssText = "font-size: 13px; font-weight: 600; color: #60a5fa;";
          badgeText.textContent = `🏆 ${badge.name}`;
          badgeBox.appendChild(badgeText);
          badgesContainer.appendChild(badgeBox);
        });
      } else {
        const noBadges = document.createElement("p");
        noBadges.style.cssText = "font-size: 13px; color: #9ca3af; text-align: center;";
        noBadges.textContent = "No badges earned yet";
        badgesContainer.appendChild(noBadges);
      }
      
      badgesSection.appendChild(badgesContainer);
      mainContainer.appendChild(badgesSection);
      
      // Footer
      const footer = document.createElement("div");
      footer.style.cssText = "margin-top: auto; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);";
      const footerText = document.createElement("p");
      footerText.style.cssText = "font-size: 9px; color: #9ca3af; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); margin-bottom: 4px;";
      footerText.textContent = "Generated with Tracktos • Aptos Wallet Analytics";
      const websiteText = document.createElement("p");
      websiteText.style.cssText = "font-size: 13px; font-weight: 600; color: #22c55e; text-shadow: 1px 1px 3px rgba(0,0,0,0.6); letter-spacing: 0.5px;";
      websiteText.textContent = "tracktos.com";
      footer.appendChild(footerText);
      footer.appendChild(websiteText);
      mainContainer.appendChild(footer);
      
      contentDiv.appendChild(mainContainer);
      
      snapshotDiv.appendChild(contentDiv);
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
      yPos += 10;
      pdf.text(`• Total Portfolio Value: $${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, yPos);

      // Additional Statistics
      yPos += 20;
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Network Participation", 20, yPos);
      pdf.line(20, yPos + 2, pageWidth - 20, yPos + 2);
      yPos += 15;

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      
      const avgDailyTx = walletIdentity?.activeDays && walletIdentity.activeDays > 0 
        ? (transactionCount / walletIdentity.activeDays).toFixed(2)
        : '0';
      pdf.text(`• Average daily transactions: ${avgDailyTx}`, 20, yPos);
      yPos += 10;
      
      const avgGasPerTx = transactionCount > 0 
        ? (gasSpent / transactionCount).toFixed(4)
        : '0';
      pdf.text(`• Average gas per transaction: ${avgGasPerTx} APT`, 20, yPos);
      yPos += 10;
      
      const tokensPerNFT = nftCount > 0 
        ? (tokenCount / nftCount).toFixed(2)
        : tokenCount.toString();
      pdf.text(`• Tokens to NFTs ratio: ${tokensPerNFT}`, 20, yPos);
      yPos += 10;
      
      const activityRate = walletIdentity?.activeDays 
        ? ((walletIdentity.activeDays / parseInt(formattedWalletAge.split(' ')[0] || '1')) * 100).toFixed(1)
        : '0';
      pdf.text(`• Activity rate: ${activityRate}% (active days vs wallet age)`, 20, yPos);

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

  const shareOnTwitter = async () => {
    setGeneratingImage(true);
    try {
      // Generate and download the snapshot first
      await generateSnapshot();
      
      // Then open Twitter with text prompting to attach the downloaded image
      const gasSpent = parseFloat(walletIdentity?.totalGasSpent || '0');
      const portfolioPercentile = calculatePercentile(portfolioValue, [100000, 50000, 10000, 1000, 100]);
      const txPercentile = calculatePercentile(transactionCount, [10000, 5000, 1000, 500, 100]);
      
      const text = `Check out my Aptos wallet milestones! 🏆\n\n💰 Portfolio: $${portfolioValue.toLocaleString()}\n📊 Transactions: ${transactionCount.toLocaleString()}\n🖼️ NFTs: ${nftCount}\n⚡ Active Days: ${walletIdentity?.activeDays || 0}\n🔥 Gas Spent: ${gasSpent.toFixed(2)} APT\n🏅 Rankings: ${getPercentileLabel(portfolioPercentile)} Portfolio, ${getPercentileLabel(txPercentile)} Activity\n\n📸 [Attach the downloaded snapshot image]\n\nAnalyze your wallet at Tracktos!`;
      
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(twitterUrl, "_blank", "width=550,height=420");
      
      toast.success("Snapshot downloaded! Attach it to your tweet.");
    } catch (error) {
      console.error("Error sharing on Twitter:", error);
      toast.error("Failed to prepare Twitter share");
    } finally {
      setGeneratingImage(false);
    }
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
            disabled={generatingImage}
            className="w-full gap-2"
            variant="default"
          >
            {generatingImage ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Share on X
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2">
          Generate a shareable image, export a detailed PDF report, or share your stats on X (Twitter)
        </div>
      </CardContent>
    </Card>
  );
}
