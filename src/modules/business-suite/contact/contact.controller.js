const { created, success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const contactService = require('./contact.service');

const create = asyncHandler(async (req, res) => {
  const contact = await contactService.createContact({
    ...req.body,
    partyId: req.params.partyId,
  });
  return created(res, contact, 'Kontak berhasil ditambahkan');
});

const list = asyncHandler(async (req, res) => {
  const result = await contactService.listContacts(req.params.partyId, req.query);
  return success(res, result.items, 'OK', 200, result.meta);
});

const get = asyncHandler(async (req, res) => {
  const contact = await contactService.getContact(req.params.contactId, req.params.partyId);
  return success(res, contact);
});

const update = asyncHandler(async (req, res) => {
  const updated = await contactService.updateContact(req.params.contactId, req.params.partyId, req.body);
  return success(res, updated, 'Kontak diperbarui');
});

const remove = asyncHandler(async (req, res) => {
  await contactService.deleteContact(req.params.contactId, req.params.partyId);
  return success(res, null, 'Kontak dihapus');
});

module.exports = { create, list, get, update, remove };
