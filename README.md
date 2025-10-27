# Tracktos

<div align="center">
  <img src="src/assets/aptos-logo.png" alt="Aptos Logo" width="100"/>
  <h3>Comprehensive Aptos Wallet Analytics Platform</h3>
  <p>Explore your Aptos blockchain journey through detailed wallet analytics and insights</p>
</div>

## 🌟 Features

### Account Overview
- **Real-time Balance Tracking**: View liquid and staked APT balances with precise decimal formatting
- **Wallet Activity Metrics**: Track total transactions and NFT collections
- **Wallet Timeline**: See wallet start date (first transaction) and most recent activity
- **Sentiment Analysis**: AI-powered wallet sentiment indicator based on activity patterns, staking behavior, and portfolio diversity

### Token Portfolio
- **Top Holdings Display**: View your top 10 fungible token assets
- **Multi-Asset Support**: Track APT and all fungible assets in your wallet
- **Formatted Balances**: Human-readable number formatting with proper decimal precision
- **Real-time Data**: Direct integration with Aptos blockchain for accurate balances

### NFT Collections
- **Comprehensive NFT Gallery**: Browse all NFTs in your collection with high-quality images
- **Price Discovery**: Automatic NFT purchase price detection from transaction history
- **Premium NFTs Showcase**: Featured display of your most expensive NFTs
- **Collection Analytics**: Total NFT count and collection diversity metrics
- **Multi-Source Image Resolution**: Supports CDN URIs, IPFS, and Arweave for NFT images

### Transaction Activity
- **Recent Transactions**: View your latest 5 transactions with success status
- **Transaction History**: Access full transaction count and sequence numbers
- **Timestamp Tracking**: Precise transaction timing with ISO-formatted dates
- **Transaction Types**: Detailed categorization of transaction types

### Network Support
- **Mainnet Integration**: Full support for Aptos mainnet
- **Testnet Support**: Test features on Aptos testnet
- **Network Switching**: Easy toggle between networks

## 🛠 Technologies Used

### Frontend
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Shadcn/ui** - High-quality component library
- **Radix UI** - Accessible component primitives
- **Lucide React** - Beautiful icon library
- **React Router** - Client-side routing
- **Sonner** - Toast notifications

### Backend (Lovable Cloud)
- **Supabase** - Backend-as-a-Service platform
- **Edge Functions** - Serverless Deno functions for API integration
- **PostgreSQL** - Production-grade database

### Blockchain Integration
- **Aptos Indexer GraphQL API** - Query blockchain data efficiently
- **Aptos Fullnode REST API** - Access precise account balances and transactions
- **Multiple Fallback Endpoints** - Ensure high availability

### Development Tools
- **ESLint** - Code quality and consistency
- **PostCSS** - CSS processing
- **TypeScript** - Static type checking

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or Bun
- npm, yarn, or bun package manager

### Installation

1. Clone the repository:
```bash
git clone <YOUR_GIT_URL>
cd tracktos
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Set up environment variables:
```bash
# .env file is auto-configured with Lovable Cloud
# No manual configuration needed for Supabase
```

4. Start the development server:
```bash
npm run dev
# or
bun dev
```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

## 📁 Project Structure

```
tracktos/
├── src/
│   ├── assets/              # Static assets (logos, images)
│   ├── components/
│   │   ├── dashboard/       # Dashboard-specific components
│   │   │   ├── AccountCard.tsx       # Account overview & sentiment
│   │   │   ├── TokensCard.tsx        # Token holdings display
│   │   │   ├── NFTsCard.tsx          # NFT gallery
│   │   │   ├── PremiumNFTsCard.tsx   # Featured expensive NFTs
│   │   │   └── ActivityCard.tsx      # Recent transactions
│   │   └── ui/              # Reusable UI components (Shadcn)
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── utils.ts         # Utility functions
│   │   └── formatters.ts    # Number and currency formatters
│   ├── integrations/
│   │   └── supabase/        # Supabase client & types
│   ├── pages/
│   │   ├── Index.tsx        # Main dashboard page
│   │   └── NotFound.tsx     # 404 page
│   ├── App.tsx              # Root component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles & design system
├── supabase/
│   ├── functions/
│   │   └── aptos/           # Edge function for Aptos API
│   │       └── index.ts     # Main API handler
│   └── config.toml          # Supabase configuration
├── public/                  # Static public assets
└── package.json             # Project dependencies
```

## 🏗 Architecture

### Data Flow
1. **User Input**: User enters Aptos wallet address and selects network
2. **Edge Function Call**: Frontend invokes Supabase edge function with address
3. **Blockchain Query**: Edge function queries Aptos Indexer GraphQL and Fullnode APIs
4. **Data Processing**: 
   - Aggregates fungible assets and calculates balances
   - Fetches NFT metadata from CDN/IPFS/Arweave
   - Parses transaction history for activity and prices
   - Calculates wallet sentiment score
5. **Response**: Formatted data returned to frontend
6. **UI Rendering**: Dashboard displays all analytics with loading states

### Key Design Patterns
- **Component Composition**: Modular dashboard cards for maintainability
- **Skeleton Loading**: Smooth loading experience with skeleton screens
- **Error Handling**: Graceful error messages and fallback states
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Type Safety**: Full TypeScript coverage for runtime safety

### Sentiment Calculation Algorithm
The wallet sentiment score (0-100) is calculated based on:
- **Transaction Volume**: Higher activity = more bullish (up to +15 points)
- **NFT Holdings**: Collection size indicates engagement (up to +10 points)
- **Token Diversity**: Multiple tokens show active trading (up to +10 points)
- **Staking Behavior**: Staked APT indicates long-term holding (up to +15 points)

Score ranges:
- 75-100: Very Bullish
- 60-74: Bullish
- 40-59: Neutral
- 25-39: Bearish
- 0-24: Very Bearish

## 🔧 Configuration

### Tailwind Design System
The project uses a semantic color system defined in `index.css`:
- Primary, secondary, accent colors
- Background and foreground variants
- Border and muted colors
- Dark mode support via CSS variables

### Environment Variables
Managed automatically by Lovable Cloud:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key
- `VITE_SUPABASE_PROJECT_ID` - Project identifier

## 📊 API Documentation

### Edge Function: `/aptos`

**Endpoint**: `POST /functions/v1/aptos`

**Request Body**:
```json
{
  "address": "0x...",
  "network": "mainnet" | "testnet"
}
```

**Response**:
```json
{
  "account": {
    "address": "0x...",
    "aptBalance": "100.5",
    "stakedApt": "50.25",
    "firstTransactionTimestamp": "2023-10-01T12:00:00.000Z",
    "lastTransactionTimestamp": "2024-01-15T14:30:00.000Z"
  },
  "tokens": [
    {
      "name": "Token Name",
      "symbol": "TKN",
      "balance": "1000.50"
    }
  ],
  "nfts": [
    {
      "name": "NFT Name",
      "collection": "Collection Name",
      "image": "https://...",
      "price": "5.5 APT",
      "purchaseHash": "0x..."
    }
  ],
  "activity": [
    {
      "hash": "0x...",
      "type": "user_transaction",
      "success": true,
      "timestamp": "2024-01-15T14:30:00.000Z"
    }
  ],
  "totalNftCount": 150,
  "totalTransactionCount": 2380
}
```

## 🎨 Design Features

- **Glassmorphism Effects**: Modern backdrop blur and transparency
- **Gradient Accents**: Subtle gradients for visual hierarchy
- **Hover Animations**: Smooth transitions and scale effects
- **Responsive Grid Layouts**: Adapts to all screen sizes
- **Dark Mode Ready**: Full dark mode support via CSS variables
- **Loading States**: Skeleton screens for better UX

## 🚢 Deployment

### Lovable Platform
1. Click "Publish" in the top right of the Lovable editor
2. Your app is automatically deployed to a Lovable subdomain

### Custom Domain
1. Navigate to Project > Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. [Learn more about custom domains](https://docs.lovable.dev/features/custom-domain)

### Self-Hosting
The project can be deployed to any static hosting platform:
- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

Build command: `npm run build` or `bun build`
Output directory: `dist`

## 💻 Development

### Edit in Lovable
Simply visit your [Lovable Project](https://lovable.dev/projects/d3101583-aee4-4bfa-8fc1-1c4946e2a16c) and start prompting. Changes made via Lovable will be committed automatically to this repo.

### Local Development
If you want to work locally using your own IDE:

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd tracktos

# Install dependencies
npm i

# Start the development server
npm run dev
```

### GitHub Codespaces
- Navigate to the main page of your repository
- Click on the "Code" button (green button) near the top right
- Select the "Codespaces" tab
- Click on "New codespace" to launch a new Codespace environment
- Edit files directly within the Codespace and commit your changes

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m "Add some AmazingFeature"`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Aptos Labs](https://aptoslabs.com/) - For the Aptos blockchain and APIs
- [Shadcn/ui](https://ui.shadcn.com/) - For the beautiful component library
- [Lovable](https://lovable.dev/) - For the development platform
- [Supabase](https://supabase.com/) - For the backend infrastructure

## 📞 Support

For questions and support, please open an issue in the GitHub repository.

---

<div align="center">
  Made with ❤️ using Lovable
</div>
