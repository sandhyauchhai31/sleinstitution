const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * SCHEDULED CRON JOB: Runs every day at 9:00 AM (Asia/Kolkata timezone)
 * Scans active franchisees in Firestore and sets status = 'Expired'
 * if their endDate < today.
 */
exports.checkAndExpirePlans = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Asia/Kolkata",
    region: "asia-south1",
  },
  async (event) => {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    console.log(`[Cron] Checking franchisee plan expiries for date: ${today}`);

    try {
      const snapshot = await db
        .collection("franchisees")
        .where("status", "==", "Active")
        .get();

      if (snapshot.empty) {
        console.log("[Cron] No active franchisees found to check.");
        return;
      }

      const batch = db.batch();
      let expiredCount = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.endDate && data.endDate < today) {
          batch.update(docSnap.ref, {
            status: "Expired",
            isPlanActive: false,
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          expiredCount++;
        }
      });

      if (expiredCount > 0) {
        await batch.commit();
        console.log(`[Cron] Successfully expired ${expiredCount} past-due franchisee accounts.`);
      } else {
        console.log("[Cron] All active accounts have valid future end dates.");
      }
    } catch (err) {
      console.error("[Cron] Error running checkAndExpirePlans:", err);
    }
  }
);
