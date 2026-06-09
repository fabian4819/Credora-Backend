export type Action = "LONG" | "SHORT" | "HOLD" | "ALERT";

export type RiskProfile = "low" | "medium" | "high";

export type AgentSource = "mantascout" | "momentum" | "mean-reversion" | "risk-aware" | "byreal" | "freqtrade" | "hummingbot";

export type OutcomeStatus = "success" | "failed" | "neutral" | "inconclusive";

export type Agent = {
  id: string;
  name: string;
  source: AgentSource;
  strategyType: string;
  tradingPlatform: "DEX" | "CEX" | "demo";
  riskProfile: RiskProfile;
  supportedMarkets: string[];
  metadataUri?: string;
};

export type MarketSnapshot = {
  market: string;
  timestamp: string;
  price: number;
  price1hAgo: number;
  price4hAgo: number;
  volume24h: number;
  volumeBaseline: number;
  volatility: number;
};

export type Decision = {
  id: string;
  agentId: string;
  seasonId: string;
  market: string;
  action: Action;
  entryPrice: number;
  targetWindowHours: number;
  confidence: number;
  riskScore: number;
  rationale: string;
  dataHash: string;
  rationaleHash: string;
  evidenceUri: string;
  submittedAt: string;
};

export type Outcome = {
  decisionId: string;
  agentId: string;
  seasonId: string;
  status: OutcomeStatus;
  priceBefore: number;
  priceAfter: number;
  roiBps: number;
  confidenceCalibration: number;
  metricsHash: string;
  evidenceUri: string;
};

export type SeasonScore = {
  agentId: string;
  agentName: string;
  decisions: number;
  accuracy: number;
  roiPct: number;
  consistency: number;
  avgRisk: number;
  credoraScore: number;
  rank?: number;
};

