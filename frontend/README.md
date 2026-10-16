# PulseTwin / AURA - Frontend Clinical Dashboard

The frontend layer is an interactive, responsive medical clinical dashboard built with React 19 and Vite. It provides remote patient monitoring, interactive 2D anatomical twin visualization, 7-day risk trajectory cones, what-if counterfactual scenario simulation, and triage ward management.

---

## 📁 Frontend Directory Structure

```
frontend/
├── src/
│   ├── components/          # Reusable clinical UI components
│   │   ├── Header.jsx       # Top navigation, role toggle, stream status, alerts bell
│   │   ├── Sidebar.jsx      # Navigation sidebar drawer
│   │   ├── RiskForecastChart.jsx # Timeseries Kalman filter trajectory & forward cone
│   │   ├── RiskBadge.jsx    # Clinical triage zone pills (Green, Watch, Yellow, Red, Stale)
│   │   ├── DigitalTwin2D.jsx# Interactive SVG/canvas anatomical twin avatar
│   │   ├── HospitalBedCard.jsx # Ward bed card with telemetry summaries
│   │   ├── CareActionModal.jsx # Clinical protocol care pathway action modal
│   │   ├── ExplainabilityPanel.jsx # Top feature driver log-odds explainability
│   │   ├── ECGWaveform.jsx  # Animated rhythm & telemetry monitor
│   │   └── OrganDetailPanel.jsx # Heart and organ subsystem metrics breakdown
│   │
│   ├── views/               # Primary application page views
│   │   ├── HomeView.jsx     # Patient portal view: Digital Twin, biometrics, telemetry status
│   │   ├── WardBedView.jsx  # Doctor portal: 8-bed remote monitoring ward matrix
│   │   ├── CommandCenterView.jsx # High-level ward overview with cohort KPI cards
│   │   ├── DigitalTwinView.jsx   # In-depth twin inspection & feature explainability
│   │   ├── PredictionsView.jsx   # 7-day forward projections & risk cone
│   │   ├── AlertsView.jsx   # Triage alert notification feed with acknowledge actions
│   │   ├── AIChatbotView.jsx# Clinical AI chatbot & what-if counterfactual simulator
│   │   ├── MedicationReportsView.jsx # Prescriptions, adherence, and lab exams
│   │   ├── RecordsView.jsx  # Archived patient clinical encounter records
│   │   └── HealthMagazineView.jsx # Patient educational heart health articles
│   │
│   ├── services/            # API integration & data layers
│   │   ├── api.js           # REST API client wrapper (patients, twin, what-if, alerts)
│   │   ├── patientService.js# Polling intervals, SSE subscriber, stale data checks
│   │   ├── chatbotData.js   # Deterministic clinical rule/intent engine & what-if runner
│   │   ├── patientData.js   # Fallback mock cohort for offline demo mode
│   │   ├── magazineData.js  # Patient health magazine content
│   │   └── medicationData.js# Medication schedule data
│   │
│   ├── utils/
│   │   └── formatters.js    # Shared clinical formatters (formatRisk, isOverFifty, formatTimeAgo)
│   │
│   ├── App.jsx              # Main application shell, state management & view routing
│   ├── App.css              # App layout styles
│   ├── index.css            # Global CSS variables & clinical design system tokens
│   └── main.jsx             # React DOM entrypoint
│
├── public/                  # Static assets (images, icons, favicons)
├── tests/
│   └── frontend.test.js     # Vitest unit & integration test suite (63 tests)
├── index.html               # Single Page Application HTML root
├── vite.config.js           # Vite bundler configuration
├── package.json             # NPM dependencies & scripts
├── package-lock.json        # NPM dependency lockfile
└── .oxlintrc.json           # Linter configuration
```

---

## 🚀 Running the Frontend Standalone

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Vite Dev Server
```bash
npm run dev
```
Runs at: `http://localhost:5173`

### 3. Run Tests
```bash
npm test
```

### 4. Build Production Bundle
```bash
npm run build
```
