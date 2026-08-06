# FindIt Launch-Scope Exclusions

The following capabilities are excluded from the production MVP unless separately certified and explicitly removed from this document:

- phone signup and SMS OTP;
- Apple OAuth;
- payments, wallets, credits, subscriptions and advertising;
- public reputation, seller ratings, trust scores, verified badges and response-time badges;
- push notifications unless VAPID, subscription lifecycle and privacy tests pass;
- any market publishing outside the approved launch market;
- any unfinished feature flag or placeholder flow.

Release requirements:

- excluded features must be disabled in UI, routes, server configuration, feature flags and marketing;
- disabled capabilities must fail closed;
- no provider credential should be configured for an excluded feature;
- re-enabling any item requires its own security, privacy, hosted acceptance and rollback evidence.
