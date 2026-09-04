const { created, success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const service = require('./agenda.service');

const create = asyncHandler(async (req, res) => {
  const agenda = await service.createAgenda({ ...req.body, partyId: req.params.partyId, createdBy: req.profile.id });
  return created(res, agenda, 'Agenda berhasil dibuat');
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listAgenda(req.params.partyId, req.query);
  return success(res, result.items, 'OK', 200, result.meta);
});

const get = asyncHandler(async (req, res) => {
  const agenda = await service.getAgenda(req.params.agendaId, req.params.partyId);
  return success(res, agenda);
});

const update = asyncHandler(async (req, res) => {
  const updated = await service.updateAgenda(req.params.agendaId, req.params.partyId, req.body);
  return success(res, updated, 'Agenda diperbarui');
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteAgenda(req.params.agendaId, req.params.partyId);
  return success(res, null, 'Agenda dihapus');
});

module.exports = { create, list, get, update, remove };
