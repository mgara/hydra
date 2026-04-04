/** Called by the setup endpoint after setup completes — transitions to full operational mode */
declare function transitionToOperational(): Promise<void>;
/** Called by the reset endpoint — transitions back to setup mode */
declare function transitionToSetup(): Promise<void>;
export { transitionToOperational, transitionToSetup };
//# sourceMappingURL=index.d.ts.map