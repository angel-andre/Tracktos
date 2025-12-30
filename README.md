# Tracktos

<div align="center">
  <img src="src/assets/aptos-logo.png" alt="Aptos Logo" width="100"/>
  <h3>Comprehensive Aptos Wallet Analytics Platform</h3>
  <p>Explore your Aptos blockchain adventure through detailed wallet analytics and insights</p>
  <p><strong>⚠️ Currently in Beta - Public Testing Phase</strong></p>
</div>

> **Note**: This application is currently in beta and undergoing public testing. Features are being actively developed and refined. Feedback and bug reports are welcome!

## 🌟 Features

### Account Overview
- **Real-time Balance Tracking**: View liquid and staked APT balances with precise decimal formatting
- **Portfolio Value Tracking**: See total USD value across all tokens
- **24h Change Metrics**: Track portfolio changes with dollar amount and percentage
- **Wallet Activity Metrics**: Track total transactions and NFT collections
- **Wallet Timeline**: See wallet start date (first transaction) and most recent activity
- **Sentiment Analysis**: AI-powered wallet sentiment indicator based on activity patterns, staking behavior, and portfolio diversity

### Portfolio Analytics
- **Historical Chart**: Track portfolio value over time with interactive chart
- **Time Range Selection**: View portfolio history by day, week, month, or year
- **Value Snapshots**: Automated tracking of portfolio value at regular intervals
- **Performance Insights**: Visualize your wallet's growth trajectory

### Token Portfolio
- **Top Holdings Display**: View your top 10 fungible token assets
- **Multi-Asset Support**: Track APT and all fungible assets in your wallet
- **USD Value Tracking**: Real-time USD pricing for all supported tokens
- **Individual Token Metrics**: Balance, price, and total value per token
- **Formatted Balances**: Human-readable number formatting with proper decimal precision
- **Real-time Data**: Direct integration with Aptos blockchain for accurate balances

### NFT Collections
- **Comprehensive NFT Gallery**: Browse all NFTs in your collection with high-quality images
- **Price Discovery**: Automatic NFT purchase price detection from transaction history
- **Premium NFTs Showcase**: Featured display of your most expensive NFTs
- **Collection Analytics**: Total NFT count and collection diversity metrics
- **Multi-Source Image Resolution**: Supports CDN URIs, IPFS, and Arweave for NFT images
- **Detailed NFT Info**: View collection name, purchase price, and transaction hash

### Transaction Analytics
- **Activity Heatmap**: Visualize transaction activity patterns over time
- **Transaction Type Breakdown**: Pie chart showing distribution of transaction types
- **Gas Analytics**: Track gas spending over time
- **Top Contracts**: See which smart contracts you interact with most
- **Recent Activity Feed**: Latest 5 transactions with success status and timestamps
- **Full Transaction History**: Access complete transaction count

### DeFi Activity
- **Swap History**: View all token swap transactions with protocol details
- **Protocol Analytics**: See trading volume and transaction count per DeFi protocol
- **Staking Activities**: Track staking actions across different protocols
- **Total DeFi Volume**: Aggregate USD volume across all DeFi interactions
- **Unique Protocols**: Count of distinct DeFi protocols used

### Wallet Identity
- **Active Days Counter**: Track how many days your wallet has been active
- **Gas Expenditure**: Total gas spent across all transactions
- **Achievement Badges**: Earn badges based on wallet activity and milestones
- **Wallet Age**: Display since when the wallet has been active
- **Comparative Rankings**: See how your wallet ranks against others in key metrics

### Share & Export
- **Shareable Cards**: Generate beautiful shareable images of your wallet stats
- **Custom Background**: Cards feature unique Pepe-themed design
- **Key Metrics Display**: Shows portfolio value, transactions, and 24h change
- **Comparative Rankings**: Display percentile rankings for various metrics
- **Achievement Badges**: Feature your earned badges on the card
- **Download & Share**: Export as PNG for social media sharing

### Multi-Wallet Management
- **Wallet Storage**: Save multiple wallet addresses for quick access
- **Quick Switch**: Easily switch between saved wallets via dropdown
- **Add New Wallets**: Simple interface to add and track additional addresses
- **Auto-Save**: Automatically saves analyzed wallets for future use

### 🌐 Network Globe (NEW)
- **3D Interactive Globe**: Visualize the Aptos network with a real-time 3D globe showing validator locations
- **Live TPS Chart**: Real-time transactions per second calculated from ledger version changes
- **Transaction Type Distribution**: Live pie chart showing breakdown of transaction types (user, block metadata, state checkpoint)
- **Epoch Progress**: Real-time epoch countdown with progress bar calculated from blockchain timestamps
- **Validator Nodes**: 148 validators displayed at accurate geographic locations across 28 countries and 52 cities
- **Live Transaction Feed**: Stream of real-time transactions with details (hash, type, amount, gas cost)
- **Transaction Visualization**: Animated pulses on globe showing live transaction activity
- **Network Statistics**: Staking data, total supply, and APR rewards display
- **Blockchain State**: Live block height, latest version, and total transaction count

### Network Support
- **Mainnet Integration**: Full support for Aptos mainnet
- **Testnet Support**: Test features on Aptos testnet
- **Network Switching**: Easy toggle between networks
- **Network-Specific Data**: Accurate data retrieval per network

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
- **Recharts** - Interactive charts and data visualization
- **React Three Fiber** - 3D graphics with Three.js for the Network Globe
- **@react-three/drei** - Useful helpers for React Three Fiber
- **Three.js** - 3D library for globe visualization
- **html2canvas** - Generate shareable images from DOM elements
- **jsPDF** - PDF generation for export functionality
- **date-fns** - Date formatting and manipulation
- **TanStack Query** - Server state management

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
│   │   ├── aptos-logo.png
│   │   ├── aptos-logo-white.png
│   │   └── pepe-card-bg.png  # Custom background for shareable cards
│   ├── components/
│   │   ├── dashboard/       # Dashboard-specific components
│   │   │   ├── AccountCard.tsx             # Account overview & sentiment
│   │   │   ├── TokensCard.tsx              # Token holdings display
│   │   │   ├── NFTsCard.tsx                # NFT gallery (paginated)
│   │   │   ├── PremiumNFTsCard.tsx         # Featured expensive NFTs
│   │   │   ├── ActivityCard.tsx            # Recent transactions
│   │   │   ├── PortfolioChartCard.tsx      # Historical portfolio value chart
│   │   │   ├── WalletIdentityCard.tsx      # Wallet age, gas, badges, rankings
│   │   │   ├── TransactionAnalyticsCard.tsx # Heatmap, charts, top contracts
│   │   │   ├── DeFiActivityCard.tsx        # Swap history, protocol analytics
│   │   │   └── ShareExportCard.tsx         # Generate shareable images
│   │   ├── globe/           # Network Globe components
│   │   │   ├── GlobeScene.tsx              # 3D globe with validator nodes
│   │   │   ├── TransactionFeed.tsx         # Live transaction stream
│   │   │   ├── NetworkStatsPanel.tsx       # Network statistics display
│   │   │   ├── TPSChart.tsx                # Live TPS sparkline chart
│   │   │   ├── TransactionTypeChart.tsx    # Transaction type pie chart
│   │   │   └── EpochProgress.tsx           # Real-time epoch countdown
│   │   └── ui/              # Reusable UI components (Shadcn)
│   ├── hooks/               # Custom React hooks
│   │   ├── use-toast.ts     # Toast notification hook
│   │   ├── useRealtimeTransactions.ts  # Live blockchain transaction fetching
│   │   └── useValidatorNodes.ts        # Validator node data and locations
│   ├── lib/
│   │   ├── utils.ts         # Utility functions
│   │   ├── formatters.ts    # Number and currency formatters
│   │   └── walletStorage.ts # Local storage for saved wallets
│   ├── integrations/
│   │   └── supabase/        # Supabase client & types
│   ├── pages/
│   │   ├── Index.tsx        # Main dashboard page
│   │   ├── Globe.tsx        # Network Globe visualization page
│   │   └── NotFound.tsx     # 404 page
│   ├── App.tsx              # Root component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles & design system
├── public/
│   └── textures/            # 3D globe textures
│       ├── earth-blue-marble.jpg
│       └── earth-topology.png
├── supabase/
│   ├── functions/
│   │   ├── aptos/                      # Main Aptos data fetching
│   │   │   └── index.ts
│   │   ├── aptos-transactions/         # Real-time transaction fetching for globe
│   │   │   └── index.ts
│   │   ├── portfolio-history/          # Portfolio value tracking
│   │   │   └── index.ts
│   │   └── generate-wallet-background/ # Custom card background generation
│   │       └── index.ts
│   └── config.toml          # Supabase configuration
└── package.json             # Project dependencies
```

## 🏗 Architecture

### Data Flow
1. **User Input**: User enters Aptos wallet address and selects network
2. **Edge Function Call**: Frontend invokes Supabase edge function with address
3. **Blockchain Query**: Edge function queries Aptos Indexer GraphQL and Fullnode APIs
4. **Data Processing**: 
   - Aggregates fungible assets and calculates balances with USD values
   - Fetches NFT metadata from CDN/IPFS/Arweave with price discovery
   - Parses transaction history for activity, analytics, and DeFi tracking
   - Calculates wallet sentiment score and achievement badges
   - Generates transaction analytics (heatmap, type breakdown, gas tracking)
   - Analyzes DeFi activity (swaps, protocols, staking)
5. **Portfolio History**: Separate edge function tracks portfolio value over time
6. **Response**: Formatted data returned to frontend with comprehensive analytics
7. **UI Rendering**: Tabbed dashboard displays all analytics with loading states
8. **Sharing**: Generate custom shareable images with wallet stats and background

### Key Design Patterns
- **Component Composition**: Modular dashboard cards for maintainability
- **Tabbed Navigation**: Organized view of different wallet aspects (Overview, Tokens, NFTs, Activity, DeFi, Identity)
- **Skeleton Loading**: Smooth loading experience with skeleton screens
- **Error Handling**: Graceful error messages and fallback states
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Type Safety**: Full TypeScript coverage for runtime safety
- **Local Storage**: Persistent wallet addresses for quick access
- **Chart Visualization**: Interactive charts for portfolio and transaction data
- **Image Generation**: HTML-to-canvas conversion for shareable cards

### Sentiment Calculation Algorithm
The wallet sentiment score (0-100) is calculated based on:
- **Transaction Volume**: Higher activity = more bullish (up to +15 points)
- **NFT Holdings**: Collection size indicates engagement (up to +10 points)
- **Token Diversity**: Multiple tokens show active trading (up to +10 points)
- **Staking Behavior**: Staked APT indicates long-term holding (up to +15 points)
- **Portfolio Value**: Higher value suggests commitment (up to +20 points)
- **DeFi Activity**: Active DeFi usage indicates engagement (up to +15 points)

Score ranges:
- 75-100: Very Bullish 🚀
- 60-74: Bullish 📈
- 40-59: Neutral 😐
- 25-39: Bearish 📉
- 0-24: Very Bearish 🐻

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
    "lastTransactionTimestamp": "2024-01-15T14:30:00.000Z",
    "usdChange24h": 125.50,
    "percentChange24h": 5.2
  },
  "tokens": [
    {
      "name": "Token Name",
      "symbol": "TKN",
      "balance": "1000.50",
      "usdPrice": 1.25,
      "usdValue": 1250.625,
      "logoUrl": "https://..."
    }
  ],
  "nfts": [
    {
      "name": "NFT Name",
      "collection": "Collection Name",
      "image": "https://...",
      "price": "5.5 APT",
      "purchaseHash": "0x...",
      "tokenDataId": "0x..."
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
  "transactionAnalytics": {
    "activityHeatmap": [
      { "date": "2024-01-01", "count": 15 }
    ],
    "typeBreakdown": [
      { "type": "Token Transfer", "count": 50, "percentage": 45.5 }
    ],
    "gasOverTime": [
      { "date": "2024-01-01", "gas": "0.005" }
    ],
    "topContracts": [
      { "address": "0x...", "name": "DeFi Protocol", "count": 25, "type": "swap" }
    ]
  },
  "defiActivity": {
    "swapHistory": [
      {
        "timestamp": "2024-01-15T14:30:00.000Z",
        "protocol": "PancakeSwap",
        "fromToken": "APT",
        "toToken": "USDC",
        "fromAmount": "10.5",
        "toAmount": "105.0",
        "volumeUsd": 105.0
      }
    ],
    "protocolVolumes": [
      {
        "protocol": "PancakeSwap",
        "type": "swap",
        "volumeUsd": 5000.0,
        "txCount": 25
      }
    ],
    "stakingActivities": [
      {
        "protocol": "Aptos Staking",
        "action": "stake",
        "amount": "100 APT",
        "timestamp": "2024-01-10T12:00:00.000Z"
      }
    ],
    "totalDefiVolumeUsd": 15000.0,
    "uniqueProtocols": 5
  },
  "walletIdentity": {
    "activeDays": 245,
    "totalGasSpent": "2.5 APT",
    "badges": [
      {
        "name": "Early Adopter",
        "description": "Wallet created in first 6 months",
        "icon": "🌟"
      }
    ]
  },
  "totalNftCount": 150,
  "totalTransactionCount": 2380,
  "totalUsdValue": 12500.75,
  "sentimentScore": 85,
  "sentimentReasons": [
    "High transaction volume",
    "Active DeFi participation",
    "Significant staking"
  ]
}
```

### Edge Function: `/portfolio-history`

**Endpoint**: `POST /functions/v1/portfolio-history`

**Request Body**:
```json
{
  "address": "0x...",
  "currentValue": 12500.75
}
```

**Response**:
```json
{
  "history": [
    {
      "timestamp": "2024-01-01T00:00:00.000Z",
      "value": 10000.0
    },
    {
      "timestamp": "2024-01-15T00:00:00.000Z",
      "value": 12500.75
    }
  ]
}
```

## 🎨 Design Features

- **3D Network Visualization**: Interactive globe with real-time validator and transaction display
- **Glassmorphism Effects**: Modern backdrop blur and transparency
- **Gradient Accents**: Subtle gradients for visual hierarchy
- **Hover Animations**: Smooth transitions and scale effects
- **Responsive Grid Layouts**: Adapts to all screen sizes
- **Dark Mode Ready**: Full dark mode support via CSS variables
- **Loading States**: Skeleton screens for better UX
- **Real-time Updates**: Live data streaming with visual indicators

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
- [Supabase](https://supabase.com/) - For the backend infrastructure

## 📞 Support

For questions and support, please open an issue in the GitHub repository.
