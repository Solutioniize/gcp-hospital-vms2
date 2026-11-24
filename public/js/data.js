/* Sample data for the demo. Every name, number and document here is fictional. */
window.VMS_DATA = (function () {
  const VERSION = 3;

  const CATEGORIES = {
    pharma:   { name: 'Pharmaceuticals', risk: 'High', docs: ['Drug wholesale licence (Form 20B/21B)', 'Manufacturer authorisation letter', 'Cold-chain SOP'] },
    device:   { name: 'Medical devices & IVD', risk: 'High', docs: ['CDSCO sale licence', 'OEM authorisation letter'] },
    capital:  { name: 'Capital equipment & AMC', risk: 'High', docs: ['OEM authorisation', 'AERB licence (radiation equipment)', 'AMC/CMC agreement with uptime SLA'] },
    clinical: { name: 'Clinical outsourced services', risk: 'High', docs: ['SPCB authorisation (BMW Rules 2016)', 'Service level agreement'] },
    it:       { name: 'IT & data processors', risk: 'Critical', docs: ['ISO 27001 certificate or audit report', 'Data hosting location statement', 'Sub-processor list'] },
    general:  { name: 'General & facility', risk: 'Medium', docs: ['Trade licence', 'PF & ESI registration'] }
  };

  const COMMON_DOCS = ['PAN', 'GST registration (verified on GST portal)', 'Bank verification (penny-drop)', 'Vendor agreement & code of conduct'];

  const ROLES = {
    pexec:    { name: 'Purchase executive', who: 'Ravi Kumar', perms: ['createVendor', 'raisePO'], poLimit: 0, payLimit: 0 },
    pmgr:     { name: 'Purchase manager', who: 'Anita Desai', perms: ['createVendor', 'approveVendor', 'raisePO', 'rate', 'renew'], poLimit: 50000, payLimit: 0 },
    stores:   { name: 'Stores / pharmacy', who: 'Joseph Mathew', perms: ['grn', 'rate'], poLimit: 0, payLimit: 0 },
    accounts: { name: 'Accounts executive', who: 'Meera Iyer', perms: ['invoice', 'preparePay', 'unmask'], poLimit: 0, payLimit: 0 },
    finance:  { name: 'Finance manager / CFO', who: 'Suresh Rao', perms: ['approvePay', 'unmask'], poLimit: 500000, payLimit: 1000000 },
    quality:  { name: 'Quality / NABH coordinator', who: 'Dr. Kavita Nair', perms: ['rate', 'nabh'], poLimit: 0, payLimit: 0 },
    ceo:      { name: 'CEO / Medical Superintendent', who: 'Dr. Arjun Menon', perms: ['approveVendor', 'approvePay', 'renew'], poLimit: Infinity, payLimit: Infinity },
    privacy:  { name: 'Privacy officer', who: 'Farah Khan', perms: ['privacy', 'unmask'], poLimit: 0, payLimit: 0 }
  };

  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(n) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); }
  function quarters() {
    const out = []; const d = new Date();
    let q = Math.floor(d.getMonth() / 3) - 1, y = d.getFullYear();
    for (let i = 0; i < 4; i++) { if (q < 0) { q = 3; y--; } out.unshift('Q' + (q + 1) + ' ' + y); q--; }
    return out;
  }
  // four quarters of scores drifting by `step` per quarter, ending at the base values
  function sc(base, step, critLast) {
    const qs = quarters(); const j = [2, -1, 1, 0];
    return qs.map((q, i) => {
      const k = 3 - i; const o = { q };
      ['quality', 'delivery', 'price', 'compliance', 'service'].forEach((d, n) => {
        o[d] = Math.max(20, Math.min(100, base[n] - step * k + j[(i + n) % 4]));
      });
      o.critical = !!(critLast && i === 3);
      return o;
    });
  }
  function docs(cat, overrides) {
    const list = COMMON_DOCS.map((n, i) => ({ name: n, number: ['ABCPK', '29ABC', 'HDFC', 'VA-'][i] + Math.floor(1000 + Math.random() * 8999), expiry: i === 3 ? addDays(300) : null, verified: true }));
    CATEGORIES[cat].docs.forEach((n, i) => list.push({ name: n, number: 'L-' + (4100 + i * 37 + Math.floor(Math.random() * 30)), expiry: addDays(120 + i * 60), verified: true }));
    (overrides || []).forEach(o => { const d = list.find(x => x.name === o.name); if (d) Object.assign(d, o); });
    return list;
  }

  function seed() {
    const V = (o) => Object.assign({
      status: 'Active', msme: '', paymentTerm: 30, turnoverAbove5cr: true, handlesPersonalData: false,
      dpa: null, empanelledOn: addDays(-700), contractEnd: addDays(200), evaluation: null
    }, o);

    const vendors = [
      V({ id: 'V01', code: 'VEN-PH-0001', name: 'Medline Pharma Distributors', category: 'pharma', city: 'Bengaluru', contact: { name: 'Prakash Shetty', email: 'orders@medline-demo.in', phone: '98450 11223' }, gstin: '29AAKCM1234F1Z5', pan: 'AAKCM1234F', bank: { acc: '50200012345678', ifsc: 'HDFC0001234' }, msme: 'Small', paymentTerm: 45, spend: 182.4, docs: docs('pharma'), scores: sc([92, 90, 84, 95, 88], 1) }),
      V({ id: 'V02', code: 'VEN-PH-0002', name: 'Sanjeevani Drug House', category: 'pharma', city: 'Mysuru', contact: { name: 'Lakshmi Rao', email: 'sales@sanjeevani-demo.in', phone: '98860 44551' }, gstin: '29AAFFS5521K1Z2', pan: 'AAFFS5521K', bank: { acc: '00011020004567', ifsc: 'SBIN0000812' }, msme: 'Micro', paymentTerm: 15, turnoverAbove5cr: false, spend: 64.9, docs: docs('pharma', [{ name: 'Drug wholesale licence (Form 20B/21B)', expiry: addDays(19) }]), scores: sc([80, 74, 78, 82, 76], 1) }),
      V({ id: 'V03', code: 'VEN-PH-0003', name: 'Nova Lifesciences', category: 'pharma', city: 'Hyderabad', status: 'Pending verification', contact: { name: 'Imran Siddiqui', email: 'kam@nova-demo.in', phone: '99000 77810' }, gstin: '36AAICN7788Q1Z9', pan: 'AAICN7788Q', bank: { acc: '91801002233441', ifsc: 'UTIB0000099' }, spend: 0, empanelledOn: null, docs: docs('pharma', [{ name: 'Cold-chain SOP', verified: false }, { name: 'Manufacturer authorisation letter', verified: false }]), scores: [] }),
      V({ id: 'V04', code: 'VEN-MD-0001', name: 'Apex Surgicals', category: 'device', city: 'Chennai', contact: { name: 'Vignesh R', email: 'tenders@apexsurg-demo.in', phone: '94440 32109' }, gstin: '33AAGCA4410M1Z1', pan: 'AAGCA4410M', bank: { acc: '61002233001', ifsc: 'ICIC0006100' }, spend: 121.7, docs: docs('device'), scores: sc([90, 88, 82, 92, 86], 0) }),
      V({ id: 'V05', code: 'VEN-MD-0002', name: 'OrthoLine Implants', category: 'device', city: 'Pune', contact: { name: 'Sameer Joshi', email: 'ortho@ortholine-demo.in', phone: '98220 66410' }, gstin: '27AABCO9090P1Z4', pan: 'AABCO9090P', bank: { acc: '30011223344', ifsc: 'KKBK0000721' }, spend: 88.2, docs: docs('device', [{ name: 'CDSCO sale licence', expiry: addDays(-6) }]), scores: sc([68, 62, 70, 58, 66], -1) }),
      V({ id: 'V06', code: 'VEN-MD-0003', name: 'MediTech Diagnostics Reagents', category: 'device', city: 'Kochi', status: 'Pending approval', contact: { name: 'Anoop Varghese', email: 'ivd@meditech-demo.in', phone: '97450 22018' }, gstin: '32AAFCM3311J1Z7', pan: 'AAFCM3311J', bank: { acc: '12340100009988', ifsc: 'FDRL0001234' }, msme: 'Small', paymentTerm: 30, spend: 0, empanelledOn: null, docs: docs('device'), scores: [], evaluation: { quality: 34, price: 24, delivery: 12, references: 11 } }),
      V({ id: 'V07', code: 'VEN-CE-0001', name: 'Visionmed Imaging Services', category: 'capital', city: 'Bengaluru', contact: { name: 'Rohit Bansal', email: 'service@visionmed-demo.in', phone: '98451 90021' }, gstin: '29AACCV6655B1Z8', pan: 'AACCV6655B', bank: { acc: '50100223344556', ifsc: 'HDFC0000240' }, spend: 146.0, contractEnd: addDays(52), docs: docs('capital'), scores: sc([84, 80, 76, 88, 72], 1) }),
      V({ id: 'V08', code: 'VEN-CE-0002', name: 'Trident Biomedical Engineering', category: 'capital', city: 'Mangaluru', status: 'Watch', contact: { name: 'Deepak Pai', email: 'amc@trident-demo.in', phone: '99860 11450' }, gstin: '29AAJFT2201H1Z3', pan: 'AAJFT2201H', bank: { acc: '00881100223', ifsc: 'CNRB0000088' }, msme: 'Small', paymentTerm: 30, spend: 38.5, docs: docs('capital', [{ name: 'AMC/CMC agreement with uptime SLA', expiry: addDays(41) }]), scores: sc([66, 58, 72, 70, 50], 2) }),
      V({ id: 'V09', code: 'VEN-CS-0001', name: 'GreenCycle Waste Management', category: 'clinical', city: 'Bengaluru', contact: { name: 'Nisha Gowda', email: 'cbwtf@greencycle-demo.in', phone: '96320 55117' }, gstin: '29AADCG4567L1Z6', pan: 'AADCG4567L', bank: { acc: '20022033044', ifsc: 'BARB0BANGAL' }, spend: 22.8, docs: docs('clinical'), scores: sc([94, 96, 86, 97, 90], 0) }),
      V({ id: 'V10', code: 'VEN-CS-0002', name: 'Precision Reference Labs', category: 'clinical', city: 'Bengaluru', handlesPersonalData: true, dpa: { signed: true, date: addDays(-210), hosting: 'Mumbai, India', subprocessors: 'Courier partner (sample pickup)', lastReview: addDays(-150), risk: 'High' }, contact: { name: 'Dr. Sunil Hegde', email: 'b2b@precisionlabs-demo.in', phone: '98804 90901' }, gstin: '29AAECP7722N1Z0', pan: 'AAECP7722N', bank: { acc: '777000112233', ifsc: 'YESB0000777' }, spend: 41.3, docs: docs('clinical'), scores: sc([82, 78, 74, 84, 80], 1) }),
      V({ id: 'V11', code: 'VEN-IT-0001', name: 'CareCloud HIS Solutions', category: 'it', city: 'Bengaluru', handlesPersonalData: true, dpa: { signed: true, date: addDays(-400), hosting: 'Mumbai & Hyderabad, India', subprocessors: 'Cloud provider (India region), SMS gateway', lastReview: addDays(-330), risk: 'Critical' }, contact: { name: 'Kiran Patil', email: 'accounts@carecloud-demo.in', phone: '80470 11000' }, gstin: '29AAHCC8899R1Z2', pan: 'AAHCC8899R', bank: { acc: '50200099887766', ifsc: 'HDFC0000500' }, spend: 58.0, contractEnd: addDays(84), docs: docs('it'), scores: sc([78, 82, 70, 76, 74], 0) }),
      V({ id: 'V12', code: 'VEN-IT-0002', name: 'DataVault Backup Services', category: 'it', city: 'Noida', status: 'Pending verification', handlesPersonalData: true, dpa: { signed: false, date: null, hosting: 'Not stated', subprocessors: 'Not provided', lastReview: null, risk: 'Critical' }, contact: { name: 'Aman Verma', email: 'sales@datavault-demo.in', phone: '99100 22004' }, gstin: '09AAKCD1122E1Z5', pan: 'AAKCD1122E', bank: { acc: '40011223399', ifsc: 'ICIC0000400' }, spend: 0, empanelledOn: null, docs: docs('it', [{ name: 'Sub-processor list', verified: false }]), scores: [] }),
      V({ id: 'V13', code: 'VEN-GF-0001', name: 'Spotless Facility Services', category: 'general', city: 'Bengaluru', status: 'Watch', contact: { name: 'Manjunath K', email: 'ops@spotless-demo.in', phone: '90080 33120' }, gstin: '29AAPFS3030C1Z1', pan: 'AAPFS3030C', bank: { acc: '11220033445', ifsc: 'SBIN0040312' }, msme: 'Micro', paymentTerm: 15, turnoverAbove5cr: false, spend: 72.6, docs: docs('general', [{ name: 'PF & ESI registration', expiry: addDays(9) }]), scores: sc([62, 64, 80, 60, 58], -1) }),
      V({ id: 'V14', code: 'VEN-GF-0002', name: 'Annapurna Dietary Services', category: 'general', city: 'Bengaluru', contact: { name: 'Geetha Murthy', email: 'kitchen@annapurna-demo.in', phone: '98451 00777' }, gstin: '29AAKFA6060D1Z9', pan: 'AAKFA6060D', bank: { acc: '30300400500', ifsc: 'KARB0000303' }, msme: 'Small', paymentTerm: 30, turnoverAbove5cr: false, spend: 49.9, docs: docs('general', [{ name: 'Trade licence', expiry: addDays(73) }]), scores: sc([80, 76, 74, 78, 72], 1) }),
      V({ id: 'V15', code: 'VEN-GF-0003', name: 'Oxyline Medical Gases', category: 'general', city: 'Tumakuru', contact: { name: 'Ramesh Babu', email: 'supply@oxyline-demo.in', phone: '94481 70707' }, gstin: '29AACCO1212G1Z4', pan: 'AACCO1212G', bank: { acc: '67890012345', ifsc: 'UBIN0567890' }, spend: 35.4, docs: docs('general'), scores: sc([93, 95, 82, 90, 89], 0) }),
      V({ id: 'V16', code: 'VEN-GF-0004', name: 'Sterling Stationers', category: 'general', city: 'Bengaluru', status: 'Watch', contact: { name: 'Faisal Ahmed', email: 'sterling@sterling-demo.in', phone: '98860 00123' }, gstin: '29AAQPS4444H1Z6', pan: 'AAQPS4444H', bank: { acc: '11002200330', ifsc: 'CNRB0001100' }, msme: 'Micro', paymentTerm: 15, turnoverAbove5cr: false, spend: 6.1, docs: docs('general'), scores: sc([52, 40, 60, 66, 48], -1, true) })
    ];

    const P = (id, vendorId, d, desc, qty, rate, status, extra) => Object.assign({ id, vendorId, date: addDays(d), desc, qty, rate, amount: qty * rate, status, raisedBy: 'Purchase executive', approvedBy: status === 'Pending approval' ? null : 'Purchase manager', expected: addDays(d + 7) }, extra || {});
    const pos = [
      P('PO-0101', 'V01', -40, 'Inj. Ceftriaxone 1g vials', 2000, 38, 'Closed'),
      P('PO-0102', 'V04', -35, 'Sterile surgical gloves (pairs)', 10000, 21, 'Closed'),
      P('PO-0103', 'V09', -32, 'Biomedical waste collection — monthly', 1, 185000, 'Closed', { approvedBy: 'Finance manager / CFO' }),
      P('PO-0104', 'V02', -24, 'Tab. Paracetamol 650mg (strips)', 6000, 14, 'Invoiced'),
      P('PO-0105', 'V05', -22, 'Locking compression plates', 40, 6400, 'Invoiced', { approvedBy: 'Finance manager / CFO' }),
      P('PO-0106', 'V14', -18, 'Patient meals — monthly', 1, 312000, 'Invoiced', { approvedBy: 'Finance manager / CFO' }),
      P('PO-0107', 'V13', -16, 'Housekeeping manpower — monthly', 1, 486000, 'Invoiced', { approvedBy: 'Finance manager / CFO' }),
      P('PO-0108', 'V15', -12, 'Medical oxygen cylinders (D-type refills)', 220, 410, 'Received'),
      P('PO-0109', 'V01', -9, 'Inj. Meropenem 1g vials', 600, 72, 'Received'),
      P('PO-0110', 'V07', -6, 'CT scanner preventive maintenance visit', 1, 95000, 'Approved', { approvedBy: 'Finance manager / CFO' }),
      P('PO-0111', 'V04', -4, 'IV cannula 20G', 5000, 9, 'Approved'),
      P('PO-0112', 'V10', -2, 'Outsourced special tests — November batch', 1, 128000, 'Pending approval'),
      P('PO-0113', 'V01', -1, 'Inj. Insulin glargine pens', 300, 410, 'Pending approval'),
      P('PO-0114', 'V08', -1, 'Ventilator AMC — quarterly instalment', 1, 640000, 'Pending approval')
    ];

    const G = (id, poId, d, rec, rej, onTime, shelf) => ({ id, poId, date: addDays(d), qtyReceived: rec, qtyRejected: rej, onTime, shelfLifeMonths: shelf, by: 'Stores / pharmacy' });
    const grns = [
      G('GRN-0201', 'PO-0101', -33, 2000, 0, true, 22),
      G('GRN-0202', 'PO-0102', -28, 10000, 120, true, 36),
      G('GRN-0203', 'PO-0103', -26, 1, 0, true, null),
      G('GRN-0204', 'PO-0104', -15, 6000, 0, false, 5),
      G('GRN-0205', 'PO-0105', -13, 36, 2, false, null),
      G('GRN-0206', 'PO-0106', -11, 1, 0, true, null),
      G('GRN-0207', 'PO-0107', -10, 1, 0, true, null),
      G('GRN-0208', 'PO-0108', -5, 220, 0, true, null),
      G('GRN-0209', 'PO-0109', -3, 600, 0, true, 18)
    ];

    const I = (id, poId, vendorId, number, d, qty, rate, irn, status, paidOn) => ({ id, poId, vendorId, number, date: addDays(d), qty, rate, irn, status, paidOn: paidOn != null ? addDays(paidOn) : null });
    const invoices = [
      I('INV-0301', 'PO-0101', 'V01', 'MPD/2425/8812', -32, 2000, 38, 'IRN-8f2a…c41', 'Paid', -6),
      I('INV-0302', 'PO-0102', 'V04', 'AS/INV/1190', -27, 9880, 21, 'IRN-21bd…9e0', 'Paid', -4),
      I('INV-0303', 'PO-0103', 'V09', 'GC/OCT/221', -25, 1, 185000, 'IRN-77c1…0aa', 'Paid', -8),
      I('INV-0304', 'PO-0104', 'V02', 'SDH-4471', -14, 6000, 14, '', 'Prepared', null),
      I('INV-0305', 'PO-0105', 'V05', 'OL/26/0932', -12, 40, 6650, 'IRN-5e0d…77b', 'Entered', null),
      I('INV-0306', 'PO-0106', 'V14', 'ADS/NOV/18', -10, 1, 312000, '', 'Prepared', null),
      I('INV-0307', 'PO-0107', 'V13', 'SFS/1124', -9, 1, 486000, '', 'Entered', null)
    ];

    const incidents = [
      { id: 'INC-001', vendorId: 'V11', title: 'Discharge summaries e-mailed to wrong ward address', detected: new Date(Date.now() - 30 * 3600e3).toISOString(), records: 14, hisRef: 'HIS-EVT-55821', boardIntimated: true, reportFiled: false, individualsNotified: false, closed: false }
    ];

    const audit = [
      { ts: new Date(Date.now() - 2 * 3600e3).toISOString(), role: 'Purchase executive', action: 'Raised purchase order', target: 'PO-0113' },
      { ts: new Date(Date.now() - 5 * 3600e3).toISOString(), role: 'Stores / pharmacy', action: 'Recorded goods receipt', target: 'GRN-0209' },
      { ts: new Date(Date.now() - 26 * 3600e3).toISOString(), role: 'Privacy officer', action: 'Intimated Data Protection Board', target: 'INC-001' },
      { ts: new Date(Date.now() - 50 * 3600e3).toISOString(), role: 'Accounts executive', action: 'Prepared payment', target: 'INV-0306' }
    ];

    return { version: VERSION, vendors, pos, grns, invoices, incidents, audit, stockouts: { events: 3, indents: 212 }, seq: 120 };
  }

  return { VERSION, CATEGORIES, COMMON_DOCS, ROLES, seed, addDays, quarters };
})();
