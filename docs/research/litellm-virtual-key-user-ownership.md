# LiteLLM virtual-key user ownership

Research date: 2026-10-28

## Findings

- A proxy-admin-created key has no owner unless `user_id` is passed to `POST /key/generate`. Supplying `user_id` makes that LiteLLM user the key owner. LiteLLM documents this explicitly in [Virtual Keys](https://docs.litellm.ai/docs/proxy/virtual_keys#what-a-key-inherits-from-its-owner).
- LiteLLM's own user-management examples create a user with `POST /user/new` and a supplied `user_id`, then create further keys for that user by supplying the same `user_id` to `POST /key/generate`. See [Users: create a user and a key for it](https://github.com/BerriAI/litellm-docs/blob/main/docs/proxy/users.md#team-members) and [Virtual Keys](https://docs.litellm.ai/docs/proxy/virtual_keys#what-a-key-inherits-from-its-owner).
- The public API exposes `GET /user/info`, `POST /user/new`, `POST /key/generate`, and `POST /key/delete`; all are listed in the [LiteLLM API reference](https://docs.litellm.ai/api-reference). The QuickStack adapter's `URLSearchParams({ user_id })` is the correct standard encoding for the `user_id` query value.
- The official documentation supports lookup by LiteLLM `user_id`; it does not describe a separate generic `custom_tag` lookup field. Therefore QuickStack should treat a sandbox custom tag as the LiteLLM `user_id`, not search an arbitrary tag property.
- `POST /key/delete` accepts a key list in QuickStack's generated OpenAPI type (`KeyRequest`), matching LiteLLM's published key-management endpoint. Deleting a key is independent of deleting its owning user; this proposal should retain LiteLLM users so later sandboxes with the same custom tag reuse that identity.

## Design impact

For a tagged sandbox, use the normalized custom tag as `user_id`:

1. `GET /user/info?user_id=<URL-encoded-custom-tag>`.
2. If absent, `POST /user/new` with that `user_id` and `auto_create_key: false`.
3. `POST /key/generate` with both `models` and that `user_id`.

The exact not-found HTTP status and any concurrent-create conflict behavior are not guaranteed by the cited public docs. QuickStack must handle a lookup miss and a conflicting `user/new` defensively, e.g. retry the lookup after an already-exists response.