package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/yourorg/agent-auth-proxy/internal/auth"
)

type debugResponse struct {
	Error string `json:"error"`
	Debug struct {
		Stage           string `json:"stage"`
		RequestWasHTTPS bool   `json:"requestWasHttps"`
	} `json:"debug"`
}

func signedAccessToken(t *testing.T, secret, id string, expiresAt time.Time) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, auth.AgentClaims{
		AgentID: "agent-1", ClaimID: "claim-1", Namespace: "project-1",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer: auth.Issuer, ID: id, IssuedAt: jwt.NewNumericDate(time.Now()), ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	})
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return tokenString
}

func TestUnauthorizedWithoutTokenHasNoDebugResponse(t *testing.T) {
	t.Setenv("AUTH_PROXY_DEBUG_ENABLED", "true")
	rec := httptest.NewRecorder()
	handleRequest(http.NotFoundHandler()).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
	if rec.Header().Get("Content-Type") == "application/json" {
		t.Fatal("response unexpectedly contains debug JSON")
	}
}

func TestInvalidTokenWithoutDebugFlagHasNoDebugResponse(t *testing.T) {
	t.Setenv("AUTH_PROXY_DEBUG_ENABLED", "false")
	rec := httptest.NewRecorder()
	handleRequest(http.NotFoundHandler()).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/?token=invalid", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
	if rec.Header().Get("Content-Type") == "application/json" {
		t.Fatal("response unexpectedly contains debug JSON")
	}
}

func TestDebugResponseForInvalidToken(t *testing.T) {
	t.Setenv("AUTH_PROXY_DEBUG_ENABLED", "true")
	rec := httptest.NewRecorder()
	handleRequest(http.NotFoundHandler()).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/?token=invalid", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
	var response debugResponse
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("decode debug response: %v", err)
	}
	if response.Debug.Stage != "access_token_parse_error" {
		t.Fatalf("stage = %q, want access_token_parse_error", response.Debug.Stage)
	}
}

func TestDebugResponseForExpiredTokenIncludesHTTPHint(t *testing.T) {
	t.Setenv("AUTH_PROXY_DEBUG_ENABLED", "true")
	t.Setenv("AGENT_JWT_SECRET", "test-secret")
	token := signedAccessToken(t, "test-secret", "expired-debug-token", time.Now().Add(-time.Minute))
	req := httptest.NewRequest(http.MethodGet, "/?token="+token, nil)
	req.Header.Set("X-Forwarded-Proto", "http")
	rec := httptest.NewRecorder()
	handleRequest(http.NotFoundHandler()).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
	var response debugResponse
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("decode debug response: %v", err)
	}
	if response.Error != "unauthorized" || response.Debug.Stage != "access_token_expired" {
		t.Fatalf("response = %+v, want expired debug response", response)
	}
	if response.Debug.RequestWasHTTPS {
		t.Fatal("requestWasHttps = true, want false")
	}
}

func TestDebugResponseForReplayedToken(t *testing.T) {
	t.Setenv("AUTH_PROXY_DEBUG_ENABLED", "true")
	t.Setenv("AGENT_JWT_SECRET", "test-secret")
	token := signedAccessToken(t, "test-secret", "replayed-debug-token", time.Now().Add(time.Hour))
	req := httptest.NewRequest(http.MethodGet, "/?token="+token, nil)
	req.Header.Set("X-Forwarded-Proto", "https")

	handleRequest(http.NotFoundHandler()).ServeHTTP(httptest.NewRecorder(), req)
	rec := httptest.NewRecorder()
	handleRequest(http.NotFoundHandler()).ServeHTTP(rec, req)
	var response debugResponse
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("decode debug response: %v", err)
	}
	if response.Debug.Stage != "access_token_replayed" {
		t.Fatalf("stage = %q, want access_token_replayed", response.Debug.Stage)
	}
}

func TestTokenRedirectSetsOriginalSessionCookie(t *testing.T) {
	t.Setenv("AGENT_JWT_SECRET", "test-secret")

	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, auth.AgentClaims{
		AgentID:   "agent-base-agent-c5bbc",
		ClaimID:   "ac-agent-base-agent-c5bbc-82393158",
		Namespace: "proj-agent-test-1-2cd39535",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "jan.meier@ost.ch",
			Issuer:    auth.Issuer,
			ID:        "access-token-main-test",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
		},
	})
	tokenString, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/?token="+tokenString+"&view=1", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	req.Header.Set("X-Forwarded-Host", "base-agent.90027620.quickstack.me")
	rec := httptest.NewRecorder()

	shouldNotProxy := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("request should redirect before proxying")
	})
	handleRequest(shouldNotProxy).ServeHTTP(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusFound)
	}
	if got := rec.Header().Get("Location"); got != "https://base-agent.90027620.quickstack.me/?view=1" {
		t.Fatalf("Location = %q", got)
	}

	cookies := rec.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("cookies = %d, want 1", len(cookies))
	}
	cookie := cookies[0]
	if cookie.Name != auth.CookieName {
		t.Fatalf("cookie name = %q", cookie.Name)
	}
	if !cookie.Secure {
		t.Fatal("cookie should be secure for https forwarded proto")
	}

	replayRecorder := httptest.NewRecorder()
	handleRequest(shouldNotProxy).ServeHTTP(replayRecorder, req)
	if replayRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("replay status = %d, want %d", replayRecorder.Code, http.StatusUnauthorized)
	}
}
