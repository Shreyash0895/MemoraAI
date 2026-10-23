/*
 * Auth service layer.
 * Phase 1 uses a simulated backend. In Phase 2, replace the bodies of these
 * three functions with Firebase Auth calls; no UI code needs to change:
 *   signIn         -> signInWithEmailAndPassword(auth, email, password)
 *   register       -> createUserWithEmailAndPassword(auth, email, password)
 *   resetPassword  -> sendPasswordResetEmail(auth, email)
 */
export const DEMO = { email: "caregiver@memoraai.demo", password: "Memora@123" };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const authService = {
  async signIn(email, password) {
    await wait(900);
    if (email.toLowerCase() === DEMO.email && password === DEMO.password) {
      return { email, name: "Demo Caregiver", patient: "Asha" };
    }
    throw { code: "auth/invalid-credential" };
  },
  async register({ name, email, patient }) {
    await wait(1000);
    return { email, name, patient };
  },
  async resetPassword() {
    await wait(800);
  },
};
