



/*

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-namespace-and-external-traffic
  namespace: proj-databases-ce53614e
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector: {}
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: traefik
    - from:
        - namespaceSelector:
            matchLabels:
              name: kube-system
    - from:
        - ipBlock:
            cidr: 0.0.0.0/0
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - port: 53
          protocol: UDP
    - to:
        - podSelector: {}


*/