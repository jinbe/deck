// Reject CLI argument values that could be smuggled in as flags (leading dash),
// so a crafted model/provider can't inject options into the spawned agent.
export function isFlagSafe(value: string | undefined): boolean {
	return !!value && !value.startsWith('-');
}
