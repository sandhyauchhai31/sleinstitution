import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, LogIn, Menu, X } from 'lucide-react';

export default function PublicNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const isAboutPage = location.pathname === '/about' || location.pathname === '/about-us';

  const getHashLink = (hash) => {
    return isHomePage ? `#${hash}` : `/#${hash}`;
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-rose-100 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">

        {/* Logo & Institute Title */}
        <Link to="/" className="flex items-center gap-2 sm:gap-3.5 group min-w-0">
          <img 
            src="/logo-2.png" 
            alt="S.L.E. Institutions Logo" 
            className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0 group-hover:scale-105 transition-transform duration-300" 
          />
          <div className="min-w-0">
            <h1 className="text-xs sm:text-lg md:text-xl font-black tracking-tight text-slate-900 group-hover:text-rose-700 transition-colors uppercase font-serif leading-snug truncate">
              S L E INSTITUTIONS
            </h1>
            <p className="text-[9px] sm:text-[11px] font-semibold text-rose-800 flex items-center gap-1 leading-none mt-0.5 truncate">
              <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 inline shrink-0" />
              <span className="truncate">Professional &amp; Industrial Training</span>
            </p>
          </div>
        </Link>

        {/* Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-extrabold text-slate-700">
          {isHomePage ? (
            <a href="#hero" className="hover:text-rose-700 transition-colors">Home</a>
          ) : (
            <Link to="/" className="hover:text-rose-700 transition-colors">Home</Link>
          )}

          <Link 
            to="/about-us" 
            className={`transition-colors ${
              isAboutPage 
                ? 'text-rose-700 font-black' 
                : 'hover:text-rose-700'
            }`}
          >
            About Us
          </Link>

          <a href={getHashLink('courses')} className="hover:text-rose-700 transition-colors">Courses</a>
          <a href={getHashLink('directors')} className="hover:text-rose-700 transition-colors">Directors</a>
          <a href={getHashLink('contacts')} className="hover:text-rose-700 transition-colors">Contacts</a>
          <a href={getHashLink('inquiry')} className="hover:text-rose-700 transition-colors">Inquire Now</a>
        </nav>

        {/* Right Side: Franchisee Portal Login Button & Mobile Menu Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            to="/login"
            className="gradient-button text-white px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-full font-extrabold text-xs sm:text-sm shadow-md hover:shadow-rose-600/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-1 sm:gap-2 cursor-pointer border border-rose-500/30"
          >
            <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Login</span>
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-xl text-slate-700 hover:bg-slate-100 focus:outline-none transition-colors border border-slate-200"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-rose-700" /> : <Menu className="w-5 h-5 text-slate-800" />}
          </button>
        </div>

      </div>

      {/* Mobile Dropdown Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 pt-3 pb-5 space-y-3 shadow-2xl animate-in slide-in-from-top-2 duration-300">
          <nav className="flex flex-col space-y-2 font-extrabold text-sm text-slate-800">
            {isHomePage ? (
              <a
                href="#hero"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-rose-50 hover:text-rose-700 transition-colors"
              >
                Home
              </a>
            ) : (
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-xl hover:bg-rose-50 hover:text-rose-700 transition-colors"
              >
                Home
              </Link>
            )}

            <Link
              to="/about-us"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded-xl transition-colors ${
                isAboutPage 
                  ? 'bg-rose-50 text-rose-700 font-black' 
                  : 'hover:bg-rose-50 hover:text-rose-700'
              }`}
            >
              About Us
            </Link>

            <a
              href={getHashLink('courses')}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-rose-50 hover:text-rose-700 transition-colors"
            >
              Courses
            </a>
            <a
              href={getHashLink('directors')}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-rose-50 hover:text-rose-700 transition-colors"
            >
              Directors
            </a>
            <a
              href={getHashLink('contacts')}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl hover:bg-rose-50 hover:text-rose-700 transition-colors"
            >
              Contacts
            </a>
            <a
              href={getHashLink('inquiry')}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 font-extrabold transition-colors"
            >
              Inquire Now
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
