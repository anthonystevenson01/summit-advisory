import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white scroll-smooth">
      {/* Navigation Bar */}
      <nav className="sticky top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex-shrink-0">
              <Link href="/" className="text-2xl font-bold text-[#1e3a8a] hover:text-[#1e40af] transition-colors">
                Summit Advisory
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-10">
              <Link href="#services" className="text-[#1f2937] hover:text-[#1e3a8a] transition-colors font-medium">
                Services
              </Link>
              <Link href="#about" className="text-[#1f2937] hover:text-[#1e3a8a] transition-colors font-medium">
                About
              </Link>
              <Link href="#consultation" className="text-[#1f2937] hover:text-[#1e3a8a] transition-colors font-medium">
                Contact
              </Link>
              <Link
                href="#consultation"
                className="bg-[#1e3a8a] text-white px-8 py-3 rounded-full hover:bg-[#1e40af] hover:scale-105 transition-all duration-300 font-medium border-2 border-[#1e3a8a]"
              >
                Book Consultation
              </Link>
            </div>
            {/* Mobile menu button */}
            <div className="md:hidden">
              <button className="text-[#1f2937] hover:text-[#1e3a8a] transition-colors">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-40 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold mb-8 leading-tight text-[#1f2937]">
              Executive Leadership When You Need It Most
            </h1>
            <p className="text-xl sm:text-2xl mb-12 text-[#4b5563] max-w-3xl mx-auto leading-relaxed">
              Fractional CXO services for SMBs ready to scale. Get C-suite expertise in growth strategy, product development, market expansion, and sales execution—without the full-time commitment.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link
                href="#consultation"
                className="bg-[#1e3a8a] text-white px-10 py-4 rounded-full hover:bg-[#1e40af] hover:scale-105 transition-all duration-300 font-semibold text-lg border-2 border-[#1e3a8a]"
              >
                Book a Call
              </Link>
              <Link
                href="#services"
                className="bg-white text-[#1e3a8a] px-10 py-4 rounded-full hover:bg-gray-50 hover:scale-105 transition-all duration-300 font-semibold text-lg border-2 border-[#1e3a8a]"
              >
                View Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-32 px-4 sm:px-6 lg:px-8 bg-[#f9fafb]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl sm:text-6xl font-bold text-center mb-20 text-[#1f2937] leading-tight">
            Our Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Service Card 1 */}
            <div className="bg-white p-10 rounded-lg border border-gray-200 hover:border-[#1e3a8a] hover:-translate-y-1 transition-all duration-300">
              <div className="w-16 h-16 border-2 border-[#1e3a8a] rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-[#1f2937]">Growth Strategy & Execution</h3>
              <p className="text-[#4b5563] leading-relaxed text-lg">
                Data-driven growth roadmaps and hands-on execution to accelerate revenue and market share
              </p>
            </div>

            {/* Service Card 2 */}
            <div className="bg-white p-10 rounded-lg border border-gray-200 hover:border-[#1e3a8a] hover:-translate-y-1 transition-all duration-300">
              <div className="w-16 h-16 border-2 border-[#1e3a8a] rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-[#1f2937]">Product Evolution & Market Fit</h3>
              <p className="text-[#4b5563] leading-relaxed text-lg">
                Refine your product strategy, validate market fit, and build roadmaps that customers actually want
              </p>
            </div>

            {/* Service Card 3 */}
            <div className="bg-white p-10 rounded-lg border border-gray-200 hover:border-[#1e3a8a] hover:-translate-y-1 transition-all duration-300">
              <div className="w-16 h-16 border-2 border-[#1e3a8a] rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-[#1f2937]">Market Entrance & Expansion</h3>
              <p className="text-[#4b5563] leading-relaxed text-lg">
                Navigate new markets with confidence. GTM strategy, positioning, and tactical execution for successful launches
              </p>
            </div>

            {/* Service Card 4 */}
            <div className="bg-white p-10 rounded-lg border border-gray-200 hover:border-[#1e3a8a] hover:-translate-y-1 transition-all duration-300">
              <div className="w-16 h-16 border-2 border-[#1e3a8a] rounded-lg flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-[#1f2937]">Sales Team Building & Deal Closing</h3>
              <p className="text-[#4b5563] leading-relaxed text-lg">
                Build high-performing sales teams and processes. Plus, I'll help close critical deals alongside your team
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl sm:text-6xl font-bold text-center mb-20 text-[#1f2937] leading-tight">
            Why Work With Summit Advisory
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            {/* Benefit 1 */}
            <div className="text-center">
              <div className="w-20 h-20 border-2 border-[#1e3a8a] rounded-full flex items-center justify-center mx-auto mb-8">
                <svg className="w-10 h-10 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-[#1f2937]">C-Suite Experience, Fractional Cost</h3>
              <p className="text-[#4b5563] leading-relaxed text-lg">
                Get executive-level strategic thinking without the full-time salary
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="text-center">
              <div className="w-20 h-20 border-2 border-[#1e3a8a] rounded-full flex items-center justify-center mx-auto mb-8">
                <svg className="w-10 h-10 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-[#1f2937]">Hands-On, Not Just Advisory</h3>
              <p className="text-[#4b5563] leading-relaxed text-lg">
                I don't just consult—I execute alongside your team and close deals
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="text-center">
              <div className="w-20 h-20 border-2 border-[#1e3a8a] rounded-full flex items-center justify-center mx-auto mb-8">
                <svg className="w-10 h-10 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-4 text-[#1f2937]">SMB-Focused Expertise</h3>
              <p className="text-[#4b5563] leading-relaxed text-lg">
                Purpose-built for growing companies navigating their next stage of scale
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Questions Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-[#1f2937] leading-tight">
              Have Questions?
            </h2>
            <p className="text-lg sm:text-xl mb-6 text-[#4b5563] leading-relaxed">
              Reach out via email or schedule a consultation below.
            </p>
            <a
              href="mailto:info@summitadvisory.com"
              className="text-[#1e3a8a] hover:text-[#1e40af] transition-colors text-lg font-medium inline-block"
            >
              info@summitadvisory.com
            </a>
            <p className="text-[#6b7280] text-sm mt-2">Based in Vancouver</p>
          </div>
        </div>
      </section>

      {/* Schedule a Consultation Section */}
      <section id="consultation" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-[#1f2937] leading-tight">
              Ready to Accelerate Your Growth?
            </h2>
            <p className="text-xl sm:text-2xl text-[#4b5563] leading-relaxed">
              Book a 30-minute consultation to discuss your business challenges
            </p>
          </div>
          <div className="w-full">
            <div className="rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white">
              <iframe
                src="https://calendly.com/anthonystevenson01/30min?embed=true&hide_gdpr_banner=1"
                width="100%"
                height="1000"
                frameBorder="0"
                className="w-full h-[1000px] sm:h-[700px]"
                title="Schedule a Consultation"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#f9fafb] text-[#4b5563] py-16 px-4 sm:px-6 lg:px-8 border-t border-gray-200">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <h3 className="text-[#1f2937] text-2xl font-bold mb-4">Summit Advisory</h3>
              <p className="text-[#6b7280] leading-relaxed">
                Fractional CXO leadership for growing SMBs.
              </p>
            </div>
            <div>
              <h4 className="text-[#1f2937] font-semibold mb-4 text-lg">Quick Links</h4>
              <ul className="space-y-3">
                <li>
                  <Link href="#services" className="hover:text-[#1e3a8a] transition-colors">
                    Services
                  </Link>
                </li>
                <li>
                  <Link href="#about" className="hover:text-[#1e3a8a] transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#contact" className="hover:text-[#1e3a8a] transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[#1f2937] font-semibold mb-4 text-lg">Connect</h4>
              <a
                href="https://linkedin.com/company/summitadvisory"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6b7280] hover:text-[#1e3a8a] transition-colors inline-flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                LinkedIn
              </a>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-[#6b7280] text-sm">
              © 2026 Summit Advisory. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 sm:mt-0">
              <Link href="/privacy" className="text-[#6b7280] hover:text-[#1e3a8a] transition-colors text-sm">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-[#6b7280] hover:text-[#1e3a8a] transition-colors text-sm">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
