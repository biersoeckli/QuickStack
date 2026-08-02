package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/yourorg/agent-auth-proxy/internal/auth"
)

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
