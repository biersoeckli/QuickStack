# Keep Cluster Add-on implementations self-contained

QuickStack registers only trusted, code-defined Cluster Add-ons. Each Add-on owns its manifest source, configuration, Kubernetes installation and status checks while satisfying a shared lifecycle contract; this permits fixed releases such as Agent Sandbox and externally catalogued releases such as Longhorn without a generic manifest or configuration engine.
