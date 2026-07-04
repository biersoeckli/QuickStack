package main

import (
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/go-chi/chi/v5"

	"github.com/yourorg/agent-auth-proxy/internal/auth"
	"github.com/yourorg/agent-auth-proxy/internal/proxy"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	rp := proxy.New()

	r := chi.NewRouter()
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	r.HandleFunc("/*", handleRequest(rp))

	log.Printf("agent auth proxy listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

// handleRequest mirrors the Bun implementation's handleRequest(): query-token
// to session-cookie exchange, cookie verification, then proxying.
// (Identical logic to the extended version - just without activity tracking
// or the reaper wiring.)
func handleRequest(rp http.Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		forwardedURI := auth.ForwardedURI(r)
		forwardedURL, err := auth.ParseForwardedURL(forwardedURI)
		if err != nil {
			http.Error(w, "Bad Request", http.StatusBadRequest)
			return
		}

		if token := forwardedURL.Query().Get("token"); token != "" {
			claims, err := auth.VerifyAccessToken(token)
			if err != nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			sessionToken, err := auth.CreateSessionToken(claims)
			if err != nil {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			q := forwardedURL.Query()
			q.Del("token")
			forwardedURL.RawQuery = q.Encode()

			location := auth.ExternalOrigin(r) + forwardedURL.EscapedPath()
			if forwardedURL.RawQuery != "" {
				location += "?" + forwardedURL.RawQuery
			}
			if forwardedURL.Fragment != "" {
				location += "#" + forwardedURL.EscapedFragment()
			}

			http.SetCookie(w, auth.SessionCookie(sessionToken, r))
			w.Header().Set("Location", location)
			w.WriteHeader(http.StatusFound)
			return
		}

		cookie, err := r.Cookie(auth.CookieName)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		claims, err := auth.VerifySessionToken(cookie.Value)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		serve(w, r, rp, claims, forwardedURL)
	}
}

func serve(w http.ResponseWriter, r *http.Request, rp http.Handler, claims *auth.AgentClaims, forwardedURL *url.URL) {
	ctx := proxy.WithClaims(r.Context(), claims)
	ctx = proxy.WithForwardedURL(ctx, forwardedURL)
	rp.ServeHTTP(w, r.WithContext(ctx))
}
