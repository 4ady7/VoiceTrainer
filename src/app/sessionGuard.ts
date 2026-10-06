export function canCommitTurn(capturedEpoch: number, currentEpoch: number, screen: string): boolean {
  return capturedEpoch === currentEpoch && screen === 'simulation'
}
