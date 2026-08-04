package main

import (
	"encoding/json"
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

		token := forwardedURL.Query().Get("token")
		debugMode := os.Getenv("AUTH_PROXY_DEBUG_ENABLED") == "true" && token != ""
		if token != "" {
			claims, err := auth.VerifyAccessToken(token)
			if err != nil {
				unauthorized(w, r, forwardedURL, auth.StageForAccessTokenError(err), err, debugMode)
				return
			}
			sessionToken, err := auth.CreateSessionToken(claims)
			if err != nil {
				if debugMode {
					unauthorized(w, r, forwardedURL, "session_creation_failed", err, true)
					return
				}
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}
			if err := auth.ConsumeAccessToken(claims); err != nil {
				unauthorized(w, r, forwardedURL, "access_token_replayed", err, debugMode)
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

func unauthorized(w http.ResponseWriter, r *http.Request, forwardedURL *url.URL, stage string, err error, debugMode bool) {
	if !debugMode {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	report := auth.BuildDebugReport(r, forwardedURL, stage, err)
	encoded, marshalErr := json.Marshal(report)
	if marshalErr != nil {
		log.Printf("auth proxy debug report serialization failed: %v", marshalErr)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	log.Printf("%s", encoded)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"error":"unauthorized","debug":`))
	_, _ = w.Write(encoded)
	_, _ = w.Write([]byte("}"))
}

func serve(w http.ResponseWriter, r *http.Request, rp http.Handler, claims *auth.AgentClaims, forwardedURL *url.URL) {
	ctx := proxy.WithClaims(r.Context(), claims)
	ctx = proxy.WithForwardedURL(ctx, forwardedURL)
	rp.ServeHTTP(w, r.WithContext(ctx))
}
