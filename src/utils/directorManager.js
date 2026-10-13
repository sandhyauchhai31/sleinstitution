import { db, collection, doc, setDoc, deleteDoc, getDocs } from '../firebase';

// 3 Core Default Directors Preserved As-Is
export const DEFAULT_DIRECTORS = [
  {
    id: 'director_chairman',
    name: 'Mr. B. Sunil',
    role: 'Managing Director / Chairman',
    email: 'Founder@sleinstitutions.com',
    image: '/directors/chairman.png',
    fallbackImage: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400',
    order: 1,
    isDefault: true,
    createdAt: 1700000000000
  },
  {
    id: 'director_vice_president',
    name: 'Mr. I. H. Pathan',
    role: 'Vice President',
    email: 'sleinstitutions.com',
    image: '/directors/vice president.png',
    fallbackImage: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400',
    order: 2,
    isDefault: true,
    createdAt: 1700000000001
  },
  {
    id: 'director_kasar',
    name: 'Mr. D. C. Kasar',
    role: 'Director',
    email: 'sleinstitutions.com',
    image: '/directors/director.png',
    fallbackImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    order: 3,
    isDefault: true,
    createdAt: 1700000000002
  }
];

const LOCAL_STORAGE_KEY = 'sle_directors_cache';
const DELETED_DEFAULT_KEY = 'sle_deleted_default_directors';
const DIRECTOR_EVENT_NAME = 'sle_directors_updated';

// Helper to generate deterministic doc ID
export const getDirectorDocId = (name) => {
  return 'director_' + String(name).toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
};

/**
 * Retrieve cached directors from localStorage or default list
 */
export const getStoredDirectors = () => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
      }
    }
  } catch (e) {
    console.warn('Error reading directors from localStorage:', e);
  }

  // Check if any default directors were deleted by admin
  let deletedDefaults = [];
  try {
    const delRaw = localStorage.getItem(DELETED_DEFAULT_KEY);
    if (delRaw) deletedDefaults = JSON.parse(delRaw);
  } catch (e) {}

  return DEFAULT_DIRECTORS
    .filter(d => !deletedDefaults.includes(d.id))
    .sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
};

/**
 * Save directors to localStorage and dispatch update event across tabs/components
 */
export const saveStoredDirectors = (directors) => {
  try {
    const sorted = [...directors].sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent(DIRECTOR_EVENT_NAME, { detail: sorted }));
  } catch (e) {
    console.warn('Error saving directors to localStorage:', e);
  }
};

let directorsFetchPromise = null;

/**
 * Fetch latest directors from Firestore once and update local cache
 */
export const refreshDirectors = async (callback) => {
  if (!db) return getStoredDirectors();
  try {
    const directorsCol = collection(db, 'directors');
    const snapshot = await getDocs(directorsCol);
    if (!snapshot.empty) {
      const firestoreList = [];
      snapshot.forEach(docSnap => {
        firestoreList.push({ id: docSnap.id, ...docSnap.data() });
      });
      const sorted = firestoreList.sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
      saveStoredDirectors(sorted);
      if (callback) callback(sorted);
      return sorted;
    }
  } catch (error) {
    console.warn('Firestore directors fetch error:', error?.message);
  }
  return getStoredDirectors();
};

/**
 * Subscribe to directors updates with LocalStorage cache + one-time Firestore fetch
 */
export const subscribeToDirectors = (callback) => {
  // First emit cached or default data immediately
  callback(getStoredDirectors());

  // Listen for local custom events (same browser tab / window)
  const handleCustomEvent = (e) => {
    if (e && e.detail) {
      callback(e.detail);
    }
  };
  window.addEventListener(DIRECTOR_EVENT_NAME, handleCustomEvent);

  // Perform single fetch on startup if db is available
  if (db) {
    if (!directorsFetchPromise) {
      directorsFetchPromise = refreshDirectors(callback);
    } else {
      directorsFetchPromise.then(res => {
        if (Array.isArray(res) && res.length > 0) callback(res);
      });
    }
  }

  return () => {
    window.removeEventListener(DIRECTOR_EVENT_NAME, handleCustomEvent);
  };
};

/**
 * Add a new director
 */
export const addDirector = async (directorData) => {
  try {
    const current = getStoredDirectors();
    const docId = getDirectorDocId(directorData.name);

    const newDirector = {
      id: docId,
      name: directorData.name.trim(),
      role: directorData.role ? directorData.role.trim() : 'Director',
      email: directorData.email ? directorData.email.trim() : 'sleinstitutions.com',
      image: directorData.image ? directorData.image.trim() : '/directors/chairman.png',
      fallbackImage: directorData.fallbackImage || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400',
      order: Number(directorData.order) || (current.length + 1),
      isDefault: false,
      createdAt: Date.now()
    };

    const updated = [...current, newDirector].sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
    saveStoredDirectors(updated);

    // Save to Firestore if accessible
    if (db) {
      try {
        await setDoc(doc(db, 'directors', docId), newDirector);
      } catch (err) {
        console.warn('Could not write director to Firestore (saved locally):', err);
      }
    }

    return { success: true, director: newDirector };
  } catch (error) {
    console.error('Error adding director:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update an existing director
 */
export const updateDirector = async (id, directorData) => {
  try {
    const current = getStoredDirectors();
    const index = current.findIndex(d => d.id === id);
    if (index === -1) {
      return { success: false, error: 'Director not found.' };
    }

    const updatedDirector = {
      ...current[index],
      ...directorData,
      name: directorData.name !== undefined ? directorData.name.trim() : current[index].name,
      role: directorData.role !== undefined ? directorData.role.trim() : current[index].role,
      email: directorData.email !== undefined ? directorData.email.trim() : current[index].email,
      image: directorData.image !== undefined ? directorData.image.trim() : current[index].image,
      order: directorData.order !== undefined ? Number(directorData.order) : current[index].order,
      updatedAt: Date.now()
    };

    const updated = [...current];
    updated[index] = updatedDirector;
    updated.sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
    saveStoredDirectors(updated);

    // Update in Firestore if available
    if (db) {
      try {
        await setDoc(doc(db, 'directors', id), updatedDirector, { merge: true });
      } catch (err) {
        console.warn('Could not update director in Firestore (saved locally):', err);
      }
    }

    return { success: true, director: updatedDirector };
  } catch (error) {
    console.error('Error updating director:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a director
 */
export const deleteDirector = async (id) => {
  try {
    const current = getStoredDirectors();
    const target = current.find(d => d.id === id);
    const updated = current.filter(d => d.id !== id);

    // If deleting a default director, track it in deleted defaults list
    if (target && target.isDefault) {
      try {
        const delRaw = localStorage.getItem(DELETED_DEFAULT_KEY);
        const deletedDefaults = delRaw ? JSON.parse(delRaw) : [];
        if (!deletedDefaults.includes(id)) {
          deletedDefaults.push(id);
          localStorage.setItem(DELETED_DEFAULT_KEY, JSON.stringify(deletedDefaults));
        }
      } catch (e) {}
    }

    saveStoredDirectors(updated);

    // Delete in Firestore if available
    if (db) {
      try {
        await deleteDoc(doc(db, 'directors', id));
      } catch (err) {
        console.warn('Could not delete director from Firestore (deleted locally):', err);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting director:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Reset directors to the 3 original defaults
 */
export const resetDirectorsToDefault = async () => {
  try {
    localStorage.removeItem(DELETED_DEFAULT_KEY);
    saveStoredDirectors(DEFAULT_DIRECTORS);

    if (db) {
      try {
        // Seed default directors into Firestore
        for (const dir of DEFAULT_DIRECTORS) {
          await setDoc(doc(db, 'directors', dir.id), dir);
        }
      } catch (err) {
        console.warn('Error resetting directors in Firestore:', err);
      }
    }

    return { success: true, directors: DEFAULT_DIRECTORS };
  } catch (error) {
    console.error('Error resetting directors:', error);
    return { success: false, error: error.message };
  }
};
