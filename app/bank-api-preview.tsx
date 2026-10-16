"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Range = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";
type SeriesPoint = { t: string; v: number };
type Series = {
  range: Range;
  interval: string;
  currency: string;
  asOf: string;
  points: SeriesPoint[];
  summary: { start: number; end: number; change: number; changePercent: number; high: number; low: number };
};
type Product = {
  symbol: string;
  name: string;
  type: string;
  area: string;
  description: string;
  risk: string;
  currentPrice: number;
  dayChange: number;
  dayChangePercent: number;
  asOf: string;
  currency: string;
};
type YahooProductMatch = {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  description: string;
  inCatalog: boolean;
};
type ProductDetail = Product & {
  riskNote: string;
  issuer: string;
  region: string;
  returns: Record<string, number>;
  volatilityPercent: number | null;
  maxDrawdownPercent: number;
  high52w: number;
  low52w: number;
  dividendYieldPercent: number;
  size: number | null;
  inceptionDate: string | null;
  topHoldings: Array<{ name: string; weightPercent: number }> | null;
};
type Account = { userId: string; currency: string; cashBalance: number; asOf: string };
type Holding = {
  symbol: string;
  name: string;
  area: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  weightPercent: number;
  asOf: string;
  boughtAt: string | null;
  heldDays: number | null;
};
type Portfolio = {
  currency: string;
  asOf: string;
  cashBalance: number;
  holdings: Holding[];
  totals: {
    holdingsValue: number;
    totalValue: number;
    totalCost: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
  };
};
type Order = {
  orderId: string;
  symbol: string;
  side: string;
  status: string;
  quantity: number;
  filledPrice: number | null;
  filledQuantity: number;
  asOf: string | null;
  createdAt: string;
};
type TradeMarkerFilter = "both" | "buy" | "sell";
type Area = { area: string; count: number };
type Clock = { serverTime: string; realTime: string; mode: "live" | "running" | "frozen"; ordersAfterServerTime: number };

const ranges: Range[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];
const defaultUser = "mock-user-alex-morgan";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function timestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function utcTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

async function requestJson<T>(path: string, userId?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(userId ? { "X-User-Id": userId } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const data = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? `Request failed (${response.status}).`);
  return data;
}

function PriceSeriesChart({
  series,
  currency,
  title,
  orders = [],
}: {
  series: Series | null;
  currency: string;
  title: string;
  orders?: Order[];
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tradeFilter, setTradeFilter] = useState<TradeMarkerFilter>("both");
  const [selectedTrade, setSelectedTrade] = useState<Order | null>(null);
  const bounds = { left: 72, right: 778, top: 28, bottom: 250 };
  const points = series?.summary ? series.points ?? [] : [];
  const min = points.length ? series!.summary.low : 0;
  const max = points.length ? series!.summary.high : 1;
  const span = max - min;
  const axisMin = span === 0 ? Math.max(0, min - Math.max(min * 0.01, 0.01)) : min;
  const axisMax = span === 0 ? max + Math.max(max * 0.01, 0.01) : max;
  const startTime = points.length ? new Date(points[0].t).getTime() : 0;
  const endTime = points.length ? new Date(points[points.length - 1].t).getTime() : startTime;
  const xFor = (time: number) => bounds.left + (endTime === startTime ? 0 : ((time - startTime) / (endTime - startTime)) * (bounds.right - bounds.left));
  const yFor = (value: number) => bounds.bottom - ((value - axisMin) / (axisMax - axisMin || 1)) * (bounds.bottom - bounds.top);
  const polyline = points.map((point) => `${xFor(new Date(point.t).getTime())},${yFor(point.v)}`).join(" ");
  const selected = hoverIndex === null ? null : points[hoverIndex] ?? null;
  const start = startTime;
  const end = endTime;
  const markerCandidates = orders.filter((order) =>
    order.status === "filled" && order.filledPrice !== null
      && (tradeFilter === "both" || order.side === tradeFilter),
  );
  const latestBuy = markerCandidates
    .filter((order) => order.side === "buy")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  const latestSell = markerCandidates
    .filter((order) => order.side === "sell")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  const tradeMarkers = [latestBuy, latestSell].filter((order): order is Order => order !== undefined);
  const markersOverlap = tradeMarkers.length === 2
    && Math.abs(markerX(tradeMarkers[0]) - markerX(tradeMarkers[1])) < 12
    && Math.abs(markerY(tradeMarkers[0]) - markerY(tradeMarkers[1])) < 12;

  function markerX(order: Order) {
    const time = new Date(order.createdAt).getTime();
    const clampedTime = Math.max(start, Math.min(end, time));
    return xFor(clampedTime);
  }

  function markerY(order: Order) {
    const price = order.filledPrice ?? axisMin;
    return yFor(Math.max(axisMin, Math.min(axisMax, price)));
  }

  function markerOffset(order: Order) {
    if (!markersOverlap) return 0;
    const x = markerX(order);
    if (x < bounds.left + 20) return order.side === "buy" ? 7 : 21;
    if (x > bounds.right - 20) return order.side === "buy" ? -21 : -7;
    return order.side === "buy" ? -11 : 11;
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * 800;
    const ratio = Math.max(0, Math.min(1, (viewX - bounds.left) / (bounds.right - bounds.left)));
    const targetTime = startTime + ratio * (endTime - startTime);
    let nearest = 0;
    for (let index = 1; index < points.length; index += 1) {
      if (Math.abs(new Date(points[index].t).getTime() - targetTime) < Math.abs(new Date(points[nearest].t).getTime() - targetTime)) nearest = index;
    }
    setHoverIndex(nearest);
  }

  return (
    <div className="bank-chart">
      <div className="bank-chart-title">
        <div><h3>{title}</h3><span>{series ? `${series.range} · ${series.interval}` : "Price history"}</span></div>
        {series?.summary && <div className={series.summary.change >= 0 ? "positive" : "negative"}>
          <strong>{money(series.summary.end, currency)}</strong> <span>{percent(series.summary.changePercent)}</span>
        </div>}
      </div>
      {points.length === 0 ? (
        <div className="bank-chart-empty">No chart data is available for this range yet.</div>
      ) : (
        <>
          <svg
            className="bank-chart-svg"
            viewBox="0 0 800 300"
            role="img"
            aria-label={`${title} price history chart`}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            {Array.from({ length: 5 }, (_, index) => {
              const value = axisMax - ((axisMax - axisMin) * index) / 4;
              const y = bounds.top + ((bounds.bottom - bounds.top) * index) / 4;
              return (
                <g key={index}>
                  <line className="bank-chart-grid" x1={bounds.left} x2={bounds.right} y1={y} y2={y} />
                  <text className="bank-chart-label" x={bounds.left - 10} y={y + 4} textAnchor="end">{money(value, currency)}</text>
                </g>
              );
            })}
            <rect x={bounds.left} y={bounds.top} width={bounds.right - bounds.left} height={bounds.bottom - bounds.top} fill="transparent" pointerEvents="all" />
            {points.length > 1 && <polyline className="bank-chart-line" points={polyline} />}
            {tradeMarkers.map((order) => (
              <g
                key={order.orderId}
                className={`bank-chart-trade-marker ${order.side}`}
                role="button"
                tabIndex={0}
                aria-label={`${order.side} ${order.quantity} ${order.symbol} at ${money(order.filledPrice ?? 0, currency)} on ${timestamp(order.createdAt)}`}
                onClick={() => setSelectedTrade(order)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedTrade(order);
                  }
                }}
              >
                <title>{`${order.side.toUpperCase()} at ${money(order.filledPrice ?? 0, currency)} · ${timestamp(order.createdAt)}${new Date(order.createdAt).getTime() < start ? " · older than chart range, shown at left edge" : ""}`}</title>
                <circle
                  className="bank-chart-trade-halo"
                  cx={markerX(order) + markerOffset(order)}
                  cy={markerY(order)}
                  r="10"
                />
                <circle
                  className="bank-chart-trade-dot"
                  cx={markerX(order) + markerOffset(order)}
                  cy={markerY(order)}
                  r="6"
                />
              </g>
            ))}
            {selected && hoverIndex !== null && (
              <g className="bank-chart-hover">
                <line x1={xFor(new Date(selected.t).getTime())} x2={xFor(new Date(selected.t).getTime())} y1={bounds.top} y2={bounds.bottom} />
                <circle cx={xFor(new Date(selected.t).getTime())} cy={yFor(selected.v)} r="5" />
              </g>
            )}
            <text className="bank-chart-label" x={bounds.left} y="278">{timestamp(points[0].t)}</text>
            <text className="bank-chart-label" x={bounds.right} y="278" textAnchor="end">{timestamp(points[points.length - 1].t)}</text>
          </svg>
          <div className="bank-chart-stats">
            <span>Period high <strong>{money(series!.summary.high, currency)}</strong></span>
            <span>Period low <strong>{money(series!.summary.low, currency)}</strong></span>
            <span>As of <strong>{timestamp(series!.asOf)}</strong></span>
          </div>
          {tradeMarkers.length > 0 && (
            <div className="bank-trade-overlay-controls">
              <div className="bank-chart-legend">
                <span><i className="buy-dot" /> Latest buy</span>
                <span><i className="sell-dot" /> Latest sell</span>
                <small>Markers show saved trade price and timestamp.</small>
              </div>
              <div className="trade-filter" aria-label="Filter trade markers">
                {(["both", "buy", "sell"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={tradeFilter === filter ? "filter-button selected" : "filter-button"}
                    aria-pressed={tradeFilter === filter}
                    onClick={() => {
                      setTradeFilter(filter);
                      if (selectedTrade && filter !== "both" && selectedTrade.side !== filter) setSelectedTrade(null);
                    }}
                  >
                    {filter === "both" ? "Both" : filter === "buy" ? "Buy" : "Sell"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="bank-chart-hover-value" aria-live="polite">
            {selected
              ? <><strong>{money(selected.v, currency)}</strong><time>{timestamp(selected.t)}</time></>
              : <span>Hover over the chart to inspect a price and timestamp.</span>}
          </div>
          {selectedTrade && (
            <div className={`bank-selected-trade ${selectedTrade.side}`}>
              <span className={`side-badge ${selectedTrade.side === "buy" ? "buy-badge" : "sell-badge"}`}>{selectedTrade.side}</span>
              <strong>{selectedTrade.quantity.toLocaleString("en-US", { maximumFractionDigits: 8 })} {selectedTrade.symbol}</strong>
              <span>at {money(selectedTrade.filledPrice ?? 0, currency)} per unit</span>
              <time dateTime={selectedTrade.createdAt}>{timestamp(selectedTrade.createdAt)}</time>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function BankApiPreview() {
  const [userId, setUserId] = useState(defaultUser);
  const [userDraft, setUserDraft] = useState(defaultUser);
  const [account, setAccount] = useState<Account | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioHistory, setPortfolioHistory] = useState<Series | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [marketMatches, setMarketMatches] = useState<YahooProductMatch[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("VTI");
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [productHistory, setProductHistory] = useState<Series | null>(null);
  const [range, setRange] = useState<Range>("1M");
  const [portfolioRange, setPortfolioRange] = useState<Range>("1M");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [sort, setSort] = useState("name");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const productChartRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);
  const [addingSymbol, setAddingSymbol] = useState("");
  const [message, setMessage] = useState("");
  const [clock, setClock] = useState<Clock | null>(null);
  const [clockDraft, setClockDraft] = useState("");
  const [clockFrozen, setClockFrozen] = useState(false);
  const [isSavingClock, setIsSavingClock] = useState(false);
  // Bumped whenever the server time changes so that every price, valuation, and chart is requested again.
  const [clockVersion, setClockVersion] = useState(0);

  useEffect(() => {
    requestJson<Clock>("/api/admin/clock").then((state) => {
      setClock(state);
      setClockDraft(state.serverTime.slice(0, 16));
      setClockFrozen(state.mode === "frozen");
    }).catch((clockError: unknown) => {
      setError(clockError instanceof Error ? clockError.message : "Could not load the server time.");
    });
  }, []);

  async function saveClock(serverTime: string | null, frozen: boolean) {
    setIsSavingClock(true);
    setError("");
    setMessage("");
    try {
      const state = await requestJson<Clock>("/api/admin/clock", undefined, {
        method: "PUT",
        body: JSON.stringify({ serverTime, frozen }),
      });
      setClock(state);
      setClockDraft(state.serverTime.slice(0, 16));
      setClockFrozen(state.mode === "frozen");
      setClockVersion((version) => version + 1);
      setMessage(serverTime === null ? "The bank is following the real clock again." : `Bank server time set to ${utcTimestamp(state.serverTime)} UTC.`);
    } catch (clockError) {
      setError(clockError instanceof Error ? clockError.message : "Could not update the server time.");
    } finally {
      setIsSavingClock(false);
    }
  }

  function shiftClock(days: number) {
    if (!clock) return;
    void saveClock(new Date(new Date(clock.serverTime).getTime() + days * 86_400_000).toISOString(), clockFrozen);
  }

  const reloadAccount = useCallback(async (targetUserId: string, targetRange: Range) => {
    const [accountData, portfolioData, portfolioChart, orderData] = await Promise.all([
      requestJson<Account>("/api/admin/bank/account", targetUserId),
      requestJson<Portfolio>("/api/admin/bank/portfolio", targetUserId),
      requestJson<Series>(`/api/admin/bank/portfolio/history?range=${targetRange}`, targetUserId),
      requestJson<{ orders: Order[] }>("/api/admin/bank/orders?limit=100", targetUserId),
    ]);
    setAccount(accountData);
    setPortfolio(portfolioData);
    setPortfolioHistory(portfolioChart);
    setOrders(orderData.orders);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setIsLoading(true);
    setError("");
    Promise.all([
      requestJson<Account>("/api/admin/bank/account", userId, { signal: controller.signal }),
      requestJson<Portfolio>("/api/admin/bank/portfolio", userId, { signal: controller.signal }),
      requestJson<Series>(`/api/admin/bank/portfolio/history?range=${portfolioRange}`, userId, { signal: controller.signal }),
      requestJson<{ orders: Order[] }>("/api/admin/bank/orders?limit=100", userId, { signal: controller.signal }),
    ]).then(([accountData, portfolioData, portfolioChart, orderData]) => {
      if (!active) return;
      setAccount(accountData);
      setPortfolio(portfolioData);
      setPortfolioHistory(portfolioChart);
      setOrders(orderData.orders);
    }).catch((loadError: unknown) => {
      if (!active || (loadError instanceof Error && loadError.name === "AbortError")) return;
      setError(loadError instanceof Error ? loadError.message : "Could not load the selected bank account.");
      setAccount(null);
      setPortfolio(null);
      setPortfolioHistory(null);
      setOrders([]);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [userId, portfolioRange, clockVersion]);

  useEffect(() => {
    const params = new URLSearchParams({ sort });
    if (query.trim()) params.set("q", query.trim());
    if (typeFilter) params.set("type", typeFilter);
    if (riskFilter) params.set("risk", riskFilter);
    if (areaFilter) params.set("area", areaFilter);
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsLoadingCatalog(true);
      Promise.all([
        requestJson<{ products: Product[] }>(`/api/admin/bank/products?${params}`, undefined, { signal: controller.signal }),
        requestJson<{ areas: Area[] }>("/api/admin/bank/areas", undefined, { signal: controller.signal }),
      ]).then(([catalog, areaResponse]) => {
        if (!active) return;
        setProducts(catalog.products);
        setAreas(areaResponse.areas);
        setSelectedSymbol((current) => catalog.products.some((product) => product.symbol === current)
          ? current
          : catalog.products[0]?.symbol ?? "");
      }).catch((loadError: unknown) => {
        if (!active || (loadError instanceof Error && loadError.name === "AbortError")) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load the product catalog.");
        setProducts([]);
        setAreas([]);
      }).finally(() => {
        if (active) setIsLoadingCatalog(false);
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, typeFilter, riskFilter, areaFilter, sort, clockVersion]);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      setMarketMatches([]);
      setIsSearchingMarket(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsSearchingMarket(true);
      requestJson<{ products: YahooProductMatch[] }>(
        `/api/admin/bank/product-search?q=${encodeURIComponent(search)}`,
        undefined,
        { signal: controller.signal },
      ).then((result) => {
        if (active) setMarketMatches(result.products);
      }).catch((searchError: unknown) => {
        if (!active || (searchError instanceof Error && searchError.name === "AbortError")) return;
        setMarketMatches([]);
        setError(searchError instanceof Error ? searchError.message : "Could not search market listings.");
      }).finally(() => {
        if (active) setIsSearchingMarket(false);
      });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!selectedSymbol) {
      setProductDetail(null);
      setProductHistory(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    Promise.all([
      requestJson<ProductDetail>(`/api/admin/bank/products/${encodeURIComponent(selectedSymbol)}`, undefined, { signal: controller.signal }),
      requestJson<Omit<Series, "range"> & { range: Range }>(
        `/api/admin/bank/products/${encodeURIComponent(selectedSymbol)}/history?range=${range}`,
        undefined,
        { signal: controller.signal },
      ),
    ]).then(([detail, history]) => {
      if (!active) return;
      setProductDetail(detail);
      setProductHistory(history);
    }).catch((loadError: unknown) => {
      if (!active || (loadError instanceof Error && loadError.name === "AbortError")) return;
      setError(loadError instanceof Error ? loadError.message : `Could not load ${selectedSymbol}.`);
      setProductDetail(null);
      setProductHistory(null);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedSymbol, range, clockVersion]);

  useEffect(() => {
    if (selectedOrder?.symbol === selectedSymbol && productDetail?.symbol === selectedSymbol) {
      productChartRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [productDetail?.symbol, selectedOrder?.symbol, selectedSymbol]);

  async function cancelOrder(order: Order) {
    setError("");
    setMessage("");
    try {
      await requestJson<Order>(`/api/admin/bank/orders/${encodeURIComponent(order.orderId)}`, userId, { method: "DELETE" });
      setMessage(`Order ${order.orderId} cancelled.`);
      await reloadAccount(userId, portfolioRange);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel the order.");
    }
  }

  async function inspectOrder(order: Order) {
    setSelectedOrder(order);
    setSelectedSymbol(order.symbol);
    try {
      const detail = await requestJson<Order>(`/api/admin/bank/orders/${encodeURIComponent(order.orderId)}`, userId);
      setSelectedOrder(detail);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Could not load order details.");
    }
  }

  async function addMarketProduct(match: YahooProductMatch) {
    setAddingSymbol(match.symbol);
    setError("");
    setMessage("");
    try {
      const result = await requestJson<{ product: Product }>(
        "/api/admin/bank/product-search",
        undefined,
        { method: "POST", body: JSON.stringify({ symbol: match.symbol }) },
      );
      const product = {
        ...result.product,
        type: result.product.type.toLowerCase(),
      };
      setProducts((current) => [product, ...current.filter(({ symbol }) => symbol !== product.symbol)]);
      setSelectedSymbol(product.symbol);
      setMessage(`${product.symbol} was added to the investment catalog with current market data.`);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : `Could not add ${match.symbol}.`);
    } finally {
      setAddingSymbol("");
    }
  }

  const currency = account?.currency ?? productDetail?.currency ?? "USD";

  return (
    <section className="bank-preview-section" id="bank-api">
      <div className="bank-preview-heading">
        <div>
          <div className="overline">MOCK BANK API · ADMIN PREVIEW</div>
          <h2>Bank app preview</h2>
          <p>Explore products, portfolio values, price history, and confirmed mock orders.</p>
        </div>
        <form className="bank-user-form" onSubmit={(event) => {
          event.preventDefault();
          const id = userDraft.trim();
          if (id && id.length <= 120) {
            setUserId(id);
            setError("");
            setMessage("");
          } else setError("User ID must be between 1 and 120 characters.");
        }}>
          <label htmlFor="bank-user-id">MOCK USER ID</label>
          <div><input id="bank-user-id" value={userDraft} onChange={(event) => setUserDraft(event.target.value)} maxLength={120} /><button type="submit">Load</button></div>
        </form>
      </div>

      <section className="bank-clock-panel" aria-label="Bank server time">
        <div className="bank-clock-readout">
          <span className="overline">BANK SERVER TIME (UTC)</span>
          <strong>{clock ? utcTimestamp(clock.serverTime) : "—"}</strong>
          <small>
            {clock?.mode === "live" && "Following the real clock"}
            {clock?.mode === "running" && "Simulated time, advancing in real time"}
            {clock?.mode === "frozen" && "Simulated time, frozen"}
            {clock && clock.ordersAfterServerTime > 0 && ` · ${clock.ordersAfterServerTime} order(s) are dated after this time`}
          </small>
        </div>
        <form className="bank-clock-form" onSubmit={(event) => {
          event.preventDefault();
          if (!clockDraft) return;
          void saveClock(new Date(`${clockDraft}:00Z`).toISOString(), clockFrozen);
        }}>
          <input type="datetime-local" aria-label="Server date and time (UTC)" value={clockDraft} onChange={(event) => setClockDraft(event.target.value)} />
          <label><input type="checkbox" checked={clockFrozen} onChange={(event) => setClockFrozen(event.target.checked)} /> Freeze</label>
          <button type="submit" disabled={isSavingClock || !clockDraft}>Set time</button>
          <button type="button" disabled={isSavingClock || !clock} onClick={() => shiftClock(1)}>+1 day</button>
          <button type="button" disabled={isSavingClock || !clock} onClick={() => shiftClock(7)}>+1 week</button>
          <button type="button" disabled={isSavingClock || !clock} onClick={() => shiftClock(30)}>+30 days</button>
          <button type="button" className="secondary" disabled={isSavingClock || clock?.mode === "live"} onClick={() => void saveClock(null, false)}>Use real clock</button>
        </form>
        <small className="bank-clock-note">All quotes, orders, and valuations use this time. Prices come from a stored Yahoo Finance snapshot and never run past the latest available data.</small>
      </section>

      <div className="bank-preview-notice">
        <strong>Mock admin mode.</strong> User IDs are identifiers, not authentication. Do not use this preview with real customer data.
      </div>
      {error && <div className="form-message error-message" role="alert">{error}</div>}
      {message && <div className="bank-success-message" role="status">{message}</div>}

      <div className="bank-metrics-grid">
        <article className="summary-card balance-card"><div className="summary-top"><span>CASH BALANCE</span><span>◈</span></div><strong>{isLoading || !account ? "—" : money(account.cashBalance, currency)}</strong><div className="summary-foot">As of {account ? timestamp(account.asOf) : "—"}</div></article>
        <article className="summary-card"><div className="summary-top"><span>PORTFOLIO VALUE</span><span>▤</span></div><strong>{isLoading || !portfolio ? "—" : money(portfolio.totals.totalValue, currency)}</strong><div className="summary-foot">Cash plus current market value</div></article>
        <article className="summary-card"><div className="summary-top"><span>UNREALIZED P/L</span><span>↗</span></div><strong className={portfolio && portfolio.totals.unrealizedPL < 0 ? "negative" : "positive"}>{isLoading || !portfolio ? "—" : money(portfolio.totals.unrealizedPL, currency)}</strong><div className="summary-foot">{portfolio ? percent(portfolio.totals.unrealizedPLPercent) : "Current holdings"}</div></article>
      </div>

      <div className="bank-two-column">
        <section className="bank-panel">
          <div className="bank-panel-heading"><div><h3>Portfolio holdings</h3><p>Current prices and server-calculated valuations</p></div></div>
          {isLoading ? <div className="bank-empty">Loading portfolio…</div> : !portfolio?.holdings.length
            ? <div className="bank-empty">No open holdings for this mock account.</div>
            : <div className="bank-table-scroll"><table className="activity-table bank-table">
              <thead><tr><th>ASSET</th><th>QUANTITY</th><th>HELD</th><th>AVG COST</th><th>PRICE</th><th>VALUE</th><th>P/L</th><th>WEIGHT</th></tr></thead>
              <tbody>{portfolio.holdings.map((holding) => <tr key={holding.symbol} onClick={() => setSelectedSymbol(holding.symbol)}>
                <td><strong>{holding.symbol}</strong><small>{holding.name}</small></td>
                <td>{holding.quantity.toLocaleString("en-US", { maximumFractionDigits: 6 })}</td>
                <td>{holding.heldDays === null ? "—" : `${holding.heldDays}d`}{holding.boughtAt && <small>since {timestamp(holding.boughtAt)}</small>}</td>
                <td>{money(holding.avgCost, currency)}</td><td>{money(holding.currentPrice, currency)}</td>
                <td className="amount-cell">{money(holding.marketValue, currency)}</td>
                <td className={holding.unrealizedPL >= 0 ? "positive" : "negative"}>{money(holding.unrealizedPL, currency)}<small>{percent(holding.unrealizedPLPercent)}</small></td>
                <td>{holding.weightPercent.toFixed(2)}%</td>
              </tr>)}</tbody>
            </table></div>}
        </section>

        <section className="bank-panel">
          <div className="bank-panel-heading"><div><h3>Portfolio value history</h3><p>Replayed orders and historical market prices</p></div>
            <div className="range-tabs" aria-label="Portfolio history range">{ranges.map((item) => <button key={item} type="button" className={portfolioRange === item ? "active" : ""} onClick={() => setPortfolioRange(item)}>{item}</button>)}</div>
          </div>
          <PriceSeriesChart series={portfolioHistory} currency={currency} title="Portfolio value" />
        </section>
      </div>

      <section className="bank-panel bank-products-panel">
        <div className="bank-panel-heading"><div><h3>Browse investments</h3><p>Current market prices and product information</p></div></div>
        <div className="product-filters">
          <input aria-label="Search investments" placeholder="Search catalog and all markets…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select aria-label="Filter by type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">All types</option><option value="stock">Stocks</option><option value="fund">Funds / ETFs</option><option value="bond">Bonds</option><option value="crypto">Crypto</option></select>
          <select aria-label="Filter by risk" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}><option value="">All risk levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
          <select aria-label="Filter by area" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}><option value="">All areas</option>{areas.map(({ area }) => <option key={area} value={area}>{area}</option>)}</select>
          <select aria-label="Sort products" value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Name</option><option value="price">Price</option><option value="dayChangePercent">Daily change</option><option value="return1Y">1Y return</option><option value="risk">Risk</option></select>
        </div>
        {query.trim().length >= 2 && (
          <div className="market-search-results" aria-live="polite">
            <div className="market-search-heading">
              <strong>Search all Yahoo Finance listings</strong>
              <span>{isSearchingMarket ? "Searching…" : `${marketMatches.length} supported matches`}</span>
            </div>
            {isSearchingMarket ? <div className="bank-empty market-search-empty">Searching stocks, funds, bonds, and crypto…</div>
              : marketMatches.length === 0 ? <div className="bank-empty market-search-empty">No supported listings found for “{query.trim()}”.</div>
                : <div className="market-match-list">{marketMatches.map((match) => {
                  return (
                    <div className="market-match" key={`${match.symbol}-${match.exchange}`}>
                      <span className="market-match-symbol">{match.symbol}</span>
                      <span className="market-match-info"><strong>{match.name}</strong><small>{match.type.toLowerCase()} · {match.exchange}</small></span>
                      <button
                        type="button"
                        disabled={addingSymbol === match.symbol}
                        onClick={() => {
                          if (!match.inCatalog) {
                            void addMarketProduct(match);
                            return;
                          }
                          setQuery(match.symbol);
                          setTypeFilter("");
                          setRiskFilter("");
                          setAreaFilter("");
                          setSelectedSymbol(match.symbol);
                        }}
                      >
                        {addingSymbol === match.symbol ? "Adding…" : match.inCatalog ? "Open" : "Add to catalog"}
                      </button>
                    </div>
                  );
                })}</div>}
            <small className="market-search-disclaimer">Search results come from Yahoo Finance. Some symbols may not have chart data in Yahoo’s price feed.</small>
          </div>
        )}
        <div className="bank-catalog-layout">
          <div className="bank-product-list">
            {isLoadingCatalog ? <div className="bank-empty">Loading catalog and live prices…</div>
              : products.length === 0 ? <div className="bank-empty">No products match these filters.</div>
                : products.map((product) => <button key={product.symbol} type="button" className={`bank-product-card ${selectedSymbol === product.symbol ? "selected" : ""}`} onClick={() => setSelectedSymbol(product.symbol)}>
                  <span className="product-card-top"><strong>{product.symbol}</strong><i className={`risk-${product.risk}`}>{product.risk}</i></span>
                  <span className="product-name">{product.name}</span>
                  <span className="product-price">{money(product.currentPrice, product.currency)} <i className={product.dayChangePercent >= 0 ? "positive" : "negative"}>{percent(product.dayChangePercent)}</i></span>
                  <span className="product-meta">{product.area} · {product.type}</span>
                </button>)}
          </div>

          <div className="bank-product-detail">
            {!productDetail ? <div className="bank-empty">Select a product to view details and place a mock order.</div> : <>
              <div className="bank-detail-heading"><div><span className="overline">{productDetail.type} · {productDetail.area}</span><h3>{productDetail.name} <small>{productDetail.symbol}</small></h3><p>{productDetail.description}</p></div>
                <strong>{money(productDetail.currentPrice, productDetail.currency)}<small className={productDetail.dayChangePercent >= 0 ? "positive" : "negative"}>{percent(productDetail.dayChangePercent)} today</small></strong>
              </div>
              <div className="product-stat-grid">
                <span>Risk <strong>{productDetail.risk}</strong></span><span>52-week high <strong>{money(productDetail.high52w, currency)}</strong></span><span>52-week low <strong>{money(productDetail.low52w, currency)}</strong></span>
                <span>Volatility <strong>{productDetail.volatilityPercent === null ? "N/A" : `${productDetail.volatilityPercent.toFixed(2)}%`}</strong></span><span>Max drawdown <strong>{productDetail.maxDrawdownPercent.toFixed(2)}%</strong></span><span>Dividend yield <strong>{productDetail.dividendYieldPercent.toFixed(2)}%</strong></span>
              </div>
              <div className="product-facts">
                <span>Issuer <strong>{productDetail.issuer}</strong></span>
                <span>Region <strong>{productDetail.region}</strong></span>
                {productDetail.size !== null && <span>Fund / market size <strong>{money(productDetail.size, currency)}</strong></span>}
                {productDetail.inceptionDate && <span>Inception <strong>{productDetail.inceptionDate}</strong></span>}
              </div>
              {productDetail.topHoldings && productDetail.topHoldings.length > 0 && (
                <div className="top-holdings-list"><strong>Top holdings</strong>{productDetail.topHoldings.map((holding) => <span key={holding.name}>{holding.name}<b>{holding.weightPercent.toFixed(1)}%</b></span>)}</div>
              )}
              <div className="return-chips">{Object.entries(productDetail.returns).map(([period, value]) => <span key={period}>{period} <strong className={value >= 0 ? "positive" : "negative"}>{percent(value)}</strong></span>)}</div>
              <div ref={productChartRef} className="bank-product-chart">
                <div className="bank-chart-controls" aria-label="Product price history range">{ranges.map((item) => <button key={item} type="button" className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div>
                <PriceSeriesChart
                  key={`${userId}-${productDetail.symbol}`}
                  series={productHistory}
                  currency={productDetail.currency}
                  title={`${productDetail.symbol} price history`}
                  orders={portfolio?.holdings.some((holding) => holding.symbol === productDetail.symbol)
                    ? orders.filter((order) => order.symbol === productDetail.symbol)
                    : []}
                />
              </div>
              <div className="bank-risk-note"><strong>Risk note:</strong> {productDetail.riskNote} This information is not personalized financial advice.</div>
            </>}
          </div>
        </div>
      </section>

      <section className="bank-panel bank-orders-panel">
        <div className="bank-panel-heading"><div><h3>Order history</h3><p>Latest orders for {userId}</p></div></div>
        {orders.length === 0 ? <div className="bank-empty">{isLoading ? "Loading orders…" : "No orders recorded for this account."}</div>
          : <div className="bank-table-scroll"><table className="activity-table bank-table">
            <thead><tr><th>ORDER</th><th>ASSET</th><th>SIDE</th><th>QUANTITY</th><th>FILL PRICE</th><th>STATUS</th><th>TIME</th><th></th></tr></thead>
            <tbody>{orders.map((order) => <tr key={order.orderId} className={selectedOrder?.orderId === order.orderId ? "selected-history-row" : ""} onClick={() => void inspectOrder(order)}>
              <td title={order.orderId}>{order.orderId.slice(0, 12)}</td><td><strong>{order.symbol}</strong></td><td><span className={`side-badge ${order.side === "buy" ? "buy-badge" : "sell-badge"}`}>{order.side}</span></td>
              <td>{order.quantity.toLocaleString("en-US", { maximumFractionDigits: 8 })}</td><td>{order.filledPrice === null ? "—" : money(order.filledPrice, currency)}</td><td><span className={`order-status status-${order.status}`}>{order.status}</span></td><td>{timestamp(order.createdAt)}</td>
              <td>{order.status === "pending" && <button type="button" className="text-button" onClick={(event) => { event.stopPropagation(); void cancelOrder(order); }}>Cancel</button>}</td>
            </tr>)}</tbody>
          </table></div>}
        {selectedOrder && <div className="order-detail-strip"><strong>Order details</strong><span>{selectedOrder.orderId}</span><span>{selectedOrder.filledQuantity} filled</span><span>Price as of {selectedOrder.asOf ? timestamp(selectedOrder.asOf) : "not filled"}</span></div>}
      </section>
      <div className="bank-preview-footer">Prices come from a Yahoo Finance snapshot stored by the bank and are shown as of the bank server time.</div>
    </section>
  );
}
