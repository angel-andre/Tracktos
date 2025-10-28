import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      portfolioValue, 
      transactionCount, 
      activeDays, 
      gasSpent,
      tokenCount,
      nftCount,
      badges 
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create a descriptive prompt based on wallet characteristics
    let walletPersonality = "";
    let visualTheme = "";
    
    // Determine wallet personality
    if (transactionCount > 5000 && activeDays > 180) {
      walletPersonality = "highly active veteran trader";
      visualTheme = "dynamic, energetic with flowing data streams and network nodes";
    } else if (portfolioValue > 50000) {
      walletPersonality = "whale investor";
      visualTheme = "luxurious, premium with golden accents and cosmic depth";
    } else if (nftCount > 20) {
      walletPersonality = "NFT collector";
      visualTheme = "colorful, artistic with gallery-like aesthetic and vibrant patterns";
    } else if (gasSpent > 50) {
      walletPersonality = "dedicated network supporter";
      visualTheme = "technical, futuristic with blockchain motifs and digital architecture";
    } else if (activeDays > 90) {
      walletPersonality = "steady long-term holder";
      visualTheme = "stable, serene with gradual growth patterns and calm colors";
    } else {
      walletPersonality = "emerging participant";
      visualTheme = "fresh, optimistic with rising elements and bright beginnings";
    }

    const badgeCount = badges?.length || 0;
    const achievementLevel = badgeCount > 5 ? "legendary" : badgeCount > 3 ? "accomplished" : "progressing";

    const prompt = `Create an abstract background image for a crypto wallet analytics card. The wallet is a ${walletPersonality} with ${achievementLevel} achievements. Visual style: ${visualTheme}. Use a gradient background with subtle geometric patterns, blockchain-inspired elements, and a sophisticated color palette suitable for overlaying white text. The image should be abstract and professional, not literal. Dimensions: 900x700 pixels. Style: modern, tech-focused, premium.`;

    console.log("Generating image with prompt:", prompt);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), 
          { 
            status: 429, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), 
          { 
            status: 402, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      throw new Error("No image URL in response");
    }

    return new Response(
      JSON.stringify({ imageUrl }), 
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in generate-wallet-background:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
