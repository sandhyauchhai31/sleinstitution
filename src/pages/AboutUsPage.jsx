import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Users,
  CheckCircle2,
  GraduationCap,
  Target,
  Eye,
  Lightbulb,
  ShieldCheck,
  Globe,
  Zap,
  Star,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Building2,
  TrendingUp,
  Heart,
  Cpu,
  BadgeCheck,
  Rocket,
  Sparkles,
  ChevronRight
} from 'lucide-react';

import PublicNavbar from '../components/PublicNavbar';

// ─── Animated Counter Hook ──────────────────────────────────────────────────
function useCountUp(end, duration = 2000, start = 0) {
  const [count, setCount] = useState(start);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !hasStarted) setHasStarted(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [hasStarted, end, duration, start]);

  return [count, ref];
}

// ─── Stat Card with animated counter ───────────────────────────────────────
function StatCard({ value, suffix = '', label, icon: Icon, color }) {
  const [count, ref] = useCountUp(value, 2200);
  return (
    <div
      ref={ref}
      className={`relative group overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white border border-slate-100 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-default`}
    >
      {/* Gradient Accent */}
      <div className={`absolute -top-6 -right-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br ${color}`} />
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 bg-gradient-to-br ${color} shadow-lg`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </div>
      <div className="text-2xl sm:text-4xl font-black text-slate-900 leading-none">
        {count}<span className="text-rose-600">{suffix}</span>
      </div>
      <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

// ─── Feature / Value Card ───────────────────────────────────────────────────
function ValueCard({ icon: Icon, title, description, gradient, delay = 0 }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-7 bg-white border border-slate-100 shadow-lg hover:shadow-2xl transition-all duration-700 hover:-translate-y-1.5 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 bg-gradient-to-br ${gradient}`} />
      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-5 bg-gradient-to-br ${gradient} shadow-xl`}>
        <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
      </div>
      <h3 className="text-base sm:text-lg font-black text-slate-900 mb-2 sm:mb-3">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-medium">{description}</p>
    </div>
  );
}

// ─── Timeline Item ─────────────────────────────────────────────────────────
function TimelineItem({ year, title, desc, isRight = false, index = 0 }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`relative flex items-start gap-3.5 sm:gap-7 transition-all duration-700 ${
        visible ? 'opacity-100 translate-x-0' : `opacity-0 ${isRight ? 'translate-x-3 sm:translate-x-8' : '-translate-x-3 sm:-translate-x-8'}`
      }`}
    >
      {/* Year bubble with outer flowing glow ring */}
      <div className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 group">
        {/* Ambient background glow ring pulsing in sequence */}
        <div 
          className="absolute -inset-1 sm:-inset-1.5 rounded-full bg-gradient-to-br from-rose-500 via-amber-400 to-rose-600 opacity-40 blur-md group-hover:opacity-85 transition-opacity duration-500"
          style={{ animation: `timelineGlowPulse 3.5s ease-in-out infinite ${index * 0.45}s` }}
        />

        {/* Main circular badge */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-rose-600 via-rose-600 to-amber-500 flex flex-col items-center justify-center shadow-xl text-white border-2 border-white/50 group-hover:scale-105 transition-transform duration-300">
          <span className="text-[9px] sm:text-[10px] font-black opacity-90 uppercase tracking-widest leading-none drop-shadow-xs">Est.</span>
          <span className="text-base sm:text-xl font-black leading-tight tracking-tight drop-shadow-md">{year}</span>
        </div>
      </div>

      <div className="pt-1.5 sm:pt-3 min-w-0 flex-1">
        <h4 className="text-base sm:text-xl font-black text-slate-900 group-hover:text-rose-700 transition-colors leading-snug break-words">
          {title}
        </h4>
        <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 leading-relaxed max-w-xl break-words">
          {desc}
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
export default function AboutUsPage() {

  const values = [
    {
      icon: Lightbulb,
      title: 'Innovation in Education',
      description: 'We integrate the latest industry tools and digital teaching methodologies to prepare students for a rapidly evolving tech landscape.',
      gradient: 'from-amber-500 to-orange-600',
      delay: 0,
    },
    {
      icon: ShieldCheck,
      title: 'Integrity & Trust',
      description: 'Every certificate, result, and record we issue is backed by government registration and ISO 21001:2025 quality standards.',
      gradient: 'from-emerald-500 to-teal-700',
      delay: 100,
    },
    {
      icon: Heart,
      title: 'Student-First Approach',
      description: 'Individual attention, career counseling, and mentorship ensure no student is left behind on their journey to success.',
      gradient: 'from-rose-500 to-pink-700',
      delay: 200,
    },
    {
      icon: Globe,
      title: 'Community Reach',
      description: 'With franchisee centers spread across Karnataka, we bring quality digital education to every district and rural corner.',
      gradient: 'from-blue-500 to-indigo-700',
      delay: 300,
    },
    {
      icon: TrendingUp,
      title: 'Career Outcomes',
      description: 'Our job-oriented programs are designed with real industry requirements, ensuring placement-ready graduates every batch.',
      gradient: 'from-purple-500 to-violet-700',
      delay: 400,
    },
    {
      icon: Cpu,
      title: 'Technology Driven',
      description: 'Smart digital classrooms, online exam portals, and cloud-based records management elevate the learning experience.',
      gradient: 'from-cyan-500 to-sky-700',
      delay: 500,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden flex flex-col">
      {/* ── STICKY PUBLIC NAVBAR ── */}
      <PublicNavbar />

      {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 text-white pt-16 sm:pt-20 pb-28 sm:pb-32">
        {/* Decorative blobs */}
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-rose-700/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-20 w-[400px] h-[400px] rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        {/* Dotted Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white/10 border border-white/20 text-[10px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest text-amber-300 backdrop-blur-sm mb-6 sm:mb-8 shadow">
            <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0" />
            <span>Govt. Registered · ISO 21001:2025 Certified</span>
          </div>

          <h1 className="text-3xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-tight sm:leading-none mb-4 sm:mb-6">
            <span className="text-white">About</span>{' '}
            <span className="bg-gradient-to-r from-amber-400 via-rose-400 to-pink-400 bg-clip-text text-transparent">
              SLE Institutions
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-xs sm:text-lg text-slate-300 font-medium leading-relaxed mb-8 sm:mb-10">
            Empowering aspirations since our founding — S L E Institutions stands as Karnataka's premier professional &amp; industrial training hub, bridging skill gaps with world-class digital education.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href="/#inquiry"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs sm:text-sm shadow-xl hover:shadow-amber-500/30 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
            >
              Enroll Now <ArrowRight className="w-4 h-4 shrink-0" />
            </a>
            <a
              href="/#courses"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
            >
              Explore Courses <ChevronRight className="w-4 h-4 shrink-0" />
            </a>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none">
          <svg viewBox="0 0 1440 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 56L60 47.3C120 38.7 240 21.3 360 17.3C480 13.3 600 21.3 720 28C840 34.7 960 40 1080 38.7C1200 37.3 1320 29.3 1380 25.3L1440 21.3V56H1380C1320 56 1200 56 1080 56C960 56 840 56 720 56C600 56 480 56 360 56C240 56 120 56 60 56H0Z" fill="#f8fafc"/>
          </svg>
        </div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-3 sm:px-6 -mt-8 sm:-mt-10 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
          <StatCard value={5000}  suffix="+"  label="Students Trained"   icon={Users}         color="from-rose-500 to-rose-700"   />
          <StatCard value={25}    suffix="+"  label="Courses Offered"    icon={BookOpen}      color="from-amber-500 to-orange-600" />
          <StatCard value={30}    suffix="+"  label="Franchise Centers"  icon={Building2}     color="from-emerald-500 to-teal-700" />
          <StatCard value={15}    suffix="+"  label="Years of Excellence" icon={Award}        color="from-blue-500 to-indigo-700"  />
        </div>
      </section>

      {/* ── ABOUT US ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-24 overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-16 items-center">
          {/* Text Side */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-4 sm:mb-6">
              <BadgeCheck className="w-3.5 h-3.5" /> Who We Are
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight mb-4 sm:mb-6">
              Shaping Futures Through{' '}
              <span className="bg-gradient-to-r from-rose-600 to-amber-500 bg-clip-text text-transparent">
                Quality Education
              </span>
            </h2>
            <div className="space-y-3 sm:space-y-4 text-slate-600 text-xs sm:text-sm leading-relaxed font-medium">
              <p>
                <strong className="text-slate-900">Soft Line Educational Society (SLES)</strong> — the driving force behind SLE Institutions — is a government-registered trust committed to democratizing professional and digital education across Karnataka.
              </p>
              <p>
                Founded with the vision of bridging the skill gap between academic learning and industry demands, we have grown into a sprawling network of franchise training centers offering industry-recognized diploma and certificate programs in IT, accounting, and computer applications.
              </p>
              <p>
                Our programs are ISO 21001:2025 quality-certified and aligned with the National Skill Development framework, ensuring every learner graduates with credentials that matter in the real world.
              </p>
            </div>

            {/* Tick list */}
            <ul className="mt-6 sm:mt-8 space-y-2.5 sm:space-y-3">
              {[
                'ISO 21001:2025 Educational Quality Certified',
                'Govt. Registered Society under Karnataka Societies Act',
                'Industry-aligned curriculum updated every year',
                'Smart Digital Classrooms with certified faculty',
                'Pan-Karnataka Franchisee Network',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Image / Decorative Side */}
          <div className="relative pt-4 sm:pt-0">
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=900"
                alt="SLE Institutions students in classroom"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-rose-900/40 via-transparent to-amber-500/10" />
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-3 left-2 sm:-bottom-6 sm:-left-6 bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-3 sm:p-5 flex items-center gap-3 sm:gap-4 border border-slate-100">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shrink-0">
                <GraduationCap className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-black text-slate-900 leading-none">ISO</div>
                <div className="text-[10px] sm:text-xs font-bold text-rose-600 mt-0.5">21001:2025 Certified</div>
              </div>
            </div>

            {/* Small accent card */}
            <div className="absolute -top-3 right-2 sm:-top-6 sm:-right-6 bg-gradient-to-br from-amber-500 to-rose-600 rounded-xl sm:rounded-2xl shadow-xl p-3 sm:p-4 text-white text-center">
              <Star className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 fill-white" />
              <div className="text-lg sm:text-2xl font-black leading-none">A+</div>
              <div className="text-[9px] sm:text-[10px] font-bold opacity-80 mt-0.5">Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MISSION & VISION ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 bg-gradient-to-b from-slate-900 to-rose-950 text-white">
        {/* Decorative dots */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #fff 1.5px, transparent 1.5px)',
            backgroundSize: '30px 30px'
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-rose-700/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-5">
              <Rocket className="w-3.5 h-3.5" /> Our Purpose
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight">
              Mission &amp;{' '}
              <span className="bg-gradient-to-r from-amber-400 to-rose-400 bg-clip-text text-transparent">
                Vision
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Mission */}
            <div className="relative group overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-10 hover:bg-white/10 transition-all duration-500">
              <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-amber-400/10 blur-2xl group-hover:bg-amber-400/20 transition-all duration-500" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-xl mb-7">
                <Target className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
                Our Mission
                <span className="text-amber-400">—</span>
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed font-medium">
                To deliver accessible, affordable, and high-quality professional education that empowers individuals from every walk of life — bridging the gap between classroom learning and real-world industry requirements, with a focus on digital literacy, financial skills, and career readiness.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  'Democratize quality IT education',
                  'Build industry-ready professionals',
                  'Support rural & semi-urban learners',
                ].map(pt => (
                  <li key={pt} className="flex items-center gap-2.5 text-xs font-semibold text-amber-200">
                    <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {pt}
                  </li>
                ))}
              </ul>
            </div>

            {/* Vision */}
            <div className="relative group overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-10 hover:bg-white/10 transition-all duration-500">
              <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-rose-400/10 blur-2xl group-hover:bg-rose-400/20 transition-all duration-500" />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-700 flex items-center justify-center shadow-xl mb-7">
                <Eye className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
                Our Vision
                <span className="text-rose-400">—</span>
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed font-medium">
                To become India's most trusted educational society — known for transformative skill development, ethical practices, and measurable career outcomes — creating a generation of digitally empowered professionals who lead their communities forward.
              </p>
              <ul className="mt-6 space-y-2.5">
                {[
                  'Pan-India network of 500+ centers',
                  'ISO & NSDC aligned curriculum',
                  'Zero drop-out, 100% placement support',
                ].map(pt => (
                  <li key={pt} className="flex items-center gap-2.5 text-xs font-semibold text-rose-200">
                    <Star className="w-3.5 h-3.5 text-rose-400 shrink-0 fill-rose-400" /> {pt}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── OUR VALUES ───────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold uppercase tracking-wider mb-5">
            <Heart className="w-3.5 h-3.5" /> Core Values
          </div>
          <h2 className="text-4xl font-black text-slate-900">
            What{' '}
            <span className="bg-gradient-to-r from-rose-600 to-amber-500 bg-clip-text text-transparent">
              Drives Us
            </span>
          </h2>
          <p className="max-w-xl mx-auto text-sm text-slate-500 font-medium mt-3 leading-relaxed">
            Our six core pillars guide every decision, every course, and every interaction we have with students, faculty, and partners.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((v) => (
            <ValueCard key={v.title} {...v} />
          ))}
        </div>
      </section>

      {/* ── JOURNEY TIMELINE ─────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-50 to-rose-50 border-y border-slate-100 py-16 sm:py-24 overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-4 sm:mb-5">
              <TrendingUp className="w-3.5 h-3.5" /> Our Journey
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900">
              Milestones That{' '}
              <span className="bg-gradient-to-r from-rose-600 to-amber-500 bg-clip-text text-transparent">
                Define Us
              </span>
            </h2>
          </div>

          <div className="relative">
            {/* Animated Flow Track (centered directly on badges: 64px on mobile at x=32px, 80px on desktop at x=40px) */}
            <div className="absolute left-8 sm:left-10 -translate-x-1/2 top-8 bottom-8 w-1 sm:w-1.5 z-0 pointer-events-none">
              {/* Soft ambient background track */}
              <div className="absolute inset-0 bg-rose-200/50 rounded-full" />

              {/* Streaming gradient flow track from top to bottom */}
              <div className="absolute inset-0 timeline-track-animated rounded-full shadow-[0_0_12px_rgba(244,63,94,0.45)]" />

              {/* Continuous downward flowing energy laser / comet */}
              <div className="timeline-comet-beam" />

              {/* Glowing emitter pulse at top */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-[0_0_12px_#f59e0b] animate-ping opacity-75" />
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-[0_0_8px_#f59e0b]" />

              {/* Glowing receiver pulse at bottom */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-rose-600 border-2 border-white shadow-[0_0_12px_#f43f5e] animate-ping opacity-75" />
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-rose-600 border-2 border-white shadow-[0_0_8px_#f43f5e]" />
            </div>

            <div className="space-y-12 relative z-10">
              <TimelineItem index={0} year="2009" title="Foundation Year" desc="Soft Line Educational Society (SLES) was established under the Karnataka Societies Act, setting the foundation for professional IT training across Karnataka." />
              <TimelineItem index={1} year="2013" title="First 10 Franchise Centers" desc="Rapid expansion with 10+ authorized training centers across Dharwad, Belagavi, and Mysuru districts, bringing quality education to semi-urban regions." isRight />
              <TimelineItem index={2} year="2017" title="Digital Classrooms Launched" desc="Upgraded to smart digital classrooms with projectors, cloud LMS, and computer lab infrastructure — raising the standard of technical education." />
              <TimelineItem index={3} year="2020" title="Online Exam & Portal System" desc="Launched the integrated online exam portal, digital student admission system, and cloud-backed result management for fully paperless operations." isRight />
              <TimelineItem index={4} year="2023" title="ISO 21001:2025 Certification" desc="Achieved ISO 21001:2025 certification — the global benchmark for educational quality management — validating our commitment to excellence." />
              <TimelineItem index={5} year="2026" title="30+ Centers & Growing" desc="Operating 30+ franchise centers across Karnataka with 5,000+ trained professionals. Expanding with new AI, Data Analytics, and Digital Marketing programs." isRight />
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT / GET IN TOUCH SECTION ─────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-3 sm:px-6 py-12 sm:py-20 space-y-8 sm:space-y-10 overflow-hidden">
        
        {/* Top Executive Get in Touch Banner */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-rose-600 via-rose-700 to-slate-900 text-white p-5 sm:p-8 md:p-12 shadow-2xl">
          {/* Decorative blur */}
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-rose-300/10 blur-2xl pointer-events-none" />

          <div className="relative grid md:grid-cols-2 gap-6 sm:gap-8 items-center min-w-0">
            <div className="space-y-3 sm:space-y-4 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-white/15 border border-white/20 text-amber-300 text-[11px] sm:text-xs font-bold uppercase tracking-wider shadow">
                <Sparkles className="w-3.5 h-3.5 shrink-0" /> Get in Touch
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight">
                Ready to Begin Your{' '}
                <span className="bg-gradient-to-r from-amber-300 to-yellow-200 bg-clip-text text-transparent">
                  Learning Journey?
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-rose-100/90 font-medium leading-relaxed">
                Reach out to us for admission details, course guidance, verification support, or institutional queries. Our counselors are ready to help.
              </p>

              <div className="pt-2">
                <a
                  href="/#inquiry"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-900 font-black text-xs sm:text-sm shadow-xl hover:shadow-amber-400/30 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                >
                  Inquire Now <ArrowRight className="w-4 h-4 shrink-0" />
                </a>
              </div>
            </div>

            {/* Quick Contact Summary Cards for Both Offices */}
            <div className="space-y-3 sm:space-y-3.5 min-w-0">
              {/* Registered Office Pill */}
              <div className="bg-white/10 border border-white/15 rounded-xl sm:rounded-2xl p-4 backdrop-blur-sm hover:bg-white/15 transition-colors min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-300/20">
                    Registered Office · Vijayapura
                  </span>
                </div>
                <div className="text-xs text-rose-100 font-medium mb-2.5 leading-relaxed break-words">
                  KHB COLONY SOLAPUR ROAD VIJAYAPURA 586101
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs font-bold text-white min-w-0">
                  <a href="tel:9482354550" className="inline-flex items-center gap-1.5 hover:text-amber-300 transition shrink-0">
                    <Phone className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>9482354550</span>
                  </a>
                  <span className="hidden sm:inline text-white/30">•</span>
                  <a href="mailto:slesindia.headoffice@gmail.com" className="inline-flex items-center gap-1.5 hover:text-amber-300 transition min-w-0 truncate max-w-full">
                    <Mail className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">slesindia.headoffice@gmail.com</span>
                  </a>
                </div>
              </div>

              {/* Administrative Office Pill */}
              <div className="bg-white/10 border border-white/15 rounded-xl sm:rounded-2xl p-4 backdrop-blur-sm hover:bg-white/15 transition-colors min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 bg-rose-400/10 px-2 py-0.5 rounded border border-rose-300/20">
                    Administrative Office · Athani
                  </span>
                </div>
                <div className="text-xs text-rose-100 font-medium mb-2.5 leading-relaxed break-words">
                  Opposite Bus Stand Satti Road Athani Belgaum 591304
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs font-bold text-white min-w-0">
                  <div className="inline-flex items-center gap-1.5 hover:text-rose-300 transition shrink-0">
                    <Phone className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <a href="tel:9611351295" className="hover:text-rose-300 transition">9611351295</a>
                    <span>/</span>
                    <a href="tel:9916563591" className="hover:text-rose-300 transition">9916563591</a>
                  </div>
                  <span className="hidden sm:inline text-white/30">•</span>
                  <a href="mailto:slesinstitute100@gmail.com" className="inline-flex items-center gap-1.5 hover:text-rose-300 transition min-w-0 truncate max-w-full">
                    <Mail className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">slesinstitute100@gmail.com</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── TWO OFFICIAL LOCATION & MAP CARDS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          
          {/* 1. Registered Office Card + Map (Vijayapura) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xl border border-slate-200/90 hover:shadow-2xl hover:border-indigo-300 transition-all duration-300 flex flex-col justify-between space-y-5 sm:space-y-6 group min-w-0">
            
            {/* Header & Details */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border border-indigo-100 inline-block">
                    Registered Office
                  </span>
                  
                  <p className="text-xs sm:text-sm text-slate-700 font-semibold mt-1 leading-relaxed break-words">
                    KHB COLONY SOLAPUR ROAD VIJAYAPURA 586101
                  </p>
                </div>
              </div>

              {/* Contacts Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 min-w-0">
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <Phone className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div className="overflow-hidden min-w-0">
                      <span className="text-[10px] uppercase font-extrabold text-slate-500 block">Contact Phone</span>
                      <a href="tel:9482354550" className="font-extrabold text-slate-900 hover:text-indigo-600 transition text-[11px] truncate block">
                        9482354550
                      </a>
                    </div>
                  </div>
                  <a
                    href="tel:9482354550"
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-extrabold text-[11px] transition shrink-0"
                  >
                    Call
                  </a>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 min-w-0">
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div className="overflow-hidden min-w-0">
                      <span className="text-[10px] uppercase font-extrabold text-slate-500 block">Official Email</span>
                      <a href="mailto:slesindia.headoffice@gmail.com" className="font-extrabold text-slate-900 hover:text-indigo-600 transition truncate block text-[11px]">
                        slesindia.headoffice@gmail.com
                      </a>
                    </div>
                  </div>
                  <a
                    href="mailto:slesindia.headoffice@gmail.com"
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-extrabold text-[11px] transition shrink-0"
                  >
                    Mail
                  </a>
                </div>
              </div>
            </div>

            {/* Map Embed for Vijayapura */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  <h4 className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-800">Regd Office Location Map</h4>
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">Vijayapura</span>
              </div>

              <div className="relative w-full h-52 sm:h-64 rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                <iframe
                  title="Registered Office Vijayapura Map"
                  src="https://maps.google.com/maps?q=KHB+Colony+Solapur+Road+Vijayapura+Karnataka+586101&t=&z=14&ie=UTF8&iwloc=&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                ></iframe>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/80">
                <div className="min-w-0">
                  <h5 className="text-xs font-extrabold text-slate-900">S L E Institutions — Regd Office</h5>
                  <p className="text-[11px] font-medium text-slate-500 break-words">KHB Colony, Solapur Road, Vijayapura 586101</p>
                </div>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=KHB+Colony+Solapur+Road+Vijayapura+586101"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Get Directions</span>
                </a>
              </div>
            </div>

          </div>

          {/* 2. Administrative Office Card + Map (Athani) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xl border border-slate-200/90 hover:shadow-2xl hover:border-rose-300 transition-all duration-300 flex flex-col justify-between space-y-5 sm:space-y-6 group min-w-0">
            
            {/* Header & Details */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-rose-600 to-rose-800 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md border border-rose-100 inline-block">
                    Administrative Office
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 font-semibold mt-1 leading-relaxed break-words">
                    Opposite Bus Stand Satti Road Athani Belgaum 591304
                  </p>
                </div>
              </div>

              {/* Contacts Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 min-w-0">
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <Phone className="w-4 h-4 text-rose-600 shrink-0" />
                    <div className="overflow-hidden min-w-0">
                      <span className="text-[10px] uppercase font-extrabold text-slate-500 block">Contact Phone</span>
                      <div className="flex items-center gap-1 font-extrabold text-slate-900 text-[11px] truncate">
                        <a href="tel:9611351295" className="hover:text-rose-600 transition">9611351295</a>
                        <span>,</span>
                        <a href="tel:9916563591" className="hover:text-rose-600 transition">9916563591</a>
                      </div>
                    </div>
                  </div>
                  <a
                    href="tel:9611351295"
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-extrabold text-[11px] transition shrink-0"
                  >
                    Call
                  </a>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 min-w-0">
                  <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                    <Mail className="w-4 h-4 text-rose-600 shrink-0" />
                    <div className="overflow-hidden min-w-0">
                      <span className="text-[10px] uppercase font-extrabold text-slate-500 block">Office Email</span>
                      <a href="mailto:slesinstitute100@gmail.com" className="font-extrabold text-slate-900 hover:text-rose-600 transition truncate block text-[11px]">
                        slesinstitute100@gmail.com
                      </a>
                    </div>
                  </div>
                  <a
                    href="mailto:slesinstitute100@gmail.com"
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white font-extrabold text-[11px] transition shrink-0"
                  >
                    Mail
                  </a>
                </div>
              </div>
            </div>

            {/* Map Embed for Athani */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <h4 className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-800">Admin Office Location Map</h4>
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">Athani</span>
              </div>

              <div className="relative w-full h-52 sm:h-64 rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                <iframe
                  title="Administrative Office Athani Map"
                  src="https://maps.google.com/maps?q=Opposite+Bus+Stand+Satti+Road+Athani+Belgaum+Karnataka+591304&t=&z=14&ie=UTF8&iwloc=&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full"
                ></iframe>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/80">
                <div className="min-w-0">
                  <h5 className="text-xs font-extrabold text-slate-900">S L E Professional Training Institute</h5>
                  <p className="text-[11px] font-medium text-slate-500 break-words">Opp. Bus Stand, Satti Road, Athani Belgaum 591304</p>
                </div>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Opp+Bus+Stand+Satti+Road+Athani+Belgaum+591304"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Get Directions</span>
                </a>
              </div>
            </div>

          </div>

        </div>

      </section>

    </div>
  );
}
