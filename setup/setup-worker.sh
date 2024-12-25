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


select_network_interface() {
    echo "Detecting network interfaces with IPv4 addresses..."
    interfaces_with_ips=$(ip -o -4 addr show | awk '{print $2, $4}' | sort -u)

    if [ $(echo "$interfaces_with_ips" | wc -l) -eq 1 ]; then
        # If only one interface is found, use it by default
        selected_iface=$(echo "$interfaces_with_ips" | awk '{print $1}')
        selected_ip=$(echo "$interfaces_with_ips" | awk '{print $2}')
        echo "Only one network interface detected: $selected_iface ($selected_ip)"
    else
        echo ""
        echo "*******************************************************************************************************"
        echo ""
        echo "Multiple network interfaces detected:"
        echo "Please select the ip address wich is in the same network as the master node."
        echo "If you havent configured a private network between the nodes, select the public ip address."
        echo ""
        options=()
        while read -r iface ip; do
            options+=("$iface ($ip)")
        done <<< "$interfaces_with_ips"

        PS3="Please select the network interface to use: "
        select entry in "${options[@]}"; do
            if [ -n "$entry" ]; then
                selected_iface=$(echo "$entry" | awk -F' ' '{print $1}')
                selected_ip=$(echo "$entry" | awk -F'[()]' '{print $2}')
                echo "Selected interface: $selected_iface ($selected_ip)"
                break
            else
                echo "Invalid selection. Please try again."
            fi
        done
    fi

    echo "Using network interface: $selected_iface with IP address: $selected_ip"
}


# install nfs-common and open-iscsi
sudo apt-get update
sudo apt-get install open-iscsi nfs-common -y

# Installation of k3s
echo "Installing k3s with --flannel-iface=$selected_iface"
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--flannel-iface=$selected_iface" INSTALL_K3S_VERSION="v1.31.3+k3s1" K3S_URL=${K3S_URL} K3S_TOKEN=${JOIN_TOKEN} sh -

echo ""
echo "-----------------------------------------------------------------------------------------------------------"
echo "* Node Setup completed. It might take a few minutes until the node is visible in the QuickStack settings. *"
echo "-----------------------------------------------------------------------------------------------------------"
echo ""