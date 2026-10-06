# Setup guides

Use these guides to install, run, and operate Credora for each supported
workflow. Start with [local development](local-development.md) if you are
contributing code. No blockchain or wallet is needed to browse the site or
inspect the synthetic demo catalog.

| Guide                                     | For                                                        |
| ----------------------------------------- | ---------------------------------------------------------- |
| [Local development](local-development.md) | Contributors running the website and API                   |
| [Blockchain development](blockchain.md)   | Developers testing contracts and real local issuance flows |
| [Mobile setup](mobile.md)                 | Expo Go, browser preview, and Android/iOS builds           |
| [User roles](user-roles.md)               | Verifiers, credential holders, issuers, and administrators |
| [Production setup](production.md)         | Operators hosting the web app and API                      |
| [Troubleshooting](troubleshooting.md)     | Common setup and connectivity problems                     |

## Before you start

Credora has three separate sources and services in its real proof flow:

1. The registry records credential proofs and issuer authorization.
2. IPFS stores the credential metadata addressed by the registry.
3. The API provides sessions, organization tools, sharing, and a rebuildable
   search projection.

The website can load without a wallet. Public verification needs a reachable
registry and metadata gateway. Issuance needs an authorized wallet and a
transaction on the configured chain. Synthetic demo records are not real
credentials.
