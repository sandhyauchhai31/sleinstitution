/**
 * Utility to enforce privacy between different Franchisee Centers.
 * - Admin / Super Admin users see ALL students across all branches.
 * - Franchisee users see ONLY their own center's students.
 */

export function getLoggedInFranchiseeProfile() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('sle_portal_user_data');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function isUserAdmin() {
  if (typeof localStorage === 'undefined') return false;
  const profile = getLoggedInFranchiseeProfile();
  const isPortalUser = localStorage.getItem('sle_portal_user') === 'true';

  // If logged in as a franchisee portal user (and profile is not explicitly admin), they are NOT admin
  if (isPortalUser && profile && profile.role !== 'admin' && profile.role !== 'superadmin' && profile.isAdmin !== true) {
    return false;
  }

  const role = localStorage.getItem('sle_user_role');
  const isDemoAdmin = localStorage.getItem('sle_admin_demo') === 'true';
  
  if (role === 'admin' || isDemoAdmin) return true;
  if (profile && (profile.role === 'admin' || profile.isAdmin === true || profile.role === 'superadmin')) return true;
  
  return false;
}

export const BRANCH_ALIASES = {
  jewargi: 'jewaragi',
  jevargi: 'jewaragi',
  jewaragi: 'jewaragi',
  yadgiri: 'yadagiri',
  yadagiri: 'yadagiri',
  muglakhod: 'mugalkod',
  mugalkod: 'mugalkod',
  shapur: 'shahapur',
  shorapur: 'shahapur',
  surapur: 'shahapur',
  shahapur: 'shahapur',
  mysuru: 'mysore',
  mysore: 'mysore'
};

export function normalizeBranch(name) {
  if (!name) return '';
  const clean = String(name).trim().toLowerCase().replace(/[^a-z]/g, '');
  return BRANCH_ALIASES[clean] || clean;
}

export function canFranchiseeAccessStudent(student, profile = getLoggedInFranchiseeProfile()) {
  // 1. Admin users have full access to all students across all branches
  if (isUserAdmin() || !student) return true;

  // 2. If no franchisee profile exists, allow access
  if (!profile) return true;

  // Extract Franchisee Profile Identifiers
  const pFranchiseId = String(profile.id || profile.franchiseCode || profile.franchiseeId || profile.code || profile.environmentId || '').trim().toLowerCase();
  const pName = String(profile.franchiseName || profile.fullName || profile.username || profile.centerName || profile.ownerName || '').trim().toLowerCase();
  const pLocation = String(profile.location || profile.centerCity || profile.place || profile.city || profile.district || profile.state || '').trim().toLowerCase();
  const pTrustBranch = String(profile.trustBranch || profile.branchName || profile.trainingCenter || '').trim().toLowerCase();
  const pEmail = String(profile.email || '').trim().toLowerCase();

  // If the profile has no identifying information, allow
  if (!pFranchiseId && !pName && !pLocation && !pTrustBranch && !pEmail) {
    return true;
  }

  // Extract Student Identifiers
  const sFranchiseId = String(student.franchiseId || student.franchiseCode || student.createdById || student.franchiseeId || student.environmentId || '').trim().toLowerCase();
  const sEmail = String(student.createdBy || student.email || '').trim().toLowerCase();
  
  // Combine all branch text fields on student
  const sBranchText = [
    student.trainingCenter,
    student.trustBranch,
    student.branchName,
    student.franchiseName,
    student.environmentName,
    student.place,
    student.centerName,
    student.city,
    student.location
  ].filter(Boolean).join(' ').toLowerCase();

  // 2.5 Transferred student resolution: strictly belongs to destination branch
  const pBranchNorm = normalizeBranch(profile.location || profile.trustBranch || profile.branchName || profile.franchiseName);
  if (student.transferredTo) {
    const activeBranchNorm = normalizeBranch(student.transferredTo);
    const fromBranchNorm = normalizeBranch(student.transferredFrom);
    if (fromBranchNorm && pBranchNorm === fromBranchNorm && pBranchNorm !== activeBranchNorm) {
      return false;
    }
    if (activeBranchNorm && pBranchNorm === activeBranchNorm) {
      return true;
    }
  }

  // 3. Direct Franchisee ID Match
  if (pFranchiseId && sFranchiseId && (pFranchiseId === sFranchiseId || sFranchiseId.includes(pFranchiseId) || pFranchiseId.includes(sFranchiseId))) {
    return true;
  }

  // 3.1 Normalized Branch / Location Match (handles spelling differences e.g. Jewargi/Jewaragi, Yadgiri/Yadagiri, Muglakhod/Mugalkod)
  const sBranchNorm = normalizeBranch(student.trustBranch || student.place || student.branchName || student.city || student.location);
  if (pBranchNorm && sBranchNorm && (pBranchNorm === sBranchNorm || pBranchNorm.includes(sBranchNorm) || sBranchNorm.includes(pBranchNorm))) {
    return true;
  }

  // 4. Creator Email Match
  if (pEmail && sEmail && pEmail === sEmail) {
    return true;
  }

  // 5. Franchisee Keyword Match against Student Branch Text
  const genericWords = new Set([
    'branch', 'center', 'centre', 'training', 'sles', 'computer', 'institute', 
    'institutions', 'saksharata', 'abhiyan', 'education', 'academy', 'portal', 
    'partner', 'main', 'head', 'office', 'karnataka', 'india', 'state', 'district', 
    'fr', 'sle', '2024', '2025', '2026', '2027', '2028', 'inst', 'code', 'reg', 
    'no', 'taluk', 'taluka', 'dist', 'zone', 'area', 'undefined', 'null'
  ]);
  
  const franchiseeKeywords = Array.from(
    new Set(
      [pLocation, pTrustBranch, pName]
        .filter(k => k && k.length >= 3)
        .flatMap(k => k.split(/[\s,/-]+/))
        .map(k => k.trim().toLowerCase())
        .filter(k => k && k.length >= 3 && !genericWords.has(k) && !/^\d+$/.test(k))
    )
  );

  if (franchiseeKeywords.length > 0 && sBranchText) {
    for (const kw of franchiseeKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(sBranchText) || (kw.length >= 4 && sBranchText.includes(kw))) {
        return true;
      }
    }
  }

  // If none of the franchisee identifiers match, DENY access
  return false;
}

export function filterStudentsForFranchisee(studentsList) {
  if (!Array.isArray(studentsList) || studentsList.length === 0) return [];
  if (isUserAdmin()) return studentsList;

  const profile = getLoggedInFranchiseeProfile();
  if (!profile) return studentsList;

  return studentsList.filter(student => canFranchiseeAccessStudent(student, profile));
}
