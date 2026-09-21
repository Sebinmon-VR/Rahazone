import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { q } from '../db.js';
import { requireAuth, requireAdmin, canAccessProject, itemProjectId, contractProjectId } from '../auth.js';
import { deleteDocument } from '../cascade.js';
import { saveFile, openFile } from '../storage.js';

const r = Router();
r.use(requireAuth);

const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 25 * 1024 * 1024;

const ALLOWED = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

// Files are buffered in memory, then handed to storage.js (Blob or disk).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type. Allowed: PDF, images, Word, Excel, text.'));
  },
});

/** Resolve which project a document belongs to from whichever scope is set. */
async function resolveScope({ project_id, item_id, contract_id }) {
  if (contract_id) {
    const pid = await contractProjectId(Number(contract_id));
    if (!pid) return null;
    const c = await q.get('SELECT item_id FROM rz_contracts WHERE id = ?', Number(contract_id));
    return { project_id: pid, item_id: c.item_id, contract_id: Number(contract_id) };
  }
  if (item_id) {
    const pid = await itemProjectId(Number(item_id));
    return pid ? { project_id: pid, item_id: Number(item_id), contract_id: null } : null;
  }
  if (project_id && await q.get('SELECT 1 AS ok FROM rz_projects WHERE id = ?', Number(project_id))) {
    return { project_id: Number(project_id), item_id: null, contract_id: null };
  }
  return null;
}

r.post('/', requireAdmin, (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) {
        const msg = err.code === 'LIMIT_FILE_SIZE' ? `File is larger than ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB` : err.message;
        return res.status(400).json({ error: msg });
      }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const scope = await resolveScope(req.body);
      if (!scope) return res.status(400).json({ error: 'A valid project_id, item_id or contract_id is required' });

      const ext = path.extname(req.file.originalname).toLowerCase().slice(0, 10);
      const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
      await saveFile(fileName, req.file.buffer, req.file.mimetype);

      const info = await q.run(
        `INSERT INTO rz_documents (project_id, item_id, contract_id, title, category, file_name, original_name, mime_type, size, uploaded_by)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        scope.project_id, scope.item_id, scope.contract_id, req.body.title || req.file.originalname,
        req.body.category || 'other', fileName, req.file.originalname, req.file.mimetype, req.file.size, req.user.id);
      res.status(201).json(await q.get('SELECT * FROM rz_documents WHERE id = ?', info.lastInsertRowid));
    } catch (e) {
      next(e);
    }
  });
});

r.get('/:id/download', async (req, res) => {
  const doc = await q.get('SELECT * FROM rz_documents WHERE id = ?', Number(req.params.id));
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (!await canAccessProject(req.user, doc.project_id)) return res.status(403).json({ error: 'No access to this document' });
  const stream = await openFile(doc.file_name);
  if (!stream) return res.status(404).json({ error: 'File missing in storage' });
  const inline = req.query.inline === '1' && (doc.mime_type === 'application/pdf' || doc.mime_type?.startsWith('image/'));
  res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
  if (doc.size) res.setHeader('Content-Length', doc.size);
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(doc.original_name)}"`);
  stream.on('error', (e) => { console.error(e); if (!res.headersSent) res.status(500).end(); else res.end(); });
  stream.pipe(res);
});

r.delete('/:id', requireAdmin, async (req, res) => {
  const doc = await q.get('SELECT * FROM rz_documents WHERE id = ?', Number(req.params.id));
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  await deleteDocument(doc);
  res.json({ ok: true });
});

export default r;
