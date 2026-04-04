import type { ServerNode } from '@matter/main';

/** Log QR code and manual pairing code to console after Matter server starts. */
export function logPairingInfo(node: ServerNode): void {
  const { pairingCodes } = node.state.commissioning;

  console.log();
  console.log('┌──────────────────────────────────┐');
  console.log('│       Matter Pairing Info         │');
  console.log('└──────────────────────────────────┘');
  console.log();
  console.log(`  QR Code:      ${pairingCodes.qrPairingCode}`);
  console.log(`  Manual Code:  ${pairingCodes.manualPairingCode}`);
  console.log();
  console.log('  Pair with Apple Home, Google Home, or Alexa using the code above.');
  console.log();
}
