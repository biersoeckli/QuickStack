#!/usr/bin/env bash
set -e

KUBECONFIG_SOURCE="/k3s-config/k3s.yaml"
KUBECONFIG_DEST="kube-config.config"

if [[ "$USE_LOCAL_DOCKER_K3S" == "true" ]]; then
    echo "Waiting for k3s kubeconfig to be created"
    until [ -f "$KUBECONFIG_SOURCE" ]; do
        sleep 2
        printf "."
    done
    echo ""

    echo "k3s kubeconfig found. Writing $KUBECONFIG_DEST..."
    # Replace 127.0.0.1 with the qs-k3s-dev service name and skip TLS verification
    sed \
        -e 's/127\.0\.0\.1/qs-k3s-dev/g' \
        -e 's/certificate-authority-data:.*/insecure-skip-tls-verify: true/' \
        "$KUBECONFIG_SOURCE" > "$KUBECONFIG_DEST"

    echo "k3s kubeconfig is ready at $KUBECONFIG_DEST"
else
    echo "USE_LOCAL_DOCKER_K3S is not set to 'true', skipping k3s kubeconfig setup."
    echo "Using existing $KUBECONFIG_DEST if present."
fi

echo ""
echo ""
echo "***************************************"
echo " > Development environment is ready! < "
echo "***************************************"
echo ""
echo ""
