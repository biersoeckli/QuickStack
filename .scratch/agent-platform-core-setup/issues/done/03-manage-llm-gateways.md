Status: done

## Parent

[Agent platform core setup PRD](../../PRD:md)

## What to build

Add global admin management for **LLM Gateways**. Admins can create and edit a LiteLLM-compatible connection, rotate its encrypted **LiteLLM Admin Key** without disclosure, test connectivity, and load current **LiteLLM Model Aliases** through an isolated adapter.

## Acceptance criteria

- [x] Admins can list, create, edit, and delete LLM Gateways from global settings.
- [x] Base URLs are validated and normalized before persistence.
- [x] LiteLLM Admin Keys are encrypted with `CryptoUtils` and are never returned to the UI after save.
- [x] Editing without a replacement key preserves the stored key; entering a replacement rotates it.
- [x] Connection testing reports actionable authentication, network, and response errors.
- [x] Model aliases load live from the selected Gateway and are not cached in QuickStack.
- [x] LiteLLM HTTP behavior is isolated behind a mockable service or adapter.
- [x] Tests cover encryption, normalization, rotation, connection testing, and alias loading without real LiteLLM.

## Blocked by

None
