# Use SandboxClaim with zero-replica warm pools for Agents

QuickStack Agents use the full Agent Sandbox extension flow: an Agent definition owns a `SandboxTemplate`, startup creates a `SandboxClaim`, and the claim targets a per-Agent `SandboxWarmPool`. In Phase 1 the warm pool uses `replicas: 0` so QuickStack keeps the Claim/Template/WarmPool model without paying for pre-warmed idle sandboxes; warm pools can later be raised above zero when faster startup matters more than idle cost.
