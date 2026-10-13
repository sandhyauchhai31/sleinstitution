import { db, doc, getDoc, updateDoc } from '../firebase.js';

/**
 * Known Administrator Emails that have permanent exemption from franchisee plan limits.
 */
const ADMIN_EMAILS = [
  'admin@slefoundation.org',
  'admin@slesinstitution.com',
  'admin@sle.org',
  'admin@gmail.com',
  's@gmail.com'
];

/**
 * Robust date parser that handles:
 * - YYYY-MM-DD and YYYY-M-D (e.g. "2026-9-01", "2026-09-01")
 * - DD/MM/YYYY and DD-MM-YYYY (e.g. "01/09/2026", "01-09-2026")
 * - ISO date strings
 * - Firestore Timestamps ({ seconds, nanoseconds } or .toDate())
 * - JavaScript Date objects
 * 
 * Returns a Date object normalized to 00:00:00 (local midnight), or null if invalid.
 */
export function parseDateToMidnight(dateInput) {
  if (!dateInput) return null;

  // 1. If Firestore Timestamp with .toDate()
  if (typeof dateInput.toDate === 'function') {
    const d = dateInput.toDate();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // 2. If plain object with seconds (Firestore timestamp serialization)
  if (typeof dateInput === 'object' && typeof dateInput.seconds === 'number') {
    const d = new Date(dateInput.seconds * 1000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // 3. If Date instance
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }

  // 4. If string
  if (typeof dateInput === 'string') {
    const str = dateInput.trim();
    if (!str) return null;

    // Matches YYYY-MM-DD, YYYY-M-D, YYYY/M/D
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1; // 0-indexed month
      const day = parseInt(ymdMatch[3], 10);
      return new Date(year, month, day);
    }

    // Matches DD-MM-YYYY, DD/MM/YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      return new Date(year, month, day);
    }

    // Standard ISO parse fallback
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }
  }

  return null;
}

/**
 * Returns today's date normalized to midnight in Asia/Kolkata (IST).
 */
export function getTodayMidnight() {
  try {
    const now = new Date();
    const istStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const [y, m, d] = istStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  } catch (e) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}

/**
 * Returns formatted YYYY-MM-DD in Asia/Kolkata (IST).
 */
export function getTodayDateString() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Check if a given plan end date has expired compared to today (IST).
 */
export function isPlanDateExpired(endDateStr) {
  if (!endDateStr) return false;
  const parsedEnd = parseDateToMidnight(endDateStr);
  if (!parsedEnd) return false;
  const todayMidnight = getTodayMidnight();
  return parsedEnd < todayMidnight;
}

/**
 * Validate a franchisee's subscription plan end date without using Cloud Functions.
 * Evaluates purely whether the plan's end date has passed today's date.
 * If the end date is valid and in the future, the plan is ACTIVE.
 * Only if the end date has passed today's date is it marked EXPIRED.
 * 
 * @param {Object} franchisee Profile object from localStorage or login
 * @returns {Promise<{ valid: boolean, status: string, endDate?: string, planName?: string, message?: string }>}
 */
export async function validateFranchiseePlanStatus(franchisee) {
  if (!franchisee) {
    return { valid: false, status: 'No_Session', message: 'No franchisee session found.' };
  }

  // Only exempt legitimate admin accounts
  const isDirectAdmin = franchisee.role === 'admin' || 
                        franchisee.isAdmin === true || 
                        (franchisee.email && ADMIN_EMAILS.includes(franchisee.email.toLowerCase()));
  if (isDirectAdmin) {
    return { valid: true, status: 'Active', message: 'Admin account has unrestricted access.' };
  }

  const franchiseId = franchisee.id || franchisee.franchiseCode;
  const todayMidnight = getTodayMidnight();

  // 1. Direct Firestore check
  if (db && franchiseId) {
    try {
      const docRef = doc(db, 'franchisees', franchiseId);
      const docSnap = await getDoc(docRef);

      if (docSnap && docSnap.exists()) {
        const liveData = docSnap.data();
        const rawDate = liveData.endDate || liveData.expiryDate || franchisee.endDate || franchisee.expiryDate;
        const parsedEnd = parseDateToMidnight(rawDate);

        // Plan expiry is strictly evaluated by date
        if (parsedEnd !== null) {
          const isDateExpired = parsedEnd < todayMidnight;

          if (isDateExpired) {
            // Update Firestore record if not yet marked Expired
            if (liveData.status !== 'Expired' || liveData.planStatus !== 'Expired' || liveData.isPlanActive !== false) {
              try {
                await updateDoc(docRef, {
                  status: 'Expired',
                  planStatus: 'Expired',
                  isPlanActive: false,
                  expiredAt: new Date().toISOString(),
                });
                liveData.status = 'Expired';
                liveData.planStatus = 'Expired';
                liveData.isPlanActive = false;
              } catch (uErr) {
                console.warn('[PlanValidator] Firestore status update skipped:', uErr?.message);
              }
            }

            return {
              valid: false,
              status: 'Expired',
              endDate: rawDate || 'N/A',
              planName: liveData.planName || franchisee.planName || 'Standard Plan',
              message: `Your franchisee plan expired on ${rawDate}. Please renew your plan to continue using the portal.`
            };
          }

          // If date has NOT expired, plan is active and valid!
          return {
            valid: true,
            status: 'Active',
            endDate: rawDate,
            planName: liveData.planName || franchisee.planName || 'Active Plan',
            message: 'Plan is active and valid.'
          };
        }

        // If no end date is set, check explicit status
        const isStatusExpired = String(liveData.status || '').toLowerCase() === 'expired';
        if (isStatusExpired) {
          return {
            valid: false,
            status: 'Expired',
            endDate: 'N/A',
            planName: liveData.planName || franchisee.planName || 'Standard Plan',
            message: 'Your franchisee plan has expired. Please renew your plan.'
          };
        }

        return {
          valid: true,
          status: 'Active',
          endDate: rawDate || 'N/A',
          planName: liveData.planName || franchisee.planName || 'Active Plan',
          message: 'Plan is active.'
        };
      }
    } catch (dbErr) {
      console.warn('[PlanValidator] Firestore direct check error:', dbErr?.message);
    }
  }

  // 2. Instant local date check (Offline fallback)
  const rawDate = franchisee.endDate || franchisee.expiryDate;
  const parsedEnd = parseDateToMidnight(rawDate);

  if (parsedEnd !== null) {
    const isDateExpired = parsedEnd < todayMidnight;
    if (isDateExpired) {
      return {
        valid: false,
        status: 'Expired',
        endDate: rawDate || 'N/A',
        planName: franchisee.planName || 'Standard Plan',
        message: `Your plan expired on ${rawDate}. Please renew your plan.`
      };
    }
  }

  return {
    valid: true,
    status: 'Active',
    endDate: rawDate || 'N/A',
    planName: franchisee.planName || 'Active Plan'
  };
}

/**
 * Specifically executed during Franchisee Login.
 * Verifies plan end date directly against Firestore & IST date.
 */
export async function checkFranchiseePlanAtLogin(franchisee) {
  return await validateFranchiseePlanStatus(franchisee);
}

/**
 * Specifically executed during Franchisee Logout.
 * Validates the franchisee's plan end date before terminating the session.
 * If expired, updates the Firestore document status to 'Expired'.
 */
export async function checkFranchiseePlanAtLogout(franchisee) {
  if (!franchisee) {
    try {
      const stored = localStorage.getItem('sle_portal_user_data');
      if (stored) franchisee = JSON.parse(stored);
    } catch (e) {}
  }
  if (!franchisee) return;

  try {
    return await validateFranchiseePlanStatus(franchisee);
  } catch (err) {
    console.warn('[PlanValidator] Logout plan check error:', err?.message);
  }
}
