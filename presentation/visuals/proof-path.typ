#import "@preview/cetz:0.5.2"

#set page(width: auto, height: auto, margin: 7mm)
#set text(font: "Calibri", size: 10pt, fill: rgb("#1F2937"))

#text(size: 19pt, weight: "bold", fill: rgb("#44546A"))[Credential lifecycle]
#linebreak()
#text(size: 9pt, fill: rgb("#667085"))[Issuance binds a public manifest to an immutable registry record. Verification repeats that binding independently.]
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
  let border = rgb("#D6DCE5")

  let card = (at, name, title, detail, fill, edge) => {
    content(at, [
      #text(size: 9pt, weight: "bold", fill: ink)[#title]
      #linebreak()
      #text(size: 7.2pt, fill: muted)[#detail]
    ], name: name, frame: "rect", padding: 6pt, fill: fill, stroke: edge + 0.9pt)
  }

  content((0.4, 7.15), [#text(size: 8pt, weight: "bold", fill: orange)[ISSUE]])
  content((0.4, 2.9), [#text(size: 8pt, weight: "bold", fill: blue)[VERIFY]])

  card((2.0, 5.9), "form", "Credential details", "Issuer + learner + skill + date", pale-orange, orange)
  card((5.6, 5.9), "manifest", "Public manifest", "Bytes + returned URI and CID", pale-orange, orange)
  card((9.2, 5.9), "hash", "Canonical v1 hash", "Keccak binds canonical fields", pale-orange, orange)
  card((12.8, 5.9), "wallet", "Issuer wallet", "Signs registry transaction", pale-orange, orange)
  card((16.4, 5.9), "registry", "Registry record", "Hash · issuer · learner · URI · time", pale-green, green)

  card((2.0, 1.5), "reference", "Credential reference", "Hash or public link", pale-blue, blue)
  card((5.6, 1.5), "read", "Read registry", "Check record + fields", pale-blue, blue)
  card((9.2, 1.5), "fetch", "Fetch manifest", "Load bytes from stored URI", pale-blue, blue)
  card((12.8, 1.5), "recompute", "Recompute proof", "Hash normalized values", pale-blue, blue)
  card((16.4, 1.5), "result", "Report result", "Compare with chain proof", pale-green, green)

  // Issuance creates the anchor; the second lane checks it independently.
  line("form", "manifest", stroke: orange + 1pt, mark: (end: ">"))
  line("manifest", "hash", stroke: orange + 1pt, mark: (end: ">"))
  line("hash", "wallet", stroke: orange + 1pt, mark: (end: ">"))
  line("wallet", "registry", stroke: orange + 1pt, mark: (end: ">"))
  line("reference", "read", stroke: blue + 1pt, mark: (end: ">"))
  line("read", "fetch", stroke: blue + 1pt, mark: (end: ">"))
  line("fetch", "recompute", stroke: blue + 1pt, mark: (end: ">"))
  line("recompute", "result", stroke: blue + 1pt, mark: (end: ">"))
})
