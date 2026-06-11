# Limitations

1. Without a central server, instant delivery to distant offline users cannot be guaranteed.
2. Without Internet, communication requires proximity or shared local network discovery such as mDNS, Bluetooth, Wi-Fi Direct, or LAN transport when available.
3. Remote push notifications generally require OS push infrastructure or intermediary services. This version implements local notifications from daemon/app events.
4. NAT/firewalls may prevent direct connections. Optional relay/community nodes can help but are not mandatory central infrastructure.
5. Bootstrap and relay nodes must be optional, replaceable network nodes, not proprietary backends.
