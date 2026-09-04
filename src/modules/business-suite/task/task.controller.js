const { created, success } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const service = require('./task.service');

const create = asyncHandler(async (req, res) => {
  const task = await service.createTask({ ...req.body, partyId: req.params.partyId, createdBy: req.profile.id });
  return created(res, task, 'Task berhasil dibuat');
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listTasks(req.params.partyId, req.query);
  return success(res, result.items, 'OK', 200, result.meta);
});

const get = asyncHandler(async (req, res) => {
  const task = await service.getTask(req.params.taskId, req.params.partyId);
  return success(res, task);
});

const update = asyncHandler(async (req, res) => {
  const updated = await service.updateTask(req.params.taskId, req.params.partyId, req.body);
  return success(res, updated, 'Task diperbarui');
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteTask(req.params.taskId, req.params.partyId);
  return success(res, null, 'Task dihapus');
});

module.exports = { create, list, get, update, remove };
