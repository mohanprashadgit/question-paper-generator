# 🎓 Grace College Question Paper Generator

> **🚀 Live Link to Use:** **[https://question-paper-generator-plum.vercel.app/](https://question-paper-generator-plum.vercel.app/)**

A professional, web-based automated Question Paper Generator tailored specifically for **Grace College of Engineering** standards. Generates standardized, formatted A4 question papers compliant with Anna University / Autonomous syllabus regulations, complete with automatic Bloom's Taxonomy Competency Level Analysis, Course Outcome (CO) Mapping, live A4 preview, and vector PDF exports.

---

## 🔗 Live Application
* **Live Deployment:** [https://question-paper-generator-plum.vercel.app/](https://question-paper-generator-plum.vercel.app/)
* **Platform:** Hosted on **Vercel** (Global Edge CDN)
* **Status:** 🟢 Live & Operational

---

## 🌟 Key Features & Implementation Overview

### 1. Dynamic Regulation & Paper Format Manager
* **Built-in Regulations**:
  * **Regulation 2021 (Reg 21)**: 50 Marks (Part A: 5×2=10; Part B: 2×16=32 with OR choices; Part C: 1×8=8 with OR choice). Units 1–5, CO1–CO5.
  * **Regulation 2025 (Reg 25)**: 50 Marks (Part A: 5×1=5 MCQs / Short; Part B: 3×3=9; Part C: 3×12=36 with OR choices). Units 1–7 + custom "Other" unit, CO1–CO7.
* **Custom Regulation Builder (UI Settings)**:
  * Faculty and staff can define new regulation formats directly inside the application (**Regulations & Settings**).
  * Configure custom Part count (A, B, C, D...), question counts, marks per question, MCQ support, OR internal choices, sub-questions, and Unit/CO ranges (e.g., 100 Marks semester exams, 2026 Autonomous regulations).
  * The Question Builder, Live Preview, Validation Engine, Analysis Charts, and Vector PDF generator **automatically adapt on the fly** without any code changes or database migrations.

---

### 2. Live Sticky A4 Preview
* **Side-by-Side Live Preview:** Instant real-time rendering of the question paper as you type.
* **Sticky Navigation & Eye Toggle:** Toggle the live preview panel on/off with an eye icon button or floating action button (FAB) for seamless distraction-free editing on laptops and mobile devices.
* **Pixel-Perfect A4 Format:** Strict CSS A4 dimensions (`210mm × 297mm`) matching official Grace College examination cell guidelines.

---

### 3. Header, Logo & Official Exam Template
* **Registration Number Box:** 12-box registration number grid placed at the top-right corner above the logo.
* **College Logo & Details:** Centered high-resolution college logo with automatic text fallback.
* **Regulation Subtitle:** Bold regulation text (e.g., `(Regulations 2021)` / `(Regulations 2025)`) below the header.
* **2-Column Paper Metadata:** Standardized metadata table containing Degree, Programme, Course Code (auto-uppercase), Course Name, Date, Duration, Year, Semester, and Max Marks.
* **Official Signatures Footer:** 4-column signature blocks for *Prepared By*, *Course Coordinator*, *Verified By IQAC*, and *Approved By HoD*.

---

### 4. Automatic Competency & CO Analysis Engine
* **Bloom's Taxonomy Competency Level Analysis**:
  * Tracks cognitive levels: **K1 (Remember)**, **K2 (Understand)**, **K3 (Apply)**, **K4 (Analyze)**, **K5 (Evaluate)**, and **K6 (Create)**.
  * Automatically calculates total marks, percentage contribution, and mapped question numbers.
* **Course Outcome (CO) Marks Contribution**:
  * Tracks **CO1 through CO7** marks distribution and percentage totals.
  * For OR questions, accurately calculates primary option marks to prevent double counting.

---

### 5. Diagram & Image Upload Support
* Upload diagrams, schematics, and figures directly into any question slot.
* Built-in **Image Cropper Modal** with 90° clockwise/counter-clockwise rotation and zoom.
* Alignment controls (Left, Center, Right) and sizing presets (Small, Medium, Large).

---

### 6. Multi-Engine PDF Export & Print System
* **Vector jsPDF + autoTable Generator:** Exports crisp, clean vector A4 PDFs ready for official printing.
* **Filename Sanitization:** Automatically cleans invalid filesystem characters (slashes, colons) to prevent download drops.
* **Direct Print & Print-to-PDF:** High-resolution browser print engine targeting clean `@media print` rules without UI chrome.
* **Bulk Print & Bulk Export:** Export or print multiple question papers sequentially in 1 click.

---

### 7. Saved Papers & Advanced Management
* **Instant Multi-Criteria Search & Filter:** Filter saved papers by Department / Programme (AI&DS, CSE, ECE, EEE, Civil, Mech), Year (I, II, III, IV), Regulation (21, 25), and Status (Draft, Completed, Exported).
* **Multi-Select & Bulk Actions:** Bulk print, bulk PDF download, and bulk deletion with checkbox selection.
* **Dual Timestamp Tracking:** Displays both *Last Modified* and *Created* dates.
* **Paper Duplication:** Clone existing question papers with 1 click to create new variations quickly.

---

### 8. Data Architecture & Cloud Deployment
* **Client-Side Persistence:** Instant auto-save via browser `localStorage` (`gcqp_papers`) with zero latency and full offline capability.
* **JSON Backup / Restore:** Export all saved papers and settings into a JSON backup file or import existing question paper databases.
* **Optional MySQL Backend Sync:** Includes `api.php` and `db.php` for local XAMPP MySQL or cPanel server synchronization.
* **Vercel / Cloud Ready:** Built with clean static web architecture (`index.html`, `vercel.json`) for 1-click free deployment on Vercel, Netlify, and GitHub Pages.

---

## 📁 Project Structure

```
question_paper_setting/
├── index.html               # Main entry point for Vercel / Cloud deployment
├── index.php                # Main entry point for PHP / XAMPP environments
├── api.php                  # REST API for optional MySQL database sync
├── db.php                   # Database connection helper (XAMPP / Cloud)
├── vercel.json              # Vercel deployment routing configuration
├── logo.png                 # Official Grace College header logo
├── sql/
│   └── schema.sql           # MySQL database schema for papers and question banks
└── assets/
    ├── css/
    │   └── style.css        # Responsive UI styles, A4 layout, and @media print rules
    └── js/
        ├── app.js           # Core application controller and state management
        ├── regulation21.js   # Regulation 2021 template definition
        ├── regulation25.js   # Regulation 2025 template definition
        ├── question-builder.js # Dynamic question slot renderer & rich editor
        ├── preview.js       # Live A4 preview and print layout generator
        ├── pdf-generator.js # Vector jsPDF + autoTable & html2pdf export engine
        ├── analysis.js      # Bloom's taxonomy and CO analysis computation
        ├── validation.js    # Form and question completeness validator
        ├── storage.js       # LocalStorage CRUD, filters, search & bulk actions
        └── help.js          # User guide and glossary documentation
```

---

## 🚀 Deployment Guide

### Deploying to Vercel (1-Click Free Hosting)
1. Push this repository to your **GitHub** account:
   ```bash
   git init
   git add .
   git commit -m "Deploy Grace Question Paper Generator"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
2. Log in to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository and click **"Deploy"**.
4. Your application will be live at `https://your-project.vercel.app`! Any future `git push` automatically updates the live website in seconds.

### Running Locally with XAMPP / PHP
1. Place the folder inside your XAMPP web root: `C:\xampp\htdocs\question_paper_setting`
2. Start **Apache** and **MySQL** in XAMPP Control Panel.
3. Import `sql/schema.sql` into phpMyAdmin (`http://localhost/phpmyadmin`).
4. Open your browser and navigate to `http://localhost/question_paper_setting`.

---

## 🛠️ Built With
* **HTML5 & Vanilla JavaScript (ES6+)**
* **Vanilla CSS3** (Custom Responsive Design System & Print Layouts)
* **[jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable)** (Vector A4 PDF Engine)
* **[html2pdf.js](https://ekoopmans.github.io/html2pdf.js/)** (High-Fidelity DOM Fallback Engine)
* **[Quill.js](https://quilljs.com/)** (Rich Text Formatting for Questions)
* **[Cropper.js](https://fengyuanchen.github.io/cropperjs/)** (Diagram & Image Cropper)
* **[Chart.js](https://www.chartjs.org/)** (Analysis Visualizations)

## 👥 Project Credits & Authors

* **Developed by:**
  * **R. Mohanprashad** — *Developer & Lead Contributor*
* **M.Harish Kumar** — *Developer * 

* **Under the Guidance of:**
  * **Mr. P. A. Sathish Kumar**, M.E., (Ph.D.) — *Assistant Professor, Department of Artificial Intelligence and Data Science (AI & DS)*
  * **Mrs. S. Janani**, M.E. — *Assistant Professor, Department of Artificial Intelligence and Data Science (AI & DS)*

* **Institution:**
  * **Grace College of Engineering**, Mullakkadu, Thoothukudi – 628 005.

---

## 📄 License
Developed for **Grace College of Engineering**. All rights reserved © 2026.
Created by **R. Mohanprashad** under the guidance of **Mr. P. A. Sathish Kumar, AP/AI&DS** and **Mrs. S. Janani, AP/AI&DS**.
