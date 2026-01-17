#!/bin/bash

# curl -sfL https://get.quickstack.dev/setup.sh | sh -

select_network_interface() {
  if [ -z "$INSTALL_K3S_INTERFACE" ]; then
    interfaces_with_ips=$(ip -o -4 addr show | awk '!/^[0-9]*: lo:/ {print $2, $4}' | cut -d'/' -f1)

    echo "Available network interfaces:"
    echo "$interfaces_with_ips"
    echo ""
    echo "*******************************************************************************************************"
    echo ""
    echo "If you plan to use QuickStack in a cluster using multiple servers in multiple Networks (private/public),"
    echo "choose the network Interface you want to use for the communication between the servers."
    echo ""
    echo "If you plan to use QuickStack in a single server setup, choose the network Interface with the public IP."
    echo ""

    i=1
    echo "$interfaces_with_ips" | while read -r iface ip; do
      printf "%d) %s (%s)\n" "$i" "$iface" "$ip"
      i=$((i + 1))
    done

    printf "Please enter the number of the interface to use: "
    # Change read to use /dev/tty explicitly
    read -r choice </dev/tty

    selected=$(echo "$interfaces_with_ips" | sed -n "${choice}p")
    selected_iface=$(echo "$selected" | awk '{print $1}')
    selected_ip=$(echo "$selected" | awk '{print $2}')

    if [ -n "$selected" ]; then
      echo "Selected interface: $selected_iface ($selected_ip)"
    else
      echo "Invalid selection. Exiting."
      exit 1
    fi
  else
    selected_iface="$INSTALL_K3S_INTERFACE"
    selected_ip=$(ip -o -4 addr show "$selected_iface" | awk '{print $4}' | cut -d'/' -f1)
    echo "Using provided network interface: $selected_iface ($selected_ip)"
  fi

  echo "Using network interface: $selected_iface with IP address: $selected_ip"
}

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

# Prompt for network interface
select_network_interface

# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
# THIS MUST BE INSTALLED ON ALL NODES --> https://longhorn.io/docs/1.7.2/deploy/install/#installing-nfsv4-client
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo "Installing nfs-common..."
sudo apt-get update
sudo apt-get install open-iscsi nfs-common -y

# Disable portmapper services --> https://github.com/biersoeckli/QuickStack/issues/18
sudo systemctl stop rpcbind.service rpcbind.socket
sudo systemctl disable rpcbind.service rpcbind.socket

# Installation of k3s
#curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--node-ip=192.168.1.2 --advertise-address=192.168.1.2 --node-external-ip=188.245.236.232 --flannel-iface=enp7s0" INSTALL_K3S_VERSION="v1.31.3+k3s1" sh -

echo "Installing k3s with --flannel-iface=$selected_iface"
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--flannel-iface=$selected_iface" INSTALL_K3S_VERSION="v1.31.3+k3s1" sh -
# Todo: Check for Ready node, takes ~30 seconds
sudo k3s kubectl get node

echo "Waiting for Kubernetes to start..."
wait_until_all_pods_running

# Installation of Longhorn
sudo kubectl apply -f https://raw.githubusercontent.com/longhorn/longhorn/v1.7.2/deploy/longhorn.yaml
echo "Waiting for Longhorn to start..."
wait_until_all_pods_running

# Installation of Cert-Manager
sudo kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.1/cert-manager.yaml
echo "Waiting for Cert-Manager to start..."
wait_until_all_pods_running
sudo kubectl -n cert-manager get pod

sudo apt-get install jq -y

# Use this for checking installation of Longhorn
# sudo curl -sSfL https://raw.githubusercontent.com/longhorn/longhorn/v1.7.2/scripts/environment_check.sh | sudo bash

joinTokenForOtherNodes=$(sudo cat /var/lib/rancher/k3s/server/node-token)

# deploy QuickStack
cat <<EOF >quickstack-setup-job.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: quickstack
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: qs-service-account
  namespace: quickstack
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: qs-role-binding
subjects:
  - kind: ServiceAccount
    name: qs-service-account
    namespace: quickstack
roleRef:
  kind: ClusterRole
  name: cluster-admin
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: batch/v1
kind: Job
metadata:
  name: quickstack-setup-job
  namespace: quickstack
spec:
  ttlSecondsAfterFinished: 3600
  template:
    spec:
      serviceAccountName: qs-service-account
      containers:
      - name: quickstack-container
        image: quickstack/quickstack:latest
        env:
        - name: START_MODE
          value: "setup"
        - name: K3S_JOIN_TOKEN
          value: "$joinTokenForOtherNodes"
        imagePullPolicy: Always
      restartPolicy: Never
  backoffLimit: 0
EOF
sudo kubectl apply -f quickstack-setup-job.yaml
sudo rm quickstack-setup-job.yaml
wait_until_all_pods_running
sudo kubectl logs -f job/quickstack-setup-job -n quickstack

# evaluate url to add node to cluster
# echo "To add an additional node to the cluster, run the following command on the worker node:"
# echo "curl -sfL https://get.quickstack.dev/setup-worker.sh | K3S_URL=https://<IP-ADDRESS-OR-HOSTNAME-OF-MASTERNODE>:6443 JOIN_TOKEN=$joinTokenForOtherNodes sh -"
