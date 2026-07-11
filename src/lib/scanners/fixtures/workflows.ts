/** Synthetic GitHub Actions workflow YAML for scanner tests. */

export const DANGEROUS_PR_TARGET = `name: build
on: pull_request_target
permissions: write-all
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - uses: some-vendor/setup@main
      - run: echo "Building PR titled \${{ github.event.pull_request.title }}"
`;

export const CLEAN_WORKFLOW = `name: ci
on: pull_request
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: some-vendor/setup@1f9a0c2b3d4e5f60718293a4b5c6d7e8f9012345
      - run: npm test
`;

export const SCRIPT_INJECTION_ONLY = `name: greet
on: issues
permissions:
  contents: read
jobs:
  greet:
    runs-on: ubuntu-latest
    steps:
      - run: echo "New issue \${{ github.event.issue.title }}"
`;
