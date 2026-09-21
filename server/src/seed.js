// Seeds demo data. Run with: npm run seed   (safe to re-run: skips if projects exist)
import './env.js';
import bcrypt from 'bcryptjs';
import { initDb, closeDb, q } from './db.js';

await initDb();

if (await q.get('SELECT TOP 1 1 AS ok FROM rz_projects')) {
  console.log('Database already has projects; skipping seed.');
  await closeDb();
  process.exit(0);
}

const hash = (p) => bcrypt.hashSync(p, 10);
const user = async (name, email, pw, role, phone) =>
  (await q.run('INSERT INTO rz_users (name, email, password_hash, role, phone) VALUES (?,?,?,?,?)', name, email, hash(pw), role, phone)).lastInsertRowid;

const existingAdmin = await q.get("SELECT TOP 1 id FROM rz_users WHERE role='admin'");
if (!existingAdmin) await user('Administrator', 'admin@rahazone.com', 'admin123', 'admin', null);
const ahmed = (await q.get('SELECT id FROM rz_users WHERE email = ?', 'ahmed@example.com'))?.id
  ?? await user('Ahmed Al Mansoori', 'ahmed@example.com', 'user123', 'user', '+971 50 111 2222');
const sara = (await q.get('SELECT id FROM rz_users WHERE email = ?', 'sara@example.com'))?.id
  ?? await user('Sara Khan', 'sara@example.com', 'user123', 'user', '+971 55 333 4444');

const project = async (name, location, description, investment) =>
  (await q.run('INSERT INTO rz_projects (name, location, description, type, total_investment) VALUES (?,?,?,?,?)',
    name, location, description, 'building', investment)).lastInsertRowid;

const tower = await project('Al Noor Tower', 'Deira, Dubai', 'Six-storey commercial building with retail on the ground floor and offices above.', 12000000);
const plaza = await project('Marina Plaza', 'Dubai Marina', 'Retail plaza with 8 shop units and 4 studio apartments.', 8500000);

const share = (pid, uid, pct, inv) =>
  q.run('INSERT INTO rz_project_shares (project_id, user_id, share_percent, invested_amount) VALUES (?,?,?,?)', pid, uid, pct, inv);
await share(tower, ahmed, 60, 7200000);
await share(tower, sara, 40, 4800000);
await share(plaza, sara, 100, 8500000);

const item = async (pid, name, type, floor, area, rent, status) =>
  (await q.run('INSERT INTO rz_items (project_id, name, type, floor, area_sqft, expected_rent, status) VALUES (?,?,?,?,?,?,?)',
    pid, name, type, floor, area, rent, status)).lastInsertRowid;

const s1 = await item(tower, 'Shop G-01', 'shop', 'Ground', 850, 9000, 'rented');
const s2 = await item(tower, 'Shop G-02', 'shop', 'Ground', 620, 7000, 'rented');
await item(tower, 'Shop G-03', 'shop', 'Ground', 700, 7500, 'vacant');
const s3 = (await q.get('SELECT id FROM rz_items WHERE project_id = ? AND name = ?', tower, 'Shop G-03')).id;
const o1 = await item(tower, 'Office 201', 'office', '2', 1200, 11000, 'rented');
const o2 = await item(tower, 'Office 202', 'office', '2', 1100, 10000, 'maintenance');
const p1 = await item(plaza, 'Unit 1', 'shop', 'Ground', 500, 6000, 'rented');
const p2 = await item(plaza, 'Unit 2', 'shop', 'Ground', 500, 6000, 'vacant');
const a1 = await item(plaza, 'Studio A', 'apartment', '1', 450, 4000, 'rented');

const contract = async (iid, tenant, phone, email, idn, business, start, end, rent, deposit) =>
  (await q.run(`INSERT INTO rz_contracts (item_id, tenant_name, tenant_phone, tenant_email, tenant_id_number, business_name, start_date, end_date, monthly_rent, deposit)
         VALUES (?,?,?,?,?,?,?,?,?,?)`, iid, tenant, phone, email, idn, business, start, end, rent, deposit)).lastInsertRowid;

const c1 = await contract(s1, 'Rashid Trading LLC', '+971 4 222 3333', 'info@rashidtrading.ae', 'TL-88213', 'Rashid Mobile Shop', '2026-01-01', '2026-12-31', 9000, 18000);
const c2 = await contract(s2, 'Fatima Hassan', '+971 50 987 6543', 'fatima@example.com', '784-1990-1234567-1', 'Bloom Flowers', '2025-10-01', '2026-09-30', 7000, 14000);
const c3 = await contract(o1, 'Nexa Consulting FZE', '+971 4 555 1212', 'admin@nexa.ae', 'FZ-4471', 'Nexa Consulting', '2026-03-01', '2027-02-28', 11000, 22000);
const c4 = await contract(p1, 'Cafe Aroma', '+971 52 111 9999', 'hello@cafearoma.ae', 'TL-90210', 'Cafe Aroma', '2026-02-01', '2027-01-31', 6000, 12000);
const c5 = await contract(a1, 'John Peterson', '+971 56 444 5555', 'john.p@example.com', 'P-A1234567', null, '2026-01-15', '2027-01-14', 4000, 4000);

const tx = (pid, iid, cid, type, category, amount, date, desc) =>
  q.run('INSERT INTO rz_transactions (project_id, item_id, contract_id, type, category, amount, [date], description) VALUES (?,?,?,?,?,?,?,?)',
    pid, iid, cid, type, category, amount, date, desc);

const months = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
for (const m of months) {
  await tx(tower, s1, c1, 'income', 'rent', 9000, `${m}-05`, 'Monthly rent - Shop G-01');
  await tx(tower, s2, c2, 'income', 'rent', 7000, `${m}-05`, 'Monthly rent - Shop G-02');
  await tx(tower, o1, c3, 'income', 'rent', 11000, `${m}-05`, 'Monthly rent - Office 201');
  await tx(tower, null, null, 'expense', 'maintenance', 2500, `${m}-10`, 'Cleaning & general maintenance');
  await tx(tower, null, null, 'expense', 'utilities', 1800, `${m}-12`, 'Common area electricity & water');
  await tx(plaza, p1, c4, 'income', 'rent', 6000, `${m}-03`, 'Monthly rent - Unit 1');
  await tx(plaza, a1, c5, 'income', 'rent', 4000, `${m}-03`, 'Monthly rent - Studio A');
  await tx(plaza, null, null, 'expense', 'management', 1200, `${m}-15`, 'Property management fee');
}
await tx(tower, o2, null, 'expense', 'renovation', 15000, '2026-06-20', 'AC replacement in Office 202');
await tx(tower, null, null, 'expense', 'insurance', 9500, '2026-04-01', 'Annual building insurance');
await tx(plaza, null, null, 'expense', 'municipality', 4200, '2026-05-18', 'Municipality fees');

const fb = (uid, pid, iid, msg, reply) =>
  q.run('INSERT INTO rz_feedback (user_id, project_id, item_id, message, admin_reply, replied_at) VALUES (?,?,?,?,?,?)',
    uid, pid, iid, msg, reply, reply ? new Date() : null);
await fb(ahmed, tower, s3, 'Shop G-03 has been vacant for a while. Can we consider lowering the asking rent to attract a tenant?', 'Agreed. We have reduced the listing to 6,800 and two viewings are scheduled next week.');
await fb(sara, tower, null, 'Please share the insurance renewal document when available.', null);
await fb(sara, plaza, p2, 'Is there any update on Unit 2? A friend of mine may be interested in leasing it.', null);

console.log('Seed complete.');
console.log('  Admin: admin@rahazone.com / admin123');
console.log('  Users: ahmed@example.com / user123, sara@example.com / user123');
await closeDb();
