/**
 * Safely extracts academic/admission year from a student record
 * @param {Object} student 
 * @returns {string} 4-digit year string (e.g. "2026", "2025", "2024")
 */
export function getStudentYear(student) {
  if (!student) return String(new Date().getFullYear());

  // 1. Explicit year attributes
  if (student.year && /^\d{4}$/.test(String(student.year))) return String(student.year);
  if (student.admissionYear && /^\d{4}$/.test(String(student.admissionYear))) return String(student.admissionYear);
  if (student.academicYear) {
    const m = String(student.academicYear).match(/20\d\d/);
    if (m) return m[0];
  }

  // 2. Date fields (admissionDate, createdDate, startDate, date, examDate, issueDate, endDate, createdAt)
  const dateCandidates = [
    student.admissionDate,
    student.createdDate,
    student.startDate,
    student.date,
    student.examDate,
    student.issueDate,
    student.endDate,
    student.createdAt
  ];

  for (const candidate of dateCandidates) {
    if (!candidate) continue;
    // Firestore Timestamp
    if (typeof candidate === 'object' && candidate.toDate) {
      try {
        return String(candidate.toDate().getFullYear());
      } catch (_) {}
    }
    // String ISO date or human readable date
    if (typeof candidate === 'string') {
      const match = candidate.match(/\b(20\d\d)\b/);
      if (match) return match[1];
    }
  }

  // 3. ID / Registration number patterns (e.g. "202638589", "SLE-2026-9041", "STUD-2026-001")
  const idCandidates = [
    student.registrationNo,
    student.regNo,
    student.certRegNo,
    student.appNumber,
    student.admissionNo,
    student.admNo,
    student.id,
    student.uid
  ];

  for (const id of idCandidates) {
    if (!id) continue;
    const str = String(id).trim();
    const leadingMatch = str.match(/^(20\d\d)\d{3,}/);
    if (leadingMatch) return leadingMatch[1];
    const wordMatch = str.match(/\b(20\d\d)\b/);
    if (wordMatch) return wordMatch[1];
  }

  return String(new Date().getFullYear());
}

/**
 * Computes available years from a student list, guaranteeing current and future calendar years
 * are automatically present and sorted in descending order (e.g. 2027, 2026, 2025, 2024).
 * @param {Array} studentsList
 * @returns {Array<string>} sorted descending years
 */
export function getAvailableYears(studentsList = []) {
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set([
    String(currentYear),
    String(currentYear - 1),
    String(currentYear - 2),
    '2026',
    '2025',
    '2024'
  ]);

  if (Array.isArray(studentsList)) {
    studentsList.forEach(s => {
      const yr = getStudentYear(s);
      if (yr && /^\d{4}$/.test(yr)) {
        yearsSet.add(String(yr));
      }
    });
  }

  return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
}
