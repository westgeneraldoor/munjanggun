export function getOptimalCols(count: number): number {
  if (count <= 0) return 1
  if (count <= 3) return count
  if (count === 4) return 2
  if (count <= 6) return 3
  return 4
}
