# IT415-exam
This repository is the work of:
-Crystel S. Acino
-Eljah Fiona P. Carpentero
-Mer Antoneth G. Gripo

## CS Campus Store UI prototype

This phase provides a touchscreen-friendly **UI and navigation prototype**, using fixed sample data. It is not a completed functional practical-exam system. The exam and context documents informed the required screen content; their transaction-logic instructions are deferred to a later phase.

### Open the prototype

Double-click `index.html` or open it in a modern browser such as Chrome, Edge, or Firefox. No installation, build command, server, or internet connection is required. Keep the `css`, `js`, and `assets` folders beside `index.html`.

### Files

- `index.html`: semantic screens, inline SVG illustrations, fixed order and payment fixtures.
- `css/styles.css`: responsive layout, touch targets, status styles, and keyboard focus.
- `js/navigation.js`: screen changes, progress updates, focus management, catalog search/category visibility, and predefined visual-state previews.
- `assets/bootstrap.min.css`: locally bundled Bootstrap 5.3.3 CSS, including its MIT license header.
- `README.md`: usage, scope, and verification notes. The original contributor attribution is preserved above.
- `tests/kiosk.cjs`: optional Playwright checks for navigation, catalog controls, fixtures, accessibility basics, and responsive rendering. Not required to run the kiosk.

### Redesigned interface and catalog

The application sits in a rounded white frame on a soft peach background. A light header, journey sidebar, pale gray catalog, and white cart panel create the desktop composition. Orange category pills and primary actions, charcoal text, neutral borders, and reusable design tokens coordinate all eight views. Six local SVG product illustrations also appear as cart thumbnails. Typography uses an offline system font stack.

**Search the menu** matches product names and short descriptions, ignoring case and leading/trailing spaces. Search combines with the selected **All**, **Drinks**, **Food**, or **Snacks** category. Drinks contains Coffee, Soft Drink, and Bottled Water; Food contains Sandwich; Snacks contains Cookies and Chocolate. A no-results state includes **Show all products**, which clears both controls. Filtering changes only visible menu cards; it never changes quantities or the fixed ₱175 order.

The desktop catalog uses compact horizontal cards in two columns, alongside a 190px sidebar and 320px cart. At narrower desktop/tablet widths the catalog becomes one column and the journey becomes a compact horizontal indicator. Phones stack the catalog and cart, with an in-flow cart summary link that moves focus to the cart. No fixed checkout overlay obscures content. All panels scroll naturally, including on short displays.

### Screens and navigation

The prototype initially displays the populated Item Selection screen. Choose **Review Order → Continue to Payment**, then select **Cash**, **QR Payment**, or **Credit/Debit Card**.

Each branch has its own payment view. **Pay Now**, **Confirm Payment**, and **Process Payment** open a clearly marked static Payment Successful preview. **View Receipt** opens the corresponding method-specific digital receipt. **New Transaction** switches to the empty-order visual state; use Prototype previews to load the populated fixture again.

- **Back to Order** returns from Review without changing the visible order fixture.
- **Back to Review** returns from payment-method selection.
- **Change Payment Method** on Cash and **Back** on QR/Card return to payment-method selection.
- The store identity also returns to Order.
- Progress is **1 Order** for item selection, **2 Review** for summary, **3 Payment** for method selection, payment screens, and the success preview, and **4 Receipt** for the digital receipt. The current stage has `aria-current="step"` and a highlighted number.
- The sidebar shows the current and completed stages as informational indicators; it has no shortcuts that bypass Review or select an inconsistent payment branch.

Navigation moves keyboard focus to the new screen heading and scrolls to the top. Standard vertical scrolling keeps all content and actions reachable on smaller screens. Keyboard users can use the skip link, Tab/Shift+Tab, and Enter/Space on buttons and the preview disclosure.

### Alternate visual states

Expand **Prototype previews** below the page footer. These design controls are separated from the kiosk flow:

- **Populated order**: the fixed four-item sample order, total ₱175.00.
- **Empty order**: zero items and ₱0.00; Review Order is disabled.
- **Cash: normal**: ₱200.00 amount-paid fixture and ₱25.00 sample change.
- **Cash: insufficient**: ₱100.00 against ₱175.00 due, ₱75.00 short; static error text, unavailable change, and disabled Pay Now. No validation runs.
- **Card: ready**: instructions to tap, insert, or swipe.
- **Card: processing**: a static processing message that never automatically completes. Process Payment still opens the predefined success preview.

Entering Cash or Card from the method chooser shows its normal/ready state. Returning to Order preserves the selected order fixture. New Transaction restores the empty-order fixture and default cash/card preview states, and resets catalog search/category controls.

### Fixed sample data

| Item | Quantity | Unit price | Subtotal |
| --- | --- | --- | --- |
| Coffee | 2 | ₱45.00 | ₱90.00 |
| Sandwich | 1 | ₱50.00 | ₱50.00 |
| Soft Drink | 1 | ₱35.00 | ₱35.00 |
| **Total** | **4** | | **₱175.00** |

The menu additionally displays Cookies (₱25.00), Bottled Water (₱20.00), and Chocolate (₱25.00).

| Payment fixture | Amount paid | Change | Fixed sample reference |
| --- | --- | --- | --- |
| Cash | ₱200.00 | ₱25.00 | TXN-2026-00125 |
| QR Payment | ₱175.00 | ₱0.00 | QR-TXN-2026-00126 |
| Credit/Debit Card | ₱175.00 | ₱0.00 | CARD-TXN-2026-00127 |

All receipts show **October 6, 2026 · 10:42 AM PHT** and the sample Payment Successful status. References and timestamps do not change. Success and receipt values are authored display fixtures, selected by payment branch; they are not generated or calculated.

### Placeholders and deferred functionality

Product cards, quantity minus/plus buttons, remove buttons, numeric keypad, and quick-amount buttons are native disabled controls with accessible names explaining their unavailability. The amount-paid field permits native editing, but editing never changes sample change, static error messages, success details, or receipt values. The QR graphic is labeled nonfunctional and cannot be scanned for payment. The terminal is an inline SVG illustration.

Deferred to the next phase: cart mutations, quantity rules, subtotal/total calculations, cash validation, change calculation, payment simulation or processing, reference generation, receipt generation, transaction persistence/reset logic, and receipt printing. No backend, APIs, payment gateway, browser storage, cookies, or build system are used.

### Dependencies

Bootstrap **5.3.3 CSS** is included locally in `assets/bootstrap.min.css`, sourced from the official Bootstrap distribution at `https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css`. The license header is retained; the unused source-map directive is omitted. The page does not fetch Bootstrap from a CDN at runtime. Bootstrap JavaScript is not needed. All illustrations are inline SVG; typography uses local system fonts. No external network requests are made at runtime.

### Verification

Verification uses headless Microsoft Edge and the optional `tests/kiosk.cjs` Playwright script; neither is required to open the prototype. With Node, Playwright, and Edge available, run `node tests/kiosk.cjs`. Set `PLAYWRIGHT_MODULE` to an absolute module path if using a bundled development runtime. Screenshots are written to the ignored `.verification` directory. Navigation checks cover all three payment branches, preceding-view Back actions, Continue, View Receipt, New Transaction, active progress, and matching method-specific success/receipt values. State checks cover empty/populated orders, normal/insufficient cash, and ready/processing card screens, including that input editing and disabled keypad controls cannot modify sample payment values. Each category is checked with matching, nonmatching, case-insensitive, and whitespace-padded searches; the fixed order remains unchanged.

Responsive checks cover all screens and alternate states at **1440 × 1000**, **768 × 1024**, **390 × 844**, and **320 × 700**. They check horizontal overflow, at least 48 × 48 CSS-pixel interactive targets, accessible control names, local assets, JavaScript errors, heading focus on screen changes, visible keyboard focus, and reduced motion. Rendered screenshots were also visually reviewed. These checks verify this UI phase; they do not verify deferred transaction functionality or substitute for a full assistive-technology audit.
