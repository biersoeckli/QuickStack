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
    if [ -z "$INSTALL_K3S_INTERFACE" ]; then
        interfaces_with_ips=$(ip -o -4 addr show | awk '!/^[0-9]*: lo:/ {print $2, $4}' | cut -d'/' -f1)

        echo "Available network interfaces:"
        echo "$interfaces_with_ips"
        echo ""
        echo "*******************************************************************************************************"
        echo ""
        echo "Please select the ip address wich is in the same network as the master node."
        echo "If you havent configured a private network between the nodes, select the public ip address."
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

# Call the function to select the network interface
select_network_interface

# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
# THIS MUST BE INSTALLED ON ALL NODES --> https://longhorn.io/docs/1.7.2/deploy/install/#installing-nfsv4-client
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
# install nfs-common, open-iscsi and jq
sudo apt-get update
sudo apt-get install open-iscsi curl nfs-common jq -y

echo "Fetching version information..."
K3S_VERSION=$(curl -s https://get.quickstack.dev/k3s-versions.json | jq -r '.prodInstallVersion')
echo "Using K3s version: $K3S_VERSION"

# Disable portmapper services --> https://github.com/biersoeckli/QuickStack/issues/18
sudo systemctl stop rpcbind.service rpcbind.socket
sudo systemctl disable rpcbind.service rpcbind.socket

if systemctl list-units --full --all | grep -q 'multipathd'; then
  sudo systemctl stop multipathd
  sudo systemctl disable multipathd
fi

if ! lsmod | grep -q dm_crypt; then
  sudo modprobe dm_crypt
fi
if ! grep -q 'dm_crypt' /etc/modules; then
  echo "dm_crypt" | sudo tee -a /etc/modules
fi

# Installation of k3s
echo "Installing k3s with --flannel-iface=$selected_iface"
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--flannel-iface=$selected_iface" INSTALL_K3S_VERSION="$K3S_VERSION" K3S_URL=${K3S_URL} K3S_TOKEN=${JOIN_TOKEN} sh -

# For HA Configuration
# curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="v1.33.8+k3s1" K3S_TOKEN= sh -s - server --server https://<IP-ADDRESS>:6443 --flannel-iface=<IFACE>

echo ""
echo "-----------------------------------------------------------------------------------------------------------"
echo "* Node Setup completed. It might take a few minutes until the node is visible in the QuickStack settings. *"
echo "-----------------------------------------------------------------------------------------------------------"
echo ""
