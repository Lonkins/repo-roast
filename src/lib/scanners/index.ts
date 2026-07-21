import type { Scanner } from "../engine/types";
import { secretsScanner } from "./secrets";
import { workflowsScanner } from "./workflows";
import { depsScanner } from "./deps";
import { slopsquatScanner } from "./slopsquat";
import { exposureScanner } from "./exposure";
import { agentsScanner } from "./agents";
import { hygieneScanner } from "./hygiene";

/** The full deterministic scanner set, in report display order. */
export const allScanners: Scanner[] = [
  secretsScanner,
  workflowsScanner,
  depsScanner,
  slopsquatScanner,
  exposureScanner,
  agentsScanner,
  hygieneScanner,
];
