import type { DocumentDecoration } from 'elysia';

/**
 * Operation metadata that carries both the public OpenAPI description and the
 * MCP-specific description used by the operation registry.
 *
 * `x-mcp-description` is a valid OpenAPI vendor extension, so the generated
 * document stays valid while MCP receives the agent-oriented text.
 */
export type ApiOperationDetail = DocumentDecoration & {
    'x-mcp-description'?: string;
};

type DescriptionSource = {
    description?: string;
    'x-mcp-description'?: string;
};

export class ApiOperationDetailUtils {

    /** Widens the Elysia detail type so routes can declare the MCP override. */
    static create(detail: ApiOperationDetail): DocumentDecoration {
        return detail;
    }

    /** MCP uses the override when present, otherwise the public description. */
    static mcpDescription(detail: DescriptionSource | undefined): string | undefined {
        return detail?.['x-mcp-description'] ?? detail?.description;
    }
}
