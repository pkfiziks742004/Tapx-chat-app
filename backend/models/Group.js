function createGroupModel(store) {
  return {
    listMine: (userId) => store.listGroups(userId),
    create: (payload) => store.createGroup(payload),
    listMemberIds: (groupId) => store.listGroupMemberIds(groupId),
    isMember: (userId, groupId) => store.isUserGroupMember(userId, groupId),

    listMessages: (userId, groupId, limit, opts) => store.listGroupMessages(userId, groupId, limit, opts),
    createMessage: (payload) => store.createGroupMessage(payload),
    createFile: (payload) => store.createGroupFileMessage(payload),
    deleteManyForMe: (payload) => store.deleteGroupMessagesForMe(payload),
    deleteManyForEveryone: (payload) => store.deleteGroupMessagesForEveryone(payload),
    markRead: (payload) => store.markGroupRead(payload),
    clearChat: (payload) => store.clearGroupChat(payload),

    uploadAttachment: (payload) => store.uploadAttachment(payload),
    createAttachmentSignedUrl: (payload) => store.createAttachmentSignedUrl(payload),
    removeAttachments: (payload) => store.removeAttachments(payload)
  };
}

module.exports = { createGroupModel };
