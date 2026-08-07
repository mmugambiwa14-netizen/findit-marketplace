# WP-02 proof-chain follow-up

Status: **PARTIAL until CI reruns**

The first WP-04 run exposed four repository-proof defects unrelated to the MFA logic:

1. the trace infrastructure contract still required direct `sessionStorage` access after F-058 routed storage through the guarded abstraction;
2. the migration certification count remained 37 after adding the 38th pgTAP suite;
3. buyer certification normalized the lockfile after setup-node cache resolution rather than before it;
4. the workflow pin verifier ignored ordinary YAML list syntax (`- uses:`), allowing several mutable action tags to escape inspection.

Repairs:

- require guarded browser-storage calls and prohibit direct `sessionStorage` in the trace contract;
- require the new MFA suite and count all 38 migration suites;
- normalize the buyer lockfile before setup-node in both jobs;
- recognize inline YAML action-list syntax;
- pin every action reference exposed by the stronger verifier to the existing approved immutable SHA allowlist.

No security control or failing product contract was removed.
