/**
 * Test and fixture files contain the very patterns the content scanners look
 * for — as test data, never as deployed code. A `dangerouslyAllowBrowser` in a
 * `.test.ts` isn't a real client-side key leak. The exposure and agents
 * scanners skip these paths so a repo's own tests don't trip its scanners.
 */

const TEST_FILE_RE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const TEST_DIR_RE = /(^|\/)(__tests__|__mocks__|fixtures?)\//;

export function isTestOrFixturePath(path: string): boolean {
  return TEST_FILE_RE.test(path) || TEST_DIR_RE.test(path);
}
