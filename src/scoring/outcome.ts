import type { Decision, Outcome } from "../types/domain.js";
import { sha256Hex } from "./hash.js";

export function calculateOutcome(decision: Decision, exitPrice: number): Outcome {
  const priceMove = (exitPrice - decision.entryPrice) / decision.entryPrice;
  const signedReturn = decision.action === "SHORT" ? -priceMove : decision.action === "LONG" ? priceMove : 0;
  const roiBps = Math.round(signedReturn * 10_000);

  let status: Outcome["status"] = "neutral";
  if (decision.action === "ALERT") {
    status = Math.abs(priceMove) >= 0.015 ? "success" : "neutral";
  } else if (decision.action === "HOLD") {
    status = Math.abs(priceMove) <= 0.01 ? "success" : "neutral";
  } else if (roiBps > 25) {
    status = "success";
  } else if (roiBps < -25) {
    status = "failed";
  }

  const realized = status === "success" ? 100 : status === "failed" ? 0 : 50;
  const confidenceCalibration = Math.max(0, 100 - Math.abs(decision.confidence - realized));
  const metrics = {
    decisionId: decision.id,
    priceBefore: decision.entryPrice,
    priceAfter: exitPrice,
    roiBps,
    status,
    confidenceCalibration
  };

  return {
    decisionId: decision.id,
    agentId: decision.agentId,
    seasonId: decision.seasonId,
    status,
    priceBefore: decision.entryPrice,
    priceAfter: exitPrice,
    roiBps,
    confidenceCalibration,
    metricsHash: sha256Hex(metrics),
    evidenceUri: `memory://outcomes/${decision.id}`
  };
}

