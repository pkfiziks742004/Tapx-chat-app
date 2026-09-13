function createCallModel(store) {
  return {
    list: (userId, opts) => store.listCallLogs(userId, opts),
    deleteForMe: ({ userId, callLogId }) => store.deleteCallLogForMe({ userId, callLogId }),
    clearForMe: (userId, opts) => store.clearCallLogsForMe(userId, opts)
  };
}

module.exports = { createCallModel };

