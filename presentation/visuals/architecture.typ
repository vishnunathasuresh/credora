#import "@preview/cetz:0.5.2"

#set page(width: auto, height: auto, margin: 7mm)
#set text(font: "Calibri", size: 10pt, fill: rgb("#1F2937"))

#text(size: 19pt, weight: "bold", fill: rgb("#44546A"))[Credora system architecture]
#linebreak()
#text(size: 9pt, fill: rgb("#667085"))[The registry anchors proof. The API coordinates product workflows and rebuildable data.]
#v(5mm)

#cetz.canvas({
  import cetz.draw: *

  let ink = rgb("#263445")
  let muted = rgb("#667085")
  let blue = rgb("#4472C4")
  let orange = rgb("#ED7D31")
  let green = rgb("#548235")
  let pale-blue = rgb("#F1F5FC")
  let pale-orange = rgb("#FFF5EB")
  let pale-green = rgb("#F1F7EE")
  let pale-gray = rgb("#F5F6F8")
  let border = rgb("#D6DCE5")

  let card = (at, name, title, detail, fill, edge) => {
    content(at, [
      #text(size: 10pt, weight: "bold", fill: ink)[#title]
      #linebreak()
      #text(size: 7.5pt, fill: muted)[#detail]
    ], name: name, frame: "rect", padding: 7pt, fill: fill, stroke: edge + 1pt)
  }

  // Three responsibility zones keep app, service, and proof boundaries clear.
  rect((0, 0), (4.5, 8.3), radius: 0.16, fill: rgb("#FAFBFD"), stroke: border + 0.8pt)
  rect((5.2, 0), (10.5, 8.3), radius: 0.16, fill: rgb("#FAFBFD"), stroke: border + 0.8pt)
  rect((11.2, 0), (16.7, 8.3), radius: 0.16, fill: rgb("#FAFBFD"), stroke: border + 0.8pt)

  content((2.25, 7.9), [#text(size: 8pt, weight: "bold", fill: muted)[CLIENT SURFACES]])
  content((7.85, 7.9), [#text(size: 8pt, weight: "bold", fill: muted)[CREDORA SERVICES]])
  content((13.95, 7.9), [#text(size: 8pt, weight: "bold", fill: muted)[PROOF AND OPERATIONS]])

  // Node labels
  card((2.25, 6.8), "issuer", "Issuer web", "Drafts and wallet-signed issue", pale-orange, orange)
  card((2.25, 4.8), "web-users", "Holder and verifier web", "Wallet view and public checks", pale-blue, blue)
  card((2.25, 1.8), "mobile", "Expo mobile", "Local links, QR, API verification", pale-blue, blue)

  card((7.85, 4.8), "api", "Credora API", "Sessions · roles · issuance · verify · share", pale-blue, blue)
  card((7.85, 1.8), "core", "Shared packages", "Hashing · ABI · storage · auth · types", pale-gray, muted)

  card((13.95, 6.8), "registry", "CredentialRegistry", "Immutable v1 record · issuer role", pale-green, green)
  card((13.95, 4.8), "metadata", "Metadata storage", "IPFS CID in production · file adapter locally", pale-green, green)
  card((13.95, 1.8), "projection", "SQLite operational DB", "Chain projection · sessions · org review · audit", pale-gray, muted)

  // The issuer submits the contract transaction from their own wallet.
  line("issuer", "registry", stroke: orange + 1.1pt, mark: (end: ">"))
  line("web-users", "api", stroke: blue + 1pt, mark: (end: ">"))
  line("mobile", (4.8, 2.15), (5.8, 2.15), (6.2, 3.65), "api.south-west", stroke: blue + 1pt, mark: (end: ">"))
  line("api", (10.8, 5.45), (12.1, 5.8), (12.7, 6.25), "registry.south-west", stroke: green + 1pt, mark: (end: ">"))
  line("api", "metadata", stroke: green + 1pt, mark: (end: ">"))
  line("api.south", (8.7, 3.45), (12.7, 3.45), "projection.north-west", stroke: blue + 0.9pt, mark: (end: ">"))
  line("api", "core", stroke: blue + 0.9pt, mark: (end: ">"))

  content((7.85, 0.62), [#text(size: 7.2pt, fill: muted)[Browser verification can bypass the API and read RPC + the configured IPFS gateway.]], anchor: "center")
})
