# Design planning

Four linked HTML pages. Open `mockups.html` in a browser and use the top bar to move between them (light/dark switch included).

| Page | Contents |
|------|----------|
| [mockups.html](mockups.html) | Annotated low-fidelity models of every screen and sheet (web and Android), landing page, states |
| [design-system.html](design-system.html) | Colour palette (UI and board), typography, spacing, radii, elevation, icons, buttons, controls, fields, sheets, signature pieces, motion, do/don't |
| [navigation-flow.html](navigation-flow.html) | Metro map of the app, routes, launch/share/account flows, sheet stack, navigation rules |
| [product-vision.html](product-vision.html) | Objective, target audience and personas, the "Metro Map" style, principles, positioning, voice, success measures |

`style.css` and `shared.js` are shared by all four (tokens mirror `DESIGN.md` and `mobile/src/constants/theme.ts`). Fonts load from Google Fonts and the flow diagrams from the Mermaid CDN, so an internet connection is needed for full fidelity.
