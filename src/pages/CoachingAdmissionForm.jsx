import React, { useState, useRef } from 'react';
import { 
  User, 
  Users, 
  Calendar, 
  MapPin, 
  Mail, 
  Phone, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  GraduationCap, 
  BookOpen, 
  School,
  FileCheck,
  Check,
  Printer,
  Sparkles
} from 'lucide-react';
import { db, doc, setDoc, collection, getDocs } from '../firebase';

export default function CoachingAdmissionForm() {
  // Form State matching exact screenshot fields
  const [formData, setFormData] = useState({
    registrationNo: '4', // Default from screenshot example
    selectedClass: '10th',
    coachingPlan: 'Regular',
    name: '',
    fatherName: '',
    motherName: '',
    gender: 'Male',
    dobDay: '1',
    dobMonth: '01',
    dobYear: '1900',
    category: 'SC',
    nationality: 'Indian',
    address: '',
    city: '',
    district: '',
    state: '',
    pinCode: '',
    contactNo: '',
    email: '',
    medium: '',
    currentClass: '',
    currentBoard: '',
    currentSchool: ''
  });

  // Photo Upload State
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef(null);

  // Form Submission & Validation State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Options
  const classOptions = ['10th', '11th', '12th', 'SSLC', 'PUC', 'Diploma', 'Degree'];
  const planOptions = ['Regular', 'Residential'];
  const genderOptions = ['Male', 'Female', 'Other'];
  const categoryOptions = ['SC', 'ST', 'OBC', 'General', 'PH', 'Other'];
  
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const currentYear = new Date().getFullYear();
  const startYear = 1980;
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => String(startYear + i));

  // Handle Input Change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handle Photo Select
  const handlePhotoSelect = (file) => {
    setPhotoError('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please upload a valid image file (JPG, JPEG, PNG).');
      return;
    }

    // 100 KB size limit (100 * 1024 bytes)
    if (file.size > 100 * 1024) {
      setPhotoError(`File size (${(file.size / 1024).toFixed(1)} KB) exceeds the maximum allowed limit of 100 KB.`);
      return;
    }

    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Form Validation
  const validate = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Candidate name is required';
    if (!formData.fatherName.trim()) errors.fatherName = "Father's name is required";
    if (!formData.motherName.trim()) errors.motherName = "Mother's name is required";
    if (!formData.contactNo.trim()) errors.contactNo = 'Contact number is required';
    if (!formData.address.trim()) errors.address = 'Address is required';
    if (!formData.city.trim()) errors.city = 'City is required';
    if (!formData.district.trim()) errors.district = 'District is required';
    if (!formData.pinCode.trim()) errors.pinCode = 'Pin code is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Duplicate Student Check for Coaching Admission
  const checkDuplicateStudent = async (data) => {
    const cleanPhone = (data.contactNo || '').trim();
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanName = (data.name || '').trim().toLowerCase();
    const cleanFather = (data.fatherName || '').trim().toLowerCase();

    const matchesRecord = (r) => {
      if (cleanPhone && (r.contactNo || r.mobileNo) && String(r.contactNo || r.mobileNo).trim() === cleanPhone) {
        return { field: 'contactNo', message: 'This mobile number is already registered for an admission application.' };
      }
      if (cleanEmail && r.email && String(r.email).trim().toLowerCase() === cleanEmail) {
        return { field: 'email', message: 'This Email ID is already registered for a student admission.' };
      }
      return null;
    };

    try {
      const cached = JSON.parse(localStorage.getItem('sle_students_cache') || '[]');
      for (const item of cached) {
        const res = matchesRecord(item);
        if (res) return res;
      }
    } catch (e) {}

    try {
      if (db) {
        const studSnap = await getDocs(collection(db, 'students'));
        for (const docSnap of studSnap.docs) {
          const res = matchesRecord(docSnap.data());
          if (res) return res;
        }
        const coachSnap = await getDocs(collection(db, 'coaching_students'));
        for (const docSnap of coachSnap.docs) {
          const res = matchesRecord(docSnap.data());
          if (res) return res;
        }
      }
    } catch (e) {
      console.log('Coaching duplicate check notice:', e);
    }

    return null;
  };

  // Form Submission -> Save directly to Firebase Firestore
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 250, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);

    // Prevent duplicate student admission submission
    const dupResult = await checkDuplicateStudent(formData);
    if (dupResult) {
      setFormErrors(prev => ({ ...prev, [dupResult.field]: dupResult.message }));
      setIsSubmitting(false);
      window.scrollTo({ top: 250, behavior: 'smooth' });
      return;
    }

    const appRefNo = 'COACH-2026-' + Math.floor(100000 + Math.random() * 900000);
    const dateOfBirth = `${formData.dobYear}-${formData.dobMonth}-${formData.dobDay}`;

    // Get logged-in Franchisee Portal user details or map city/branch to Franchisee
    let currentFranchiseeId = 'FR-DEFAULT';
    let currentFranchiseeName = formData.city.trim() || 'Athani';
    try {
      const portalUser = JSON.parse(localStorage.getItem('sle_portal_user_data') || '{}');
      if (portalUser && (portalUser.id || portalUser.environmentId)) {
        currentFranchiseeId = portalUser.id || portalUser.environmentId;
        currentFranchiseeName = portalUser.franchiseName || portalUser.location || portalUser.fullName || currentFranchiseeName;
      } else {
        const cachedFranchisees = JSON.parse(localStorage.getItem('sle_franchisees_cache') || '[]');
        const cityLower = (formData.city || '').trim().toLowerCase();
        const match = cachedFranchisees.find(f => 
          (f.location && f.location.toLowerCase() === cityLower) ||
          (f.franchiseName && f.franchiseName.toLowerCase().includes(cityLower))
        );
        if (match) {
          currentFranchiseeId = match.id;
          currentFranchiseeName = match.franchiseName || match.location || currentFranchiseeName;
        } else if (formData.city.trim()) {
          currentFranchiseeId = `FR-${formData.city.trim().toUpperCase()}`;
        }
      }
    } catch (e) {}

    const coachingRecord = {
      id: appRefNo,
      appRefNo,
      registrationNo: formData.registrationNo || String(Math.floor(Math.random() * 90) + 10),
      franchiseeId: currentFranchiseeId,
      franchiseName: currentFranchiseeName,
      environmentId: currentFranchiseeId,
      trustBranch: currentFranchiseeName,
      selectedClass: formData.selectedClass,
      coachingPlan: formData.coachingPlan,
      name: formData.name.trim(),
      fatherName: formData.fatherName.trim(),
      motherName: formData.motherName.trim(),
      gender: formData.gender,
      dobDay: formData.dobDay,
      dobMonth: formData.dobMonth,
      dobYear: formData.dobYear,
      dateOfBirth,
      category: formData.category,
      nationality: formData.nationality,
      address: formData.address.trim(),
      city: formData.city.trim(),
      district: formData.district.trim(),
      state: formData.state.trim(),
      pinCode: formData.pinCode.trim(),
      contactNo: formData.contactNo.trim(),
      mobileNo: formData.contactNo.trim(),
      email: formData.email.trim(),
      medium: formData.medium.trim(),
      currentClass: formData.currentClass.trim() || formData.selectedClass,
      currentBoard: formData.currentBoard.trim(),
      currentSchool: formData.currentSchool.trim(),
      photoPreview: photoPreview || '',
      place: formData.city.trim() || 'Athani',
      appliedDate: new Date().toISOString().split('T')[0],
      submittedAt: new Date().toLocaleString(),
      createdAt: Date.now(),
      status: 'Approved',
      formType: 'Coaching Admission'
    };

    // 1. Save to Firestore 'coaching_students' and 'students' collections
    try {
      if (db) {
        await setDoc(doc(db, 'coaching_students', appRefNo), coachingRecord, { merge: true });
        await setDoc(doc(db, 'students', appRefNo), coachingRecord, { merge: true });
        console.log('Saved coaching admission form to Firestore:', appRefNo);
      }
    } catch (err) {
      console.log('Firestore coaching save error:', err);
    }

    // 2. Save to Local Cache
    try {
      const stored = JSON.parse(localStorage.getItem('sle_coaching_students_cache') || '[]');
      localStorage.setItem('sle_coaching_students_cache', JSON.stringify([coachingRecord, ...stored]));
    } catch (e) {}

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmittedData(coachingRecord);
      resetFormFields();
    }, 600);
  };

  const resetFormFields = () => {
    setFormData({
      registrationNo: String(Math.floor(Math.random() * 90) + 10),
      selectedClass: '10th',
      coachingPlan: 'Regular',
      name: '',
      fatherName: '',
      motherName: '',
      gender: 'Male',
      dobDay: '01',
      dobMonth: '01',
      dobYear: '2010',
      category: 'General (GM)',
      nationality: 'Indian',
      address: '',
      city: '',
      district: '',
      state: '',
      pinCode: '',
      contactNo: '',
      email: '',
      medium: '',
      currentClass: '',
      currentBoard: '',
      currentSchool: ''
    });
    setPhoto(null);
    setPhotoPreview(null);
    setPhotoError('');
    setFormErrors({});
  };

  const resetForm = () => {
    setSubmittedData(null);
    resetFormFields();
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-6">

      {/* Red banner matching the exact prompt screenshot with SLE color theme */}
      <div className="gradient-banner rounded-2xl py-6 px-6 sm:px-8 shadow-xl border border-rose-800/40 text-center text-white relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 space-y-1">
          <h2 className="text-xl sm:text-3xl font-black tracking-wider uppercase font-serif drop-shadow-sm">
            COACHING ADMISSION FORM
          </h2>
          <p className="text-rose-100 font-bold tracking-widest text-sm sm:text-base font-sans">
            (10TH TO 12TH CLASS)
          </p>
        </div>
      </div>

      {/* Main Glass Card Form Container matching screenshot structure */}
      <div className="glass-card bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden max-w-5xl mx-auto">
        <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8">

          {/* Row 1: Registration No, Class, Coaching Plan */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80">
            {/* Registration No */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Registration No:
              </label>
              <input
                type="text"
                name="registrationNo"
                value={formData.registrationNo}
                onChange={handleChange}
                placeholder="Enter Registration No"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 font-semibold focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            {/* Class */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Class:
              </label>
              <select
                name="selectedClass"
                value={formData.selectedClass}
                onChange={handleChange}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 font-semibold focus:outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20"
              >
                {classOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Training Plan (Label: TRAINING PLAN, Default: Regular, NOT EDITABLE) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                TRAINING PLAN:
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="coachingPlan"
                  value="Regular"
                  readOnly
                  disabled
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-700 font-bold cursor-not-allowed select-none"
                />
                <span className="absolute right-3 top-2.5 text-[11px] font-semibold text-slate-400">
                  (Default)
                </span>
              </div>
            </div>
          </div>


          {/* Row 2: Name, Father's Name, Mother's Name */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-rose-700 border-b border-slate-200 pb-2">
              1. Student Information
            </h3>

            <div className="space-y-4">
              {/* Name */}
              <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2 md:gap-4">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Name: <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-3">
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter Name"
                    className={`w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none transition-all ${
                      formErrors.name 
                        ? 'border-rose-500 bg-rose-50/50 focus:ring-2 focus:ring-rose-500/20' 
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                    }`}
                  />
                  {formErrors.name && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.name}</p>}
                </div>
              </div>

              {/* Father's Name */}
              <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2 md:gap-4">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Fathers Name: <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-3">
                  <input
                    type="text"
                    name="fatherName"
                    value={formData.fatherName}
                    onChange={handleChange}
                    placeholder="Enter Fathers Name"
                    className={`w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none transition-all ${
                      formErrors.fatherName 
                        ? 'border-rose-500 bg-rose-50/50 focus:ring-2 focus:ring-rose-500/20' 
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                    }`}
                  />
                  {formErrors.fatherName && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.fatherName}</p>}
                </div>
              </div>

              {/* Mother's Name */}
              <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2 md:gap-4">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Mothers Name: <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-3">
                  <input
                    type="text"
                    name="motherName"
                    value={formData.motherName}
                    onChange={handleChange}
                    placeholder="Enter Mothers Name"
                    className={`w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none transition-all ${
                      formErrors.motherName 
                        ? 'border-rose-500 bg-rose-50/50 focus:ring-2 focus:ring-rose-500/20' 
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                    }`}
                  />
                  {formErrors.motherName && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.motherName}</p>}
                </div>
              </div>
            </div>
          </div>


          {/* Row 3: Gender & Date of Birth */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-rose-700 border-b border-slate-200 pb-2">
              2. Personal Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Gender */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-4">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Gender:
                </label>
                <div className="md:col-span-2">
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  >
                    {genderOptions.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date of Birth */}
              <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Date of Birth:
                </label>
                <div className="md:col-span-3 grid grid-cols-3 gap-2">
                  <select
                    name="dobDay"
                    value={formData.dobDay}
                    onChange={handleChange}
                    className="px-2.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  >
                    {days.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    name="dobMonth"
                    value={formData.dobMonth}
                    onChange={handleChange}
                    className="px-2.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  >
                    {months.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    name="dobYear"
                    value={formData.dobYear}
                    onChange={handleChange}
                    className="px-2.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>


          {/* Row 4: Category & Nationality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category */}
            <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-4">
              <label className="text-xs font-bold text-slate-700 md:text-right">
                Category:
              </label>
              <div className="md:col-span-2">
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                >
                  {categoryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nationality */}
            <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-2 md:gap-3">
              <label className="text-xs font-bold text-slate-700 md:text-right">
                Nationality:
              </label>
              <div className="md:col-span-3">
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  placeholder="Enter Nationality"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
            </div>
          </div>


          {/* Row 5: Address, City, District, State, Pin Code, Contact No, Email */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-rose-700 border-b border-slate-200 pb-2">
              3. Contact & Location Information
            </h3>

            {/* Address */}
            <div className="grid grid-cols-1 md:grid-cols-6 items-center gap-2 md:gap-4">
              <label className="text-xs font-bold text-slate-700 md:text-right md:col-span-1">
                Address: <span className="text-rose-500">*</span>
              </label>
              <div className="md:col-span-5">
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter Address"
                  className={`w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none transition-all ${
                    formErrors.address 
                      ? 'border-rose-500 bg-rose-50/50' 
                      : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                  }`}
                />
                {formErrors.address && <p className="text-xs text-rose-600 flex items-center gap-1 mt-1"><AlertCircle className="w-3.5 h-3.5" />{formErrors.address}</p>}
              </div>
            </div>

            {/* City & District */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* City */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  City: <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Enter city"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                  {formErrors.city && <p className="text-xs text-rose-600 mt-1">{formErrors.city}</p>}
                </div>
              </div>

              {/* District */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  District: <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    placeholder="Enter District"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                  {formErrors.district && <p className="text-xs text-rose-600 mt-1">{formErrors.district}</p>}
                </div>
              </div>
            </div>

            {/* State & Pin Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* State */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  State:
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Enter state"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              {/* Pin Code */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Pin Code: <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="pinCode"
                    maxLength="6"
                    value={formData.pinCode}
                    onChange={handleChange}
                    placeholder="Enter Pin Code"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                  {formErrors.pinCode && <p className="text-xs text-rose-600 mt-1">{formErrors.pinCode}</p>}
                </div>
              </div>
            </div>

            {/* Contact No & Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact No */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Contact No: <span className="text-rose-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="tel"
                    name="contactNo"
                    maxLength="10"
                    value={formData.contactNo}
                    onChange={handleChange}
                    placeholder="Enter Contact No"
                    className={`w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none transition-all ${
                      formErrors.contactNo 
                        ? 'border-rose-500 bg-rose-50/50' 
                        : 'border-slate-300 bg-slate-50/50 focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20'
                    }`}
                  />
                  {formErrors.contactNo && <p className="text-xs text-rose-600 mt-1">{formErrors.contactNo}</p>}
                </div>
              </div>

              {/* Email */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Email:
                </label>
                <div className="md:col-span-2">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter Your Email ID"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>
            </div>
          </div>


          {/* Row 6: Medium, Current Class, Current Board, Current School */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-rose-700 border-b border-slate-200 pb-2">
              4. Current Academic Background
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Medium */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Medium:
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="medium"
                    value={formData.medium}
                    onChange={handleChange}
                    placeholder="Enter Medium"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              {/* Current Class */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Current Class:
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="currentClass"
                    value={formData.currentClass}
                    onChange={handleChange}
                    placeholder="Enter class"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current Board */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Current Board:
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="currentBoard"
                    value={formData.currentBoard}
                    onChange={handleChange}
                    placeholder="Enter board"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              {/* Current School */}
              <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2 md:gap-3">
                <label className="text-xs font-bold text-slate-700 md:text-right">
                  Current School:
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="currentSchool"
                    value={formData.currentSchool}
                    onChange={handleChange}
                    placeholder="Enter school"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/50 text-sm focus:outline-none focus:border-rose-600 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>
            </div>
          </div>


          {/* Section: File Upload matching exact prompt note & labels */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-rose-600" /> File Upload
            </h3>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <p className="text-xs font-bold text-rose-600">
                Notes: File size must be less than 100kb
              </p>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Candidate photo (passport size)
                </label>

                {/* Upload Box */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => !photoPreview && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer bg-white ${
                    photoError 
                      ? 'border-rose-400 bg-rose-50/40' 
                      : photoPreview 
                      ? 'border-emerald-500 bg-emerald-50/20' 
                      : 'border-slate-300 hover:border-rose-500 hover:bg-rose-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && handlePhotoSelect(e.target.files[0])}
                  />

                  {photoPreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <img
                          src={photoPreview}
                          alt="Candidate Photo Preview"
                          className="w-28 h-36 object-cover rounded-lg border-2 border-emerald-500 shadow-md"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removePhoto();
                          }}
                          className="absolute -top-2 -right-2 bg-rose-600 text-white p-1 rounded-full shadow hover:bg-rose-700 transition"
                          title="Remove Photo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Photo Uploaded ({ (photo?.size / 1024).toFixed(1) } KB)
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold shadow-sm transition"
                        >
                          Choose File
                        </button>
                        <span className="text-xs text-slate-500">
                          {photo ? photo.name : 'No file chosen'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Supports JPG, PNG • Max size 100 KB
                      </p>
                    </div>
                  )}
                </div>

                {photoError && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                    <AlertCircle className="w-3.5 h-3.5" />{photoError}
                  </p>
                )}
              </div>
            </div>
          </div>


          {/* Submit / Insert Button (matching screenshot "Insert" blue/rose pill button) */}
          <div className="pt-6 border-t border-slate-200 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={resetForm}
              className="px-5 py-2.5 rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition"
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="gradient-button text-white px-12 py-2.5 rounded-full font-bold text-sm shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Insert</span>
              )}
            </button>
          </div>

        </form>
      </div>

      {/* OFFICIAL COACHING ADMISSION FORM ACKNOWLEDGMENT VIEW */}
      {submittedData && (
        <div id="printable-coaching-modal" className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto printable-modal">
          <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full p-3 sm:p-8 shadow-2xl border border-slate-300 relative max-h-[95vh] overflow-y-auto">
            
            {/* Action Bar (Hidden when printing) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4 sm:mb-6 print-hide print:hidden">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider">Coaching Admission Submitted Successfully</span>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl flex items-center gap-2 shadow transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Admission Form</span>
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl flex items-center gap-2 shadow transition cursor-pointer"
                >
                  <span>Add Another Form</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubmittedData(null)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE OFFICIAL COACHING ADMISSION FORM DOCUMENT */}
            <div id="printable-coaching-form" className="bg-white text-slate-900 space-y-4 sm:space-y-6 font-sans p-1 sm:p-4 printable-document">
              
              {/* Header Section */}
              <div className="flex items-start justify-between relative pb-2 border-b border-slate-200 gap-2">
                {/* Top Left Logo (public/logo-1.jpg) */}
                <div className="w-12 h-12 sm:w-20 sm:h-20 flex-shrink-0">
                  <img src="/logo-1.jpg" alt="SLE Institutions Logo" className="w-full h-full object-contain" />
                </div>

                {/* Center Title & Subheaders */}
                <div className="text-center flex-1 px-1">
                  <h1 className="text-base sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                    SLE INSTITUTIONS
                  </h1>
                  <p className="text-[9px] sm:text-xs font-semibold text-slate-700 mt-0.5 leading-tight max-w-2xl mx-auto">
                    (Sharing Computer Literacy Movement with Govt. of India) Recognized by Govt. Of INDIA. ISO 21001:2025 Certified Institute.
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-widest mt-1">
                    Admission Form
                  </p>
                </div>

                {/* Right Spacer to balance the left logo and keep header centered */}
                <div className="w-12 sm:w-20 flex-shrink-0" />
              </div>

              {/* Main Border Boxed Form Details */}
              <div className="border border-slate-800 p-3 sm:p-8 relative min-h-[460px] text-xs sm:text-sm font-sans text-slate-900 bg-white space-y-4">
                
                {/* Candidate Photo (Centered Top of Box) */}
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border border-slate-800 overflow-hidden mx-auto shadow-sm bg-slate-100 flex items-center justify-center">
                  {submittedData.photoPreview ? (
                    <img
                      src={submittedData.photoPreview}
                      alt="Candidate Photo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 text-center px-2">Photo</span>
                  )}
                </div>

                {/* Registration No Row */}
                <div className="pb-3 border-b border-slate-300 grid grid-cols-[115px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-2 pt-2 min-w-0">
                  <span className="font-bold text-slate-900 text-xs sm:text-sm">Registration No:</span>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm break-all">{submittedData.registrationNo}</span>
                </div>

                {/* Section 1 Fields */}
                <div className="space-y-2.5 pb-3 border-b border-slate-300">
                  <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-2 min-w-0">
                    <span className="font-bold text-slate-900">Name:</span>
                    <span className="font-semibold text-slate-900 break-words">{submittedData.name}</span>
                  </div>

                  <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-2 min-w-0">
                    <span className="font-bold text-slate-900">Date of Birth:</span>
                    <span className="font-semibold text-slate-900">{submittedData.dobDay}-{submittedData.dobMonth}-{submittedData.dobYear}</span>
                  </div>

                  <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-2 min-w-0">
                    <span className="font-bold text-slate-900">Class:</span>
                    <span className="font-semibold text-slate-900 break-words">{submittedData.selectedClass}</span>
                  </div>

                  <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-2 min-w-0">
                    <span className="font-bold text-slate-900">Address:</span>
                    <span className="font-semibold text-slate-900 break-words">
                      {[submittedData.address, submittedData.city, submittedData.district, submittedData.state, submittedData.pinCode].filter(Boolean).join(', ')}
                    </span>
                  </div>
                </div>

                {/* Section 2 Fields: Father Name & Mother Name (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-slate-300 pt-1">
                  <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-2 min-w-0">
                    <span className="font-bold text-slate-900">Father Name:</span>
                    <span className="font-semibold text-slate-900 break-words">{submittedData.fatherName}</span>
                  </div>

                  <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                    <span className="font-bold text-slate-900">Mother Name:</span>
                    <span className="font-semibold text-slate-900 break-words">{submittedData.motherName}</span>
                  </div>
                </div>

                {/* Section 3 Fields: Contact No & Email (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-slate-300 pt-1">
                  <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-2 min-w-0">
                    <span className="font-bold text-slate-900">Contact No:</span>
                    <span className="font-semibold text-slate-900 break-all">{submittedData.contactNo}</span>
                  </div>

                  <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[140px_1fr] items-baseline gap-2 min-w-0">
                    <span className="font-bold text-slate-900">Email:</span>
                    <span className="font-semibold text-slate-900 lowercase break-all">{submittedData.email || ''}</span>
                  </div>
                </div>

                {/* Section 4 Fields: Academic Details (2 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900">Medium:</span>
                      <span className="font-semibold text-slate-900">{submittedData.medium || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-[115px_1fr] sm:grid-cols-[160px_1fr] items-baseline gap-2 min-w-0">
                      <span className="font-bold text-slate-900">Current Board:</span>
                      <span className="font-semibold text-slate-900">{submittedData.currentBoard || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-[140px_1fr] items-baseline gap-2">
                      <span className="font-bold text-slate-900">Current Class:</span>
                      <span className="font-semibold text-slate-900">{submittedData.currentClass || submittedData.selectedClass}</span>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] items-baseline gap-2">
                      <span className="font-bold text-slate-900">Current School:</span>
                      <span className="font-semibold text-slate-900">{submittedData.currentSchool || 'N/A'}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom Footer Office Address */}
              <div className="text-center pt-3 pb-1 border-t border-slate-200 space-y-0.5">
                <p className="text-[10px] sm:text-xs font-bold text-slate-800 tracking-tight">
                  Regd Office: KHB COLONY SOLAPUR ROAD VIJAYAPURA 586101 &bull; Contact: 9482354550 &bull; Email: slesindia.headoffice@gmail.com
                </p>
                <p className="text-[10px] sm:text-xs font-bold text-slate-800 tracking-tight">
                  Administrative office: Opposite Bus Stand Satti Road Athani Belgaum 591304 &bull; Contact: 9611351295, 9916563591 &bull; Email: slesinstitute100@gmail.com
                </p>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
