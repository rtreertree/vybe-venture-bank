export const bankProducts = [
  {
    symbol: "AAPL", name: "Apple Inc.", type: "STOCK", area: "Technology", description: "Consumer electronics, software, and services company.",
    risk: "MEDIUM", riskNote: "Technology businesses can be affected by competition, product cycles, and changing consumer demand.", issuer: "Apple Inc.", region: "US", dividendYieldPercent: 0.4,
  },
  {
    symbol: "MSFT", name: "Microsoft Corporation", type: "STOCK", area: "Technology", description: "Software, cloud computing, and technology services company.",
    risk: "MEDIUM", riskNote: "Technology businesses can be affected by competition, regulation, and rapid changes in the market.", issuer: "Microsoft Corporation", region: "US", dividendYieldPercent: 0.7,
  },
  {
    symbol: "NVDA", name: "NVIDIA Corporation", type: "STOCK", area: "Technology", description: "Designer of graphics processors and accelerated computing platforms.",
    risk: "HIGH", riskNote: "The share price can be volatile and the business depends on cyclical demand for advanced computing.", issuer: "NVIDIA Corporation", region: "US", dividendYieldPercent: 0.03,
  },
  {
    symbol: "AMZN", name: "Amazon.com, Inc.", type: "STOCK", area: "Consumer", description: "E-commerce, cloud computing, and digital services company.",
    risk: "MEDIUM", riskNote: "Retail margins, competition, and cloud spending can materially affect results.", issuer: "Amazon.com, Inc.", region: "US", dividendYieldPercent: 0,
  },
  {
    symbol: "GOOGL", name: "Alphabet Inc.", type: "STOCK", area: "Technology", description: "Technology company with businesses in online search, advertising, and cloud services.",
    risk: "MEDIUM", riskNote: "Advertising demand, competition, and regulatory actions may affect the business.", issuer: "Alphabet Inc.", region: "US", dividendYieldPercent: 0,
  },
  {
    symbol: "TSLA", name: "Tesla, Inc.", type: "STOCK", area: "Clean energy", description: "Electric vehicle, battery storage, and clean energy company.",
    risk: "HIGH", riskNote: "The share price can be volatile and the business faces intense competition and execution risks.", issuer: "Tesla, Inc.", region: "US", dividendYieldPercent: 0,
  },
  {
    symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "FUND", area: "Broad market", description: "Tracks a broad index of large US companies.",
    risk: "MEDIUM", riskNote: "The fund can lose value when the US equity market declines.", issuer: "Vanguard", region: "US", dividendYieldPercent: 1.2,
  },
  {
    symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "FUND", area: "Broad market", description: "Provides exposure to a broad range of US companies across market sizes.",
    risk: "MEDIUM", riskNote: "The fund can lose value when the US equity market declines.", issuer: "Vanguard", region: "US", dividendYieldPercent: 1.3,
  },
  {
    symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "FUND", area: "Broad market", description: "Tracks the performance of large-cap US equities.",
    risk: "MEDIUM", riskNote: "The fund can lose value when the US equity market declines.", issuer: "State Street Global Advisors", region: "US", dividendYieldPercent: 1.2,
  },
  {
    symbol: "QQQ", name: "Invesco QQQ Trust", type: "FUND", area: "Technology", description: "Tracks a large-cap index weighted toward non-financial technology companies.",
    risk: "HIGH", riskNote: "The fund is concentrated in growth and technology companies and may be more volatile than a broad-market fund.", issuer: "Invesco", region: "US", dividendYieldPercent: 0.6,
  },
  {
    symbol: "BND", name: "Vanguard Total Bond Market ETF", type: "BOND", area: "Fixed income", description: "Provides broad exposure to investment-grade US bonds.",
    risk: "LOW", riskNote: "Bond prices can fall when interest rates rise; credit and inflation risks also apply.", issuer: "Vanguard", region: "US", dividendYieldPercent: 3.5,
  },
  {
    symbol: "SCHD", name: "Schwab US Dividend Equity ETF", type: "FUND", area: "Dividend equities", description: "Tracks US companies with a history of paying dividends and strong financial characteristics.",
    risk: "MEDIUM", riskNote: "The fund remains exposed to equity-market losses and may be concentrated in dividend-paying sectors.", issuer: "Charles Schwab", region: "US", dividendYieldPercent: 3.4,
  },
  {
    symbol: "IVV", name: "iShares Core S&P 500 ETF", type: "FUND", area: "Broad market", description: "Tracks large-cap US equities represented in the S&P 500 index.",
    risk: "MEDIUM", riskNote: "The fund can lose value when the US equity market declines.", issuer: "BlackRock", region: "US", dividendYieldPercent: 1.2,
  },
  {
    symbol: "BTC", name: "Bitcoin", type: "CRYPTO", area: "Crypto", description: "A decentralized digital asset with a limited issuance schedule.",
    risk: "HIGH", riskNote: "Crypto assets can be extremely volatile and may lose most or all of their value.", issuer: "Bitcoin network", region: "Global", dividendYieldPercent: 0,
  },
  {
    symbol: "ETH", name: "Ethereum", type: "CRYPTO", area: "Crypto", description: "A decentralized blockchain network with a native digital asset.",
    risk: "HIGH", riskNote: "Crypto assets can be extremely volatile and may lose most or all of their value.", issuer: "Ethereum network", region: "Global", dividendYieldPercent: 0,
  },
  {
    symbol: "VXUS", name: "Vanguard Total International Stock ETF", type: "FUND", area: "International equities", description: "Provides exposure to non-US companies in developed and emerging markets.",
    risk: "MEDIUM", riskNote: "The fund can lose value when equity markets decline. Currency and foreign-market risks also apply.", issuer: "Vanguard", region: "Global", dividendYieldPercent: 2.9,
  },
  {
    symbol: "VWO", name: "Vanguard FTSE Emerging Markets ETF", type: "FUND", area: "Emerging markets", description: "Tracks large and mid-sized companies in emerging market countries.",
    risk: "HIGH", riskNote: "Emerging markets can be volatile and are exposed to political, currency, and liquidity risks.", issuer: "Vanguard", region: "Emerging markets", dividendYieldPercent: 3.0,
  },
  {
    symbol: "XLV", name: "Health Care Select Sector SPDR Fund", type: "FUND", area: "Healthcare", description: "Tracks US health care companies in the S&P 500.",
    risk: "MEDIUM", riskNote: "The fund is concentrated in one sector and can be affected by regulation and drug-pricing changes.", issuer: "State Street Global Advisors", region: "US", dividendYieldPercent: 1.5,
  },
  {
    symbol: "AGG", name: "iShares Core US Aggregate Bond ETF", type: "BOND", area: "Fixed income", description: "Provides broad exposure to investment-grade US bonds.",
    risk: "LOW", riskNote: "Bond prices can fall when interest rates rise; credit and inflation risks also apply.", issuer: "BlackRock", region: "US", dividendYieldPercent: 3.7,
  },
  {
    symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", type: "BOND", area: "Government bonds", description: "Holds long-term US Treasury bonds.",
    risk: "MEDIUM", riskNote: "Long-duration bonds are highly sensitive to interest-rate changes and can lose significant value.", issuer: "BlackRock", region: "US", dividendYieldPercent: 4.0,
  },
  {
    symbol: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", type: "BOND", area: "Government bonds", description: "Holds short-term US Treasury bonds.",
    risk: "LOW", riskNote: "Returns may not keep pace with inflation, and prices can still move with interest rates.", issuer: "BlackRock", region: "US", dividendYieldPercent: 3.8,
  },
  {
    symbol: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF", type: "BOND", area: "Corporate bonds", description: "Holds US high-yield corporate bonds.",
    risk: "HIGH", riskNote: "High-yield bonds carry greater default and credit risk and can fall sharply in downturns.", issuer: "BlackRock", region: "US", dividendYieldPercent: 5.7,
  },
  {
    symbol: "GLD", name: "SPDR Gold Shares", type: "COMMODITY", area: "Precious metals", description: "Tracks the price of gold bullion.",
    risk: "MEDIUM", riskNote: "Gold prices can be volatile and the asset produces no income.", issuer: "State Street Global Advisors", region: "Global", dividendYieldPercent: 0,
  },
  {
    symbol: "SLV", name: "iShares Silver Trust", type: "COMMODITY", area: "Precious metals", description: "Tracks the price of silver bullion.",
    risk: "HIGH", riskNote: "Silver prices are volatile and driven by both investment and industrial demand.", issuer: "BlackRock", region: "Global", dividendYieldPercent: 0,
  },
  {
    symbol: "USO", name: "United States Oil Fund", type: "COMMODITY", area: "Energy commodities", description: "Tracks the price of West Texas Intermediate crude oil futures.",
    risk: "HIGH", riskNote: "Oil prices are volatile and futures-based funds can lose value even when spot prices are flat.", issuer: "USCF", region: "Global", dividendYieldPercent: 0,
  },
  {
    symbol: "DBC", name: "Invesco DB Commodity Index Tracking Fund", type: "COMMODITY", area: "Broad commodities", description: "Tracks a diversified basket of commodity futures.",
    risk: "HIGH", riskNote: "Commodity prices are volatile and futures roll costs can reduce returns.", issuer: "Invesco", region: "Global", dividendYieldPercent: 0,
  },
  {
    symbol: "VNQ", name: "Vanguard Real Estate ETF", type: "REIT", area: "Real estate", description: "Holds US real estate investment trusts.",
    risk: "MEDIUM", riskNote: "REITs are sensitive to interest rates and property-market conditions.", issuer: "Vanguard", region: "US", dividendYieldPercent: 3.9,
  },
  {
    symbol: "O", name: "Realty Income Corporation", type: "REIT", area: "Real estate", description: "Net-lease REIT that pays monthly dividends.",
    risk: "MEDIUM", riskNote: "Tenant defaults, rising interest rates, and property values can affect results.", issuer: "Realty Income Corporation", region: "US", dividendYieldPercent: 5.6,
  },
  {
    symbol: "SOL", name: "Solana", type: "CRYPTO", area: "Crypto", description: "A high-throughput blockchain network with a native digital asset.",
    risk: "HIGH", riskNote: "Crypto assets can be extremely volatile and may lose most or all of their value.", issuer: "Solana network", region: "Global", dividendYieldPercent: 0,
  },
  {
    symbol: "XRP", name: "XRP", type: "CRYPTO", area: "Crypto", description: "A digital asset used on the XRP Ledger for payments.",
    risk: "HIGH", riskNote: "Crypto assets can be extremely volatile and may lose most or all of their value.", issuer: "XRP Ledger", region: "Global", dividendYieldPercent: 0,
  },
  {
    symbol: "JPM", name: "JPMorgan Chase & Co.", type: "STOCK", area: "Financials", description: "Global financial services and investment banking firm.",
    risk: "MEDIUM", riskNote: "Earnings depend on interest rates, credit quality, and economic conditions.", issuer: "JPMorgan Chase & Co.", region: "US", dividendYieldPercent: 2.0,
  },
  {
    symbol: "JNJ", name: "Johnson & Johnson", type: "STOCK", area: "Healthcare", description: "Pharmaceutical and medical device company.",
    risk: "LOW", riskNote: "Litigation, patent expirations, and regulation can affect results.", issuer: "Johnson & Johnson", region: "US", dividendYieldPercent: 3.0,
  },
  {
    symbol: "XOM", name: "Exxon Mobil Corporation", type: "STOCK", area: "Energy", description: "Integrated oil and gas company.",
    risk: "MEDIUM", riskNote: "Earnings depend heavily on commodity prices and energy-transition policy.", issuer: "Exxon Mobil Corporation", region: "US", dividendYieldPercent: 3.4,
  },
  {
    symbol: "BIL", name: "SPDR Bloomberg 1-3 Month T-Bill ETF", type: "BOND", area: "Cash equivalents", description: "Holds very short-term US Treasury bills.",
    risk: "LOW", riskNote: "Returns may not keep pace with inflation, and prices can still move with interest rates.", issuer: "State Street Global Advisors", region: "US", dividendYieldPercent: 4.2,
  },
  {
    symbol: "SGOV", name: "iShares 0-3 Month Treasury Bond ETF", type: "BOND", area: "Cash equivalents", description: "Holds US Treasury bills maturing in under three months.",
    risk: "LOW", riskNote: "Returns may not keep pace with inflation, and prices can still move with interest rates.", issuer: "BlackRock", region: "US", dividendYieldPercent: 4.2,
  },
  {
    symbol: "SHV", name: "iShares Short Treasury Bond ETF", type: "BOND", area: "Cash equivalents", description: "Holds US Treasury bills with maturities up to one year.",
    risk: "LOW", riskNote: "Returns may not keep pace with inflation, and prices can still move with interest rates.", issuer: "BlackRock", region: "US", dividendYieldPercent: 4.1,
  },
  {
    symbol: "VGSH", name: "Vanguard Short-Term Treasury ETF", type: "BOND", area: "Government bonds", description: "Holds US Treasury bonds with short maturities.",
    risk: "LOW", riskNote: "Returns may not keep pace with inflation, and prices can still move with interest rates.", issuer: "Vanguard", region: "US", dividendYieldPercent: 3.9,
  },
  {
    symbol: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", type: "BOND", area: "Government bonds", description: "Holds intermediate-term US Treasury bonds.",
    risk: "LOW", riskNote: "Bond prices can fall when interest rates rise; credit and inflation risks also apply.", issuer: "BlackRock", region: "US", dividendYieldPercent: 3.6,
  },
  {
    symbol: "TIP", name: "iShares TIPS Bond ETF", type: "BOND", area: "Inflation-protected bonds", description: "Holds US Treasury inflation-protected securities.",
    risk: "LOW", riskNote: "Bond prices can fall when interest rates rise; credit and inflation risks also apply.", issuer: "BlackRock", region: "US", dividendYieldPercent: 2.5,
  },
  {
    symbol: "MUB", name: "iShares National Muni Bond ETF", type: "BOND", area: "Municipal bonds", description: "Holds investment-grade US municipal bonds.",
    risk: "LOW", riskNote: "Bond prices can fall when interest rates rise; credit and inflation risks also apply. Municipal issuers may default.", issuer: "BlackRock", region: "US", dividendYieldPercent: 3.1,
  },
  {
    symbol: "LQD", name: "iShares iBoxx Investment Grade Corporate Bond ETF", type: "BOND", area: "Corporate bonds", description: "Holds investment-grade US corporate bonds.",
    risk: "LOW", riskNote: "Bond prices can fall when interest rates rise; credit and inflation risks also apply.", issuer: "BlackRock", region: "US", dividendYieldPercent: 4.3,
  },
  {
    symbol: "VCSH", name: "Vanguard Short-Term Corporate Bond ETF", type: "BOND", area: "Corporate bonds", description: "Holds short-term investment-grade US corporate bonds.",
    risk: "LOW", riskNote: "Bond prices can fall when interest rates rise; credit and inflation risks also apply.", issuer: "Vanguard", region: "US", dividendYieldPercent: 4.0,
  },
  {
    symbol: "BSV", name: "Vanguard Short-Term Bond ETF", type: "BOND", area: "Fixed income", description: "Holds short-term investment-grade US bonds.",
    risk: "LOW", riskNote: "Bond prices can fall when interest rates rise; credit and inflation risks also apply.", issuer: "Vanguard", region: "US", dividendYieldPercent: 3.6,
  },
  {
    symbol: "PG", name: "The Procter & Gamble Company", type: "STOCK", area: "Consumer staples", description: "Household and personal care products company.",
    risk: "LOW", riskNote: "Demand is stable, but input costs, competition, and currency moves can affect results.", issuer: "The Procter & Gamble Company", region: "US", dividendYieldPercent: 2.4,
  },
  {
    symbol: "KO", name: "The Coca-Cola Company", type: "STOCK", area: "Consumer staples", description: "Global beverage company.",
    risk: "LOW", riskNote: "Demand is stable, but consumer preferences, currency moves, and regulation can affect results.", issuer: "The Coca-Cola Company", region: "US", dividendYieldPercent: 3.0,
  },
  {
    symbol: "WMT", name: "Walmart Inc.", type: "STOCK", area: "Consumer staples", description: "Global retailer of groceries and general merchandise.",
    risk: "LOW", riskNote: "Thin margins and competition can affect results, though demand is generally stable.", issuer: "Walmart Inc.", region: "US", dividendYieldPercent: 1.0,
  },
  {
    symbol: "USMV", name: "iShares MSCI USA Min Vol Factor ETF", type: "FUND", area: "Low volatility equities", description: "Holds US stocks selected for lower volatility.",
    risk: "LOW", riskNote: "The fund remains exposed to equity-market losses, though it aims to fall less than the broad market.", issuer: "BlackRock", region: "US", dividendYieldPercent: 1.5,
  },
  {
    symbol: "VIG", name: "Vanguard Dividend Appreciation ETF", type: "FUND", area: "Dividend equities", description: "Tracks US companies with a record of growing dividends.",
    risk: "LOW", riskNote: "The fund remains exposed to equity-market losses, though holdings are typically established companies.", issuer: "Vanguard", region: "US", dividendYieldPercent: 1.7,
  },
] as const;

export type BankProductSeed = (typeof bankProducts)[number];

export function toYahooSymbol(symbol: string) {
  if (symbol === "BTC") return "BTC-USD";
  if (symbol === "ETH") return "ETH-USD";
  if (symbol === "SOL") return "SOL-USD";
  if (symbol === "XRP") return "XRP-USD";
  return symbol;
}
