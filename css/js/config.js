// ────────────────────────────
// SUPABASE CONFIG
// ────────────────────────────
const SUPABASE_URL = 'https://wlshytnzmjjuujajyeyi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indsc2h5dG56bWpqdXVqYWp5ZXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODIzOTQsImV4cCI6MjA5NDU1ODM5NH0.Gcw6fLBk-LcjyipADvhUraRClNJ2tdDyuArPBlAUwxM';

async function sbFetch(path, options = {}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ────────────────────────────
// DATA STORE
// ────────────────────────────
const BUSINESSES = [
  { id:'biz1', name:'Delta Group Logistics Inc',  icon:'🚚', industry:'Logistics'        },
  { id:'biz2', name:'Delta Freight Systems LLC',  icon:'📦', industry:'Freight'           },
  { id:'biz3', name:'DFS Equipment Leasing LLC',  icon:'🏗️', industry:'Equipment Leasing' },
  { id:'biz4', name:'Mood Shine Cannabis',         icon:'🌿', industry:'Cannabis'          },
  { id:'biz5', name:'Paychex Solutions',           icon:'💼', industry:'Payroll & HR'      },
];

const CONTENT = {
  biz1: {
    docs: ['Logistics Operations Manual','Client Service Agreements','Fleet Management Report','Insurance & Compliance Docs'],
    financials: [{ label:'Revenue Q2', value:'—', up:true },{ label:'Operating Costs', value:'—', up:false },{ label:'Net Profit', value:'—', up:true },{ label:'Fleet Utilization', value:'—', up:true }]
  },
  biz2: {
    docs: ['Freight Rate Schedule','Carrier Agreements','Shipment Reports Q2','DOT Compliance Files'],
    financials: [{ label:'Freight Revenue', value:'—', up:true },{ label:'Carrier Costs', value:'—', up:false },{ label:'Net Profit', value:'—', up:true },{ label:'Load Growth', value:'—', up:true }]
  },
  biz3: {
    docs: ['Equipment Lease Agreements','Asset Register 2025','Maintenance Schedules','Client Contracts'],
    financials: [{ label:'Lease Revenue', value:'—', up:true },{ label:'Maintenance Costs', value:'—', up:false },{ label:'Net Profit', value:'—', up:true },{ label:'Fleet Value', value:'—', up:true }]
  },
  biz4: {
    docs: ['License & Compliance Docs','Product Catalog 2025','Vendor Agreements','Lab Test Reports'],
    financials: [{ label:'Sales Revenue', value:'—', up:true },{ label:'COGS', value:'—', up:false },{ label:'Net Profit', value:'—', up:true },{ label:'Sales Growth', value:'—', up:true }]
  },
  biz5: {
    docs: ['Payroll Processing Guide','HR Policy Manual','Client Onboarding Docs','Service Agreements'],
    financials: [{ label:'Service Revenue', value:'—', up:true },{ label:'Operating Costs', value:'—', up:false },{ label:'Net Profit', value:'—', up:true },{ label:'Client Growth', value:'—', up:true }]
  },
};

const ADMIN = { username: 'admin', password: 'Portal@Delta99!' };
const RESEND_API_KEY = 're_AsM1mQSL_6eroVM9iud5RgPScQsuJJa4F';
const FROM_EMAIL = 'noreply@acessmyportal.com';

let currentUser = null;
let USERS = [];
let editingUserIdx = null;
let pendingPerms = {};
let activeContentBiz = 'biz1';
let activeUserBiz = null;
let pendingLoginUser = null;
let twoFACode = null;
let twoFAExpiry = null;
let countdownTimer = null;
