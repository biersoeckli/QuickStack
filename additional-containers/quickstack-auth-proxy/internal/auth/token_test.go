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
			ID:        "access-token-1",
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

func TestConsumeAccessTokenRejectsReplay(t *testing.T) {
	t.Setenv("AGENT_JWT_SECRET", "test-secret")
	consumedAccessTokens.Lock()
	consumedAccessTokens.jtiExpiry = make(map[string]time.Time)
	consumedAccessTokens.Unlock()

	claims := &AgentClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        "access-token-1",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(accessTokenTTL())),
		},
	}
	if err := ConsumeAccessToken(claims); err != nil {
		t.Fatalf("first consume: %v", err)
	}
	if err := ConsumeAccessToken(claims); err == nil {
		t.Fatal("second consume succeeded, want replay rejection")
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, AgentClaims{
		AgentID: "agent-1", ClaimID: "claim-1", Namespace: "project-1",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer: Issuer, ID: "access-token-1", ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		},
	})
	tokenString, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	if _, err := VerifyAccessToken(tokenString); err == nil {
		t.Fatal("replayed token verified, want rejection")
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
