# Cisco Hardening Playbook (CyberPatriot Nationals Tier)

This is the definitive, Nationals-level Order of Operations for securing Cisco IOS Routers and Switches.

## 0. PRE-FLIGHT & FORENSICS
- [ ] **Read the README**: Identify required topology, allowed management networks, VLANs, and required routing protocols.
- [ ] **View Current Config**: `show running-config` (Save a copy locally to a text editor).
- [ ] **Check Connections**: `show users` and `show tcp brief` to see if an attacker is currently connected.

## 1. INITIAL DEVICE SECURITY
- [ ] **Enable Secret**: Do not use `enable password`. Use `enable secret [StrongPassword]`.
- [ ] **Service Password Encryption**: Encrypt all plaintext passwords in the config.
  ```text
  Router(config)# service password-encryption
  ```
- [ ] **Banner MOTD**: Set a legal warning banner.
  ```text
  Router(config)# banner motd # UNAUTHORIZED ACCESS PROHIBITED #
  ```
- [ ] **Disable DNS Lookup**: Prevents console hanging on mistyped commands.
  ```text
  Router(config)# no ip domain-lookup
  ```

## 2. USER AUTHENTICATION & AAA
- [ ] **Create Administrative User**: Create a user with highest privilege and encrypted password.
  ```text
  Router(config)# username admin privilege 15 secret [StrongPassword]
  ```
- [ ] **Enable AAA**: Authentication, Authorization, and Accounting.
  ```text
  Router(config)# aaa new-model
  Router(config)# aaa authentication login default local
  ```

## 3. SECURING MANAGEMENT LINES (Console, VTY, AUX)
- [ ] **Console Line (Line Con 0)**:
  ```text
  Router(config)# line con 0
  Router(config-line)# login local
  Router(config-line)# exec-timeout 5 0   (Logs out after 5 mins of inactivity)
  Router(config-line)# logging synchronous (Prevents logs from interrupting typing)
  ```
- [ ] **VTY Lines (SSH/Telnet Management)**:
  ```text
  Router(config)# line vty 0 4
  Router(config-line)# login local
  Router(config-line)# transport input ssh (Crucial: Disables Telnet)
  Router(config-line)# exec-timeout 5 0
  Router(config-line)# access-class ADMIN_VTY in (Restrict who can connect, see ACL section)
  ```
- [ ] **AUX Line**: Disable the auxiliary port if unused.
  ```text
  Router(config)# line aux 0
  Router(config-line)# no exec
  Router(config-line)# transport input none
  ```

## 4. SSH CONFIGURATION (Replacing Telnet)
- [ ] **Set Domain Name**: Required to generate RSA keys.
  ```text
  Router(config)# ip domain-name mydomain.com
  ```
- [ ] **Generate RSA Keys**: Use a strong modulus.
  ```text
  Router(config)# crypto key generate rsa
  How many bits in the modulus [512]: 2048
  ```
- [ ] **Enforce SSHv2 and Limits**:
  ```text
  Router(config)# ip ssh version 2
  Router(config)# ip ssh time-out 60
  Router(config)# ip ssh authentication-retries 3
  ```

## 5. DISABLE INSECURE / UNUSED SERVICES
- [ ] **HTTP / HTTPS Server**: Disable web management unless strictly required.
  ```text
  Router(config)# no ip http server
  Router(config)# no ip http secure-server
  ```
- [ ] **CDP (Cisco Discovery Protocol)**: Disable globally or on internet-facing interfaces to prevent information disclosure.
  ```text
  Router(config)# no cdp run
  ```
- [ ] **Other Legacy Services**:
  ```text
  Router(config)# no service finger
  Router(config)# no service pad
  Router(config)# no ip bootp server
  Router(config)# no ip source-route
  ```

## 6. SWITCH SPECIFIC SECURITY (L2)
- [ ] **Disable Unused Ports**: Move unused ports to a dead VLAN and shut them down.
  ```text
  Switch(config)# interface range fa0/10 - 24
  Switch(config-if-range)# switchport access vlan 999
  Switch(config-if-range)# shutdown
  ```
- [ ] **Port Security**: Prevent MAC spoofing and CAM table overflows on access ports.
  ```text
  Switch(config-if)# switchport mode access
  Switch(config-if)# switchport port-security
  Switch(config-if)# switchport port-security maximum 2
  Switch(config-if)# switchport port-security mac-address sticky
  Switch(config-if)# switchport port-security violation restrict
  ```
- [ ] **Disable DTP (Dynamic Trunking Protocol)**: Prevent VLAN hopping on access ports.
  ```text
  Switch(config-if)# switchport nonegotiate
  ```
- [ ] **Spanning Tree Security**: Enable BPDU Guard on all PortFast (access) ports.
  ```text
  Switch(config)# spanning-tree portfast bpduguard default
  ```

## 7. ROUTING PROTOCOL SECURITY
- [ ] **OSPF Authentication**:
  ```text
  Router(config-if)# ip ospf message-digest-key 1 md5 [SecretKey]
  Router(config-router)# area 0 authentication message-digest
  ```
- [ ] **EIGRP Authentication**:
  ```text
  Router(config)# key chain EIGRP_KEY
  Router(config-keychain)# key 1
  Router(config-keychain-key)# key-string [SecretKey]
  Router(config-if)# ip authentication mode eigrp 1 md5
  Router(config-if)# ip authentication key-chain eigrp 1 EIGRP_KEY
  ```

## 8. ACCESS CONTROL LISTS (ACLs)
- [ ] **Protect VTY Lines (Management)**: Only allow the admin subnet to SSH into the router.
  ```text
  Router(config)# ip access-list standard ADMIN_VTY
  Router(config-std-nacl)# permit 192.168.1.0 0.0.0.255
  Router(config-std-nacl)# deny any log
  Router(config)# line vty 0 4
  Router(config-line)# access-class ADMIN_VTY in
  ```
- [ ] **Anti-Spoofing on External Interfaces**: Block private IPs coming from the outside interface.

## 9. LOGGING & NTP
- [ ] **NTP**: Set an NTP server so logs have accurate timestamps.
  ```text
  Router(config)# ntp server 10.0.0.5
  ```
- [ ] **Logging**: Log to an external syslog server if available, and buffer logs.
  ```text
  Router(config)# logging host 10.0.0.6
  Router(config)# logging trap informational
  Router(config)# logging buffered 16384
  ```

## 10. FINAL VERIFICATION
- [ ] **Review**: `show running-config` to ensure all changes took effect.
- [ ] **Save**: Save your configuration so it survives a reboot.
  ```text
  Router# copy running-config startup-config
  ```
