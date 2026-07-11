import { describe, expect, test } from "vitest";
import { matchSecrets, shannonEntropy } from "./rules";
import {
  CLEAN_LINE,
  FAKE_AWS_KEY,
  FAKE_CREDENTIAL_ASSIGNMENT,
  FAKE_GH_TOKEN,
  FAKE_PRIVATE_KEY,
  FAKE_STRIPE_KEY,
} from "../fixtures/secrets";

describe("shannonEntropy", () => {
  test("empty string is zero", () => {
    expect(shannonEntropy("")).toBe(0);
  });
  test("uniform repetition is low", () => {
    expect(shannonEntropy("aaaaaaaa")).toBe(0);
  });
  test("varied string is high", () => {
    expect(shannonEntropy("Xq7Rt9Zp2Lk4Wm8V")).toBeGreaterThan(3.5);
  });
});

describe("matchSecrets", () => {
  test("detects an AWS access key id", () => {
    const hits = matchSecrets(`const k = "${FAKE_AWS_KEY}";`);
    expect(hits.map((h) => h.rule.id)).toContain("aws-access-key-id");
  });

  test("detects a GitHub token", () => {
    const hits = matchSecrets(`token: ${FAKE_GH_TOKEN}`);
    expect(hits.map((h) => h.rule.id)).toContain("github-token");
  });

  test("detects a Stripe live key", () => {
    const hits = matchSecrets(FAKE_STRIPE_KEY);
    expect(hits.map((h) => h.rule.id)).toContain("stripe-secret-key");
  });

  test("detects a private key header", () => {
    const hits = matchSecrets(FAKE_PRIVATE_KEY);
    expect(hits.map((h) => h.rule.id)).toContain("private-key");
  });

  test("detects a high-entropy credential assignment", () => {
    const hits = matchSecrets(FAKE_CREDENTIAL_ASSIGNMENT);
    expect(hits.map((h) => h.rule.id)).toContain(
      "generic-credential-assignment",
    );
  });

  test("does not flag a low-entropy credential assignment", () => {
    const hits = matchSecrets('password = "aaaaaaaaaaaaaaaaaaaa"');
    expect(hits.map((h) => h.rule.id)).not.toContain(
      "generic-credential-assignment",
    );
  });

  test("clean code produces no findings", () => {
    expect(matchSecrets(CLEAN_LINE)).toHaveLength(0);
  });

  test("reports the line number of the match", () => {
    const hits = matchSecrets(`line one\nconst k = "${FAKE_AWS_KEY}";`);
    const aws = hits.find((h) => h.rule.id === "aws-access-key-id");
    expect(aws?.lineNumber).toBe(2);
  });
});
