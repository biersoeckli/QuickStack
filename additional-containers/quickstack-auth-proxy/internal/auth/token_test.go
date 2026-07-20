package auth

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestVerifyAccessTokenAcceptsOriginalIssuer(t *testing.T) {
	t.Setenv("AGENT_JWT_SECRET", "test-secret")

	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, AgentClaims{
		AgentID:   "agent-base-agent-c5bbc",
		ClaimID:   "ac-agent-base-agent-c5bbc-82393158",
		Namespace: "proj-agent-test-1-2cd39535",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "jan.meier@ost.ch",
			Issuer:    "quickstack-auth-proxy",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
		},
	})
	tokenString, err := token.SignedString([]byte(os.Getenv("AGENT_JWT_SECRET")))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	claims, err := VerifyAccessToken(tokenString)
	if err != nil {
		t.Fatalf("verify token: %v", err)
	}
	if claims.AgentID != "agent-base-agent-c5bbc" {
		t.Fatalf("AgentID = %q", claims.AgentID)
	}
}

func TestCookieNameMatchesOriginalImplementation(t *testing.T) {
	if CookieName != "qs-auth-proxy-session" {
		t.Fatalf("CookieName = %q", CookieName)
	}
}

func TestSessionCookieSupportsCrossSiteIframes(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "http://auth-proxy.test", nil)
	cookie := SessionCookie("session-token", req)

	if !cookie.Secure {
		t.Fatal("SessionCookie().Secure = false, want true")
	}
	if cookie.SameSite != http.SameSiteNoneMode {
		t.Fatalf("SessionCookie().SameSite = %v, want %v", cookie.SameSite, http.SameSiteNoneMode)
	}
}
