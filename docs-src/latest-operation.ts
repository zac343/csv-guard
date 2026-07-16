export function createLatestOperation() {
  let revision = 0;

  return {
    begin() {
      revision += 1;
      return revision;
    },
    invalidate() {
      revision += 1;
    },
    isCurrent(candidate: number) {
      return candidate === revision;
    },
  };
}
