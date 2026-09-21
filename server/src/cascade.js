import { q, tx } from './db.js';
import { deleteFiles } from './storage.js';

/**
 * SQL Server rejects multiple cascade paths, so transactions, documents and
 * feedback are removed explicitly here, inside one transaction, and the
 * underlying files are deleted from storage (Blob or disk) afterwards.
 */

const names = (rows) => rows.map(r => r.file_name);

export async function deleteProject(id) {
  const files = await q.all('SELECT file_name FROM rz_documents WHERE project_id = ?', id);
  await tx(async t => {
    await t.run('DELETE FROM rz_documents WHERE project_id = ?', id);
    await t.run('DELETE FROM rz_feedback WHERE project_id = ?', id);
    await t.run('DELETE FROM rz_transactions WHERE project_id = ?', id);
    await t.run('DELETE FROM rz_projects WHERE id = ?', id); // cascades shares, items, contracts
  });
  await deleteFiles(names(files));
}

export async function deleteItem(id) {
  const files = await q.all('SELECT file_name FROM rz_documents WHERE item_id = ?', id);
  await tx(async t => {
    await t.run('DELETE FROM rz_documents WHERE item_id = ?', id);
    await t.run('DELETE FROM rz_feedback WHERE item_id = ?', id);
    await t.run('UPDATE rz_transactions SET item_id = NULL, contract_id = NULL WHERE item_id = ?', id);
    await t.run('UPDATE rz_transactions SET contract_id = NULL WHERE contract_id IN (SELECT id FROM rz_contracts WHERE item_id = ?)', id);
    await t.run('DELETE FROM rz_items WHERE id = ?', id); // cascades contracts
  });
  await deleteFiles(names(files));
}

export async function deleteContract(id) {
  const files = await q.all('SELECT file_name FROM rz_documents WHERE contract_id = ?', id);
  await tx(async t => {
    await t.run('DELETE FROM rz_documents WHERE contract_id = ?', id);
    await t.run('UPDATE rz_transactions SET contract_id = NULL WHERE contract_id = ?', id);
    await t.run('DELETE FROM rz_contracts WHERE id = ?', id);
  });
  await deleteFiles(names(files));
}

export async function deleteDocument(doc) {
  await q.run('DELETE FROM rz_documents WHERE id = ?', doc.id);
  await deleteFiles([doc.file_name]);
}
