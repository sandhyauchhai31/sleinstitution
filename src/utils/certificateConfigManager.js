import { db, doc, getDoc, setDoc } from '../firebase';

export const DEFAULT_CERTIFICATE_CONFIG = {
  headerTopText: "",
  orgTitleLine1: "S.L.E.",
  orgTitleLine2: "COMPUTER SAKSHARATA ABHIYAN",
  instituteSub: "Professional & Industrial Training Institute",
  societyName: "Soft Line Educational Society",
  societyReg: "Regd By Karnataka Societies Act 17 of 1960",
  govtRecognized: "Recognized by Govt of India",
  nitiAayogTag: "National Institute of Transforming India and LLP",
  llpTag: "",
  certifiedTag: "ISO-21001:2025 CERTIFIED INSTITUTE",
  leftLogoUrl: "/logo-2.png",
  emblemUrl: "/niti-aayog-grey.png",
  rightLogoUrl: "/logo.png",
  signatoryBranchHead: "Branch Head",
  signatoryMD: "Managing Director",
  signatoryMDSub: "S.L.E.S. Institution",
  requirePayment: true,
  certificateFee: 500
};

export const getCertificateConfig = () => {
  try {
    const saved = localStorage.getItem('sle_certificate_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.orgTitleLine1 || parsed.orgTitleLine1 === 'S.L.E.S' || parsed.orgTitleLine1 === 'SLES') {
        parsed.orgTitleLine1 = 'S.L.E.';
      }
      if (!parsed.emblemUrl || parsed.emblemUrl === '/ashok-chakra.png') {
        parsed.emblemUrl = '/niti-aayog-grey.png';
      }
      if (!parsed.rightLogoUrl) {
        parsed.rightLogoUrl = '/logo.png';
      }
      if (parsed.headerTopText && parsed.headerTopText.includes('Transforming India')) {
        parsed.headerTopText = '';
      }
      if (!parsed.societyReg || parsed.societyReg.includes('1930') || parsed.societyReg.includes('Act. 1960 Society')) {
        parsed.societyReg = 'Regd By Karnataka Societies Act 17 of 1960';
      }
      if (!parsed.nitiAayogTag || parsed.nitiAayogTag === 'National Institute of Transforming India' || !parsed.nitiAayogTag.includes('LLP')) {
        parsed.nitiAayogTag = 'National Institute of Transforming India and LLP';
      }
      if (parsed.societyName && parsed.societyName.includes('®')) {
        parsed.societyName = parsed.societyName.replace(/®/g, '').trim();
      }
      if (parsed.nitiAayogTag && parsed.nitiAayogTag.includes('LLP') && parsed.llpTag === 'Limited Liability Partnership') {
        parsed.llpTag = '';
      }
      if (parsed.govtRecognized && parsed.govtRecognized.includes('india')) {
        parsed.govtRecognized = parsed.govtRecognized.replace(/\bindia\b/g, 'India');
      }
      try { localStorage.setItem('sle_certificate_config', JSON.stringify({ ...DEFAULT_CERTIFICATE_CONFIG, ...parsed })); } catch (e) {}
      return { ...DEFAULT_CERTIFICATE_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn('Error reading certificate config:', e);
  }
  return DEFAULT_CERTIFICATE_CONFIG;
};

export const saveCertificateConfig = async (newConfig) => {
  const merged = { ...DEFAULT_CERTIFICATE_CONFIG, ...newConfig };
  try {
    localStorage.setItem('sle_certificate_config', JSON.stringify(merged));
    window.dispatchEvent(new Event('sle_certificate_config_updated'));
  } catch (e) {
    console.error('Error saving certificate config to localStorage:', e);
  }

  if (db) {
    try {
      await setDoc(doc(db, 'settings', 'certificate_config'), merged, { merge: true });
    } catch (err) {
      console.warn('Firestore certificate config sync notice:', err);
    }
  }
  return merged;
};

export const fetchCertificateConfigFromFirestore = async () => {
  if (!db) return getCertificateConfig();
  try {
    const snap = await getDoc(doc(db, 'settings', 'certificate_config'));
    if (snap.exists()) {
      const data = snap.data();
      const merged = { ...DEFAULT_CERTIFICATE_CONFIG, ...data };
      if (!merged.rightLogoUrl) merged.rightLogoUrl = '/logo.png';
      if (!merged.emblemUrl || merged.emblemUrl === '/ashok-chakra.png') merged.emblemUrl = '/niti-aayog-grey.png';
      if (merged.nitiAayogTag === 'National Institute of Transforming India' || !merged.nitiAayogTag.includes('LLP')) {
        merged.nitiAayogTag = 'National Institute of Transforming India and LLP';
      }
      if (merged.nitiAayogTag && merged.nitiAayogTag.includes('LLP') && merged.llpTag === 'Limited Liability Partnership') {
        merged.llpTag = '';
      }
      if (!merged.societyReg || merged.societyReg.includes('1930') || merged.societyReg.includes('Act. 1960 Society')) {
        merged.societyReg = 'Regd By Karnataka Societies Act 17 of 1960';
      }
      if (merged.govtRecognized && merged.govtRecognized.includes('india')) {
        merged.govtRecognized = merged.govtRecognized.replace(/\bindia\b/g, 'India');
      }
      localStorage.setItem('sle_certificate_config', JSON.stringify(merged));
      window.dispatchEvent(new Event('sle_certificate_config_updated'));
      return merged;
    }
  } catch (err) {
    console.warn('Firestore fetch certificate config notice:', err);
  }
  return getCertificateConfig();
};
