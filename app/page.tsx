import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#1a1414]">
      {/* Header */}
      <header className="border-b border-[var(--warm-gray-400)] bg-white dark:bg-[#1a1414]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="!mb-0">Nutrient SDK Samples</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Introduction */}
        <div className="mb-16">
          <p className="text-xl !mb-6">
            Explore interactive demos and code samples for Nutrient Web SDK.
            Each example demonstrates key features and implementation patterns
            to help you integrate document processing capabilities into your
            applications.
          </p>
        </div>

        {/* SDK Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Web SDK */}
          <div className="border border-[var(--warm-gray-400)] rounded-lg p-6 hover:border-[var(--digital-pollen)] transition-colors">
            <h2 className="!mb-4">Web SDK</h2>
            <p className="!mb-6">
              Client-side JavaScript SDK for viewing, annotating, and editing
              PDF documents in web browsers.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link
                href="/web-sdk"
                className="btn btn-yellow no-underline !text-[var(--black)]"
              >
                View Samples
              </Link>
              <a
                href="https://www.nutrient.io/sdk/web/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-yellow-outline no-underline"
              >
                Documentation
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
