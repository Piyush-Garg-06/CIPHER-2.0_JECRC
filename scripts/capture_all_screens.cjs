const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function captureScreenshots() {
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

  console.log('1. Capturing Patient Home / 3D Model Overview...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(screenshotsDir, '01_patient_home_3d.png'), fullPage: false });

  console.log('2. Opening Cardiovascular Report Modal...');
  try {
    const heartTag = await page.$('.heart-tag');
    if (heartTag) {
      await heartTag.click();
      await new Promise(r => setTimeout(r, 1200));
      await page.screenshot({ path: path.join(screenshotsDir, '02_cardio_report_modal.png'), fullPage: false });
      const closeBtn = await page.$('.modal-overlay-light button, .modal-content-light button');
      if (closeBtn) await closeBtn.click();
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    console.log('Modal capture error:', e.message);
  }

  console.log('3. Switching to Doctor Portal (Ward Grid)...');
  try {
    const switchPortalBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const found = btns.find(b => b.textContent.includes('Doctor') || b.title?.includes('Switch Portal'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // In gateway modal or directly
    const accessDoctorBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const found = btns.find(b => b.textContent.includes('Access Clinical Station') || b.textContent.includes('Doctor'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, '03_ward_8bed_matrix.png'), fullPage: false });
  } catch (e) {
    console.log('Ward switch error:', e.message);
  }

  console.log('4. Navigating to Digital Twin View...');
  try {
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, div'));
      const found = links.find(el => el.textContent?.trim() === 'Digital Twin' || el.textContent?.includes('Digital Twin'));
      if (found) found.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, '04_digital_twin_laser_scan.png'), fullPage: false });
  } catch (e) {
    console.log('Digital Twin navigation error:', e.message);
  }

  console.log('5. Navigating to Predictions & Forecaster View...');
  try {
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('button, a'));
      const found = links.find(el => el.textContent?.includes('Predictions') || el.textContent?.includes('Risk Forecast'));
      if (found) found.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, '05_predictions_and_xai.png'), fullPage: false });
  } catch (e) {
    console.log('Predictions navigation error:', e.message);
  }

  console.log('6. Navigating to Electronic Health Records (EHR) Vault...');
  try {
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('button, a'));
      const found = links.find(el => el.textContent?.includes('Records') || el.textContent?.includes('Diagnostic Vault'));
      if (found) found.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, '06_ehr_diagnostic_vault.png'), fullPage: false });
  } catch (e) {
    console.log('EHR navigation error:', e.message);
  }

  console.log('7. Navigating to Alerts & Clinical Triage Center...');
  try {
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('button, a'));
      const found = links.find(el => el.textContent?.includes('Alerts') || el.textContent?.includes('Early Warning'));
      if (found) found.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, '07_clinical_alerts_center.png'), fullPage: false });
  } catch (e) {
    console.log('Alerts navigation error:', e.message);
  }

  console.log('8. Navigating to Health Magazine & YouTube Tutorials...');
  try {
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('button, a'));
      const found = links.find(el => el.textContent?.includes('Magazine') || el.textContent?.includes('Health Magazine'));
      if (found) found.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, '08_health_magazine_videos.png'), fullPage: false });
  } catch (e) {
    console.log('Magazine navigation error:', e.message);
  }

  console.log('9. Navigating to AI Chatbot View...');
  try {
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('button, a'));
      const found = links.find(el => el.textContent?.includes('AI Chatbot') || el.textContent?.includes('Clinical AI'));
      if (found) found.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(screenshotsDir, '09_ai_chatbot_assistant.png'), fullPage: false });
  } catch (e) {
    console.log('Chatbot navigation error:', e.message);
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

captureScreenshots().catch(console.error);
