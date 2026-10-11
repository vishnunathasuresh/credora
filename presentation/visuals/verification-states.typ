#import "@preview/cetz:0.5.2"

#set page(width: auto, height: auto, margin: 7mm)
#set text(font: "Calibri", size: 10pt, fill: rgb("#1F2937"))

#text(size: 19pt, weight: "bold", fill: rgb("#44546A"))[Verification outcomes]
#linebreak()
#text(size: 9pt, fill: rgb("#667085"))[Infrastructure failures stay separate from a proof mismatch.]
#v(5mm)

#cetz.canvas({
  import cetz.draw: *

  let ink = rgb("#263445")
  let muted = rgb("#667085")
  let blue = rgb("#4472C4")
  let green = rgb("#548235")
  let red = rgb("#C0504D")
  let amber = rgb("#C58A13")
  let pale-blue = rgb("#F1F5FC")
  let pale-green = rgb("#F1F7EE")
  let pale-red = rgb("#FBF0EF")
  let pale-amber = rgb("#FFF7E6")

  let card = (at, name, title, detail, fill, edge) => {
    content(at, [
      #text(size: 8.5pt, weight: "bold", fill: ink)[#title]
      #linebreak()
      #text(size: 6.8pt, fill: muted)[#detail]
    ], name: name, frame: "rect", padding: 5pt, fill: fill, stroke: edge + 0.9pt)
  }

  card((1.6, 4.1), "input", "Credential reference", "Is it a 32-byte hash?", pale-blue, blue)
  card((5.1, 4.1), "ledger", "Read registry", "Record present?", pale-blue, blue)
  card((8.9, 4.1), "metadata", "Fetch metadata", "Gateway returns bytes?", pale-blue, blue)
  card((12.7, 4.1), "compare", "Recompute and compare", "Hash + issuer + learner", pale-blue, blue)
  card((16.4, 4.1), "valid", "Verified", "All bound fields match", pale-green, green)

  card((1.6, 0.55), "malformed", "Malformed", "Input cannot be parsed", pale-amber, amber)
  card((5.1, 7.4), "ledger-down", "Ledger unavailable", "Retry RPC; proof is unknown", pale-amber, amber)
  card((5.1, 0.55), "not-found", "Not found", "No record at this registry", pale-amber, amber)
  card((8.9, 7.4), "metadata-down", "Metadata unavailable", "Retry gateway; proof is unknown", pale-amber, amber)
  card((12.7, 0.55), "mismatch", "Proof mismatch", "Metadata does not match record", pale-red, red)

  // Main path runs left to right. Side branches name the exact stopping state.
  line("input", "ledger", stroke: blue + 0.9pt, mark: (end: ">"))
  line("ledger", "metadata", stroke: blue + 0.9pt, mark: (end: ">"))
  line("metadata", "compare", stroke: blue + 0.9pt, mark: (end: ">"))
  line("compare", "valid", stroke: green + 1pt, mark: (end: ">"))
  line("input.south", (1.6, 1.4), stroke: amber + 0.9pt, mark: (end: ">"))
  line("ledger.north", (5.1, 6.9), stroke: amber + 0.9pt, mark: (end: ">"))
  line("ledger.south", (5.1, 1.4), stroke: amber + 0.9pt, mark: (end: ">"))
  line("metadata.north", (8.9, 6.9), stroke: amber + 0.9pt, mark: (end: ">"))
  line("compare.south", (12.7, 1.4), stroke: red + 0.9pt, mark: (end: ">"))
})
