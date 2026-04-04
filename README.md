# 🦷 Blueteeth B-points Reward System

A high-fidelity, production-ready clinical reward portal for dental professionals. This system allows doctors to submit patient cases, track clinical performance metrics, and earn "B-Points" based on treatment yields, all synchronized in real-time.

![System Preview](https://github.com/user-attachments/assets/placeholder-image.png) *(Note: Add actual screenshot here)*

## 🚀 Key Features

- **Elite Doctor Dashboard**: Real-time tracking of B-Points, Total Earnings, and Case Status.
- **Dynamic Case Submission**: Streamlined workflow for initializing new patient records and clinical yields.
- **Global Clinical Stream**: Integrated activity feed with node-status indicators (Approved, Pending, Rejected).
- **Points Valuation System**: Transparent yield weightage for different treatments (e.g., Dental Implants, RCT, Prophylaxis).
- **Indestructible Authentication**: Robust Firebase-powered authentication with OTP and role-based access.
- **Zero-Latency Sync**: Real-time cloud synchronization using Google Cloud Firestore.
- **Premium UI/UX**: Built with a sleek, enterprise-grade aesthetic using Tailwind CSS and Framer Motion.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
- **Database/Auth**: [Firebase](https://firebase.google.com/) (Firestore & Authentication)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Communications**: [EmailJS](https://www.emailjs.com/)
- **State Management**: React Context API

## 📋 Treatment Yields (Sample)

| Treatment | B-Points |
| :--- | :--- |
| Dental Implant | 10 Pts |
| Root Canal (RCT) | 5 Pts |
| Prophylaxis | 2 Pts |

*Valuation: 1 B-Point = ₹50.00*

## 🏁 Getting Started

### Prerequisites

- Node.js 18.0 or later
- npm or yarn
- A Firebase project

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/blueteeth-reward-system.git
   cd blueteeth-reward-system
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory and add your Firebase and EmailJS credentials (refer to `.env.template` if available):
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Directory Structure

- `app/`: Next.js pages and routing logic.
- `components/`: Reusable UI components (buttons, cards, layout).
- `context/`: Global state management (AuthContext).
- `lib/`: Firebase configuration and Firestore utility functions.
- `public/`: Static assets and images.

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---
Built with ❤️ for the Dental Community.
