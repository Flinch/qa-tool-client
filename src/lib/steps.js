// Test case steps are rendered inside an <ol>, which numbers them on its own.
// Older/AI-generated steps sometimes carry their own leading "1.", "2)",
// "Step 3:" prefix too, which then shows up doubled ("1. 1. Do the thing").
// Strip it for display rather than mutating stored data.
export function formatStep(step) {
  return step.replace(/^\s*(?:step\s*)?\d+[.):]\s*/i, '')
}
