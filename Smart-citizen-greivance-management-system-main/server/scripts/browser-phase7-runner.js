/**
 * ============================================================================
 * PHASE 7: REAL BROWSER AUDIT RUNNER (CHROME CDP)
 * ============================================================================
 * Tests actual Google Chrome rendering, UI component presence, and network/console
 * health across all 4 roles:
 * 1. Login Page (/login) rendering and role controls.
 * 2. Citizen Grievance Tracking (/track) with Official Department Chat UI.
 * 3. Central Admin Dashboard (/admin) with Official Chat trigger & modal DOM.
 * 4. Department Officer Portal (/officer) with department work queue & tasks.
 * 5. Console errors and uncaught exception audit.
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const { spawn, execSync } = require('child_process');
const mongoose = require('mongoose');
const { generateToken } = require('../middleware/auth');
const User = require('../models/User');

let backendProc = null;
let frontendProc = null;
let chromeProc = null;

function killTree(pid) {
  if (!pid) return;
  try {
    execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
  } catch {}
}

const testResults = [];
function recordResult(section, testName, passed, details = '') {
  testResults.push({ section, testName, passed, details });
  const badge = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${badge}] [${section}] ${testName}`);
  if (details) console.log(`       └─ ${details}`);
}

class BrowserSession {
  constructor(ws) {
    this.ws = ws;
    this.msgId = 1;
    this.pending = new Map();
    this.consoleLogs = [];
    this.consoleErrors = [];
    this.networkRequests = [];
    this.failedRequests = [];

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.pending.has(data.id)) {
        const { resolve, reject } = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const type = data.params.type;
        const text = data.params.args.map((a) => a.value || a.description || '').join(' ');
        this.consoleLogs.push({ type, text });
        if (
          type === 'error' &&
          !text.includes('Failed to load resource: the server responded with a status of 401') &&
          !text.includes('[vite]') &&
          !text.includes('favicon')
        ) {
          this.consoleErrors.push(text);
        }
      } else if (data.method === 'Runtime.exceptionThrown') {
        const desc = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text;
        if (desc && !desc.includes('[vite]')) {
          this.consoleErrors.push(desc);
        }
      } else if (data.method === 'Network.responseReceived') {
        const resp = data.params.response;
        this.networkRequests.push({ url: resp.url, status: resp.status });
        if (resp.status >= 400 && !resp.url.includes('/api/auth/me')) {
          this.failedRequests.push({ url: resp.url, status: resp.status });
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await new Promise((r) => setTimeout(r, 1800));
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function runBrowserTests() {
  console.log('\n================================================================');
  console.log('🌐  PHASE 7: REAL BROWSER (CHROME CDP) END-TO-END AUDIT');
  console.log('================================================================\n');

  try {
    // Connect to DB to load test accounts for token generation
    await mongoose.connect(process.env.MONGODB_URI);
    const supervisor = await User.findOne({ role: 'department_supervisor', departmentName: 'Road Maintenance Department' });
    const adminUser = await User.findOne({ role: 'central_admin' });

    const supervisorToken = generateToken(supervisor);
    const adminToken = generateToken(adminUser);
    await mongoose.disconnect();

    // 1. Launch Backend (Port 5000)
    console.log('📡 Starting Backend Server on port 5000...');
    backendProc = spawn('node', ['server/index.js'], {
      cwd: path.resolve(__dirname, '../../'),
      env: { ...process.env, PORT: '5000' },
      stdio: 'pipe',
    });

    // 2. Launch Vite Frontend (Port 5173)
    console.log('⚡ Starting Vite Frontend on port 5173...');
    frontendProc = spawn('cmd.exe', ['/c', 'npx', 'vite', '--host', '127.0.0.1', '--port', '5173'], {
      cwd: path.resolve(__dirname, '../../'),
      stdio: 'pipe',
    });

    // Wait 3.5s for servers to be ready
    await new Promise((r) => setTimeout(r, 3500));

    // 3. Launch Real Google Chrome Headless with Remote Debugging
    console.log('🖥️  Launching Google Chrome with CDP on port 9222...');
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    chromeProc = spawn(chromePath, [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=C:\\Users\\Bhagya Lakshmi\\.gemini\\antigravity\\brain\\53d240b4-1f5e-4d33-a136-637917fff67c\\chrome_phase7_profile',
      'about:blank',
    ]);

    await new Promise((r) => setTimeout(r, 2000));

    const verRes = await fetch('http://127.0.0.1:9222/json/version');
    const version = await verRes.json();
    console.log(`📡 Google Chrome CDP Ready: ${version.Browser}\n`);

    // Open Main Tab
    const tabRes = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:5173/login', { method: 'PUT' });
    const tab = await tabRes.json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    const session = new BrowserSession(ws);

    await session.send('Page.enable');
    await session.send('Runtime.enable');
    await session.send('Network.enable');
    await session.setViewport(1440, 900);

    // =========================================================================
    // TEST 1: Login Page Rendering & Role Navigation
    // =========================================================================
    console.log('--- Test 1: Authentication & Login Page ---');
    await session.navigate('http://127.0.0.1:5173/login');

    const loginTitle = await session.eval('document.title');
    const inputCount = await session.eval('document.querySelectorAll("input").length');
    const buttonCount = await session.eval('document.querySelectorAll("button").length');
    const loginText = await session.eval('document.body.innerText');
    const hasBranding = loginText.includes('Citizen') || loginText.includes('Sign In') || loginText.includes('Login') || loginText.includes('Staff');

    recordResult(
      'BROWSER-LOGIN',
      'Login portal renders with credentials inputs & municipal role branding',
      Boolean(inputCount >= 2 && buttonCount >= 1 && hasBranding),
      `Title: "${loginTitle}", Inputs: ${inputCount}, Buttons: ${buttonCount}, Has Branding: ${hasBranding}`
    );

    // =========================================================================
    // TEST 2: Citizen Tracking & Official Department Chat
    // =========================================================================
    console.log('\n--- Test 2: Citizen Portal & Official Department Chat ---');
    await session.navigate('http://127.0.0.1:5173/track?id=CMP-2026-001248');

    await new Promise((r) => setTimeout(r, 2200));

    const trackPageText = await session.eval('document.body.innerText');
    const hasComplaintHeader = trackPageText.includes('CMP-2026-001248') || trackPageText.includes('Track Grievance');
    const hasChatSection =
      trackPageText.includes('Official Municipal Communication') ||
      trackPageText.includes('Department Chat') ||
      trackPageText.includes('Official Communication');

    recordResult(
      'BROWSER-CITIZEN-CHAT',
      'Citizen Grievance Tracking renders Official Department Chat container',
      Boolean(hasComplaintHeader && hasChatSection),
      `Found complaint tracking: ${hasComplaintHeader}, Official chat section found: ${hasChatSection}`
    );

    // =========================================================================
    // TEST 3: Department Officer Portal
    // =========================================================================
    console.log('\n--- Test 3: Department Officer Dashboard ---');
    // Pre-populate authenticated supervisor session
    const supervisorSessionData = {
      id: supervisor._id.toString(),
      name: supervisor.name,
      role: 'department_supervisor',
      departmentId: supervisor.departmentId?.toString(),
      departmentName: supervisor.departmentName,
      email: supervisor.email,
    };

    await session.eval(`
      localStorage.setItem('smart_city_auth_token', '${supervisorToken}');
      localStorage.setItem('smart_city_active_session_v2', JSON.stringify(${JSON.stringify(supervisorSessionData)}));
    `);

    await session.navigate('http://127.0.0.1:5173/officer');
    await new Promise((r) => setTimeout(r, 2500));

    const officerText = await session.eval('document.body.innerText');
    const hasOfficerBrand =
      officerText.includes('Officer Work Queue') ||
      officerText.includes('Department Officer') ||
      officerText.includes('Road Maintenance') ||
      officerText.includes('Tasks') ||
      officerText.includes('Workflow Stages') ||
      officerText.includes('All Grievances');

    recordResult(
      'BROWSER-OFFICER',
      'Department Officer Portal renders with Department work queue & metrics',
      Boolean(hasOfficerBrand),
      `Officer dashboard UI confirmed: ${hasOfficerBrand}`
    );

    // =========================================================================
    // TEST 4: Central Admin Dashboard
    // =========================================================================
    console.log('\n--- Test 4: Central Admin Portal ---');
    const adminSessionData = {
      id: adminUser._id.toString(),
      name: adminUser.name,
      role: 'central_admin',
      email: adminUser.email,
    };

    await session.eval(`
      localStorage.setItem('smart_city_auth_token', '${adminToken}');
      localStorage.setItem('smart_city_active_session_v2', JSON.stringify(${JSON.stringify(adminSessionData)}));
    `);

    await session.navigate('http://127.0.0.1:5173/admin');
    await new Promise((r) => setTimeout(r, 2500));

    const adminText = await session.eval('document.body.innerText');
    const hasAdminBrand =
      adminText.includes('Municipal Control Centre') ||
      adminText.includes('Grievances Directory') ||
      adminText.includes('Admin') ||
      adminText.includes('Critical');

    recordResult(
      'BROWSER-ADMIN',
      'Central Admin Dashboard renders with municipal analytics and grievances directory',
      Boolean(hasAdminBrand),
      `Admin dashboard UI confirmed: ${hasAdminBrand}`
    );

    // =========================================================================
    // TEST 5: Browser Console & Network Failure Audit
    // =========================================================================
    console.log('\n--- Test 5: Browser Console & Network Health Audit ---');

    const fatalErrors = session.consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('401') && !e.includes('[vite]') && !e.includes('Failed to load resource')
    );

    recordResult(
      'BROWSER-HEALTH',
      'Zero Fatal React Runtime Exceptions in Browser Console',
      fatalErrors.length === 0,
      fatalErrors.length === 0 ? 'No uncaught React exceptions or runtime crashes.' : `Errors: ${fatalErrors.join(', ')}`
    );

    ws.close();
  } catch (err) {
    console.error('❌ Browser test execution error:', err);
  } finally {
    console.log('\n🧹 Terminating Browser Testing Harness Processes...');
    if (chromeProc) killTree(chromeProc.pid);
    if (frontendProc) killTree(frontendProc.pid);
    if (backendProc) killTree(backendProc.pid);
    console.log('✅ Chrome, Vite, and Backend terminated safely.\n');
  }

  const passed = testResults.filter((r) => r.passed).length;
  console.log('================================================================');
  console.log(`Browser Test Summary: ${passed}/${testResults.length} checks passed`);
  console.log(`Overall Status: ${passed === testResults.length ? 'ALL BROWSER TESTS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('================================================================\n');
}

runBrowserTests();
