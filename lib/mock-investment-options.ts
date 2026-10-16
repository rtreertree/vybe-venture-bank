import type { InvestmentAssetType } from "@/generated/prisma/client";

export type MockInvestmentOption = {
  option_id: string;
  symbol: string;
  name: string;
  asset_type: InvestmentAssetType;
  currency: "USD";
  mock_price: number;
};

export const mockInvestmentOptions: MockInvestmentOption[] = [
  { option_id: "stock-aapl", symbol: "AAPL", name: "Apple Inc.", asset_type: "STOCK", currency: "USD", mock_price: 227.52 },
  { option_id: "stock-nvda", symbol: "NVDA", name: "NVIDIA Corporation", asset_type: "STOCK", currency: "USD", mock_price: 138.85 },
  { option_id: "stock-msft", symbol: "MSFT", name: "Microsoft Corporation", asset_type: "STOCK", currency: "USD", mock_price: 428.76 },
  { option_id: "stock-amzn", symbol: "AMZN", name: "Amazon.com, Inc.", asset_type: "STOCK", currency: "USD", mock_price: 187.83 },
  { option_id: "stock-googl", symbol: "GOOGL", name: "Alphabet Inc.", asset_type: "STOCK", currency: "USD", mock_price: 176.14 },
  { option_id: "stock-meta", symbol: "META", name: "Meta Platforms, Inc.", asset_type: "STOCK", currency: "USD", mock_price: 567.36 },
  { option_id: "stock-tsla", symbol: "TSLA", name: "Tesla, Inc.", asset_type: "STOCK", currency: "USD", mock_price: 221.33 },
  { option_id: "etf-voo", symbol: "VOO", name: "Vanguard S&P 500 ETF", asset_type: "ETF", currency: "USD", mock_price: 532.64 },
  { option_id: "etf-vti", symbol: "VTI", name: "Vanguard Total Stock Market ETF", asset_type: "ETF", currency: "USD", mock_price: 296.71 },
  { option_id: "etf-spy", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", asset_type: "ETF", currency: "USD", mock_price: 580.49 },
  { option_id: "etf-bnd", symbol: "BND", name: "Vanguard Total Bond Market ETF", asset_type: "ETF", currency: "USD", mock_price: 73.28 },
  { option_id: "crypto-btc", symbol: "BTC", name: "Bitcoin", asset_type: "CRYPTO", currency: "USD", mock_price: 67340 },
  { option_id: "crypto-eth", symbol: "ETH", name: "Ethereum", asset_type: "CRYPTO", currency: "USD", mock_price: 2614 },
];

export function findMockInvestmentOption(optionId: string) {
  return mockInvestmentOptions.find((option) => option.option_id === optionId);
}
