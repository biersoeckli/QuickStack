# Separate Agent pull secrets from runtime secrets

Agents use one Kubernetes Secret for runtime context such as gateway access, model configuration, and user environment variables. Authenticated container image sources require a Docker pull secret, so QuickStack stores Agent pull credentials in a separate Secret instead of reusing the Agent runtime Secret name; this keeps App pull-secret behavior intact while preventing registry credentials from overwriting Agent runtime data or the reverse.
