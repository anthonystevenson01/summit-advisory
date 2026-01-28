import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen scroll-smooth relative z-10">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-xl lg:text-2xl font-bold text-[#1e3a8a] hover:text-[#1e40af] transition-colors">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-[#1e3a8a]" fill="currentColor" viewBox="0 0 24 24" stroke="#1e3a8a" strokeWidth={2}>
                  <path d="M2 20l4-8 4 8M6 12l-4 8M10 20l4-8 4 8M14 12l-4 8M18 20l3-4 3 4M21 16l-3 4" />
                </svg>
                <span className="hidden sm:inline">Summit Strategy Advisory</span>
                <span className="sm:hidden">Summit</span>
              </Link>
            </div>
            <div className="flex items-center">
              <Link
                href="#consultation"
                className="bg-[#1e3a8a] text-white px-4 py-2 sm:px-8 sm:py-3 rounded-full hover:bg-[#1e40af] active:scale-95 sm:hover:scale-105 transition-all duration-300 font-medium border-2 border-[#1e3a8a] text-sm sm:text-base"
              >
                <span className="hidden sm:inline">Give Us a Call</span>
                <span className="sm:hidden">Call</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 sm:pt-32 sm:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-white/25 backdrop-blur-sm sm:backdrop-blur-lg rounded-2xl p-6 sm:p-10 lg:p-12 inline-block shadow-xl">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 sm:mb-8 leading-tight text-gray-900">
                Vision. Action. Growth.
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl text-slate-800 max-w-3xl mx-auto leading-relaxed">
                By providing fractional CXO support, our seasoned executives can extend your leadership team cost effectively. We bring the strategic ideas and hands-on execution needed to achieve sustained growth
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/30 backdrop-blur-sm sm:backdrop-blur-xl rounded-2xl border border-white/40 shadow-2xl p-6 sm:p-10 lg:p-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-center text-gray-900 leading-tight mb-10 sm:mb-16">
                Where We Can Help
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 lg:gap-16">
              {/* Service Card 1 */}
              <div className="p-6 sm:p-8 rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300">
                <div className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-[#1e3a8a] rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-900">Growth Strategy & Execution</h3>
                <p className="text-slate-700 leading-relaxed text-base sm:text-lg">
                  Data-driven growth roadmaps and hands-on execution to accelerate revenue and market share
                </p>
              </div>

              {/* Service Card 2 */}
              <div className="p-6 sm:p-8 rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300">
                <div className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-[#1e3a8a] rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold mb-4 text-gray-900">Product Evolution & Market Fit</h3>
                <p className="text-slate-700 leading-relaxed text-lg">
                  Refine your product strategy, validate market fit, and build roadmaps that customers actually want
                </p>
              </div>

              {/* Service Card 3 */}
              <div className="p-6 sm:p-8 rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300">
                <div className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-[#1e3a8a] rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-900">Market Entrance & Expansion</h3>
                <p className="text-slate-700 leading-relaxed text-base sm:text-lg">
                  Navigate new markets with confidence. GTM strategy, positioning, and tactical execution for successful launches
                </p>
              </div>

              {/* Service Card 4 */}
              <div className="p-6 sm:p-8 rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300">
                <div className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-[#1e3a8a] rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-900">Sales Team Building & Deal Closing</h3>
                <p className="text-slate-700 leading-relaxed text-base sm:text-lg">
                  Build high-performing sales teams and processes. Plus, we'll help close critical deals alongside your team
                </p>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/30 backdrop-blur-sm sm:backdrop-blur-xl rounded-2xl border border-white/40 shadow-2xl p-6 sm:p-10 lg:p-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-center text-gray-900 leading-tight mb-10 sm:mb-16">
                Why Work With Summit Advisory
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 lg:gap-16">
                {/* Benefit 1 */}
                <div className="p-6 sm:p-8 rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300 text-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-[#1e3a8a] rounded-full flex items-center justify-center mx-auto mb-6 sm:mb-8">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-900">C-Suite Experience, Fractional Cost</h3>
                  <p className="text-slate-700 leading-relaxed text-base sm:text-lg">
                    Get executive-level strategic thinking without the full-time salary
                  </p>
                </div>

                {/* Benefit 2 */}
                <div className="p-8 rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300 text-center">
                  <div className="w-20 h-20 border-2 border-[#1e3a8a] rounded-full flex items-center justify-center mx-auto mb-8">
                    <svg className="w-10 h-10 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-900">Hands-On, Not Just Advisory</h3>
                  <p className="text-slate-700 leading-relaxed text-base sm:text-lg">
                    We don't just consult—we execute alongside your team and close deals
                  </p>
                </div>

                {/* Benefit 3 */}
                <div className="p-8 rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300 text-center">
                  <div className="w-20 h-20 border-2 border-[#1e3a8a] rounded-full flex items-center justify-center mx-auto mb-8">
                    <svg className="w-10 h-10 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-900">Built for Growing Companies</h3>
                  <p className="text-slate-700 leading-relaxed text-base sm:text-lg">
                    Purpose-built expertise for companies navigating their next stage of scale and expansion
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Questions Section */}
      <section id="contact" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-gray-900 leading-tight">
              Have Questions?
            </h2>
            <p className="text-base sm:text-lg lg:text-xl mb-6 text-slate-700 leading-relaxed">
              Reach out via email or schedule a consultation below.
            </p>
            <a
              href="mailto:info@summitadvisory.com"
              className="text-[#1e3a8a] hover:text-[#1e40af] transition-colors text-lg font-medium inline-block"
            >
              info@summitadvisory.com
            </a>
            <p className="text-slate-600 text-sm mt-2">Based in Vancouver</p>
          </div>
        </div>
      </section>

      {/* Schedule a Consultation Section */}
      <section id="consultation" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-gray-900 leading-tight">
              Ready to Accelerate Your Growth?
            </h2>
            <p className="text-xl sm:text-2xl text-slate-700 leading-relaxed">
              Book a 30-minute consultation to discuss your business challenges
            </p>
          </div>
          <div className="w-full">
            <div className="rounded-lg border border-gray-200 shadow-lg overflow-hidden bg-white">
              <iframe
                src="https://calendly.com/anthonystevenson01/30min?embed=true&hide_gdpr_banner=1"
                width="100%"
                height="1000"
                frameBorder="0"
                className="w-full h-[1000px] sm:h-[700px]"
                title="Schedule a Consultation"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
