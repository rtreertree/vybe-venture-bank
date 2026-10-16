"use client";

import BankApiPreview from "./bank-api-preview";

export default function InvestmentsClient() {
  return (
    <main className="bank-app-shell">
      <header className="bank-app-topbar">
        <a className="brand" href="/" aria-label="VybeVenture Bank home">
          <span className="brand-mark">V</span>
          <span>VybeVenture<span className="brand-dot"> Bank</span></span>
        </a>
        <span className="bank-app-mode"><i /> MOCK BANK APP</span>
      </header>
      <div className="bank-app-content">
        <BankApiPreview />
        <footer className="bank-app-footer">
          <span>© 2026 VybeVenture Bank</span>
          <span>Mock investment app · Not for production</span>
        </footer>
      </div>
    </main>
  );
}
