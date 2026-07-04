package proxy

import (
	"context"
	"net/url"

	"github.com/yourorg/agent-auth-proxy/internal/auth"
)

type claimsKey struct{}
type forwardedKey struct{}

func WithClaims(ctx context.Context, c *auth.AgentClaims) context.Context {
	return context.WithValue(ctx, claimsKey{}, c)
}

func ClaimsFromContext(ctx context.Context) *auth.AgentClaims {
	c, _ := ctx.Value(claimsKey{}).(*auth.AgentClaims)
	return c
}

func WithForwardedURL(ctx context.Context, u *url.URL) context.Context {
	return context.WithValue(ctx, forwardedKey{}, u)
}

func ForwardedURLFromContext(ctx context.Context) *url.URL {
	u, _ := ctx.Value(forwardedKey{}).(*url.URL)
	return u
}
