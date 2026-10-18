const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function captureAllClean() {
  const screenshotsDir = path.join(__dirname, '..', 'docs', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Patient Home with 3D Twin & Laser
  console.log('1. Capturing Patient Home / 3D Model...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
    const homeBtn = items.find(el => el.textContent.includes('Patient Digital Twin') || el.textContent.includes('My Digital Twin'));
    if (homeBtn) homeBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(screenshotsDir, '01_patient_home_3d.png'), fullPage: false });

  // 2. Open Cardiovascular Report Modal
  console.log('2. Opening Cardio Report Modal...');
  try {
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const reportBtn = btns.find(b => b.textContent && b.textContent.includes('Cardiovascular Report'));
      if (reportBtn) { reportBtn.click(); return true; }
      return false;
    });
    console.log('Cardio button clicked:', clicked);
    if (clicked) {
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(screenshotsDir, '02_cardio_report_modal.png'), fullPage: false });
      // close modal by clicking overlay or close button
      await page.evaluate(() => {
        const closeBtn = document.querySelector('.modal-overlay-light button, .modal-content-light button');
        if (closeBtn) closeBtn.click();
      });
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (e) {
    console.log('Cardio modal error:', e.message);
  }

  // 3. Hospital Ward Beds
  console.log('3. Navigating to Hospital Ward Beds...');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
    const wardBtn = items.find(el => el.textContent.includes('Hospital Ward Beds'));
    if (wardBtn) wardBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(screenshotsDir, '03_ward_8bed_matrix.png'), fullPage: false });

  // 4. Explore Digital Twin Modal
  console.log('4. Opening Explore 3D Digital Twin Modal...');
  try {
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
      const homeBtn = items.find(el => el.textContent.includes('Patient Digital Twin') || el.textContent.includes('My Digital Twin'));
      if (homeBtn) homeBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    const exploreClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('Explore 3D Digital Twin'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log('Explore button clicked:', exploreClicked);
    if (exploreClicked) {
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(screenshotsDir, '04_digital_twin_laser_scan.png'), fullPage: false });
      // Close modal
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const closeBtn = btns.find(b => b.textContent && (b.textContent.includes('Exit Interactive Twin') || b.textContent.includes('Close')));
        if (closeBtn) closeBtn.click();
      });
      await new Promise(r => setTimeout(r, 800));
    }
  } catch (e) {
    console.log('Digital twin modal error:', e.message);
  }

  // 5. Prediction (7-Day Forecast & XAI)
  console.log('5. Navigating to Prediction View...');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
    const btn = items.find(el => el.textContent.includes('Prediction') || el.textContent.includes('Risk Forecast'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(screenshotsDir, '05_predictions_and_xai.png'), fullPage: false });

  // 6. Medical Records (EHR Vault)
  console.log('6. Navigating to Medical Records...');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
    const btn = items.find(el => el.textContent.includes('Medical Records'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(screenshotsDir, '06_ehr_diagnostic_vault.png'), fullPage: false });

  // 7. Alerts Triage
  console.log('7. Navigating to Alerts Triage...');
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
    const btn = items.find(el => el.textContent.includes('Alerts Triage'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(screenshotsDir, '07_clinical_alerts_center.png'), fullPage: false });

  // 8. Health Magazine (Videos) - Switch role to patient
  console.log('8. Switching to Patient Portal for Health Magazine...');
  // Directly trigger patient role switch
  await page.evaluate(() => {
    // Open gateway modal
    const roleBtns = Array.from(document.querySelectorAll('button'));
    const switchBtn = roleBtns.find(b => b.title?.includes('Switch Portal') || b.textContent.includes('Doctor Portal') || b.textContent.includes('Switch'));
    if (switchBtn) switchBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const patientBtn = btns.find(b => b.textContent && b.textContent.includes('Patient Portal') && !b.textContent.includes('Doctor'));
    if (patientBtn) patientBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));

  // Click Health Magazine
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
    const magBtn = items.find(el => el.textContent.includes('Health Magazine'));
    if (magBtn) magBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(screenshotsDir, '08_health_magazine_videos.png'), fullPage: false });

  // 9. AI Chatbot
  console.log('9. Navigating to AI Chatbot...');
  // Ensure we are inside chatbot view
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.sidebar-nav-item'));
    const botBtn = items.find(el => el.textContent.includes('AI Health Assistant') || el.textContent.includes('AI Chatbot'));
    if (botBtn) botBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  
  // Make sure no leftover modal is showing
  await page.evaluate(() => {
    const gatewayOverlay = document.querySelector('.modal-overlay-light, .portal-gateway-overlay, [class*="gateway"]');
    if (gatewayOverlay) {
      const closeBtn = gatewayOverlay.querySelector('button');
      if (closeBtn) closeBtn.click();
    }
  });
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(screenshotsDir, '09_ai_chatbot_assistant.png'), fullPage: false });

  await browser.close();
  console.log('Finished capturing all clean screenshots!');
}

captureAllClean().catch(console.error);
