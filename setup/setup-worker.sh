#!/bin/bash

# curl -sfL https://get.quickstack.dev/setup-worker.sh | K3S_URL=<https://IP-ADDRESS-OR-HOSTNAME-OF-MASTERNODE:6443> JOIN_TOKEN=<TOKEN> sh -

if [ -z "${K3S_URL}" ]; then
  echo "Error: Missing parameter 'K3S_URL'."
  echo "Example K3S_URL https://<IP-ADDRESS-OR-HOSTNAME-OF-MASTERNODE>:6443"
  exit 1
fi

if [ -z "${JOIN_TOKEN}" ]; then
  echo "Error: Missing parameter 'JOIN_TOKEN'."
  exit 1
fi

k3sUrl="$1"
joinToken="$2"

wait_until_all_pods_running() {

    # Waits another 5 seconds to make sure all pods are registered for the first time.
    sleep 5

    while true; do
        OUTPUT=$(sudo k3s kubectl get pods -A --no-headers 2>&1)

        # Checks if there are no resources found --> Kubernetes ist still starting up
        if echo "$OUTPUT" | grep -q "No resources found"; then
            echo "Kubernetes is still starting up..."
        else
            # Extracts the STATUS column from the kubectl output and filters out the values "Running" and "Completed".
            STATUS=$(echo "$OUTPUT" | awk '{print $4}' | grep -vE '^(Running|Completed)$')

            # If the STATUS variable is empty, all pods are running and the loop can be exited.
            if [ -z "$STATUS" ]; then
            echo "Pods started successfully."
            break
            else
            echo "Waiting for all pods to come online..."
            fi
        fi

        # Waits for X seconds before checking the pod status again.
        sleep 10
    done

    # Waits another 5 seconds to make sure all pods are ready.
    sleep 5

    sudo kubectl get node
    sudo kubectl get pods -A
}

# install nfs-common
sudo apt-get update
sudo apt-get install nfs-common -y

# Installation of k3s
curl -sfL https://get.k3s.io | K3S_URL=${K3S_URL} K3S_TOKEN=${JOIN_TOKEN} sh -

echo ""
echo "-----------------------------------------------------------------------------------------------------------"
echo "* Node Setup completed. It might take a few minutes until the node is visible in the QuickStack settings. *"
echo "-----------------------------------------------------------------------------------------------------------"
echo ""