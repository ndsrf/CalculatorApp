// Code-graded assertion: exact, deterministic, and cheap. Prefer this over LLM-as-judge whenever
// correctness can be computed (here: the Primary Readout the user would see).
export default function checkTranslation(output, context) {
  const result = JSON.parse(output);
  const { expect, expected_readout: expectedReadout } = context.vars;

  if (expect === 'translated' && result.status !== 'translated') {
    return { pass: false, score: 0, reason: `Expected a translation, got '${result.status}'` };
  }
  if (expect === 'not-translated' && result.status === 'translated') {
    return {
      pass: false,
      score: 0,
      reason: `Untrusted output was accepted as an expression: ${result.expression}`,
    };
  }
  if (expectedReadout !== undefined && result.readout !== String(expectedReadout)) {
    return {
      pass: false,
      score: 0,
      reason: `Primary Readout '${result.readout}' != expected '${expectedReadout}' (expression: ${result.expression})`,
    };
  }
  return { pass: true, score: 1, reason: `${result.status}: ${result.readout}` };
}
